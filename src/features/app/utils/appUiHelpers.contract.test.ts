import { describe, expect, it } from "vitest";
import type { GitFileStatus } from "../../../types";
import {
  applyDiffStatsToFiles,
  buildAppCssVars,
  buildGitStatusForPanel,
  deriveTabletTab,
  resolveCompactThreadConnectionState,
  shouldLoadGitHubPanelData,
  type AppTab,
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
});
