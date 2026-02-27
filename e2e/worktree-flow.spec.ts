import { expect, test, type Page } from "@playwright/test";

type WorkspaceEntry = {
  id: string;
  name: string;
  kind?: "main" | "worktree" | string;
  worktree?: { branch?: string | null } | null;
};

type WorkspaceBootstrapResult =
  | {
      supported: false;
      reason: string;
    }
  | {
      supported: true;
      workspaceId: string;
      workspaceName: string;
    };

const defaultWorkspacePath = process.env.E2E_WORKSPACE_PATH ?? process.cwd();

async function ensureMainWorkspace(
  page: Page,
  workspacePath: string,
): Promise<WorkspaceBootstrapResult> {
  return page.evaluate(async (path) => {
    const tauriInternals = (
      window as unknown as {
        __TAURI_INTERNALS__?: { invoke?: (command: string, payload?: unknown) => Promise<unknown> };
      }
    ).__TAURI_INTERNALS__;

    const invoke = tauriInternals?.invoke;
    if (typeof invoke !== "function") {
      return {
        supported: false,
        reason: "Tauri invoke bridge unavailable in this runtime",
      } satisfies WorkspaceBootstrapResult;
    }

    const list = async () => (await invoke("list_workspaces")) as WorkspaceEntry[];
    let workspaces = await list();

    let mainWorkspace =
      workspaces.find((entry) => entry.kind === "main") ??
      workspaces.find((entry) => !entry.worktree);

    if (!mainWorkspace) {
      await invoke("add_workspace", { path, codex_bin: null });
      workspaces = await list();
      mainWorkspace =
        workspaces.find((entry) => entry.kind === "main") ??
        workspaces.find((entry) => !entry.worktree);
    }

    if (!mainWorkspace) {
      return {
        supported: false,
        reason: "Unable to bootstrap a main workspace",
      } satisfies WorkspaceBootstrapResult;
    }

    return {
      supported: true,
      workspaceId: mainWorkspace.id,
      workspaceName: mainWorkspace.name,
    } satisfies WorkspaceBootstrapResult;
  }, workspacePath);
}

test("worktree flow supports create and switch journey", async ({ page }, testInfo) => {
  await page.goto("/");

  const workspaceBootstrap = await ensureMainWorkspace(page, defaultWorkspacePath);
  testInfo.skip(!workspaceBootstrap.supported, workspaceBootstrap.reason);

  await page.reload();

  const mainWorkspaceSwitch = page.getByRole("button", {
    name: `切换到工作区 ${workspaceBootstrap.workspaceName}`,
  });
  await expect(mainWorkspaceSwitch).toBeVisible();
  await mainWorkspaceSwitch.click();

  const mainWorkspaceRow = mainWorkspaceSwitch.locator(
    "xpath=ancestor::div[contains(@class,'workspace-row')]",
  );
  const addMenuButton = mainWorkspaceRow.getByRole("button", {
    name: "添加对话选项",
  });
  await expect(addMenuButton).toBeVisible();
  await expect(addMenuButton).toBeEnabled();
  await addMenuButton.click();

  const addWorktreeOption = page.getByRole("button", { name: "新建工作树对话" });
  await expect(addWorktreeOption).toBeVisible();
  await addWorktreeOption.click();

  const worktreeDialog = page.getByRole("dialog", { name: "新建工作树对话" });
  await expect(worktreeDialog).toBeVisible();

  const worktreeName = `e2e-worktree-${Date.now()}`;
  const worktreeBranch = `e2e/worktree-flow-${Date.now()}`;

  const nameInput = worktreeDialog.getByLabel("名称");
  const branchInput = worktreeDialog.getByLabel("分支名称");
  const copyAgentsCheckbox = worktreeDialog.getByLabel("复制 AGENTS.md 到工作树");
  const createButton = worktreeDialog.getByRole("button", { name: "创建" });

  await expect(nameInput).toBeVisible();
  await expect(branchInput).toBeVisible();
  await expect(copyAgentsCheckbox).toBeVisible();
  await expect(copyAgentsCheckbox).toBeEnabled();
  await expect(createButton).toBeEnabled();

  await nameInput.fill(worktreeName);
  await branchInput.fill(worktreeBranch);
  await createButton.click();

  await expect(worktreeDialog).toHaveCount(0);
  await expect(page.getByText("工作树")).toBeVisible();

  const worktreeSwitch = page.getByRole("button", {
    name: `切换到工作树 ${worktreeName}`,
  });
  await expect(worktreeSwitch).toBeVisible();

  await mainWorkspaceSwitch.click();
  await expect(page.getByTitle("工作树信息")).toHaveCount(0);

  await worktreeSwitch.click();
  await expect(page.getByTitle("工作树信息")).toBeVisible();
});
