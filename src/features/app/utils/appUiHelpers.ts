import type { GitFileStatus, WorkspaceInfo } from "../../../types";

export const MESSAGE_FONT_SIZE_STORAGE_NAME = "codexmonitor.messageFontSize";
const MESSAGE_FONT_SIZE_MIN = 11;
const MESSAGE_FONT_SIZE_MAX = 16;
const MESSAGE_FONT_SIZE_DEFAULT = 13;

export type DiffLineStats = {
  additions: number;
  deletions: number;
};

export type AppTab = "home" | "projects" | "codex" | "git" | "log";

export type GitPanelMode = "issues" | "prs" | "local";

export type DiffSource = "local" | "pr";

export type CompactThreadConnectionState = "live" | "polling" | "disconnected";
export type CompactThreadConnectionIndicatorMeta = {
  stateClassName: "is-live" | "is-polling" | "is-disconnected";
  title: string;
  label: "Live" | "Polling" | "Disconnected";
};

export type CommandPaletteItem = {
  id: string;
  label: string;
  section: string;
  shortcut?: string;
  action: () => void;
};

export function deriveTabletTab(activeTab: AppTab): "codex" | "git" | "log" {
  return activeTab === "projects" || activeTab === "home" ? "codex" : activeTab;
}

export function deriveIsGitPanelVisible(params: {
  hasActiveWorkspace: boolean;
  isCompact: boolean;
  isTablet: boolean;
  tabletTab: "codex" | "git" | "log";
  activeTab: AppTab;
  rightPanelCollapsed: boolean;
}): boolean {
  return Boolean(
    params.hasActiveWorkspace &&
      (params.isCompact
        ? (params.isTablet ? params.tabletTab : params.activeTab) === "git"
        : !params.rightPanelCollapsed),
  );
}

export function deriveShowCompactCodexThreadActions(params: {
  hasActiveWorkspace: boolean;
  isCompact: boolean;
  isPhone: boolean;
  isTablet: boolean;
  activeTab: AppTab;
  tabletTab: "codex" | "git" | "log";
}): boolean {
  return (
    params.hasActiveWorkspace &&
    params.isCompact &&
    ((params.isPhone && params.activeTab === "codex") ||
      (params.isTablet && params.tabletTab === "codex"))
  );
}

export function deriveShowComposer(params: {
  isCompact: boolean;
  centerMode: "chat" | "diff";
  isTablet: boolean;
  tabletTab: "codex" | "git" | "log";
  activeTab: AppTab;
  showWorkspaceHome: boolean;
}): boolean {
  return (
    (params.isCompact
      ? (params.isTablet ? params.tabletTab : params.activeTab) === "codex"
      : params.centerMode === "chat" || params.centerMode === "diff") &&
    !params.showWorkspaceHome
  );
}

export function shouldLoadGitHubPanelData(params: {
  isGitPanelVisible: boolean;
  gitPanelMode: GitPanelMode;
  shouldLoadDiffs: boolean;
  diffSource: DiffSource;
}): boolean {
  return (
    params.isGitPanelVisible &&
    (params.gitPanelMode === "issues" ||
      params.gitPanelMode === "prs" ||
      (params.shouldLoadDiffs && params.diffSource === "pr"))
  );
}

export function resolveCompactThreadConnectionState(params: {
  isWorkspaceConnected: boolean;
  backendMode: "local" | "remote";
  remoteThreadConnectionState: "live" | "polling" | "disconnected";
}): CompactThreadConnectionState {
  if (!params.isWorkspaceConnected) {
    return "disconnected";
  }
  return params.backendMode === "remote" ? params.remoteThreadConnectionState : "live";
}

export function buildCompactThreadConnectionIndicatorMeta(
  state: CompactThreadConnectionState,
): CompactThreadConnectionIndicatorMeta {
  if (state === "live") {
    return {
      stateClassName: "is-live",
      title: "Receiving live thread events",
      label: "Live",
    };
  }
  if (state === "polling") {
    return {
      stateClassName: "is-polling",
      title: "Connected, syncing thread state by polling",
      label: "Polling",
    };
  }
  return {
    stateClassName: "is-disconnected",
    title: "Disconnected from backend",
    label: "Disconnected",
  };
}

export function deriveFileStatusLabel(params: {
  hasError: boolean;
  changedFileCount: number;
}): string {
  if (params.hasError) {
    return "Git 状态不可用";
  }
  if (params.changedFileCount > 0) {
    return `${params.changedFileCount} 个文件已更改`;
  }
  return "工作树无更改";
}

export function clampMessageFontSize(value: number): number {
  if (!Number.isFinite(value)) {
    return MESSAGE_FONT_SIZE_DEFAULT;
  }
  return Math.min(
    MESSAGE_FONT_SIZE_MAX,
    Math.max(MESSAGE_FONT_SIZE_MIN, Math.round(value)),
  );
}

export function loadMessageFontSize(): number {
  if (typeof window === "undefined") {
    return MESSAGE_FONT_SIZE_DEFAULT;
  }
  try {
    const raw = window.localStorage.getItem(MESSAGE_FONT_SIZE_STORAGE_NAME);
    if (!raw) {
      return MESSAGE_FONT_SIZE_DEFAULT;
    }
    return clampMessageFontSize(Number(raw));
  } catch (error) {
    const traceId = `font-size-storage-${Date.now()}`;
    console.warn("[app-ui][font-size-load-failed]", {
      traceId,
      requestId: traceId,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      storage: MESSAGE_FONT_SIZE_STORAGE_NAME,
    });
    return MESSAGE_FONT_SIZE_DEFAULT;
  }
}

