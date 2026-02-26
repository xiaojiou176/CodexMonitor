import Calendar from "lucide-react/dist/esm/icons/calendar";
import Clock3 from "lucide-react/dist/esm/icons/clock-3";
import FolderPlus from "lucide-react/dist/esm/icons/folder-plus";
import GitBranch from "lucide-react/dist/esm/icons/git-branch";
import Link2 from "lucide-react/dist/esm/icons/link-2";
import ListFilter from "lucide-react/dist/esm/icons/list-filter";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Search from "lucide-react/dist/esm/icons/search";
import { useCallback, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { ThreadListSortKey } from "../../../types";
import {
  PopoverMenuItem,
  PopoverSurface,
} from "../../design-system/components/popover/PopoverPrimitives";
import { useDismissibleMenu } from "../hooks/useDismissibleMenu";

type SidebarHeaderProps = {
  onSelectHome: () => void;
  onAddWorkspace: () => void;
  onAddWorkspaceFromUrl: () => void;
  onToggleSearch: () => void;
  isSearchOpen: boolean;
  threadListSortKey: ThreadListSortKey;
  onSetThreadListSortKey: (sortKey: ThreadListSortKey) => void;
  onRefreshAllThreads: () => void;
  showSubAgentThreadsInSidebar: boolean;
  onToggleShowSubAgentThreadsInSidebar: () => void;
  refreshDisabled?: boolean;
  refreshInProgress?: boolean;
};

export function SidebarHeader({
  onSelectHome,
  onAddWorkspace,
  onAddWorkspaceFromUrl,
  onToggleSearch,
  isSearchOpen,
  threadListSortKey,
  onSetThreadListSortKey,
  onRefreshAllThreads,
  showSubAgentThreadsInSidebar,
  onToggleShowSubAgentThreadsInSidebar,
  refreshDisabled = false,
  refreshInProgress = false,
}: SidebarHeaderProps) {
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const sortToggleRef = useRef<HTMLButtonElement | null>(null);
  const sortDropdownRef = useRef<HTMLDivElement | null>(null);

  const closeSortMenu = useCallback((restoreFocus: boolean) => {
    setSortMenuOpen(false);
    if (!restoreFocus) {
      return;
    }
    requestAnimationFrame(() => {
      sortToggleRef.current?.focus();
    });
  }, []);

  useDismissibleMenu({
    isOpen: sortMenuOpen,
    containerRef: sortMenuRef,
    onClose: () => closeSortMenu(false),
  });

  const handleSelectSort = (sortKey: ThreadListSortKey) => {
    closeSortMenu(true);
    if (sortKey === threadListSortKey) {
      return;
    }
    onSetThreadListSortKey(sortKey);
  };

  const focusSortOption = useCallback((index: number) => {
    const options = sortDropdownRef.current?.querySelectorAll<HTMLButtonElement>(
      "[role='menuitemradio']",
    );
    if (!options || options.length === 0) {
      return;
    }
    const normalizedIndex = Math.min(options.length - 1, Math.max(0, index));
    options[normalizedIndex]?.focus();
  }, []);

  const handleSortToggleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSortMenuOpen(true);
        requestAnimationFrame(() => {
          focusSortOption(0);
        });
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSortMenuOpen(true);
        requestAnimationFrame(() => {
          focusSortOption(1);
        });
      }
    },
    [focusSortOption],
  );

  const handleSortMenuKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const options = sortDropdownRef.current?.querySelectorAll<HTMLButtonElement>(
        "[role='menuitemradio']",
      );
      if (!options || options.length === 0) {
        return;
      }
      const activeElement = document.activeElement as HTMLButtonElement | null;
      const currentIndex = Array.from(options).findIndex((option) => option === activeElement);
      const focusAt = (index: number) => {
        const normalized = (index + options.length) % options.length;
        options[normalized]?.focus();
      };

      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusAt(currentIndex < 0 ? 0 : currentIndex + 1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        focusAt(currentIndex < 0 ? options.length - 1 : currentIndex - 1);
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        focusAt(0);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        focusAt(options.length - 1);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeSortMenu(true);
      }
    },
    [closeSortMenu],
  );

  return (
    <div className="sidebar-header">
      <div className="sidebar-header-title">
        <div className="sidebar-title-group">
          <button
            className="sidebar-title-add"
            onClick={onAddWorkspace}
            data-tauri-drag-region="false"
            aria-label="添加工作区"
            type="button"
            title="添加工作区"
          >
            <FolderPlus aria-hidden />
          </button>
          <button
            className="sidebar-title-add"
            onClick={onAddWorkspaceFromUrl}
            data-tauri-drag-region="false"
            aria-label="从 URL 添加工作区"
            type="button"
            title="从 URL 添加工作区"
          >
            <Link2 aria-hidden />
          </button>
          <button
            className="subtitle subtitle-button sidebar-title-button"
            onClick={onSelectHome}
            data-tauri-drag-region="false"
            aria-label="打开首页"
          >
            项目
          </button>
        </div>
      </div>
      <div className="sidebar-header-actions">
        <div className="sidebar-sort-menu" ref={sortMenuRef}>
          <button
            className={`ghost sidebar-sort-toggle${sortMenuOpen ? " is-active" : ""}`}
            onClick={() => setSortMenuOpen((open) => !open)}
            onKeyDown={handleSortToggleKeyDown}
            data-tauri-drag-region="false"
            aria-label="排序对话"
            aria-haspopup="menu"
            aria-expanded={sortMenuOpen}
            ref={sortToggleRef}
            type="button"
            title="排序对话"
          >
            <ListFilter aria-hidden />
          </button>
          {sortMenuOpen && (
            <PopoverSurface
              className="sidebar-sort-dropdown"
              role="menu"
              onKeyDown={handleSortMenuKeyDown}
              ref={sortDropdownRef}
            >
              <PopoverMenuItem
                className="sidebar-sort-option"
                role="menuitemradio"
                aria-checked={threadListSortKey === "updated_at"}
                onClick={() => handleSelectSort("updated_at")}
                data-tauri-drag-region="false"
                icon={<Clock3 aria-hidden />}
                active={threadListSortKey === "updated_at"}
              >
                最近更新
              </PopoverMenuItem>
              <PopoverMenuItem
                className="sidebar-sort-option"
                role="menuitemradio"
                aria-checked={threadListSortKey === "created_at"}
                onClick={() => handleSelectSort("created_at")}
                data-tauri-drag-region="false"
                icon={<Calendar aria-hidden />}
                active={threadListSortKey === "created_at"}
              >
                最新创建
              </PopoverMenuItem>
            </PopoverSurface>
          )}
        </div>
        <button
          className={`ghost sidebar-subagent-toggle${showSubAgentThreadsInSidebar ? " is-active" : ""}`}
          onClick={onToggleShowSubAgentThreadsInSidebar}
          data-tauri-drag-region="false"
          aria-label={showSubAgentThreadsInSidebar ? "隐藏子代理线程" : "显示子代理线程"}
          aria-pressed={showSubAgentThreadsInSidebar}
          type="button"
          title={showSubAgentThreadsInSidebar ? "隐藏子代理线程" : "显示子代理线程"}
        >
          <GitBranch aria-hidden />
        </button>
        <button
          className="ghost sidebar-refresh-toggle"
          onClick={onRefreshAllThreads}
          data-tauri-drag-region="false"
          aria-label="刷新全部工作区对话"
          type="button"
          title="刷新全部工作区对话"
          disabled={refreshDisabled}
          aria-busy={refreshInProgress}
        >
          <RefreshCw
            className={refreshInProgress ? "sidebar-refresh-icon spinning" : "sidebar-refresh-icon"}
            aria-hidden
          />
        </button>
        <button
          className={`ghost sidebar-search-toggle${isSearchOpen ? " is-active" : ""}`}
          onClick={onToggleSearch}
          data-tauri-drag-region="false"
          aria-label="切换搜索"
          aria-pressed={isSearchOpen}
          type="button"
        >
          <Search aria-hidden />
        </button>
      </div>
    </div>
  );
}
