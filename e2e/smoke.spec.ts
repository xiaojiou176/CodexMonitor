import { expect, test } from "@playwright/test";

async function activateByPointer(page: import("@playwright/test").Page, locator: import("@playwright/test").Locator) {
  await expect(locator).toBeVisible();
  await expect(locator).toBeEnabled();
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("Target element has no bounding box for pointer activation.");
  }
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

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
  await activateByPointer(page, timeButton);
  await expect(timeButton).toHaveAttribute("aria-pressed", "true");
  await expect(tokenButton).toHaveAttribute("aria-pressed", "false");
  await activateByPointer(page, tokenButton);
  await expect(tokenButton).toHaveAttribute("aria-pressed", "true");
  await expect(timeButton).toHaveAttribute("aria-pressed", "false");

  const sortButton = page.getByRole("button", { name: "排序对话" });
  await activateByPointer(page, sortButton);
  await expect(page.getByRole("menuitemradio", { name: "最近更新" })).toBeVisible();
  await activateByPointer(page, page.getByRole("menuitemradio", { name: "最新创建" }));
  await expect(page.getByRole("menuitemradio", { name: "最新创建" })).toHaveCount(0);
});

test("session smoke covers create flow and creation-mode switch", async ({ page }) => {
  await page.addInitScript(() => {
    const mockWorkspace = {
      id: "ws-smoke",
      name: "Smoke Workspace",
      path: "/tmp/smoke-workspace",
      connected: false,
      kind: "main",
      parentId: null,
      worktree: null,
      settings: {
        sidebarCollapsed: false,
      },
    };

    const tauriInternals = (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ as
      | { invoke?: (command: string, payload: unknown) => Promise<unknown> }
      | undefined;
    const originalInvoke = tauriInternals?.invoke;

    (window as unknown as { __TAURI_INTERNALS__: { invoke: (command: string, payload: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__ =
      {
        invoke: async (command: string, payload: unknown) => {
          if (command === "list_workspaces") {
            return [mockWorkspace];
          }
          if (command === "list_workspace_groups") {
            return [];
          }
          if (typeof originalInvoke === "function") {
            return originalInvoke(command, payload);
          }
          throw new Error(`[smoke-ui] unmocked tauri command: ${command}`);
        },
      };
  });

  await page.goto("/");

  const addSessionButton = page.getByRole("button", { name: "添加对话选项" }).first();
  await activateByPointer(page, addSessionButton);
  await expect(page.getByRole("button", { name: "新建对话" })).toBeVisible();
  await activateByPointer(page, page.getByRole("button", { name: "新建对话" }));

  const draftRow = page.locator(".thread-row-draft").first();
  await expect(draftRow).toBeVisible();
  await expect(draftRow).toContainText("新建对话");

  await activateByPointer(page, addSessionButton);
  await activateByPointer(page, page.getByRole("button", { name: "新建工作树对话" }));
  const worktreeDialog = page.getByRole("dialog", { name: "新建工作树对话" });
  await expect(worktreeDialog).toBeVisible();
  await activateByPointer(page, worktreeDialog.getByRole("button", { name: "取消" }));
});
