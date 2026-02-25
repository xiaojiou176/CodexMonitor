import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import * as notification from "@tauri-apps/plugin-notification";
import * as tauriService from "./tauri";
import {
  addWorkspace,
  appendStructuredLog,
  compactThread,
  createAgent,
  deleteAgent,
  fetchGit,
  forkThread,
  getAgentsSettings,
  getAppsList,
  getExperimentalFeatureList,
  getGitHubIssues,
  getGitLog,
  getGitStatus,
  getOpenAppIcon,
  listThreads,
  listMcpServerStatus,
  readAgentConfigToml,
  readGlobalAgentsMd,
  readGlobalCodexConfigToml,
  listWorkspaces,
  setAgentsCoreSettings,
  setAppBadgeCount,
  clearAppBadge,
  setCodexFeatureFlag,
  TauriInvokeBridgeUnavailableError,
  orbitConnectTest,
  orbitRunnerStart,
  orbitRunnerStatus,
  orbitRunnerStop,
  orbitSignInPoll,
  orbitSignInStart,
  orbitSignOut,
  openWorkspaceIn,
  readAgentMd,
  stageGitAll,
  respondToServerRequest,
  respondToUserInputRequest,
  sendUserMessage,
  steerTurn,
  sendNotification,
  startReview,
  setThreadName,
  updateAgent,
  threadLiveSubscribe,
  threadLiveUnsubscribe,
  tailscaleDaemonStart,
  tailscaleDaemonCommandPreview,
  tailscaleDaemonStatus,
  tailscaleDaemonStop,
  tailscaleStatus,
  writeGlobalAgentsMd,
  writeGlobalCodexConfigToml,
  writeAgentConfigToml,
  writeAgentMd,
} from "./tauri";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
  sendNotification: vi.fn(),
}));

