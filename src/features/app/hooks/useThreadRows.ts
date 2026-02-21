import { useCallback } from "react";

import type { ThreadSummary } from "../../../types";

export type ThreadRow = {
  thread: ThreadSummary;
  depth: number;
  rootId: string;
  isSubAgent: boolean;
  hasSubAgentDescendants: boolean;
  isCollapsed: boolean;
};

type ThreadRowResult = {
  pinnedRows: ThreadRow[];
  unpinnedRows: ThreadRow[];
  totalRoots: number;
  hasMoreRoots: boolean;
};

type GetThreadRowsOptions = {
  showSubAgentThreads?: boolean;
  isRootCollapsed?: (workspaceId: string, rootId: string) => boolean;
};

export function useThreadRows(threadParentById: Record<string, string>) {
  const getThreadRows = useCallback(
    (
      threads: ThreadSummary[],
      isExpanded: boolean,
      workspaceId: string,
      getPinTimestamp: (workspaceId: string, threadId: string) => number | null,
      options?: GetThreadRowsOptions,
    ): ThreadRowResult => {
      const showSubAgentThreads = options?.showSubAgentThreads ?? true;
      const isRootCollapsed = options?.isRootCollapsed ?? (() => false);
      const threadIds = new Set(threads.map((thread) => thread.id));
      const childrenByParent = new Map<string, ThreadSummary[]>();
      const roots: ThreadSummary[] = [];
      const resolveVisibleParentId = (threadId: string) => {
        let current = threadParentById[threadId];
        const visited = new Set<string>([threadId]);
        while (current && !visited.has(current)) {
          if (threadIds.has(current)) {
            return current;
          }
          visited.add(current);
          current = threadParentById[current];
        }
        return null;
      };

      threads.forEach((thread) => {
        const parentId = resolveVisibleParentId(thread.id);
        if (parentId) {
          const list = childrenByParent.get(parentId) ?? [];
          list.push(thread);
          childrenByParent.set(parentId, list);
        } else {
          roots.push(thread);
        }
      });

      const pinnedRoots: ThreadSummary[] = [];
      const unpinnedRoots: ThreadSummary[] = [];

      roots.forEach((thread) => {
        if (!showSubAgentThreads && threadParentById[thread.id]) {
          return;
        }
        const pinTime = getPinTimestamp(workspaceId, thread.id);
        if (pinTime !== null) {
          pinnedRoots.push(thread);
        } else {
          unpinnedRoots.push(thread);
        }
      });

      pinnedRoots.sort((a, b) => {
        const aTime = getPinTimestamp(workspaceId, a.id) ?? 0;
        const bTime = getPinTimestamp(workspaceId, b.id) ?? 0;
        return aTime - bTime;
      });

      const visibleRootCount = isExpanded ? unpinnedRoots.length : 3;
      const visibleRoots = unpinnedRoots.slice(0, visibleRootCount);

      const appendThread = (
        thread: ThreadSummary,
        depth: number,
        rootId: string,
        rootCollapsed: boolean,
        rows: ThreadRow[],
      ) => {
        const children = childrenByParent.get(thread.id) ?? [];
        const isSubAgent = depth > 0 || Boolean(threadParentById[thread.id]);
        rows.push({
          thread,
          depth,
          rootId,
          isSubAgent,
          hasSubAgentDescendants: showSubAgentThreads && children.length > 0,
          isCollapsed: depth === 0 ? rootCollapsed : false,
        });
        if (!showSubAgentThreads) {
          return;
        }
        if (depth === 0 && rootCollapsed) {
          return;
        }
        children.forEach((child) => appendThread(child, depth + 1, rootId, false, rows));
      };

      const pinnedRows: ThreadRow[] = [];
      pinnedRoots.forEach((thread) => {
        const rootCollapsed = isRootCollapsed(workspaceId, thread.id);
        appendThread(thread, 0, thread.id, rootCollapsed, pinnedRows);
      });

      const unpinnedRows: ThreadRow[] = [];
      visibleRoots.forEach((thread) => {
        const rootCollapsed = isRootCollapsed(workspaceId, thread.id);
        appendThread(thread, 0, thread.id, rootCollapsed, unpinnedRows);
      });

      return {
        pinnedRows,
        unpinnedRows,
        totalRoots: unpinnedRoots.length,
        hasMoreRoots: unpinnedRoots.length > visibleRootCount,
      };
    },
    [threadParentById],
  );

  return { getThreadRows };
}
