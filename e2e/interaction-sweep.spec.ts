import { expect, test, type Locator, type Page } from "@playwright/test";

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
  await expect(locator).toBeVisible();
  await expect(locator).toBeEnabled();
  await locator.focus();
  await expect(locator).toBeFocused();
}

async function activateByClick(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  await expect(locator).toBeEnabled();
  await locator.scrollIntoViewIfNeeded();
  await locator.click({ force: true, noWaitAfter: true, timeout: 5000 });
}

async function activateByKey(locator: Locator, key: "Enter" | "Space"): Promise<void> {
  await expect(locator).toBeVisible();
  await expect(locator).toBeEnabled();
  await locator.focus();
  await expect(locator).toBeFocused();
  await locator.press(key, { noWaitAfter: true, timeout: 5000 });
}

test("interaction sweep: key controls are visible, enabled, and focusable", async ({ page }) => {
  await page.goto("/");

  for (const target of MAIN_INTERACTIVE_CONTROLS) {
    await test.step(`control is interactive: ${target.label}`, async () => {
      await expectInteractive(target.locator(page));
    });
  }
});

test("interaction sweep: usage toggles support click + Enter + Space activation", async ({ page }) => {
  await page.goto("/");

  const tokenButton = page.getByRole("button", { name: "令牌" });
  const timeButton = page.getByRole("button", { name: "时长" });

  await expect(tokenButton).toHaveAttribute("aria-pressed", "true");
  await expect(timeButton).toHaveAttribute("aria-pressed", "false");

  await activateByClick(timeButton);
  await expect(timeButton).toHaveAttribute("aria-pressed", "true");
  await expect(tokenButton).toHaveAttribute("aria-pressed", "false");

  await activateByKey(tokenButton, "Enter");
  await expect(tokenButton).toHaveAttribute("aria-pressed", "true");
  await expect(timeButton).toHaveAttribute("aria-pressed", "false");

  await activateByKey(timeButton, "Space");
  await expect(timeButton).toHaveAttribute("aria-pressed", "true");
  await expect(tokenButton).toHaveAttribute("aria-pressed", "false");
});

test("interaction sweep: sort trigger supports click + Enter + Space activation", async ({ page }) => {
  await page.goto("/");

  const sortButton = page.getByRole("button", { name: "排序对话" });
  const recentMenuItem = page.getByRole("menuitemradio", { name: "最近更新" });

  await activateByClick(sortButton);
  await expect(sortButton).toHaveAttribute("aria-expanded", "true");
  await expect(recentMenuItem).toBeVisible();
  await activateByClick(sortButton);
  await expect(sortButton).toHaveAttribute("aria-expanded", "false");

  await activateByKey(sortButton, "Enter");
  await expect(sortButton).toHaveAttribute("aria-expanded", "true");
  await expect(recentMenuItem).toBeVisible();
  await activateByKey(sortButton, "Enter");
  await expect(sortButton).toHaveAttribute("aria-expanded", "false");

  await activateByKey(sortButton, "Space");
  await expect(sortButton).toHaveAttribute("aria-expanded", "true");
  await expect(recentMenuItem).toBeVisible();
});
