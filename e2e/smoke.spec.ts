import { expect, test } from "@playwright/test";

test("home smoke renders core entry points", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Let's build")).toBeVisible();
  await expect(page.getByText("快速开始")).toBeVisible();
  await expect(page.getByRole("button", { name: "添加工作区" }).first()).toBeVisible();
});

test("home usage controls are visible", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "刷新用量" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "选择工作区" })).toBeVisible();
  await expect(page.getByRole("button", { name: "令牌" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const timeToggle = page.getByRole("button", { name: "时长" });
  await expect(timeToggle).toBeVisible();
  await expect(timeToggle).toHaveAttribute("aria-pressed", "false");
});

test("home empty states are visible on a fresh session", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("暂无对话记录")).toBeVisible();
  await expect(page.getByText("暂无使用数据")).toBeVisible();
});

test("sidebar search control has stable default state", async ({ page }) => {
  await page.goto("/");

  const searchToggle = page.getByRole("button", { name: "切换搜索" });
  await expect(searchToggle).toBeVisible();
  await expect(searchToggle).toBeEnabled();
  await expect(searchToggle).toHaveAttribute("aria-pressed", "false");
  const searchInput = page.getByLabel("搜索工作区和对话");
  await expect(searchInput).toHaveCount(0);
});

test("usage and sort controls expose stable default states", async ({ page }) => {
  await page.goto("/");

  const tokenButton = page.getByRole("button", { name: "令牌" });
  const timeButton = page.getByRole("button", { name: "时长" });
  await expect(tokenButton).toBeVisible();
  await expect(tokenButton).toBeEnabled();
  await expect(timeButton).toBeVisible();
  await expect(timeButton).toBeEnabled();
  await expect(tokenButton).toHaveAttribute("aria-pressed", "true");
  await expect(timeButton).toHaveAttribute("aria-pressed", "false");

  const sortButton = page.getByRole("button", { name: "排序对话" });
  await expect(sortButton).toBeVisible();
  await expect(sortButton).toBeEnabled();
  await expect(page.getByRole("menuitemradio", { name: "最近更新" })).toHaveCount(0);
  await expect(page.getByRole("menuitemradio", { name: "最新创建" })).toHaveCount(0);
});

test("home smoke supports a minimal interaction journey", async ({ page }) => {
  await page.goto("/");

  const tokenButton = page.getByRole("button", { name: "令牌" });
  const timeButton = page.getByRole("button", { name: "时长" });
  await timeButton.evaluate((element) => (element as HTMLButtonElement).click());
  await expect(timeButton).toHaveAttribute("aria-pressed", "true");
  await expect(tokenButton).toHaveAttribute("aria-pressed", "false");
  await tokenButton.evaluate((element) => (element as HTMLButtonElement).click());
  await expect(tokenButton).toHaveAttribute("aria-pressed", "true");
  await expect(timeButton).toHaveAttribute("aria-pressed", "false");

  const sortButton = page.getByRole("button", { name: "排序对话" });
  await sortButton.evaluate((element) => (element as HTMLButtonElement).click());
  await expect(page.getByRole("menuitemradio", { name: "最近更新" })).toBeVisible();
  await page
    .getByRole("menuitemradio", { name: "最新创建" })
    .evaluate((element) => (element as HTMLElement).click());
  await expect(page.getByRole("menuitemradio", { name: "最新创建" })).toHaveCount(0);
});
