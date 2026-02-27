import { describe, expect, it } from "vitest";
import type { GitFileStatus, WorkspaceInfo } from "../../../types";
import {
  applyDiffStatsToFiles,
  buildAppCssVars,
  buildCommandPaletteItems,
  buildCompactThreadConnectionIndicatorMeta,
  buildGitStatusForPanel,
  deriveIsGitPanelVisible,
  deriveShowCompactCodexThreadActions,
  deriveTabletTab,
  resolveCompactThreadConnectionState,
  shouldLoadGitHubPanelData,
  type AppTab,
  type CompactThreadConnectionState,
  type DiffSource,
  type GitPanelMode,
} from "./appUiHelpers";

function legacyTabletTab(activeTab: AppTab): "codex" | "git" | "log" {
  return activeTab === "projects" || activeTab === "home" ? "codex" : activeTab;
}

function legacyShouldLoadGitHubPanelData(params: {
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

function legacyIsGitPanelVisible(params: {
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

function legacyShowCompactCodexThreadActions(params: {
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

function legacyCompactThreadConnectionState(params: {
  isWorkspaceConnected: boolean;
  backendMode: "local" | "remote";
  remoteThreadConnectionState: "live" | "polling" | "disconnected";
}): "live" | "polling" | "disconnected" {
  return !params.isWorkspaceConnected
    ? "disconnected"
    : params.backendMode === "remote"
      ? params.remoteThreadConnectionState
      : "live";
}

function legacyCompactThreadConnectionIndicatorMeta(state: CompactThreadConnectionState): {
  stateClassName: "is-live" | "is-polling" | "is-disconnected";
  title: string;
  label: "Live" | "Polling" | "Disconnected";
} {
  return {
    stateClassName:
      state === "live" ? "is-live" : state === "polling" ? "is-polling" : "is-disconnected",
    title:
      state === "live"
        ? "Receiving live thread events"
        : state === "polling"
          ? "Connected, syncing thread state by polling"
          : "Disconnected from backend",
    label: state === "live" ? "Live" : state === "polling" ? "Polling" : "Disconnected",
  };
}

function legacyBuildGitStatusForPanel(params: {
  branchName: string;
  files: GitFileStatus[];
  stagedFiles: GitFileStatus[];
  unstagedFiles: GitFileStatus[];
  totalAdditions: number;
  totalDeletions: number;
  error: string | null;
}, statsByPath: Record<string, { additions: number; deletions: number }>) {
  const stagedFiles = applyDiffStatsToFiles(params.stagedFiles, statsByPath);
  const unstagedFiles = applyDiffStatsToFiles(params.unstagedFiles, statsByPath);
  const files = applyDiffStatsToFiles(params.files, statsByPath);
  const totalAdditions =
    stagedFiles.reduce((sum, file) => sum + file.additions, 0) +
    unstagedFiles.reduce((sum, file) => sum + file.additions, 0);
  const totalDeletions =
    stagedFiles.reduce((sum, file) => sum + file.deletions, 0) +
    unstagedFiles.reduce((sum, file) => sum + file.deletions, 0);
  return {
    ...params,
    files,
    stagedFiles,
    unstagedFiles,
    totalAdditions,
    totalDeletions,
  };
}

function legacyBuildAppCssVars(params: {
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
}) {
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

function legacyBuildCommandPaletteItems(params: {
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
}) {
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

function summarizeCommandItems(
  items: Array<{ id: string; label: string; section: string; shortcut?: string; action: () => void }>,
) {
  return items.map(({ id, label, section, shortcut, action }) => ({
    id,
    label,
    section,
    shortcut,
    hasAction: typeof action === "function",
  }));
}

describe("appUiHelpers contract", () => {
  it("keeps tablet tab derivation semantics", () => {
    const allTabs: AppTab[] = ["home", "projects", "codex", "git", "log"];
    for (const tab of allTabs) {
      expect(deriveTabletTab(tab)).toBe(legacyTabletTab(tab));
    }
  });

  it("keeps GitHub panel lazy-load condition semantics", () => {
    const bools = [true, false];
    const panelModes: GitPanelMode[] = ["issues", "prs", "local"];
    const diffSources: DiffSource[] = ["local", "pr"];

    for (const isGitPanelVisible of bools) {
      for (const gitPanelMode of panelModes) {
        for (const shouldLoadDiffs of bools) {
          for (const diffSource of diffSources) {
            const params = { isGitPanelVisible, gitPanelMode, shouldLoadDiffs, diffSource };
            expect(shouldLoadGitHubPanelData(params)).toBe(legacyShouldLoadGitHubPanelData(params));
          }
        }
      }
    }
  });

  it("keeps git panel visibility derivation semantics", () => {
    const bools = [true, false];
    const tabs: AppTab[] = ["home", "projects", "codex", "git", "log"];
    const tabletTabs: Array<"codex" | "git" | "log"> = ["codex", "git", "log"];

    for (const hasActiveWorkspace of bools) {
      for (const isCompact of bools) {
        for (const isTablet of bools) {
          for (const tabletTab of tabletTabs) {
            for (const activeTab of tabs) {
              for (const rightPanelCollapsed of bools) {
                const params = {
                  hasActiveWorkspace,
                  isCompact,
                  isTablet,
                  tabletTab,
                  activeTab,
                  rightPanelCollapsed,
                };
                expect(deriveIsGitPanelVisible(params)).toBe(legacyIsGitPanelVisible(params));
              }
            }
          }
        }
      }
    }
  });

  it("keeps compact codex thread action visibility semantics", () => {
    const bools = [true, false];
    const tabs: AppTab[] = ["home", "projects", "codex", "git", "log"];
    const tabletTabs: Array<"codex" | "git" | "log"> = ["codex", "git", "log"];

    for (const hasActiveWorkspace of bools) {
      for (const isCompact of bools) {
        for (const isPhone of bools) {
          for (const isTablet of bools) {
            for (const activeTab of tabs) {
              for (const tabletTab of tabletTabs) {
                const params = {
                  hasActiveWorkspace,
                  isCompact,
                  isPhone,
                  isTablet,
                  activeTab,
                  tabletTab,
                };
                expect(deriveShowCompactCodexThreadActions(params)).toBe(
                  legacyShowCompactCodexThreadActions(params),
                );
              }
            }
          }
        }
      }
    }
  });

  it("keeps compact thread connection state semantics", () => {
    const bools = [true, false];
    const backendModes: Array<"local" | "remote"> = ["local", "remote"];
    const remoteStates: Array<"live" | "polling" | "disconnected"> = [
      "live",
      "polling",
      "disconnected",
    ];

    for (const isWorkspaceConnected of bools) {
      for (const backendMode of backendModes) {
        for (const remoteThreadConnectionState of remoteStates) {
          const params = { isWorkspaceConnected, backendMode, remoteThreadConnectionState };
          expect(resolveCompactThreadConnectionState(params)).toBe(
            legacyCompactThreadConnectionState(params),
          );
        }
      }
    }
  });

  it("keeps compact thread connection indicator copy/style semantics", () => {
    const states: CompactThreadConnectionState[] = ["live", "polling", "disconnected"];
    for (const state of states) {
      expect(buildCompactThreadConnectionIndicatorMeta(state)).toEqual(
        legacyCompactThreadConnectionIndicatorMeta(state),
      );
    }
  });

  it("keeps git panel status aggregation semantics", () => {
    const gitStatus = {
      branchName: "main",
      files: [
        { path: "src/a.ts", status: "M", additions: 1, deletions: 2 },
        { path: "src/b.ts", status: "M", additions: 3, deletions: 4 },
      ],
      stagedFiles: [{ path: "src/a.ts", status: "M", additions: 1, deletions: 2 }],
      unstagedFiles: [{ path: "src/b.ts", status: "M", additions: 3, deletions: 4 }],
      totalAdditions: 0,
      totalDeletions: 0,
      error: null,
    };
    const statsByPath = {
      "src/a.ts": { additions: 8, deletions: 5 },
      "src/b.ts": { additions: 2, deletions: 1 },
    };

    expect(buildGitStatusForPanel(gitStatus, statsByPath)).toEqual(
      legacyBuildGitStatusForPanel(gitStatus, statsByPath),
    );
  });

  it("keeps app CSS variable derivation semantics", () => {
    const compactValues = {
      isCompact: true,
      sidebarWidth: 320,
      sidebarCollapsed: true,
      rightPanelWidth: 360,
      rightPanelCollapsed: true,
      planPanelHeight: 250,
      terminalPanelHeight: 280,
      debugPanelHeight: 290,
      uiFontFamily: "Inter",
      codeFontFamily: "Fira Code",
      codeFontSize: 13,
      messageFontSize: 14,
    };
    const desktopValues = {
      ...compactValues,
      isCompact: false,
      sidebarCollapsed: false,
      rightPanelCollapsed: false,
    };

    expect(buildAppCssVars(compactValues)).toEqual(legacyBuildAppCssVars(compactValues));
    expect(buildAppCssVars(desktopValues)).toEqual(legacyBuildAppCssVars(desktopValues));
  });

  it("keeps command palette item shape semantics", () => {
    const noop = () => {};
    const activeWorkspace = { id: "workspace-1", name: "Main" } as WorkspaceInfo;
    const baseParams = {
      newAgentShortcut: null,
      newWorktreeAgentShortcut: null,
      toggleTerminalShortcut: null,
      toggleProjectsSidebarShortcut: null,
      onAddWorkspace: noop,
      onAddWorkspaceFromUrl: noop,
      onAddAgent: (_workspace: WorkspaceInfo) => {},
      onAddWorktreeAgent: (_workspace: WorkspaceInfo) => {},
      onToggleTerminal: noop,
      onExpandSidebar: noop,
      onCollapseSidebar: noop,
      onOpenSettings: noop,
    };

    const withoutWorkspaceParams = {
      ...baseParams,
      activeWorkspace: null,
      sidebarCollapsed: false,
    };
    const withWorkspaceParams = {
      ...baseParams,
      activeWorkspace,
      sidebarCollapsed: true,
    };

    expect(summarizeCommandItems(buildCommandPaletteItems(withoutWorkspaceParams))).toEqual(
      summarizeCommandItems(legacyBuildCommandPaletteItems(withoutWorkspaceParams)),
    );
    expect(summarizeCommandItems(buildCommandPaletteItems(withWorkspaceParams))).toEqual(
      summarizeCommandItems(legacyBuildCommandPaletteItems(withWorkspaceParams)),
    );
  });

  it("keeps command palette action routing semantics", () => {
    const activeWorkspace = { id: "workspace-1", name: "Main" } as WorkspaceInfo;

    const runScenario = (sidebarCollapsed: boolean) => {
      const legacyCalls: string[] = [];
      const nextCalls: string[] = [];
      const baseParams = {
        activeWorkspace,
        newAgentShortcut: null,
        newWorktreeAgentShortcut: null,
        toggleTerminalShortcut: null,
        toggleProjectsSidebarShortcut: null,
        sidebarCollapsed,
        onAddWorkspace: () => {
          legacyCalls.push("add-workspace");
        },
        onAddWorkspaceFromUrl: () => {
          legacyCalls.push("add-workspace-from-url");
        },
        onAddAgent: (workspace: WorkspaceInfo) => {
          legacyCalls.push(`new-agent:${workspace.id}`);
        },
        onAddWorktreeAgent: (workspace: WorkspaceInfo) => {
          legacyCalls.push(`new-worktree:${workspace.id}`);
        },
        onToggleTerminal: () => {
          legacyCalls.push("toggle-terminal");
        },
        onExpandSidebar: () => {
          legacyCalls.push("expand-sidebar");
        },
        onCollapseSidebar: () => {
          legacyCalls.push("collapse-sidebar");
        },
        onOpenSettings: () => {
          legacyCalls.push("open-settings");
        },
      };
      const legacyItems = legacyBuildCommandPaletteItems(baseParams);
      for (const item of legacyItems) {
        item.action();
      }

      const nextParams = {
        ...baseParams,
        onAddWorkspace: () => {
          nextCalls.push("add-workspace");
        },
        onAddWorkspaceFromUrl: () => {
          nextCalls.push("add-workspace-from-url");
        },
        onAddAgent: (workspace: WorkspaceInfo) => {
          nextCalls.push(`new-agent:${workspace.id}`);
        },
        onAddWorktreeAgent: (workspace: WorkspaceInfo) => {
          nextCalls.push(`new-worktree:${workspace.id}`);
        },
        onToggleTerminal: () => {
          nextCalls.push("toggle-terminal");
        },
        onExpandSidebar: () => {
          nextCalls.push("expand-sidebar");
        },
        onCollapseSidebar: () => {
          nextCalls.push("collapse-sidebar");
        },
        onOpenSettings: () => {
          nextCalls.push("open-settings");
        },
      };
      const nextItems = buildCommandPaletteItems(nextParams);
      for (const item of nextItems) {
        item.action();
      }

      expect(nextCalls).toEqual(legacyCalls);
    };

    runScenario(true);
    runScenario(false);
  });
});
