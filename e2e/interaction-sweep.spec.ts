import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  ensureInteractive,
  installUiStabilityMocks,
} from "./helpers/interactions";

type ControlTarget = {
  label: string;
  locator: (page: Page) => Locator;
};

const MAIN_INTERACTIVE_CONTROLS: ControlTarget[] = [
  {
    label: "添加工作区",
    locator: (page) => page.getByRole("button", { name: "添加工作区" }).first(),
  },
  {
    label: "刷新用量",
    locator: (page) => page.getByRole("button", { name: "刷新用量" }),
  },
  {
    label: "令牌",
    locator: (page) => page.getByRole("button", { name: "令牌" }),
  },
  {
    label: "时长",
    locator: (page) => page.getByRole("button", { name: "时长" }),
  },
  {
    label: "排序对话",
    locator: (page) => page.getByRole("button", { name: "排序对话" }),
  },
  {
    label: "切换搜索",
    locator: (page) => page.getByRole("button", { name: "切换搜索" }),
  },
];

async function expectInteractive(locator: Locator): Promise<void> {
  await ensureInteractive(locator);
  await locator.focus();
  await expect(locator).toBeFocused();
}

test("interaction sweep: key controls are visible, enabled, and focusable", async ({ page }) => {
  await installUiStabilityMocks(page);
  await page.goto("/");

  for (const target of MAIN_INTERACTIVE_CONTROLS) {
    await test.step(`control is interactive: ${target.label}`, async () => {
      await expectInteractive(target.locator(page));
    });
  }
});

test("interaction sweep: usage toggles expose stable accessibility state", async ({ page }) => {
  await installUiStabilityMocks(page);
  await page.goto("/");

  const tokenButton = page.getByRole("button", { name: "令牌" });
  const timeButton = page.getByRole("button", { name: "时长" });

  await expect(tokenButton).toHaveAttribute("aria-pressed", "true");
  await expect(timeButton).toHaveAttribute("aria-pressed", "false");

  await tokenButton.focus();
  await expect(tokenButton).toBeFocused();
  await expect(tokenButton).toBeVisible();
  await expect(tokenButton).toBeEnabled();

  await timeButton.focus();
  await expect(timeButton).toBeFocused();
  await expect(tokenButton).toBeVisible();
  await expect(tokenButton).toBeEnabled();
  await expect(timeButton).toBeVisible();
  await expect(timeButton).toBeEnabled();
});

test("interaction sweep: sort trigger exposes stable accessibility state", async ({ page }) => {
  await installUiStabilityMocks(page);
  await page.goto("/");

  const sortButton = page.getByRole("button", { name: "排序对话" });
  await expect(sortButton).toHaveAttribute("aria-haspopup", "menu");
  await expect(sortButton).toHaveAttribute("aria-expanded", "false");
  await sortButton.focus();
  await expect(sortButton).toBeFocused();
  await expect(sortButton).toBeVisible();
  await expect(sortButton).toBeEnabled();
});
