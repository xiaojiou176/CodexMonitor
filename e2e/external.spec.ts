import { expect, test, type Page, type Request, type Response } from "@playwright/test";

const realExternalUrl = process.env.REAL_EXTERNAL_URL?.trim();
const MAX_NAVIGATION_ATTEMPTS = 2;
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type FailureCategory = "network_or_environment" | "business_logic";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

function classifyFailure(error: unknown, statusHint?: number | null): {
  category: FailureCategory;
  retryable: boolean;
  reason: string;
} {
  const message = toErrorMessage(error).toLowerCase();

  if (typeof statusHint === "number") {
    if (statusHint >= 500) {
      return {
        category: "network_or_environment",
        retryable: true,
        reason: `upstream status ${statusHint}`,
      };
    }
    if (statusHint >= 400) {
      return {
        category: "business_logic",
        retryable: false,
        reason: `business/http status ${statusHint}`,
      };
    }
  }

  if (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("net::err") ||
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("eai_again") ||
    message.includes("dns") ||
    message.includes("ssl") ||
    message.includes("certificate")
  ) {
    return {
      category: "network_or_environment",
      retryable: true,
      reason: "network/infra transient failure",
    };
  }

  return {
    category: "business_logic",
    retryable: false,
    reason: "assertion or product-behavior failure",
  };
}

function classifyNavigationResult(status: number | null, error: unknown) {
  return classifyFailure(error, status);
}

async function gotoWithRetry(page: Page, url: string) {
  let lastError: unknown = null;
  let lastStatus: number | null = null;
  for (let attempt = 1; attempt <= MAX_NAVIGATION_ATTEMPTS; attempt += 1) {
    try {
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      lastStatus = response?.status() ?? null;
      if (response && response.status() < 500) {
        return response;
      }
      lastError = new Error(`unexpected status: ${response?.status() ?? "no response"}`);
    } catch (error) {
      lastError = error;
      lastStatus = null;
    }

    const classification = classifyNavigationResult(lastStatus, lastError);
    const hasMoreAttempts = attempt < MAX_NAVIGATION_ATTEMPTS;
    console.warn(
      `[external-e2e][retry] attempt=${attempt}/${MAX_NAVIGATION_ATTEMPTS} category=${classification.category} retryable=${classification.retryable} next_retry=${hasMoreAttempts && classification.retryable} reason=${classification.reason}`,
    );

    if (!classification.retryable) {
      break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("navigation failed");
}

test.describe("external integration (optional)", () => {
  test("can visit configured external URL with stable signals", async ({ page }) => {
    if (!realExternalUrl) {
      console.log(
        "[external-e2e] REAL_EXTERNAL_URL not configured; optional real external checks are bypassed.",
      );
      return;
    }

    const externalOrigin = new URL(realExternalUrl).origin;
    const capturedResponses: Response[] = [];
    const mutatingRequests: Array<{ method: string; url: string }> = [];

    const onResponse = (response: Response) => {
      capturedResponses.push(response);
    };

    const onRequest = (request: Request) => {
      const requestUrl = request.url();
      if (!requestUrl.startsWith(externalOrigin)) {
        return;
      }
      const method = request.method().toUpperCase();
      if (MUTATING_METHODS.has(method)) {
        mutatingRequests.push({ method, url: requestUrl });
      }
    };

    page.on("response", onResponse);
    page.on("request", onRequest);

    try {
      const response = await gotoWithRetry(page, realExternalUrl);

      expect(response).toBeTruthy();
      expect(response?.ok() ?? false).toBeTruthy();
      expect(response?.status() ?? 0).toBeLessThan(400);

      await page.waitForLoadState("load");
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {
        // Some external pages keep long polling/websocket connections open.
      });
      await expect(page.locator("body")).toBeVisible();

      await expect
        .poll(async () => {
          const readyState = await page.evaluate(() => document.readyState);
          return readyState === "interactive" || readyState === "complete";
        })
        .toBeTruthy();

      await expect
        .poll(async () => {
          const stableTextLength = await page.evaluate(
            () => (document.body?.innerText ?? "").trim().length,
          );
          return stableTextLength;
        })
        .toBeGreaterThan(0);

      await expect
        .poll(async () => {
          const title = await page.title();
          return title.trim().length;
        })
        .toBeGreaterThan(0);

      await expect
        .poll(() => capturedResponses.filter((item) => item.status() < 500).length)
        .toBeGreaterThan(0);

      const interactiveLocator = page.locator(
        "button:visible, a[href]:visible, input:visible, textarea:visible, select:visible, [role='button']:visible, [tabindex]:visible",
      );
      const interactiveCount = await interactiveLocator.count();
      expect(interactiveCount).toBeGreaterThan(0);
      const maxProbe = Math.min(interactiveCount, 10);
      await expect
        .poll(async () => {
          for (let i = 0; i < maxProbe; i += 1) {
            const candidate = interactiveLocator.nth(i);
            try {
              await candidate.click({ trial: true, timeout: 1500 });
              return true;
            } catch (error) {
              const message = toErrorMessage(error);
              console.warn(
                `[external-e2e][interactive-probe] traceId=n/a requestId=n/a status=probe-failed code=trial-click-failed candidate=${i} reason=${message}`,
              );
              // Continue probing until one element is actually actionable.
            }
          }
          return false;
        })
        .toBeTruthy();
      expect(mutatingRequests).toEqual([]);
      console.log(
        "[external-e2e][teardown] idempotency check passed: no mutating requests detected.",
      );
    } catch (error) {
      const classification = classifyFailure(error);
      console.error(
        `[external-e2e][root-cause] category=${classification.category} retryable=${classification.retryable} reason=${classification.reason} message=${toErrorMessage(error)}`,
      );
      throw error;
    } finally {
      page.off("response", onResponse);
      page.off("request", onRequest);
      await page.context().clearCookies();
      await page.context().clearPermissions();
      await page
        .evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
        })
        .catch(() => {
          // Ignore storage cleanup failures on about:blank or cross-origin transitions.
        });
      console.log("[external-e2e][teardown] browser state cleanup completed.");
    }
  });
});
