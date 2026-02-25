import { expect, test, type Page } from "@playwright/test";

const realExternalUrl = process.env.REAL_EXTERNAL_URL?.trim();
const MAX_NAVIGATION_ATTEMPTS = 3;

async function gotoWithRetry(page: Page, url: string) {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_NAVIGATION_ATTEMPTS; attempt += 1) {
    try {
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      if (response && response.status() < 500) {
        return response;
      }
      lastError = new Error(`unexpected status: ${response?.status() ?? "no response"}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("navigation failed after retries");
}

test.describe("external integration (optional)", () => {
  test("can visit configured external URL with stable signals", async ({ page }) => {
    if (!realExternalUrl) {
      console.log(
        "[external-e2e] REAL_EXTERNAL_URL not configured; optional real external checks are bypassed.",
      );
      return;
    }

    const capturedResponses = [];
    page.on("response", (response) => {
      capturedResponses.push(response);
    });

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

    const interactiveLocator = page
      .locator(
        "button:visible, a[href]:visible, input:visible, textarea:visible, select:visible, [role='button']:visible, [tabindex]:visible",
      )
      .first();
    const interactiveCount = await interactiveLocator.count();
    expect(interactiveCount).toBeGreaterThan(0);
    await expect
      .poll(async () => {
        try {
          await interactiveLocator.click({ trial: true, timeout: 5000 });
          return true;
        } catch {
          return false;
        }
      })
      .toBeTruthy();
  });
});
