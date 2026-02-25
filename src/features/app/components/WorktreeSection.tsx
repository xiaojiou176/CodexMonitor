import Layers from "lucide-react/dist/esm/icons/layers";

import type { ThreadSummary, WorkspaceInfo } from "../../../types";
import type { SidebarMenuTriggerEvent } from "../hooks/useSidebarMenus";
import type { SidebarTicker } from "../hooks/useSidebarTicker";
import { ThreadList } from "./ThreadList";
import { ThreadLoading } from "./ThreadLoading";
import { WorktreeCard } from "./WorktreeCard";

type ThreadStatusMap = Record<
  string,
  { isProcessing: boolean; hasUnread: boolean; isReviewing: boolean }
>;

type ThreadRowsResult = {
  pinnedRows: Array<{
    thread: ThreadSummary;
    depth: number;
    rootId: string;
    isSubAgent: boolean;
    hasSubAgentDescendants: boolean;
    isCollapsed: boolean;
  }>;
  unpinnedRows: Array<{
    thread: ThreadSummary;
    depth: number;
    rootId: string;
    isSubAgent: boolean;
    hasSubAgentDescendants: boolean;
    isCollapsed: boolean;
  }>;
  totalRoots: number;
  hasMoreRoots: boolean;
};

type WorktreeSectionProps = {
  worktrees: WorkspaceInfo[];
  deletingWorktreeIds: Set<string>;
  threadsByWorkspace: Record<string, ThreadSummary[]>;
  threadStatusById: ThreadStatusMap;
  threadListLoadingByWorkspace: Record<string, boolean>;
  threadListPagingByWorkspace: Record<string, boolean>;
  threadListCursorByWorkspace: Record<string, string | null>;
  expandedWorkspaces: Set<string>;
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  getThreadRows: (
    threads: ThreadSummary[],
    isExpanded: boolean,
    workspaceId: string,
    getPinTimestamp: (workspaceId: string, threadId: string) => number | null,
    options?: {
      showSubAgentThreads?: boolean;
      isRootCollapsed?: (workspaceId: string, rootId: string) => boolean;
    },
  ) => ThreadRowsResult;
  getThreadTime: (thread: ThreadSummary) => string | null;
  isThreadPinned: (workspaceId: string, threadId: string) => boolean;
  getPinTimestamp: (workspaceId: string, threadId: string) => number | null;
  showSubAgentThreadsInSidebar: boolean;
  isRootCollapsed: (workspaceId: string, rootId: string) => boolean;
  onToggleRootCollapse: (workspaceId: string, rootId: string) => void;
  onSelectWorkspace: (id: string) => void;
  onConnectWorkspace: (workspace: WorkspaceInfo) => void;
  onToggleWorkspaceCollapse: (workspaceId: string, collapsed: boolean) => void;
  onSelectThread: (workspaceId: string, threadId: string) => void;
  onThreadSelectionChange?: (selection: {
    workspaceId: string;
    threadId: string;
    orderedThreadIds: string[];
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
  }) => void;
  selectedWorkspaceId?: string | null;
  selectedThreadIds?: ReadonlySet<string>;
  onShowThreadMenu: (
    event: SidebarMenuTriggerEvent,
    workspaceId: string,
    threadId: string,
    canPin: boolean,
  ) => void;
  onShowWorktreeMenu: (
    event: SidebarMenuTriggerEvent,
    worktree: WorkspaceInfo,
  ) => void;
  onToggleExpanded: (workspaceId: string) => void;
  onLoadOlderThreads: (workspaceId: string) => void;
  sidebarTicker: SidebarTicker;
};