export function countDiffLineStats(diffText: string): DiffLineStats {
  let additions = 0;
  let deletions = 0;
  for (const line of diffText.split("\n")) {
    if (
      !line ||
      line.startsWith("+++") ||
      line.startsWith("---") ||
      line.startsWith("diff --git") ||
      line.startsWith("@@") ||
      line.startsWith("index ") ||
      line.startsWith("\\ No newline")
    ) {
      continue;
    }
    if (line.startsWith("+")) {
      additions += 1;
    } else if (line.startsWith("-")) {
      deletions += 1;
    }
  }
  return { additions, deletions };
}

export function applyDiffStatsToFiles(
  files: GitFileStatus[],
  statsByPath: Record<string, DiffLineStats>,
): GitFileStatus[] {
  return files.map((file) => {
    const stats = statsByPath[file.path];
    if (!stats) {
      return file;
    }
    return {
      ...file,
      additions: stats.additions,
      deletions: stats.deletions,
    };
  });
}

export function buildGitStatusForPanel<
  T extends {
    files: GitFileStatus[];
    stagedFiles: GitFileStatus[];
    unstagedFiles: GitFileStatus[];
    totalAdditions: number;
    totalDeletions: number;
  },
>(gitStatus: T, statsByPath: Record<string, DiffLineStats>): T {
  const stagedFiles = applyDiffStatsToFiles(gitStatus.stagedFiles, statsByPath);
  const unstagedFiles = applyDiffStatsToFiles(gitStatus.unstagedFiles, statsByPath);
  const files = applyDiffStatsToFiles(gitStatus.files, statsByPath);
  const totalAdditions =
    stagedFiles.reduce((sum, file) => sum + file.additions, 0) +
    unstagedFiles.reduce((sum, file) => sum + file.additions, 0);
  const totalDeletions =
    stagedFiles.reduce((sum, file) => sum + file.deletions, 0) +
    unstagedFiles.reduce((sum, file) => sum + file.deletions, 0);
  return {
    ...gitStatus,
    files,
    stagedFiles,
    unstagedFiles,
    totalAdditions,
    totalDeletions,
  };
}

export function buildAppCssVars(params: {
  isCompact: boolean;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  rightPanelWidth: number;
  rightPanelCollapsed: boolean;
  planPanelHeight: number;
  terminalPanelHeight: number;
  debugPanelHeight: number;
  uiFontFamily: string;
  codeFontFamily: string;
  codeFontSize: number;
  messageFontSize: number;
}): Record<string, string> {
  return {
    "--sidebar-width": `${params.isCompact ? params.sidebarWidth : params.sidebarCollapsed ? 0 : params.sidebarWidth}px`,
    "--right-panel-width": `${params.isCompact ? params.rightPanelWidth : params.rightPanelCollapsed ? 0 : params.rightPanelWidth}px`,
    "--plan-panel-height": `${params.planPanelHeight}px`,
    "--terminal-panel-height": `${params.terminalPanelHeight}px`,
    "--debug-panel-height": `${params.debugPanelHeight}px`,
    "--ui-font-family": params.uiFontFamily,
    "--code-font-family": params.codeFontFamily,
    "--code-font-size": `${params.codeFontSize}px`,
    "--message-font-size": `${params.messageFontSize}px`,
  };
}

export function buildCommandPaletteItems(params: {
  activeWorkspace: WorkspaceInfo | null;
  newAgentShortcut: string | null;
  newWorktreeAgentShortcut: string | null;
  toggleTerminalShortcut: string | null;
  toggleProjectsSidebarShortcut: string | null;
  sidebarCollapsed: boolean;
  onAddWorkspace: () => void;
  onAddWorkspaceFromUrl: () => void;
  onAddAgent: (workspace: WorkspaceInfo) => void;
  onAddWorktreeAgent: (workspace: WorkspaceInfo) => void;
  onToggleTerminal: () => void;
  onExpandSidebar: () => void;
  onCollapseSidebar: () => void;
  onOpenSettings: () => void;
}): CommandPaletteItem[] {
  const activeWorkspace = params.activeWorkspace;
  return [
    {
      id: "add-workspace",
      label: "添加工作区",
      section: "工作区",
      action: () => {
        params.onAddWorkspace();
      },
    },
    {
      id: "add-workspace-from-url",
      label: "从 URL 添加工作区",
      section: "工作区",
      action: params.onAddWorkspaceFromUrl,
    },
    ...(activeWorkspace
      ? [
          {
            id: "new-agent",
            label: "新建 Agent",
            shortcut: params.newAgentShortcut ?? "⌘N",
            section: "工作区",
            action: () => {
              params.onAddAgent(activeWorkspace);
            },
          },
          {
            id: "new-worktree",
            label: "新建工作树 Agent",
            shortcut: params.newWorktreeAgentShortcut ?? undefined,
            section: "工作区",
            action: () => {
              params.onAddWorktreeAgent(activeWorkspace);
            },
          },
        ]
      : []),
    {
      id: "toggle-terminal",
      label: "切换终端",
      shortcut: params.toggleTerminalShortcut ?? "⌘`",
      section: "面板",
      action: params.onToggleTerminal,
    },
    {
      id: "toggle-sidebar",
      label: "切换侧栏",
      shortcut: params.toggleProjectsSidebarShortcut ?? undefined,
      section: "面板",
      action: () => {
        params.sidebarCollapsed ? params.onExpandSidebar() : params.onCollapseSidebar();
      },
    },
    {
      id: "open-settings",
      label: "打开设置",
      section: "导航",
      action: () => {
        params.onOpenSettings();
      },
    },
  ];
}
