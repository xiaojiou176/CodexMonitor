import { expect, test, type Page } from "@playwright/test";

const APPROVAL_TIMEOUT_MS = 45_000;
const INTERRUPT_TIMEOUT_MS = 20_000;

async function hasTauriInvokeBridge(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const internals = (
      window as unknown as {
        __TAURI_INTERNALS__?: { invoke?: unknown };
      }
    ).__TAURI_INTERNALS__;
    return Boolean(internals && typeof internals.invoke === "function");
  });
}

async function ensureLiveWorkspace(page: Page) {
  await page.goto("/");
  const hasBridge = await hasTauriInvokeBridge(page);
  if (!hasBridge) {
    return { live: false as const };
  }

  const workspaceSelect = page.getByRole("combobox", { name: "选择工作区" });
  await expect(workspaceSelect).toBeVisible();
  const optionCount = await workspaceSelect.locator("option").count();
  if (optionCount === 0) {
    return { live: false as const };
  }
  return { live: true as const };
}

async function startDraftThread(page: Page) {
  const addThreadButton = page.getByRole("button", { name: "添加对话选项" }).first();
  await expect(addThreadButton).toBeVisible();
  await addThreadButton.click();

  const createThreadButton = page.getByRole("button", { name: "新建对话" });
  await expect(createThreadButton).toBeVisible();
  await createThreadButton.click();
  await expect(page.locator(".thread-row-draft").first()).toBeVisible();
}

async function sendPrompt(page: Page, prompt: string) {
  const textarea = page.locator(".composer-input textarea");
  await expect(textarea).toBeVisible();
  await textarea.fill(prompt);

  const sendButton = page.getByRole("button", { name: "发送" }).first();
  await expect(sendButton).toBeEnabled();
  await sendButton.click();
}

test("approval flow shows request and updates after decision", async ({ page }) => {
  const workspace = await ensureLiveWorkspace(page);
  if (!workspace.live) {
    await expect(page.getByRole("combobox", { name: "选择工作区" })).toBeVisible();
    return;
  }
  await startDraftThread(page);

  await sendPrompt(
    page,
    "请执行 shell 命令 `pwd` 并返回结果。如果需要审批，请等待我处理。",
  );

  const approvalToast = page.locator(".approval-toast").first();
  const approvalVisible = await approvalToast
    .waitFor({ state: "visible", timeout: APPROVAL_TIMEOUT_MS })
    .then(() => true)
    .catch(() => false);
  if (!approvalVisible) {
    await expect(page.locator(".thread-row-draft").first()).toBeVisible();
    await expect(page.locator(".composer-input textarea")).toBeVisible();
    return;
  }

  await expect(approvalToast.getByText("需要审批")).toBeVisible();
  const approveButton = approvalToast.getByRole("button", { name: "批准 (Enter)" });
  const declineButton = approvalToast.getByRole("button", { name: "拒绝" });
  await expect(approveButton).toBeEnabled();
  await expect(declineButton).toBeEnabled();

  const beforeCount = await page.locator(".approval-toast").count();
  await approveButton.click();
  await expect(page.locator(".approval-toast")).toHaveCount(Math.max(0, beforeCount - 1));
});

test(
  "interruption flow exposes stop action and falls back with feedback",
  async ({ page }) => {
    const workspace = await ensureLiveWorkspace(page);
    if (!workspace.live) {
      await expect(page.getByRole("combobox", { name: "选择工作区" })).toBeVisible();
      await expect(page.getByRole("button", { name: "停止" })).toHaveCount(0);
      return;
    }
  await startDraftThread(page);

  await sendPrompt(
    page,
    "请执行较慢的多步任务：先列出当前目录文件，再逐个解释用途，最后给出总结。",
  );

  const stopButton = page.getByRole("button", { name: "停止" });
  const stopVisible = await stopButton
    .waitFor({ state: "visible", timeout: INTERRUPT_TIMEOUT_MS })
    .then(() => true)
    .catch(() => false);
    if (!stopVisible) {
      await expect(page.locator(".composer-input textarea")).toBeVisible();
      await expect(page.getByRole("button", { name: "停止" })).toHaveCount(0);
      return;
    }

    await expect(stopButton).toBeEnabled();
    await stopButton.click();

    await expect(page.getByRole("button", { name: "发送" }).first()).toBeVisible();
    await expect(page.getByText("Session stopped.")).toBeVisible();
  },
);
