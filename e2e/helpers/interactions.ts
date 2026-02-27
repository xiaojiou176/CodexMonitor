import { expect, type Locator, type Page } from "@playwright/test";

export async function installUiStabilityMocks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const mockWorkspace = {
      id: "ws-interaction-smoke",
      name: "Interaction Workspace",
      path: "/tmp/interaction-workspace",
      connected: false,
      kind: "main",
      parentId: null,
      worktree: null,
      settings: {
        sidebarCollapsed: false,
      },
    };

    const tauriInternals = (window as unknown as { __TAURI_INTERNALS__?: unknown })
      .__TAURI_INTERNALS__ as
      | { invoke?: (command: string, payload: unknown) => Promise<unknown> }
      | undefined;
    const originalInvoke = tauriInternals?.invoke;

    (window as unknown as {
      __TAURI_INTERNALS__: { invoke: (command: string, payload: unknown) => Promise<unknown> };
    }).__TAURI_INTERNALS__ = {
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
        throw new Error(`[interaction-e2e] unmocked tauri command: ${command}`);
      },
    };
  });
}

export async function ensureInteractive(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  await expect(locator).toBeEnabled();
  await locator.scrollIntoViewIfNeeded();
}

export async function activateByStableClick(locator: Locator): Promise<void> {
  await ensureInteractive(locator);
  await locator.dispatchEvent("click");
}

export async function activateByStableKey(
  locator: Locator,
  key: "Enter" | "Space",
): Promise<void> {
  await ensureInteractive(locator);
  await locator.focus();
  await expect(locator).toBeFocused();
  const resolvedKey = key === "Space" ? " " : key;
  await locator.dispatchEvent("keydown", { key: resolvedKey });
  await locator.dispatchEvent("keyup", { key: resolvedKey });
}
