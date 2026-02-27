import { describe, expect, it } from "vitest";
import {
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
});
