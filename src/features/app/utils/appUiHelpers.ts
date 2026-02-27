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

export type GitPanelMode = "issues" | "prs" | "local" | "diff" | "log";

export type DiffSource = "local" | "pr" | "commit";

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

export type LatestAgentRunEntry = {
  threadId: string;
  message: string;
  timestamp: number;
  projectName: string;
  groupName?: string | null;
  workspaceId: string;
  isProcessing: boolean;
};

export type RecentThreadInstance = {
  id: string;
  workspaceId: string;
  threadId: string;
  modelId: string | null;
  modelLabel: string;
  sequence: number;
};

export type ContinueThreadConfig = {
  enabled: boolean;
  prompt: string;
};

export type QueueHealthArtifact = {
  queueLength: number;
  inFlight: boolean;
};

export type QueueHealthEntry = {
  threadId: string;
  queueLength: number;
  inFlight: boolean;
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

export function deriveShowMobilePollingFetchStatus(params: {
  showCompactCodexThreadActions: boolean;
  isWorkspaceConnected: boolean;
  backendMode: "local" | "remote";
  remoteThreadConnectionState: CompactThreadConnectionState;
}): boolean {
  return (
    params.showCompactCodexThreadActions &&
    params.isWorkspaceConnected &&
    params.backendMode === "remote" &&
    params.remoteThreadConnectionState === "polling"
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

export function resolvePreferredThreadId(params: {
  workspaceId: string;
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  threadsByWorkspace: Record<string, Array<{ id: string }>>;
}): string | null {
  if (params.activeWorkspaceId === params.workspaceId && params.activeThreadId) {
    return params.activeThreadId;
  }
  return params.threadsByWorkspace[params.workspaceId]?.[0]?.id ?? null;
}

export function buildThreadWorkspaceById(params: {
  workspaces: Array<{ id: string }>;
  threadsByWorkspace: Record<string, Array<{ id: string }>>;
}): Record<string, string> {
  const result: Record<string, string> = {};
  for (const workspace of params.workspaces) {
    const threads = params.threadsByWorkspace[workspace.id] ?? [];
    for (const thread of threads) {
      result[thread.id] = workspace.id;
    }
  }
  return result;
}

export function buildQueueArtifactsByThread(
  entries: QueueHealthEntry[],
): Record<string, QueueHealthArtifact> {
  const byThread: Record<string, QueueHealthArtifact> = {};
  entries.forEach((entry) => {
    byThread[entry.threadId] = {
      queueLength: entry.queueLength,
      inFlight: entry.inFlight,
    };
  });
  return byThread;
}

export function resolveActiveContinueConfig(params: {
  activeThreadId: string | null;
  continueConfigByThread: Record<string, ContinueThreadConfig>;
  defaultPrompt: string;
}): ContinueThreadConfig {
  if (params.activeThreadId) {
    return (
      params.continueConfigByThread[params.activeThreadId] ?? {
        enabled: false,
        prompt: params.defaultPrompt,
      }
    );
  }
  return {
    enabled: false,
    prompt: params.defaultPrompt,
  };
}

export function buildContinueConfigForModeChange(params: {
  prev: Record<string, ContinueThreadConfig>;
  activeThreadId: string;
  enabled: boolean;
  defaultPrompt: string;
}): Record<string, ContinueThreadConfig> {
  return {
    ...params.prev,
    [params.activeThreadId]: {
      enabled: params.enabled,
      prompt: params.prev[params.activeThreadId]?.prompt ?? params.defaultPrompt,
    },
  };
}

export function buildContinueConfigForPromptChange(params: {
  prev: Record<string, ContinueThreadConfig>;
  activeThreadId: string;
  prompt: string;
}): Record<string, ContinueThreadConfig> {
  return {
    ...params.prev,
    [params.activeThreadId]: {
      enabled: params.prev[params.activeThreadId]?.enabled ?? false,
      prompt: params.prompt,
    },
  };
}

export function buildAppClassName(params: {
  isCompact: boolean;
  isPhone: boolean;
  isTablet: boolean;
  shouldReduceTransparency: boolean;
  sidebarCollapsed: boolean;
  rightPanelCollapsed: boolean;
}): string {
  return `app ${params.isCompact ? "layout-compact" : "layout-desktop"}${
    params.isPhone ? " layout-phone" : ""
  }${params.isTablet ? " layout-tablet" : ""}${
    params.shouldReduceTransparency ? " reduced-transparency" : ""
  }${!params.isCompact && params.sidebarCollapsed ? " sidebar-collapsed" : ""}${
    !params.isCompact && params.rightPanelCollapsed ? " right-panel-collapsed" : ""
  }`;
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

export function buildLatestAgentRuns(params: {
  workspaces: WorkspaceInfo[];
  threadsByWorkspace: Record<string, Array<{ id: string }>>;
  lastAgentMessageByThread: Record<string, { text: string; timestamp: number }>;
  threadStatusById: Record<string, { isProcessing?: boolean }>;
  getWorkspaceGroupName: (workspaceId: string) => string | null | undefined;
  limit?: number;
}): LatestAgentRunEntry[] {
  const entries: LatestAgentRunEntry[] = [];
  params.workspaces.forEach((workspace) => {
    const threads = params.threadsByWorkspace[workspace.id] ?? [];
    threads.forEach((thread) => {
      const entry = params.lastAgentMessageByThread[thread.id];
      if (!entry) {
        return;
      }
      entries.push({
        threadId: thread.id,
        message: entry.text,
        timestamp: entry.timestamp,
        projectName: workspace.name,
        groupName: params.getWorkspaceGroupName(workspace.id),
        workspaceId: workspace.id,
        isProcessing: params.threadStatusById[thread.id]?.isProcessing ?? false,
      });
    });
  });
  return entries.sort((a, b) => b.timestamp - a.timestamp).slice(0, params.limit ?? 3);
}

export function buildRecentThreadsSnapshot(params: {
  activeWorkspaceId: string | null;
  threadsByWorkspace: Record<string, Array<{ id: string; updatedAt: number; name?: string | null }>>;
  recentThreadLimit: number;
}): {
  recentThreadInstances: RecentThreadInstance[];
  recentThreadsUpdatedAt: number | null;
} {
  if (!params.activeWorkspaceId) {
    return { recentThreadInstances: [], recentThreadsUpdatedAt: null };
  }
  const threads = params.threadsByWorkspace[params.activeWorkspaceId] ?? [];
  if (threads.length === 0) {
    return { recentThreadInstances: [], recentThreadsUpdatedAt: null };
  }
  const sorted = [...threads].sort((a, b) => b.updatedAt - a.updatedAt);
  const slice = sorted.slice(0, params.recentThreadLimit);
  const updatedAt = slice.reduce(
    (max, thread) => (thread.updatedAt > max ? thread.updatedAt : max),
    0,
  );
  const instances = slice.map((thread, index) => ({
    id: `recent-${thread.id}`,
    workspaceId: params.activeWorkspaceId as string,
    threadId: thread.id,
    modelId: null,
    modelLabel: thread.name?.trim() || "未命名对话",
    sequence: index + 1,
  }));
  return {
    recentThreadInstances: instances,
    recentThreadsUpdatedAt: updatedAt > 0 ? updatedAt : null,
  };
}