describe("tauri invoke wrappers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "is_macos_debug_build") {
        return false;
      }
      return undefined;
    });
  });

  it("uses codex_bin for addWorkspace", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({ id: "ws-1" });

    await addWorkspace("/tmp/project", null);

    expect(invokeMock).toHaveBeenCalledWith("add_workspace", {
      path: "/tmp/project",
      codex_bin: null,
    });
  });

  it("maps add_workspace_from_git_url payload", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({ id: "ws-git" });

    await tauriService.addWorkspaceFromGitUrl(
      "https://github.com/acme/repo",
      "/tmp",
      "repo",
      null,
    );

    expect(invokeMock).toHaveBeenCalledWith("add_workspace_from_git_url", {
      url: "https://github.com/acme/repo",
      destinationPath: "/tmp",
      targetFolderName: "repo",
      codex_bin: null,
    });
  });

  it("maps workspace_id to workspaceId for git status", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({
      branchName: "main",
      files: [],
      stagedFiles: [],
      unstagedFiles: [],
      totalAdditions: 0,
      totalDeletions: 0,
    });

    await getGitStatus("ws-1");

    expect(invokeMock).toHaveBeenCalledWith("get_git_status", {
      workspaceId: "ws-1",
    });
  });

  it("maps structured log payload for append_structured_log", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce(undefined);

    await appendStructuredLog("ERROR", "useGitDiffs", "Failed to load git diffs", {
      workspaceId: "ws-1",
    });

    expect(invokeMock).toHaveBeenCalledWith("append_structured_log", {
      level: "ERROR",
      source: "useGitDiffs",
      message: "Failed to load git diffs",
      context: { workspaceId: "ws-1" },
    });
  });

  it("maps workspace_id to workspaceId for GitHub issues", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({ total: 0, issues: [] });

    await getGitHubIssues("ws-2");

    expect(invokeMock).toHaveBeenCalledWith("get_github_issues", {
      workspaceId: "ws-2",
    });
  });

  it("throws explicit bridge-unavailable error when the Tauri invoke bridge is missing", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockRejectedValueOnce(
      new TypeError("Cannot read properties of undefined (reading 'invoke')"),
    );

    await expect(listWorkspaces()).rejects.toBeInstanceOf(
      TauriInvokeBridgeUnavailableError,
    );
    expect(invokeMock).toHaveBeenCalledWith("list_workspaces");
  });

  it("rethrows non-bridge list workspace errors", async () => {
    const invokeMock = vi.mocked(invoke);
    const error = new Error("boom");
    invokeMock.mockRejectedValueOnce(error);

    await expect(listWorkspaces()).rejects.toBe(error);
  });

  it("applies default limit for git log", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({
      total: 0,
      entries: [],
      ahead: 0,
      behind: 0,
      aheadEntries: [],
      behindEntries: [],
      upstream: null,
    });

    await getGitLog("ws-3");

    expect(invokeMock).toHaveBeenCalledWith("get_git_log", {
      workspaceId: "ws-3",
      limit: 40,
    });
  });

  it("maps workspaceId and threadId for fork_thread", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await forkThread("ws-9", "thread-9");

    expect(invokeMock).toHaveBeenCalledWith("fork_thread", {
      workspaceId: "ws-9",
      threadId: "thread-9",
    });
  });

  it("maps workspaceId and threadId for compact_thread", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await compactThread("ws-10", "thread-10");

    expect(invokeMock).toHaveBeenCalledWith("compact_thread", {
      workspaceId: "ws-10",
      threadId: "thread-10",
    });
  });

  it("maps workspaceId and threadId for thread_live_subscribe", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await threadLiveSubscribe("ws-11", "thread-11");

    expect(invokeMock).toHaveBeenCalledWith("thread_live_subscribe", {
      workspaceId: "ws-11",
      threadId: "thread-11",
    });
  });

  it("maps workspaceId and threadId for thread_live_unsubscribe", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await threadLiveUnsubscribe("ws-12", "thread-12");

    expect(invokeMock).toHaveBeenCalledWith("thread_live_unsubscribe", {
      workspaceId: "ws-12",
      threadId: "thread-12",
    });
  });

  it("maps workspaceId/threadId/name for set_thread_name", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await setThreadName("ws-9", "thread-9", "New Name");

    expect(invokeMock).toHaveBeenCalledWith("set_thread_name", {
      workspaceId: "ws-9",
      threadId: "thread-9",
      name: "New Name",
    });
  });

  it("maps workspaceId/cursor/limit for list_mcp_server_status", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await listMcpServerStatus("ws-10", "cursor-1", 25);

    expect(invokeMock).toHaveBeenCalledWith("list_mcp_server_status", {
      workspaceId: "ws-10",
      cursor: "cursor-1",
      limit: 25,
    });
  });

  it("maps workspaceId/cursor/limit/sortKey/cwd for list_threads", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await listThreads("ws-11", "cursor-0", 20, "updated_at", "/tmp/repo");

    expect(invokeMock).toHaveBeenCalledWith("list_threads", {
      workspaceId: "ws-11",
      cursor: "cursor-0",
      limit: 20,
      sortKey: "updated_at",
      cwd: "/tmp/repo",
    });
  });

  it("keeps list_threads cwd undefined when omitted", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await listThreads("ws-11");

    expect(invokeMock).toHaveBeenCalledWith("list_threads", {
      workspaceId: "ws-11",
      cursor: undefined,
      limit: undefined,
      sortKey: undefined,
      cwd: undefined,
    });
  });

  it("maps workspaceId/cursor/limit/threadId for apps_list", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await getAppsList("ws-11", "cursor-1", 25, "thread-11");

    expect(invokeMock).toHaveBeenCalledWith("apps_list", {
      workspaceId: "ws-11",
      cursor: "cursor-1",
      limit: 25,
      threadId: "thread-11",
    });
  });

  it("keeps apps_list threadId undefined when omitted", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await getAppsList("ws-11");

    expect(invokeMock).toHaveBeenCalledWith("apps_list", {
      workspaceId: "ws-11",
      cursor: undefined,
      limit: undefined,
      threadId: undefined,
    });
  });

  it("maps workspaceId/cursor/limit for experimental_feature_list", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await getExperimentalFeatureList("ws-11", "cursor-2", 50);

    expect(invokeMock).toHaveBeenCalledWith("experimental_feature_list", {
      workspaceId: "ws-11",
      cursor: "cursor-2",
      limit: 50,
    });
  });

  it("maps feature key and enabled for set_codex_feature_flag", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce(undefined);

    await setCodexFeatureFlag("collab", true);

    expect(invokeMock).toHaveBeenCalledWith("set_codex_feature_flag", {
      featureKey: "collab",
      enabled: true,
    });
  });

  it("sets app badge count", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce(undefined);

    await setAppBadgeCount(6);

    expect(invokeMock).toHaveBeenCalledWith("set_app_badge_count", { count: 6 });
  });

  it("clears app badge", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce(undefined);

    await clearAppBadge();

    expect(invokeMock).toHaveBeenCalledWith("clear_app_badge");
  });

  it("invokes stage_git_all", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await stageGitAll("ws-6");

    expect(invokeMock).toHaveBeenCalledWith("stage_git_all", {
      workspaceId: "ws-6",
    });
  });

  it("invokes fetch_git", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await fetchGit("ws-7");

    expect(invokeMock).toHaveBeenCalledWith("fetch_git", {
      workspaceId: "ws-7",
    });
  });

  it("maps openWorkspaceIn options", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await openWorkspaceIn("/tmp/project", {
      appName: "Xcode",
      args: ["--reuse-window"],
    });

    expect(invokeMock).toHaveBeenCalledWith("open_workspace_in", {
      path: "/tmp/project",
      app: "Xcode",
      command: null,
      args: ["--reuse-window"],
    });
  });

  it("rejects openWorkspaceIn when command is not allowlisted", async () => {
    await expect(
      openWorkspaceIn("/tmp/project", { command: "rm -rf /", args: [] }),
    ).rejects.toThrow("Invalid command: unsupported characters");
  });

  it("rejects openWorkspaceIn when args contain unsupported values", async () => {
    await expect(
      openWorkspaceIn("/tmp/project", {
        command: "code",
        args: ["--unsafe"],
      }),
    ).rejects.toThrow("Argument not allowed: --unsafe");
  });

  it("invokes get_open_app_icon", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce("data:image/png;base64,abc");

    await getOpenAppIcon("Xcode");

    expect(invokeMock).toHaveBeenCalledWith("get_open_app_icon", {
      appName: "Xcode",
    });
  });

  it("invokes orbit remote auth/runner wrappers", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValue(undefined);

    await orbitConnectTest();
    await orbitSignInStart();
    await orbitSignInPoll("device-code");
    await orbitSignOut();
    await orbitRunnerStart();
    await orbitRunnerStop();
    await orbitRunnerStatus();

    expect(invokeMock).toHaveBeenCalledWith("orbit_connect_test");
    expect(invokeMock).toHaveBeenCalledWith("orbit_sign_in_start");
    expect(invokeMock).toHaveBeenCalledWith("orbit_sign_in_poll", {
      deviceCode: "device-code",
    });
    expect(invokeMock).toHaveBeenCalledWith("orbit_sign_out");
    expect(invokeMock).toHaveBeenCalledWith("orbit_runner_start");
    expect(invokeMock).toHaveBeenCalledWith("orbit_runner_stop");
    expect(invokeMock).toHaveBeenCalledWith("orbit_runner_status");
  });

  it("invokes tailscale wrappers", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValue(undefined);

    await tailscaleStatus();
    await tailscaleDaemonCommandPreview();
    await tailscaleDaemonStart();
    await tailscaleDaemonStop();
    await tailscaleDaemonStatus();

    expect(invokeMock).toHaveBeenCalledWith("tailscale_status");
    expect(invokeMock).toHaveBeenCalledWith("tailscale_daemon_command_preview");
    expect(invokeMock).toHaveBeenCalledWith("tailscale_daemon_start");
    expect(invokeMock).toHaveBeenCalledWith("tailscale_daemon_stop");
    expect(invokeMock).toHaveBeenCalledWith("tailscale_daemon_status");
  });

  it("reads agent.md for a workspace", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({ exists: true, content: "# Agent", truncated: false });

    await readAgentMd("ws-agent");

    expect(invokeMock).toHaveBeenCalledWith("file_read", {
      scope: "workspace",
      kind: "agents",
      workspaceId: "ws-agent",
    });
  });

  it("writes agent.md for a workspace", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await writeAgentMd("ws-agent", "# Agent");

    expect(invokeMock).toHaveBeenCalledWith("file_write", {
      scope: "workspace",
      kind: "agents",
      workspaceId: "ws-agent",
      content: "# Agent",
    });
  });

  it("reads global AGENTS.md", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({ exists: true, content: "# Global", truncated: false });

    await readGlobalAgentsMd();

    expect(invokeMock).toHaveBeenCalledWith("file_read", {
      scope: "global",
      kind: "agents",
      workspaceId: undefined,
    });
  });

  it("writes global AGENTS.md", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await writeGlobalAgentsMd("# Global");

    expect(invokeMock).toHaveBeenCalledWith("file_write", {
      scope: "global",
      kind: "agents",
      workspaceId: undefined,
      content: "# Global",
    });
  });

  it("reads global config.toml", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({ exists: true, content: "model = \"gpt-5\"", truncated: false });

    await readGlobalCodexConfigToml();

    expect(invokeMock).toHaveBeenCalledWith("file_read", {
      scope: "global",
      kind: "config",
      workspaceId: undefined,
    });
  });

  it("writes global config.toml", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await writeGlobalCodexConfigToml("model = \"gpt-5\"");

    expect(invokeMock).toHaveBeenCalledWith("file_write", {
      scope: "global",
      kind: "config",
      workspaceId: undefined,
      content: "model = \"gpt-5\"",
    });
  });

  it("reads agents settings", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({
      configPath: "/Users/me/.codex/config.toml",
      multiAgentEnabled: true,
      maxThreads: 6,
      agents: [],
    });

    await getAgentsSettings();

    expect(invokeMock).toHaveBeenCalledWith("get_agents_settings");
  });

  it("updates core agents settings", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({
      configPath: "/Users/me/.codex/config.toml",
      multiAgentEnabled: false,
      maxThreads: 4,
      agents: [],
    });

    await setAgentsCoreSettings({ multiAgentEnabled: false, maxThreads: 4 });

    expect(invokeMock).toHaveBeenCalledWith("set_agents_core_settings", {
      input: { multiAgentEnabled: false, maxThreads: 4 },
    });
  });

  it("creates an agent", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await createAgent({
      name: "researcher",
      description: "Research-focused role",
      template: "blank",
      model: "gpt-5-codex",
      reasoningEffort: "medium",
    });

    expect(invokeMock).toHaveBeenCalledWith("create_agent", {
      input: {
        name: "researcher",
        description: "Research-focused role",
        template: "blank",
        model: "gpt-5-codex",
        reasoningEffort: "medium",
      },
    });
  });

  it("updates an agent", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await updateAgent({
      originalName: "researcher",
      name: "code_reviewer",
      description: "Review-focused role",
      renameManagedFile: true,
    });

    expect(invokeMock).toHaveBeenCalledWith("update_agent", {
      input: {
        originalName: "researcher",
        name: "code_reviewer",
        description: "Review-focused role",
        renameManagedFile: true,
      },
    });
  });

  it("deletes an agent", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await deleteAgent({
      name: "researcher",
      deleteManagedFile: true,
    });

    expect(invokeMock).toHaveBeenCalledWith("delete_agent", {
      input: {
        name: "researcher",
        deleteManagedFile: true,
      },
    });
  });

  it("reads an agent config file", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce("model = \"gpt-5-codex\"");

    await readAgentConfigToml("researcher");

    expect(invokeMock).toHaveBeenCalledWith("read_agent_config_toml", {
      agentName: "researcher",
    });
  });

  it("writes an agent config file", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await writeAgentConfigToml("researcher", "model = \"gpt-5-codex\"");

    expect(invokeMock).toHaveBeenCalledWith("write_agent_config_toml", {
      agentName: "researcher",
      content: "model = \"gpt-5-codex\"",
    });
  });

  it("fills sendUserMessage defaults in payload", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await sendUserMessage("ws-4", "thread-1", "hello", {
      images: ["image.png"],
    });

    expect(invokeMock).toHaveBeenCalledWith("send_user_message", {
      workspaceId: "ws-4",
      threadId: "thread-1",
      text: "hello",
      model: null,
      effort: null,
      accessMode: null,
      images: ["image.png"],
      appMentions: null,
      skillMentions: null,
    });
  });

  it("includes collaboration mode payload when provided", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await sendUserMessage("ws-4", "thread-1", "hello", {
      collaborationMode: { id: "reviewer", strategy: "parallel" },
    });

    expect(invokeMock).toHaveBeenCalledWith("send_user_message", {
      workspaceId: "ws-4",
      threadId: "thread-1",
      text: "hello",
      model: null,
      effort: null,
      accessMode: null,
      images: null,
      appMentions: null,
      skillMentions: null,
      collaborationMode: { id: "reviewer", strategy: "parallel" },
    });
  });

  it("includes app mentions when sending a message", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await sendUserMessage("ws-4", "thread-1", "hello $calendar", {
      appMentions: [{ name: "Calendar", path: "app://connector_calendar" }],
    });

    expect(invokeMock).toHaveBeenCalledWith("send_user_message", {
      workspaceId: "ws-4",
      threadId: "thread-1",
      text: "hello $calendar",
      model: null,
      effort: null,
      accessMode: null,
      images: null,
      appMentions: [{ name: "Calendar", path: "app://connector_calendar" }],
      skillMentions: null,
    });
  });

  it("includes skill mentions when sending a message", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await sendUserMessage("ws-4", "thread-1", "hello $深度调试模式", {
      skillMentions: [
        {
          name: "深度调试模式",
          path: "/Users/me/.codex/skills/_深度模式/深度调试模式/SKILL.md",
        },
      ],
    });

    expect(invokeMock).toHaveBeenCalledWith("send_user_message", {
      workspaceId: "ws-4",
      threadId: "thread-1",
      text: "hello $深度调试模式",
      model: null,
      effort: null,
      accessMode: null,
      images: null,
      appMentions: null,
      skillMentions: [
        {
          name: "深度调试模式",
          path: "/Users/me/.codex/skills/_深度模式/深度调试模式/SKILL.md",
        },
      ],
    });
  });

  it("invokes turn_steer for steer payloads", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await steerTurn("ws-4", "thread-1", "turn-2", "continue", ["image.png"]);

    expect(invokeMock).toHaveBeenCalledWith("turn_steer", {
      workspaceId: "ws-4",
      threadId: "thread-1",
      turnId: "turn-2",
      text: "continue",
      images: ["image.png"],
      appMentions: null,
      skillMentions: null,
    });
  });

  it("passes app mentions to turn_steer", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await steerTurn("ws-4", "thread-1", "turn-2", "continue", undefined, [
      { name: "Calendar", path: "app://connector_calendar" },
    ]);

    expect(invokeMock).toHaveBeenCalledWith("turn_steer", {
      workspaceId: "ws-4",
      threadId: "thread-1",
      turnId: "turn-2",
      text: "continue",
      images: null,
      appMentions: [{ name: "Calendar", path: "app://connector_calendar" }],
      skillMentions: null,
    });
  });

  it("passes skill mentions to turn_steer", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await steerTurn(
      "ws-4",
      "thread-1",
      "turn-2",
      "continue $深度调试模式",
      undefined,
      undefined,
      [
        {
          name: "深度调试模式",
          path: "/Users/me/.codex/skills/_深度模式/深度调试模式/SKILL.md",
        },
      ],
    );

    expect(invokeMock).toHaveBeenCalledWith("turn_steer", {
      workspaceId: "ws-4",
      threadId: "thread-1",
      turnId: "turn-2",
      text: "continue $深度调试模式",
      images: null,
      appMentions: null,
      skillMentions: [
        {
          name: "深度调试模式",
          path: "/Users/me/.codex/skills/_深度模式/深度调试模式/SKILL.md",
        },
      ],
    });
  });

  it("omits delivery when starting reviews without override", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await startReview("ws-5", "thread-2", { type: "uncommittedChanges" });

    expect(invokeMock).toHaveBeenCalledWith("start_review", {
      workspaceId: "ws-5",
      threadId: "thread-2",
      target: { type: "uncommittedChanges" },
    });
  });

  it("includes delivery when explicitly provided", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await startReview("ws-5", "thread-2", { type: "commit", sha: "sha-8" }, "detached");

    expect(invokeMock).toHaveBeenCalledWith("start_review", {
      workspaceId: "ws-5",
      threadId: "thread-2",
      target: { type: "commit", sha: "sha-8" },
      delivery: "detached",
    });
  });

  it("nests decisions for server request responses", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await respondToServerRequest("ws-6", 101, "accept");

    expect(invokeMock).toHaveBeenCalledWith("respond_to_server_request", {
      workspaceId: "ws-6",
      requestId: 101,
      result: { decision: "accept" },
    });
  });

  it("passes object results through for server request responses", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});
    const result = { approved: true, reason: "safe" };

    await respondToServerRequest("ws-6", "req-1", result);

    expect(invokeMock).toHaveBeenCalledWith("respond_to_server_request", {
      workspaceId: "ws-6",
      requestId: "req-1",
      result,
    });
  });

  it("nests answers for user input responses", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await respondToUserInputRequest("ws-7", 202, {
      confirm_path: { answers: ["Yes"] },
    });

    expect(invokeMock).toHaveBeenCalledWith("respond_to_server_request", {
      workspaceId: "ws-7",
      requestId: 202,
      result: {
        answers: {
          confirm_path: { answers: ["Yes"] },
        },
      },
    });
  });

  it("passes through multiple user input answers", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    const answers = {
      confirm_path: { answers: ["Yes"] },
      notes: { answers: ["First line", "Second line"] },
    };

    await respondToUserInputRequest("ws-8", 303, answers);

    expect(invokeMock).toHaveBeenCalledWith("respond_to_server_request", {
      workspaceId: "ws-8",
      requestId: 303,
      result: {
        answers,
      },
    });
  });

  it("sends a notification without re-requesting permission when already granted", async () => {
    const isPermissionGrantedMock = vi.mocked(notification.isPermissionGranted);
    const requestPermissionMock = vi.mocked(notification.requestPermission);
    const sendNotificationMock = vi.mocked(notification.sendNotification);
    isPermissionGrantedMock.mockResolvedValueOnce(true);

    await sendNotification("Hello", "World");

    expect(isPermissionGrantedMock).toHaveBeenCalledTimes(1);
    expect(requestPermissionMock).not.toHaveBeenCalled();
    expect(sendNotificationMock).toHaveBeenCalledWith({
      title: "Hello",
      body: "World",
    });
  });

  it("passes extra metadata when provided", async () => {
    const isPermissionGrantedMock = vi.mocked(notification.isPermissionGranted);
    const sendNotificationMock = vi.mocked(notification.sendNotification);
    isPermissionGrantedMock.mockResolvedValueOnce(true);

    await sendNotification("Hello", "World", {
      extra: { kind: "thread", workspaceId: "ws-1", threadId: "t-1" },
    });

    expect(sendNotificationMock).toHaveBeenCalledWith({
      title: "Hello",
      body: "World",
      extra: { kind: "thread", workspaceId: "ws-1", threadId: "t-1" },
    });
  });

  it("requests permission once when needed and sends on grant", async () => {
    const isPermissionGrantedMock = vi.mocked(notification.isPermissionGranted);
    const requestPermissionMock = vi.mocked(notification.requestPermission);
    const sendNotificationMock = vi.mocked(notification.sendNotification);
    isPermissionGrantedMock.mockResolvedValueOnce(false);
    requestPermissionMock.mockResolvedValueOnce("granted");

    await sendNotification("Grant", "Please");

    expect(isPermissionGrantedMock).toHaveBeenCalledTimes(1);
    expect(requestPermissionMock).toHaveBeenCalledTimes(1);
    expect(sendNotificationMock).toHaveBeenCalledWith({
      title: "Grant",
      body: "Please",
    });
  });

  it("does not send and warns when permission is denied", async () => {
    const isPermissionGrantedMock = vi.mocked(notification.isPermissionGranted);
    const requestPermissionMock = vi.mocked(notification.requestPermission);
    const sendNotificationMock = vi.mocked(notification.sendNotification);
    const invokeMock = vi.mocked(invoke);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    isPermissionGrantedMock.mockResolvedValueOnce(false);
    requestPermissionMock.mockResolvedValueOnce("denied");

    await sendNotification("Denied", "Nope");

    expect(isPermissionGrantedMock).toHaveBeenCalledTimes(1);
    expect(requestPermissionMock).toHaveBeenCalledTimes(1);
    expect(sendNotificationMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      "Notification permission not granted.",
      { permission: "denied" },
    );
    expect(invokeMock).toHaveBeenCalledWith("send_notification_fallback", {
      title: "Denied",
      body: "Nope",
    });
    warnSpy.mockRestore();
  });

  it("falls back when the notification plugin throws", async () => {
    const isPermissionGrantedMock = vi.mocked(notification.isPermissionGranted);
    const invokeMock = vi.mocked(invoke);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    isPermissionGrantedMock.mockRejectedValueOnce(new Error("boom"));

    await sendNotification("Plugin", "Failed");

    expect(invokeMock).toHaveBeenCalledWith("send_notification_fallback", {
      title: "Plugin",
      body: "Failed",
    });
    warnSpy.mockRestore();
  });

  it("prefers the fallback on macOS debug builds", async () => {
    const isPermissionGrantedMock = vi.mocked(notification.isPermissionGranted);
    const invokeMock = vi.mocked(invoke);

    invokeMock.mockImplementation(async (command: string) => {
      if (command === "is_macos_debug_build") {
        return true;
      }
      if (command === "send_notification_fallback") {
        return undefined;
      }
      return undefined;
    });

    await sendNotification("Dev", "Fallback");

    expect(invokeMock).toHaveBeenCalledWith("is_macos_debug_build");
    expect(invokeMock).toHaveBeenCalledWith("send_notification_fallback", {
      title: "Dev",
      body: "Fallback",
    });
    expect(isPermissionGrantedMock).not.toHaveBeenCalled();
  });

  it("warns when fallback notification also fails", async () => {
    const invokeMock = vi.mocked(invoke);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "is_macos_debug_build") {
        return true;
      }
      if (command === "send_notification_fallback") {
        throw new Error("fallback failed");
      }
      return undefined;
    });

    await sendNotification("Dev", "Fallback failed");

    expect(warnSpy).toHaveBeenCalledWith("Notification fallback failed.", {
      error: expect.any(Error),
    });
    warnSpy.mockRestore();
  });

  it("maps optional notification fields when provided", async () => {
    const isPermissionGrantedMock = vi.mocked(notification.isPermissionGranted);
    const sendNotificationMock = vi.mocked(notification.sendNotification);
    isPermissionGrantedMock.mockResolvedValueOnce(true);

    await sendNotification("Hello", "World", {
      id: 7,
      group: "workspaces",
      actionTypeId: "open-thread",
      sound: "hero",
      autoCancel: true,
      extra: { workspaceId: "ws-1" },
    });

    expect(sendNotificationMock).toHaveBeenCalledWith({
      title: "Hello",
      body: "World",
      id: 7,
      group: "workspaces",
      actionTypeId: "open-thread",
      sound: "hero",
      autoCancel: true,
      extra: { workspaceId: "ws-1" },
    });
  });

  it("maps picker helpers for null, string and array dialog outputs", async () => {
    const openMock = vi.mocked(open);
    openMock.mockResolvedValueOnce(null);
    await expect(tauriService.pickWorkspacePath()).resolves.toBeNull();

    openMock.mockResolvedValueOnce("/tmp/ws");
    await expect(tauriService.pickWorkspacePath()).resolves.toBe("/tmp/ws");

    openMock.mockResolvedValueOnce(["/tmp/a.png", "/tmp/b.png"]);
    await expect(tauriService.pickImageFiles()).resolves.toEqual([
      "/tmp/a.png",
      "/tmp/b.png",
    ]);

    openMock.mockResolvedValueOnce("/tmp/single.png");
    await expect(tauriService.pickImageFiles()).resolves.toEqual(["/tmp/single.png"]);
  });

  it("normalizes config model values and handles non-string responses", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});
    await expect(tauriService.getConfigModel("ws-1")).resolves.toBeNull();

    invokeMock.mockResolvedValueOnce({ model: "   " });
    await expect(tauriService.getConfigModel("ws-1")).resolves.toBeNull();

    invokeMock.mockResolvedValueOnce({ model: " gpt-5-codex " });
    await expect(tauriService.getConfigModel("ws-1")).resolves.toBe("gpt-5-codex");
  });

  it("returns an empty archive summary without invoking backend for empty thread ids", async () => {
    const invokeMock = vi.mocked(invoke);
    await expect(tauriService.archiveThreads("ws-1", [])).resolves.toEqual({
      allSucceeded: true,
      okIds: [],
      failed: [],
      total: 0,
    });
    expect(invokeMock).not.toHaveBeenCalledWith("archive_threads", expect.anything());
  });

  it("maps local usage snapshot payloads", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValue(undefined);

    await tauriService.localUsageSnapshot();
    expect(invokeMock).toHaveBeenCalledWith("local_usage_snapshot", { days: 30 });

    await tauriService.localUsageSnapshot(7, "/tmp/ws");
    expect(invokeMock).toHaveBeenCalledWith("local_usage_snapshot", {
      days: 7,
      workspacePath: "/tmp/ws",
    });
  });

  it("maps additional invoke wrappers consistently", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValue(undefined);

    await tauriService.isWorkspacePathDir("/tmp/ws");
    expect(invokeMock).toHaveBeenLastCalledWith("is_workspace_path_dir", { path: "/tmp/ws" });

    await tauriService.addClone("parent", "/tmp/copies", "copy-1");
    expect(invokeMock).toHaveBeenLastCalledWith("add_clone", {
      sourceWorkspaceId: "parent",
      copiesFolder: "/tmp/copies",
      copyName: "copy-1",
    });

    await tauriService.addWorktree("parent", "feat/test", null);
    expect(invokeMock).toHaveBeenLastCalledWith("add_worktree", {
      parentId: "parent",
      branch: "feat/test",
      name: null,
      copyAgentsMd: true,
    });

    await tauriService.addWorktree("parent", "feat/no-copy", "wt-2", false);
    expect(invokeMock).toHaveBeenLastCalledWith("add_worktree", {
      parentId: "parent",
      branch: "feat/no-copy",
      name: "wt-2",
      copyAgentsMd: false,
    });

    await tauriService.getWorktreeSetupStatus("ws-1");
    expect(invokeMock).toHaveBeenLastCalledWith("worktree_setup_status", { workspaceId: "ws-1" });

    await tauriService.markWorktreeSetupRan("ws-1");
    expect(invokeMock).toHaveBeenLastCalledWith("worktree_setup_mark_ran", { workspaceId: "ws-1" });

    await tauriService.updateWorkspaceSettings("ws-1", {
      sidebarCollapsed: false,
      worktreeSetupScript: "npm i",
    });
    expect(invokeMock).toHaveBeenLastCalledWith("update_workspace_settings", {
      id: "ws-1",
      settings: { sidebarCollapsed: false, worktreeSetupScript: "npm i" },
    });

    await tauriService.updateWorkspaceCodexBin("ws-1", "/usr/local/bin/codex");
    expect(invokeMock).toHaveBeenLastCalledWith("update_workspace_codex_bin", {
      id: "ws-1",
      codex_bin: "/usr/local/bin/codex",
    });

    await tauriService.removeWorkspace("ws-1");
    expect(invokeMock).toHaveBeenLastCalledWith("remove_workspace", { id: "ws-1" });

    await tauriService.removeWorktree("wt-1");
    expect(invokeMock).toHaveBeenLastCalledWith("remove_worktree", { id: "wt-1" });

    await tauriService.renameWorktree("wt-1", "feat/renamed");
    expect(invokeMock).toHaveBeenLastCalledWith("rename_worktree", {
      id: "wt-1",
      branch: "feat/renamed",
    });

    await tauriService.renameWorktreeUpstream("wt-1", "feat/old", "feat/new");
    expect(invokeMock).toHaveBeenLastCalledWith("rename_worktree_upstream", {
      id: "wt-1",
      oldBranch: "feat/old",
      newBranch: "feat/new",
    });

    await tauriService.applyWorktreeChanges("ws-1");
    expect(invokeMock).toHaveBeenLastCalledWith("apply_worktree_changes", { workspaceId: "ws-1" });

    await tauriService.connectWorkspace("ws-1");
    expect(invokeMock).toHaveBeenLastCalledWith("connect_workspace", { id: "ws-1" });

    await tauriService.startThread("ws-1");
    expect(invokeMock).toHaveBeenLastCalledWith("start_thread", { workspaceId: "ws-1" });

    await tauriService.interruptTurn("ws-1", "th-1", "turn-1");
    expect(invokeMock).toHaveBeenLastCalledWith("turn_interrupt", {
      workspaceId: "ws-1",
      threadId: "th-1",
      turnId: "turn-1",
    });

    await tauriService.rememberApprovalRule("ws-1", ["npm", "test"]);
    expect(invokeMock).toHaveBeenLastCalledWith("remember_approval_rule", {
      workspaceId: "ws-1",
      command: ["npm", "test"],
    });

    await tauriService.listGitRoots("ws-1", 4);
    expect(invokeMock).toHaveBeenLastCalledWith("list_git_roots", { workspaceId: "ws-1", depth: 4 });

    await tauriService.getGitDiffs("ws-1");
    expect(invokeMock).toHaveBeenLastCalledWith("get_git_diffs", { workspaceId: "ws-1" });

    await tauriService.getGitCommitDiff("ws-1", "abc123");
    expect(invokeMock).toHaveBeenLastCalledWith("get_git_commit_diff", {
      workspaceId: "ws-1",
      sha: "abc123",
    });

    await tauriService.getGitRemote("ws-1");
    expect(invokeMock).toHaveBeenLastCalledWith("get_git_remote", { workspaceId: "ws-1" });

    await tauriService.stageGitFile("ws-1", "src/a.ts");
    expect(invokeMock).toHaveBeenLastCalledWith("stage_git_file", {
      workspaceId: "ws-1",
      path: "src/a.ts",
    });

    await tauriService.unstageGitFile("ws-1", "src/a.ts");
    expect(invokeMock).toHaveBeenLastCalledWith("unstage_git_file", {
      workspaceId: "ws-1",
      path: "src/a.ts",
    });

    await tauriService.revertGitFile("ws-1", "src/a.ts");
    expect(invokeMock).toHaveBeenLastCalledWith("revert_git_file", {
      workspaceId: "ws-1",
      path: "src/a.ts",
    });

    await tauriService.revertGitAll("ws-1");
    expect(invokeMock).toHaveBeenLastCalledWith("revert_git_all", { workspaceId: "ws-1" });

    await tauriService.commitGit("ws-1", "feat: save");
    expect(invokeMock).toHaveBeenLastCalledWith("commit_git", {
      workspaceId: "ws-1",
      message: "feat: save",
    });

    await tauriService.pushGit("ws-1");
    expect(invokeMock).toHaveBeenLastCalledWith("push_git", { workspaceId: "ws-1" });

    await tauriService.pullGit("ws-1");
    expect(invokeMock).toHaveBeenLastCalledWith("pull_git", { workspaceId: "ws-1" });

    await tauriService.syncGit("ws-1");
    expect(invokeMock).toHaveBeenLastCalledWith("sync_git", { workspaceId: "ws-1" });

    await tauriService.getGitHubPullRequests("ws-1");
    expect(invokeMock).toHaveBeenLastCalledWith("get_github_pull_requests", { workspaceId: "ws-1" });

    await tauriService.getGitHubPullRequestDiff("ws-1", 9);
    expect(invokeMock).toHaveBeenLastCalledWith("get_github_pull_request_diff", {
      workspaceId: "ws-1",
      prNumber: 9,
    });

    await tauriService.getGitHubPullRequestComments("ws-1", 9);
    expect(invokeMock).toHaveBeenLastCalledWith("get_github_pull_request_comments", {
      workspaceId: "ws-1",
      prNumber: 9,
    });

    await tauriService.getModelList("ws-1");
    expect(invokeMock).toHaveBeenLastCalledWith("model_list", { workspaceId: "ws-1" });

    await tauriService.getCollaborationModes("ws-1");
    expect(invokeMock).toHaveBeenLastCalledWith("collaboration_mode_list", { workspaceId: "ws-1" });

    await tauriService.getAccountRateLimits("ws-1");
    expect(invokeMock).toHaveBeenLastCalledWith("account_rate_limits", { workspaceId: "ws-1" });

    await tauriService.getAccountInfo("ws-1");
    expect(invokeMock).toHaveBeenLastCalledWith("account_read", { workspaceId: "ws-1" });

    await tauriService.runCodexLogin("ws-1");
    expect(invokeMock).toHaveBeenLastCalledWith("codex_login", { workspaceId: "ws-1" });

    await tauriService.cancelCodexLogin("ws-1");
    expect(invokeMock).toHaveBeenLastCalledWith("codex_login_cancel", { workspaceId: "ws-1" });

    await tauriService.getSkillsList("ws-1");
    expect(invokeMock).toHaveBeenLastCalledWith("skills_list", { workspaceId: "ws-1" });

    await tauriService.getPromptsList("ws-1");
    expect(invokeMock).toHaveBeenLastCalledWith("prompts_list", { workspaceId: "ws-1" });

    await tauriService.getWorkspacePromptsDir("ws-1");
    expect(invokeMock).toHaveBeenLastCalledWith("prompts_workspace_dir", { workspaceId: "ws-1" });

    await tauriService.getGlobalPromptsDir("ws-1");
    expect(invokeMock).toHaveBeenLastCalledWith("prompts_global_dir", { workspaceId: "ws-1" });

    await tauriService.createPrompt("ws-1", {
      scope: "workspace",
      name: "plan",
      content: "do this",
    });
    expect(invokeMock).toHaveBeenLastCalledWith("prompts_create", {
      workspaceId: "ws-1",
      scope: "workspace",
      name: "plan",
      description: null,
      argumentHint: null,
      content: "do this",
    });

    await tauriService.updatePrompt("ws-1", {
      path: "workspace/plan.md",
      name: "plan",
      content: "updated",
    });
    expect(invokeMock).toHaveBeenLastCalledWith("prompts_update", {
      workspaceId: "ws-1",
      path: "workspace/plan.md",
      name: "plan",
      description: null,
      argumentHint: null,
      content: "updated",
    });

    await tauriService.deletePrompt("ws-1", "workspace/plan.md");
    expect(invokeMock).toHaveBeenLastCalledWith("prompts_delete", {
      workspaceId: "ws-1",
      path: "workspace/plan.md",
    });

    await tauriService.movePrompt("ws-1", { path: "workspace/plan.md", scope: "global" });
    expect(invokeMock).toHaveBeenLastCalledWith("prompts_move", {
      workspaceId: "ws-1",
      path: "workspace/plan.md",
      scope: "global",
    });

    await tauriService.getAppSettings();
    expect(invokeMock).toHaveBeenLastCalledWith("get_app_settings");

    await tauriService.isMobileRuntime();
    expect(invokeMock).toHaveBeenLastCalledWith("is_mobile_runtime");

    await tauriService.updateAppSettings({} as never);
    expect(invokeMock).toHaveBeenLastCalledWith("update_app_settings", { settings: {} });

    await tauriService.setMenuAccelerators([{ id: "menu.new", accelerator: "CmdOrCtrl+N" }]);
    expect(invokeMock).toHaveBeenLastCalledWith("menu_set_accelerators", {
      updates: [{ id: "menu.new", accelerator: "CmdOrCtrl+N" }],
    });

    await tauriService.runCodexDoctor(null, "--json");
    expect(invokeMock).toHaveBeenLastCalledWith("codex_doctor", {
      codexBin: null,
      codexArgs: "--json",
    });

    await tauriService.runCodexUpdate("codex", null);
    expect(invokeMock).toHaveBeenLastCalledWith("codex_update", {
      codexBin: "codex",
      codexArgs: null,
    });

    await tauriService.getWorkspaceFiles("ws-1");
    expect(invokeMock).toHaveBeenLastCalledWith("list_workspace_files", { workspaceId: "ws-1" });

    await tauriService.readWorkspaceFile("ws-1", "README.md");
    expect(invokeMock).toHaveBeenLastCalledWith("read_workspace_file", {
      workspaceId: "ws-1",
      path: "README.md",
    });

    await tauriService.listGitBranches("ws-1");
    expect(invokeMock).toHaveBeenLastCalledWith("list_git_branches", { workspaceId: "ws-1" });

    await tauriService.checkoutGitBranch("ws-1", "feat/x");
    expect(invokeMock).toHaveBeenLastCalledWith("checkout_git_branch", {
      workspaceId: "ws-1",
      name: "feat/x",
    });

    await tauriService.createGitBranch("ws-1", "feat/y");
    expect(invokeMock).toHaveBeenLastCalledWith("create_git_branch", {
      workspaceId: "ws-1",
      name: "feat/y",
    });

    await tauriService.getDictationModelStatus();
    expect(invokeMock).toHaveBeenLastCalledWith("dictation_model_status", {});

    await tauriService.downloadDictationModel("small");
    expect(invokeMock).toHaveBeenLastCalledWith("dictation_download_model", { modelId: "small" });

    await tauriService.cancelDictationDownload("small");
    expect(invokeMock).toHaveBeenLastCalledWith("dictation_cancel_download", { modelId: "small" });

    await tauriService.removeDictationModel("small");
    expect(invokeMock).toHaveBeenLastCalledWith("dictation_remove_model", { modelId: "small" });

    await tauriService.startDictation("en-US");
    expect(invokeMock).toHaveBeenLastCalledWith("dictation_start", { preferredLanguage: "en-US" });

    await tauriService.requestDictationPermission();
    expect(invokeMock).toHaveBeenLastCalledWith("dictation_request_permission");

    await tauriService.stopDictation();
    expect(invokeMock).toHaveBeenLastCalledWith("dictation_stop");

    await tauriService.cancelDictation();
    expect(invokeMock).toHaveBeenLastCalledWith("dictation_cancel");

    await tauriService.openTerminalSession("ws-1", "term-1", 120, 40);
    expect(invokeMock).toHaveBeenLastCalledWith("terminal_open", {
      workspaceId: "ws-1",
      terminalId: "term-1",
      cols: 120,
      rows: 40,
    });

    await tauriService.writeTerminalSession("ws-1", "term-1", "ls -la");
    expect(invokeMock).toHaveBeenLastCalledWith("terminal_write", {
      workspaceId: "ws-1",
      terminalId: "term-1",
      data: "ls -la",
    });

    await tauriService.resizeTerminalSession("ws-1", "term-1", 100, 30);
    expect(invokeMock).toHaveBeenLastCalledWith("terminal_resize", {
      workspaceId: "ws-1",
      terminalId: "term-1",
      cols: 100,
      rows: 30,
    });

    await tauriService.closeTerminalSession("ws-1", "term-1");
    expect(invokeMock).toHaveBeenLastCalledWith("terminal_close", {
      workspaceId: "ws-1",
      terminalId: "term-1",
    });

    await tauriService.resumeThread("ws-1", "thread-1");
    expect(invokeMock).toHaveBeenLastCalledWith("resume_thread", {
      workspaceId: "ws-1",
      threadId: "thread-1",
    });

    await tauriService.archiveThread("ws-1", "thread-1");
    expect(invokeMock).toHaveBeenLastCalledWith("archive_thread", {
      workspaceId: "ws-1",
      threadId: "thread-1",
    });

    await tauriService.archiveThreads("ws-1", ["thread-1"]);
    expect(invokeMock).toHaveBeenLastCalledWith("archive_threads", {
      workspaceId: "ws-1",
      threadIds: ["thread-1"],
    });

    await tauriService.generateRunMetadata("ws-1", "Ship it");
    expect(invokeMock).toHaveBeenLastCalledWith("generate_run_metadata", {
      workspaceId: "ws-1",
      prompt: "Ship it",
    });

    await tauriService.generateCommitMessage("ws-1");
    expect(invokeMock).toHaveBeenLastCalledWith("generate_commit_message", {
      workspaceId: "ws-1",
    });
  });
});