export function WorktreeSection({
  worktrees,
  deletingWorktreeIds,
  threadsByWorkspace,
  threadStatusById,
  threadListLoadingByWorkspace,
  threadListPagingByWorkspace,
  threadListCursorByWorkspace,
  expandedWorkspaces,
  activeWorkspaceId,
  activeThreadId,
  getThreadRows,
  getThreadTime,
  isThreadPinned,
  getPinTimestamp,
  showSubAgentThreadsInSidebar,
  isRootCollapsed,
  onToggleRootCollapse,
  onSelectWorkspace,
  onConnectWorkspace,
  onToggleWorkspaceCollapse,
  onSelectThread,
  onThreadSelectionChange,
  selectedWorkspaceId = null,
  selectedThreadIds,
  onShowThreadMenu,
  onShowWorktreeMenu,
  onToggleExpanded,
  onLoadOlderThreads,
  sidebarTicker,
}: WorktreeSectionProps) {
  if (!worktrees.length) {
    return null;
  }

  return (
    <div className="worktree-section">
      <div className="worktree-header">
        <Layers className="worktree-header-icon" aria-hidden />
        工作树
      </div>
      <div className="worktree-list">
        {worktrees.map((worktree) => {
          const worktreeThreads = threadsByWorkspace[worktree.id] ?? [];
          const isLoadingWorktreeThreads =
            threadListLoadingByWorkspace[worktree.id] ?? false;
          const showWorktreeLoader =
            isLoadingWorktreeThreads && worktreeThreads.length === 0;
          const worktreeNextCursor =
            threadListCursorByWorkspace[worktree.id] ?? null;
          const showWorktreeThreadList =
            worktreeThreads.length > 0 || Boolean(worktreeNextCursor);
          const isWorktreePaging =
            threadListPagingByWorkspace[worktree.id] ?? false;
          const isWorktreeExpanded = expandedWorkspaces.has(worktree.id);
          const {
            unpinnedRows: worktreeThreadRows,
            totalRoots: totalWorktreeRoots,
          } = getThreadRows(
            worktreeThreads,
            isWorktreeExpanded,
            worktree.id,
            getPinTimestamp,
            {
              showSubAgentThreads: showSubAgentThreadsInSidebar,
              isRootCollapsed,
            },
          );

          return (
            <WorktreeCard
              key={worktree.id}
              worktree={worktree}
              isActive={worktree.id === activeWorkspaceId}
              isDeleting={deletingWorktreeIds.has(worktree.id)}
              onSelectWorkspace={onSelectWorkspace}
              onShowWorktreeMenu={onShowWorktreeMenu}
              onToggleWorkspaceCollapse={onToggleWorkspaceCollapse}
              onConnectWorkspace={onConnectWorkspace}
            >
              {showWorktreeThreadList && (
                <ThreadList
                  workspaceId={worktree.id}
                  pinnedRows={[]}
                  unpinnedRows={worktreeThreadRows}
                  totalThreadRoots={totalWorktreeRoots}
                  isExpanded={isWorktreeExpanded}
                  nextCursor={worktreeNextCursor}
                  isPaging={isWorktreePaging}
                  nested
                  showLoadOlder={false}
                  activeWorkspaceId={activeWorkspaceId}
                  activeThreadId={activeThreadId}
                  threadStatusById={threadStatusById}
                  getThreadTime={getThreadTime}
                  isThreadPinned={isThreadPinned}
                  onToggleExpanded={onToggleExpanded}
                  onLoadOlderThreads={onLoadOlderThreads}
                  onSelectThread={onSelectThread}
                  onThreadSelectionChange={onThreadSelectionChange}
                  selectedThreadIds={
                    selectedWorkspaceId === worktree.id ? selectedThreadIds : undefined
                  }
                  onShowThreadMenu={onShowThreadMenu}
                  onToggleRootCollapse={onToggleRootCollapse}
                  showSubAgentCollapseToggles={showSubAgentThreadsInSidebar}
                  sidebarTicker={sidebarTicker}
                />
              )}
              {showWorktreeLoader && <ThreadLoading nested />}
            </WorktreeCard>
          );
        })}
      </div>
    </div>
  );
}
