import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { MainTopbar } from "../../app/components/MainTopbar";

type TabletLayoutProps = {
  tabletNavNode: ReactNode;
  approvalToastsNode: ReactNode;
  updateToastNode: ReactNode;
  errorToastsNode: ReactNode;
  homeNode: ReactNode;
  showHome: boolean;
  showWorkspace: boolean;
  sidebarNode: ReactNode;
  tabletTab: "projects" | "codex" | "git" | "log";
  onSidebarResizeStart: (event: MouseEvent<HTMLDivElement>) => void;
  onSidebarResizeKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  sidebarWidth: number;
  sidebarResizeMin: number;
  sidebarResizeMax: number;
  topbarLeftNode: ReactNode;
  codexTopbarActionsNode?: ReactNode;
  messagesNode: ReactNode;
  composerNode: ReactNode;
  gitDiffPanelNode: ReactNode;
  gitDiffViewerNode: ReactNode;
  debugPanelNode: ReactNode;
};

export function TabletLayout({
  tabletNavNode,
  approvalToastsNode,
  updateToastNode,
  errorToastsNode,
  homeNode,
  showHome,
  showWorkspace,
  sidebarNode,
  tabletTab,
  onSidebarResizeStart,
  onSidebarResizeKeyDown,
  sidebarWidth,
  sidebarResizeMin,
  sidebarResizeMax,
  topbarLeftNode,
  codexTopbarActionsNode,
  messagesNode,
  composerNode,
  gitDiffPanelNode,
  gitDiffViewerNode,
  debugPanelNode,
}: TabletLayoutProps) {
  return (
    <>
      {tabletNavNode}
      <div className="tablet-projects">{sidebarNode}</div>
      <div
        className="projects-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="调整项目面板大小"
        tabIndex={0}
        aria-valuemin={sidebarResizeMin}
        aria-valuemax={sidebarResizeMax}
        aria-valuenow={sidebarWidth}
        onMouseDown={onSidebarResizeStart}
        onKeyDown={onSidebarResizeKeyDown}
      />
      <main className="tablet-main" aria-label="主内容">
        {approvalToastsNode}
        {updateToastNode}
        {errorToastsNode}
        {showHome && homeNode}
        {showWorkspace && (
          <>
            <MainTopbar
              leftNode={topbarLeftNode}
              actionsNode={tabletTab === "codex" ? codexTopbarActionsNode : undefined}
              className="tablet-topbar"
            />
            {tabletTab === "codex" && (
              <>
                <div className="content tablet-content">{messagesNode}</div>
                {composerNode}
              </>
            )}
            {tabletTab === "git" && (
              <div className="tablet-git">
                {gitDiffPanelNode}
                <div className="tablet-git-viewer">{gitDiffViewerNode}</div>
              </div>
            )}
            {tabletTab === "log" && debugPanelNode}
          </>
        )}
      </main>
    </>
  );
}
