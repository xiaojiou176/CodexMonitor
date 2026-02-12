import Folder from "lucide-react/dist/esm/icons/folder";
import type { DragEvent, MouseEvent } from "react";

import type { WorkspaceInfo } from "../../../types";

type WorkspaceCardProps = {
  workspace: WorkspaceInfo;
  workspaceName?: React.ReactNode;
  isActive: boolean;
  isCollapsed: boolean;
  addMenuOpen: boolean;
  addMenuWidth: number;
  onSelectWorkspace: (id: string) => void;
  onShowWorkspaceMenu: (event: MouseEvent, workspaceId: string) => void;
  onToggleWorkspaceCollapse: (workspaceId: string, collapsed: boolean) => void;
  onConnectWorkspace: (workspace: WorkspaceInfo) => void;
  onToggleAddMenu: (anchor: {
    workspaceId: string;
    top: number;
    left: number;
    width: number;
  } | null) => void;
  isDraggable?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  dropPosition?: "before" | "after" | null;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (event: DragEvent<HTMLDivElement>) => void;
  isAliasEditing?: boolean;
  aliasDraft?: string;
  onAliasDraftChange?: (value: string) => void;
  onAliasSubmit?: () => void;
  onAliasCancel?: () => void;
  onStartAliasEdit?: (workspaceId: string) => void;
  children?: React.ReactNode;
};

export function WorkspaceCard({
  workspace,
  workspaceName,
  isActive,
  isCollapsed,
  addMenuOpen,
  addMenuWidth,
  onSelectWorkspace,
  onShowWorkspaceMenu,
  onToggleWorkspaceCollapse,
  onConnectWorkspace,
  onToggleAddMenu,
  isDraggable = false,
  isDragging = false,
  isDropTarget = false,
  dropPosition = null,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isAliasEditing = false,
  aliasDraft = "",
  onAliasDraftChange,
  onAliasSubmit,
  onAliasCancel,
  onStartAliasEdit,
  children,
}: WorkspaceCardProps) {
  const contentCollapsedClass = isCollapsed ? " collapsed" : "";

  return (
    <div className="workspace-card">
      <div
        className={`workspace-row ${isActive ? "active" : ""}${
          isDraggable ? " workspace-row-draggable" : ""
        }${isDragging ? " workspace-row-dragging" : ""}${
          isDropTarget ? " workspace-row-drop-target" : ""
        }${
          isDropTarget && dropPosition === "before"
            ? " workspace-row-drop-target-before"
            : ""
        }${
          isDropTarget && dropPosition === "after"
            ? " workspace-row-drop-target-after"
            : ""
        }`}
        role="button"
        tabIndex={0}
        onClick={() => onSelectWorkspace(workspace.id)}
        onContextMenu={(event) => onShowWorkspaceMenu(event, workspace.id)}
        draggable={isDraggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelectWorkspace(workspace.id);
          }
        }}
      >
        <div>
          <div className="workspace-name-row">
            <div className="workspace-title">
              <Folder className="workspace-icon" size={14} aria-hidden />
              {isAliasEditing ? (
                <input
                  className="workspace-alias-input"
                  value={aliasDraft}
                  onChange={(event) => onAliasDraftChange?.(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  onFocus={(event) => event.stopPropagation()}
                  onBlur={() => onAliasSubmit?.()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onAliasSubmit?.();
                      return;
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      onAliasCancel?.();
                    }
                  }}
                  aria-label="工作区自定义名称"
                  autoFocus
                />
              ) : (
                <span
                  className="workspace-name"
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onStartAliasEdit?.(workspace.id);
                  }}
                  title="双击重命名"
                >
                  {workspaceName ?? workspace.name}
                </span>
              )}
              <button
                className={`workspace-toggle ${isCollapsed ? "" : "expanded"}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleWorkspaceCollapse(workspace.id, !isCollapsed);
                }}
                data-tauri-drag-region="false"
                aria-label={isCollapsed ? "显示对话" : "隐藏对话"}
                aria-expanded={!isCollapsed}
              >
                <span className="workspace-toggle-icon">›</span>
              </button>
            </div>
            <button
              className="ghost workspace-add"
              onClick={(event) => {
                event.stopPropagation();
                const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                const left = Math.min(
                  Math.max(rect.left, 12),
                  window.innerWidth - addMenuWidth - 12,
                );
                const top = rect.bottom + 8;
                onToggleAddMenu(
                  addMenuOpen
                    ? null
                    : {
                        workspaceId: workspace.id,
                        top,
                        left,
                        width: addMenuWidth,
                      },
                );
              }}
              data-tauri-drag-region="false"
              aria-label="添加对话选项"
              aria-expanded={addMenuOpen}
            >
              +
            </button>
          </div>
        </div>
        {!workspace.connected && (
          <span
            className="connect"
            onClick={(event) => {
              event.stopPropagation();
              onConnectWorkspace(workspace);
            }}
          >
            连接
          </span>
        )}
      </div>
      <div
        className={`workspace-card-content${contentCollapsedClass}`}
        aria-hidden={isCollapsed}
        inert={isCollapsed ? true : undefined}
      >
        <div className="workspace-card-content-inner">{children}</div>
      </div>
    </div>
  );
}
