import type { Page } from "@playwright/test";

export type WorkspaceRecord = {
  id: string;
  name: string;
  path: string;
  connected: boolean;
};

function asWorkspaceRecord(value: unknown): WorkspaceRecord {
  const record = value as Record<string, unknown>;
  return {
    id: String(record.id ?? ""),
    name: String(record.name ?? ""),
    path: String(record.path ?? ""),
    connected: Boolean(record.connected),
  };
}

export async function hasTauriInvoke(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const internals = (window as unknown as {
      __TAURI_INTERNALS__?: { invoke?: unknown };
    }).__TAURI_INTERNALS__;
    return typeof internals?.invoke === "function";
  });
}

export async function tauriInvoke<T>(
  page: Page,
  command: string,
  payload?: Record<string, unknown>,
): Promise<T> {
  return page.evaluate(
    async ({ command, payload }) => {
      const internals = (window as unknown as {
        __TAURI_INTERNALS__?: {
          invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
        };
      }).__TAURI_INTERNALS__;
      if (typeof internals?.invoke !== "function") {
        throw new Error("Tauri invoke bridge unavailable");
      }
      return internals.invoke(command, payload);
    },
    { command, payload: payload ?? {} },
  ) as Promise<T>;
}

export async function listWorkspaces(page: Page): Promise<WorkspaceRecord[]> {
  const raw = await tauriInvoke<unknown[]>(page, "list_workspaces", {});
  return raw.map(asWorkspaceRecord);
}

export async function ensureWorkspace(
  page: Page,
  workspacePath: string,
): Promise<WorkspaceRecord> {
  const existing = (await listWorkspaces(page)).find(
    (workspace) => workspace.path === workspacePath,
  );
  if (existing) {
    return existing;
  }

  const created = await tauriInvoke<unknown>(page, "add_workspace", {
    path: workspacePath,
    codex_bin: null,
  });
  return asWorkspaceRecord(created);
}
