import { expect, test } from "@playwright/test";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  ensureWorkspace,
  hasTauriInvoke,
  listWorkspaces,
} from "./helpers/workspace-flow";

test("workspace lifecycle: add workspace -> connect -> show thread/session state", async ({
  page,
}) => {
  const workspacePath = await mkdtemp(path.join(os.tmpdir(), "codex-monitor-e2e-"));

  await page.goto("/");

  const bridgeReady = await hasTauriInvoke(page);
  if (!bridgeReady) {
    await expect(page.getByRole("combobox", { name: "选择工作区" })).toBeVisible();
    return;
  }

  const workspace = await ensureWorkspace(page, workspacePath);
  await page.reload();

  const workspaceButton = page.getByRole("button", {
    name: new RegExp(`切换到工作区\\s+${workspace.name}`),
  });
  await expect(workspaceButton).toBeVisible();
  await workspaceButton.click();

  const workspaceRow = page.locator(`.workspace-row[data-workspace-id="${workspace.id}"]`);
  const connectButton = workspaceRow.getByRole("button", { name: "连接" });
  if (await connectButton.isVisible()) {
    await connectButton.click();
  }

  const connected = await expect
    .poll(
      async () => {
        const latest = await listWorkspaces(page);
        return latest.find((entry) => entry.id === workspace.id)?.connected ?? false;
      },
      {
        timeout: 20_000,
      },
    )
    .toBeTruthy()
    .then(
      () => true,
      () => false,
    );

  if (!connected) {
    await expect(connectButton).toBeVisible();
    return;
  }

  await expect(workspaceRow.locator(".thread-list-empty")).toContainText(
    "暂无对话，点击 + 新建",
  );

  const addSessionButton = workspaceRow.getByRole("button", {
    name: "添加对话选项",
  });
  await addSessionButton.click();

  const createSessionButton = page.getByRole("button", { name: "新建对话" });
  await expect(createSessionButton).toBeVisible();
  await createSessionButton.click();

  await expect(workspaceRow.locator(".thread-row-draft .thread-name")).toContainText(
    "新建对话",
  );
});
