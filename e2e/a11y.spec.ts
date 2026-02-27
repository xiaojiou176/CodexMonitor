import { expect, test } from "@playwright/test";
import type { TestInfo } from "@playwright/test";
import type { Locator } from "@playwright/test";
import { formatViolations, runA11yAudit } from "./helpers/a11y";
import { installUiStabilityMocks } from "./helpers/interactions";

const BLOCKING_IMPACTS = new Set(["critical", "serious"]);
const REPORTABLE_IMPACTS = new Set(["critical", "serious"]);

function toBlockingViolations(violations: Awaited<ReturnType<typeof runA11yAudit>>["violations"]) {
  return violations.filter((violation) => BLOCKING_IMPACTS.has(violation.impact));
}

function toReportableViolations(violations: Awaited<ReturnType<typeof runA11yAudit>>["violations"]) {
  return violations.filter((violation) => REPORTABLE_IMPACTS.has(violation.impact));
}

async function attachA11yReport(
  testInfo: TestInfo,
  surface: string,
  violations: Awaited<ReturnType<typeof runA11yAudit>>["violations"],
) {
  const reportBody = [
    `surface=${surface}`,
    `blocking_policy=critical-and-serious`,
    `violations=${violations.length}`,
    formatViolations(violations),
  ].join("\n");

  await testInfo.attach(`a11y-${surface}-critical-serious-report`, {
    body: reportBody,
    contentType: "text/plain",
  });
}

async function assertVisiblePrecondition(
  locator: Locator,
  testInfo: TestInfo,
  surface: string,
  message: string,
) {
  const visible = await locator.isVisible().catch(() => false);
  await testInfo.attach(`a11y-${surface}-precondition`, {
    body: `surface=${surface}\nvisible=${String(visible)}\nmessage=${message}`,
    contentType: "text/plain",
  });
  await expect(locator, message).toBeVisible();
}

test("a11y: home page blocks on critical and serious axe violations", async ({ page }, testInfo) => {
  await installUiStabilityMocks(page);
  await page.goto("/");

  const homeMarker = page.getByText("Let's build").first();
  await assertVisiblePrecondition(
    homeMarker,
    testInfo,
    "home",
    "Home page core marker must be visible for a11y gate.",
  );

  const report = await runA11yAudit(page);
  const reportableViolations = toReportableViolations(report.violations);
  const blockingViolations = toBlockingViolations(report.violations);
  await attachA11yReport(testInfo, "home", reportableViolations);

  await expect(report.passesCount).toBeGreaterThan(0);
  expect(
    blockingViolations,
    `A11y gate failed on home page (blocking=critical+serious):\n${formatViolations(blockingViolations)}`,
  ).toEqual([]);
});

test("a11y: sidebar interaction surface blocks on critical and serious axe violations", async ({ page }, testInfo) => {
  await installUiStabilityMocks(page);
  await page.goto("/");

  const searchToggle = page.getByRole("button", { name: "切换搜索" });
  await assertVisiblePrecondition(
    searchToggle,
    testInfo,
    "sidebar",
    "Sidebar search toggle must be visible for a11y gate.",
  );

  // Keep this audit stable by validating sidebar trigger surface without forcing menu state transitions.
  await searchToggle.focus();
  await expect(searchToggle, "Sidebar search toggle must receive focus for keyboard users.").toBeFocused();

  const report = await runA11yAudit(page);
  const reportableViolations = toReportableViolations(report.violations);
  const blockingViolations = toBlockingViolations(report.violations);
  await attachA11yReport(testInfo, "sidebar", reportableViolations);

  await expect(report.passesCount).toBeGreaterThan(0);
  expect(
    blockingViolations,
    `A11y gate failed on sidebar surface (blocking=critical+serious):\n${formatViolations(blockingViolations)}`,
  ).toEqual([]);
});
