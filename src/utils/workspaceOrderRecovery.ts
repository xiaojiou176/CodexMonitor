import type { WorkspaceInfo } from "../types";

const WORKSPACE_ORDER_WAL_STORAGE_KEY = "codexmonitor.workspaceOrder.pendingWal";
const NULL_GROUP_ID_SENTINEL = "__codexmonitor_null_group_id__";

export type PendingWorkspaceReorder = {
  orderedWorkspaceIds: string[];
  groupId: string | null;
  updatedAt: number;
};

type PersistedPendingWorkspaceReorder = {
  version: 1;
  orderedWorkspaceIds: string[];
  groupId: string;
  updatedAt: number;
};

function serializeGroupId(groupId: string | null): string {
  return groupId ?? NULL_GROUP_ID_SENTINEL;
}

function deserializeGroupId(groupId: string): string | null {
  return groupId === NULL_GROUP_ID_SENTINEL ? null : groupId;
}

function normalizeWorkspaceIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const next: string[] = [];
  const seen = new Set<string>();
  value.forEach((entry) => {
    if (typeof entry !== "string") {
      return;
    }
    if (seen.has(entry)) {
      return;
    }
    seen.add(entry);
    next.push(entry);
  });
  return next;
}

export function savePendingWorkspaceReorder(
  payload: Omit<PendingWorkspaceReorder, "updatedAt">,
): void {
  if (typeof window === "undefined") {
    return;
  }
  const orderedWorkspaceIds = normalizeWorkspaceIds(payload.orderedWorkspaceIds);
  if (orderedWorkspaceIds.length === 0) {
    clearPendingWorkspaceReorder();
    return;
  }
  const persisted: PersistedPendingWorkspaceReorder = {
    version: 1,
    orderedWorkspaceIds,
    groupId: serializeGroupId(payload.groupId),
    updatedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(
      WORKSPACE_ORDER_WAL_STORAGE_KEY,
      JSON.stringify(persisted),
    );
  } catch {
    // Best-effort persistence.
  }
}

export function loadPendingWorkspaceReorder(): PendingWorkspaceReorder | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(WORKSPACE_ORDER_WAL_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<PersistedPendingWorkspaceReorder>;
    if (!parsed || typeof parsed !== "object" || parsed.version !== 1) {
      return null;
    }
    if (typeof parsed.groupId !== "string") {
      return null;
    }
    const orderedWorkspaceIds = normalizeWorkspaceIds(parsed.orderedWorkspaceIds);
    if (orderedWorkspaceIds.length === 0) {
      return null;
    }
    return {
      orderedWorkspaceIds,
      groupId: deserializeGroupId(parsed.groupId),
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

export function clearPendingWorkspaceReorder(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(WORKSPACE_ORDER_WAL_STORAGE_KEY);
  } catch {
    // Best-effort persistence.
  }
}

export async function persistWorkspaceOrderWithWal(
  orderedWorkspaces: WorkspaceInfo[],
  groupId: string | null,
  persistWorkspaceOrder: (
    orderedWorkspaces: WorkspaceInfo[],
    groupId: string | null,
  ) => Promise<void>,
): Promise<void> {
  if (orderedWorkspaces.length <= 1) {
    return;
  }
  savePendingWorkspaceReorder({
    orderedWorkspaceIds: orderedWorkspaces.map((entry) => entry.id),
    groupId,
  });
  await persistWorkspaceOrder(orderedWorkspaces, groupId);
  clearPendingWorkspaceReorder();
}

export async function replayPendingWorkspaceReorder(
  workspaceById: Map<string, WorkspaceInfo>,
  persistWorkspaceOrder: (
    orderedWorkspaces: WorkspaceInfo[],
    groupId: string | null,
  ) => Promise<void>,
): Promise<boolean> {
  const pending = loadPendingWorkspaceReorder();
  if (!pending) {
    return false;
  }
  const orderedWorkspaces: WorkspaceInfo[] = [];
  pending.orderedWorkspaceIds.forEach((workspaceId) => {
    const workspace = workspaceById.get(workspaceId);
    if (workspace && (workspace.kind ?? "main") !== "worktree") {
      orderedWorkspaces.push(workspace);
    }
  });
  if (orderedWorkspaces.length <= 1) {
    clearPendingWorkspaceReorder();
    return false;
  }
  try {
    await persistWorkspaceOrder(orderedWorkspaces, pending.groupId);
    clearPendingWorkspaceReorder();
    return true;
  } catch {
    return false;
  }
}

export function __workspaceOrderRecoveryStorageKeyForTests(): string {
  return WORKSPACE_ORDER_WAL_STORAGE_KEY;
}
