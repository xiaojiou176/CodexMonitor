import { useCallback, type KeyboardEvent, type MouseEvent } from "react";
import { Menu, MenuItem } from "@tauri-apps/api/menu";
import { LogicalPosition } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";

import type { WorkspaceInfo } from "../../../types";
import { pushErrorToast } from "../../../services/toasts";
import { fileManagerName } from "../../../utils/platformPaths";

type SidebarMenuHandlers = {
  onDeleteThread: (workspaceId: string, threadId: string) => void;
  onDeleteThreads?: (workspaceId: string, threadIds: string[]) => void;
  getSelectedThreadIds?: (workspaceId: string) => string[];
  onPinThread: (workspaceId: string, threadId: string) => void;
  onUnpinThread: (workspaceId: string, threadId: string) => void;
  isThreadPinned: (workspaceId: string, threadId: string) => boolean;
  onRenameThread: (workspaceId: string, threadId: string) => void;
  onRenameWorkspaceAlias: (workspaceId: string) => void;
  onReloadWorkspaceThreads: (workspaceId: string) => void;
  onDeleteWorkspace: (workspaceId: string) => void;
  onDeleteWorktree: (workspaceId: string) => void;
};

type SyntheticMenuCoordinates = {
  clientX: number;
  clientY: number;
  currentTarget?: EventTarget | null;
  preventDefault?: () => void;
  stopPropagation?: () => void;
};

export type SidebarMenuTriggerEvent =
  | MouseEvent<HTMLElement>
  | KeyboardEvent<HTMLElement>
  | SyntheticMenuCoordinates;

function stopMenuTriggerEvent(event: SidebarMenuTriggerEvent) {
  event.preventDefault?.();
  event.stopPropagation?.();
}

function resolveMenuPosition(event: SidebarMenuTriggerEvent) {
  if (
    "clientX" in event &&
    typeof event.clientX === "number" &&
    typeof event.clientY === "number" &&
    (event.clientX !== 0 || event.clientY !== 0)
  ) {
    return new LogicalPosition(event.clientX, event.clientY);
  }

  const target = "currentTarget" in event ? event.currentTarget : null;
  if (target instanceof HTMLElement) {
    const rect = target.getBoundingClientRect();
    return new LogicalPosition(
      rect.left + rect.width / 2,
      rect.top + Math.min(rect.height, 24),
    );
  }
  return new LogicalPosition(0, 0);
}

export function useSidebarMenus({
  onDeleteThread,
  onDeleteThreads,
  getSelectedThreadIds,
  onPinThread,
  onUnpinThread,
  isThreadPinned,
  onRenameThread,
  onRenameWorkspaceAlias,
  onReloadWorkspaceThreads,
  onDeleteWorkspace,
  onDeleteWorktree,
}: SidebarMenuHandlers) {
  const showThreadMenu = useCallback(
    async (
      event: SidebarMenuTriggerEvent,
      workspaceId: string,
      threadId: string,
      canPin: boolean,
    ) => {
      stopMenuTriggerEvent(event);
      const selectedThreadIds = Array.from(
        new Set(getSelectedThreadIds?.(workspaceId) ?? []),
      );
      const shouldArchiveSelection =
        selectedThreadIds.length > 1 && selectedThreadIds.includes(threadId);
      const archiveTargetIds = shouldArchiveSelection
        ? selectedThreadIds
        : [threadId];
      const renameItem = await MenuItem.new({
        text: "重命名",
        action: () => onRenameThread(workspaceId, threadId),
      });
      const archiveItem = await MenuItem.new({
        text: shouldArchiveSelection
          ? `归档所选 (${archiveTargetIds.length})`
          : "归档",
        action: () => {
          if (!shouldArchiveSelection) {
            onDeleteThread(workspaceId, threadId);
            return;
          }
          if (onDeleteThreads) {
            onDeleteThreads(workspaceId, archiveTargetIds);
            return;
          }
          archiveTargetIds.forEach((targetThreadId) => {
            onDeleteThread(workspaceId, targetThreadId);
          });
        },
      });
      const copyItem = await MenuItem.new({
        text: "复制 ID",
        action: async () => {
          try {
            await navigator.clipboard.writeText(threadId);
          } catch {
            // Clipboard failures are non-fatal here.
          }
        },
      });
      const items = [renameItem];
      if (canPin) {
        const isPinned = isThreadPinned(workspaceId, threadId);
        items.push(
          await MenuItem.new({
            text: isPinned ? "取消置顶" : "置顶",
            action: () => {
              if (isPinned) {
                onUnpinThread(workspaceId, threadId);
              } else {
                onPinThread(workspaceId, threadId);
              }
            },
          }),
        );
      }
      items.push(copyItem, archiveItem);
      const menu = await Menu.new({ items });
      const window = getCurrentWindow();
      const position = resolveMenuPosition(event);
      await menu.popup(position, window);
    },
    [
      isThreadPinned,
      onDeleteThread,
      onDeleteThreads,
      getSelectedThreadIds,
      onPinThread,
      onRenameThread,
      onUnpinThread,
    ],
  );

  const showWorkspaceMenu = useCallback(
    async (event: SidebarMenuTriggerEvent, workspaceId: string) => {
      stopMenuTriggerEvent(event);
      const renameAliasItem = await MenuItem.new({
        text: "自定义名称",
        action: () => onRenameWorkspaceAlias(workspaceId),
      });
      const reloadItem = await MenuItem.new({
        text: "刷新对话",
        action: () => onReloadWorkspaceThreads(workspaceId),
      });
      const deleteItem = await MenuItem.new({
        text: "删除",
        action: () => onDeleteWorkspace(workspaceId),
      });
      const menu = await Menu.new({
        items: [renameAliasItem, reloadItem, deleteItem],
      });
      const window = getCurrentWindow();
      const position = resolveMenuPosition(event);
      await menu.popup(position, window);
    },
    [onDeleteWorkspace, onReloadWorkspaceThreads, onRenameWorkspaceAlias],
  );

  const showWorktreeMenu = useCallback(
    async (event: SidebarMenuTriggerEvent, worktree: WorkspaceInfo) => {
      stopMenuTriggerEvent(event);
      const fileManagerLabel = fileManagerName();
      const reloadItem = await MenuItem.new({
        text: "刷新对话",
        action: () => onReloadWorkspaceThreads(worktree.id),
      });
      const revealItem = await MenuItem.new({
        text: `在${fileManagerLabel}中显示`,
        action: async () => {
          if (!worktree.path) {
            return;
          }
          try {
            const { revealItemInDir } = await import(
              "@tauri-apps/plugin-opener"
            );
            await revealItemInDir(worktree.path);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            pushErrorToast({
              title: `无法在${fileManagerLabel}中显示工作树`,
              message,
            });
            console.warn("Failed to reveal worktree", {
              message,
              workspaceId: worktree.id,
              path: worktree.path,
            });
          }
        },
      });
      const deleteItem = await MenuItem.new({
        text: "删除工作树",
        action: () => onDeleteWorktree(worktree.id),
      });
      const menu = await Menu.new({ items: [reloadItem, revealItem, deleteItem] });
      const window = getCurrentWindow();
      const position = resolveMenuPosition(event);
      await menu.popup(position, window);
    },
    [onReloadWorkspaceThreads, onDeleteWorktree],
  );

  return { showThreadMenu, showWorkspaceMenu, showWorktreeMenu };
}
