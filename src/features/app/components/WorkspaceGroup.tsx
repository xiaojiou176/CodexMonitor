type WorkspaceGroupProps = {
  toggleId: string | null;
  name: string;
  showHeader: boolean;
  isCollapsed: boolean;
  onToggleCollapse: (groupId: string) => void;
  children: React.ReactNode;
};

export function WorkspaceGroup({
  toggleId,
  name,
  showHeader,
  isCollapsed,
  onToggleCollapse,
  children,
}: WorkspaceGroupProps) {
  const isToggleable = Boolean(toggleId);
  return (
    <div className="workspace-group">
      {showHeader && (
        <>
          {isToggleable ? (
            <button
              type="button"
              className="workspace-group-header is-toggleable"
              onClick={() => {
                if (!toggleId) {
                  return;
                }
                onToggleCollapse(toggleId);
              }}
              aria-label={isCollapsed ? "展开分组" : "折叠分组"}
              aria-expanded={!isCollapsed}
            >
              <span className="workspace-group-label">{name}</span>
              <span className={`group-toggle ${isCollapsed ? "" : "expanded"}`} aria-hidden>
                <span className="group-toggle-icon">›</span>
              </span>
            </button>
          ) : (
            <div className="workspace-group-header">
              <div className="workspace-group-label">{name}</div>
            </div>
          )}
        </>
      )}
      <div className={`workspace-group-list ${isCollapsed ? "collapsed" : ""}`}>
        <div className="workspace-group-content">{children}</div>
      </div>
    </div>
  );
}
