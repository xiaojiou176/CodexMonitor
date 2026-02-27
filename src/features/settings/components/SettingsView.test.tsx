// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppSettings, WorkspaceInfo } from "../../../types";
import { DEFAULT_COMMIT_MESSAGE_PROMPT } from "../../../utils/commitMessagePrompt";
import { SettingsView } from "./SettingsView";
import { ask, open } from "@tauri-apps/plugin-dialog";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: vi.fn(),
  open: vi.fn(),
}));

afterEach(async () => {
  await act(async () => {
    await new Promise<void>((resolve) => {
      queueMicrotask(resolve);
    });
  });
  cleanup();
});

const baseSettings: AppSettings = {
  codexBin: null,
  codexArgs: null,
  backendMode: "local",
  remoteBackendProvider: "tcp",
  remoteBackendHost: "127.0.0.1:4732",
  remoteBackendToken: null,
  orbitWsUrl: null,
  orbitAuthUrl: null,
  orbitRunnerName: null,
  orbitAutoStartRunner: false,
  keepDaemonRunningAfterAppClose: false,
  orbitUseAccess: false,
  orbitAccessClientId: null,
  orbitAccessClientSecretRef: null,
  reviewDeliveryMode: "inline",
  composerModelShortcut: null,
  composerReasoningShortcut: null,
  composerCollaborationShortcut: null,
  interruptShortcut: null,
  newAgentShortcut: null,
  newWorktreeAgentShortcut: null,
  newCloneAgentShortcut: null,
  archiveThreadShortcut: null,
  toggleProjectsSidebarShortcut: null,
  toggleGitSidebarShortcut: null,
  branchSwitcherShortcut: null,
  toggleDebugPanelShortcut: null,
  toggleTerminalShortcut: null,
  cycleAgentNextShortcut: null,
  cycleAgentPrevShortcut: null,
  cycleWorkspaceNextShortcut: null,
  cycleWorkspacePrevShortcut: null,
  lastComposerModelId: null,
  lastComposerReasoningEffort: null,
  uiScale: 1,
  theme: "system",
  usageShowRemaining: false,
  showMessageFilePath: true,
  threadCopyIncludeUserInput: true,
  threadCopyIncludeAssistantMessages: true,
  threadCopyToolOutputMode: "compact",
  threadScrollRestoreMode: "latest",
  threadTitleAutogenerationEnabled: false,
  uiFontFamily:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  codeFontFamily:
    'ui-monospace, "Cascadia Mono", "Segoe UI Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  codeFontSize: 11,
  notificationSoundsEnabled: true,
  systemNotificationsEnabled: true,
  preloadGitDiffs: true,
  gitDiffIgnoreWhitespaceChanges: false,
  commitMessagePrompt: DEFAULT_COMMIT_MESSAGE_PROMPT,
  experimentalCollabEnabled: false,
  collaborationModesEnabled: true,
  steerEnabled: true,
  unifiedExecEnabled: true,
  showSubAgentThreadsInSidebar: true,
  autoArchiveSubAgentThreadsEnabled: true,
  autoArchiveSubAgentThreadsMaxAgeMinutes: 30,
  experimentalAppsEnabled: false,
  personality: "friendly",
  dictationEnabled: false,
  dictationModelId: "base",
  dictationPreferredLanguage: null,
  dictationHoldKey: "alt",
  composerEditorPreset: "default",
  composerFenceExpandOnSpace: false,
  composerFenceExpandOnEnter: false,
  composerFenceLanguageTags: false,
  composerFenceWrapSelection: false,
  composerFenceAutoWrapPasteMultiline: false,
  composerFenceAutoWrapPasteCodeLike: false,
  composerListContinuation: false,
  composerCodeBlockCopyUseModifier: false,
  workspaceGroups: [],
  openAppTargets: [
    {
      id: "vscode",
      label: "VS Code",
      kind: "app",
      appName: "Visual Studio Code",
      command: null,
      args: [],
    },
  ],
  selectedOpenAppId: "vscode",
};

const createDoctorResult = () => ({
  ok: true,
  codexBin: null,
  version: null,
  appServerOk: true,
  details: null,
  path: null,
  nodeOk: true,
  nodeVersion: null,
  nodeDetails: null,
});

const renderDisplaySection = (
  options: {
    appSettings?: Partial<AppSettings>;
    reduceTransparency?: boolean;
    onUpdateAppSettings?: ComponentProps<typeof SettingsView>["onUpdateAppSettings"];
    onToggleTransparency?: ComponentProps<typeof SettingsView>["onToggleTransparency"];
  } = {},
) => {
  cleanup();
  const onUpdateAppSettings =
    options.onUpdateAppSettings ?? vi.fn().mockResolvedValue(undefined);
  const onToggleTransparency = options.onToggleTransparency ?? vi.fn();
  const props: ComponentProps<typeof SettingsView> = {
    reduceTransparency: options.reduceTransparency ?? false,
    onToggleTransparency,
    appSettings: {
      ...baseSettings,
      remoteBackendProvider: "orbit",
      ...options.appSettings,
    },
    openAppIconById: {},
    onUpdateAppSettings,
    workspaceGroups: [],
    groupedWorkspaces: [],
    ungroupedLabel: "Ungrouped",
    onClose: vi.fn(),
    onMoveWorkspace: vi.fn(),
    onDeleteWorkspace: vi.fn(),
    onCreateWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onRenameWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onMoveWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onDeleteWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onAssignWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onRunDoctor: vi.fn().mockResolvedValue(createDoctorResult()),
    onUpdateWorkspaceCodexBin: vi.fn().mockResolvedValue(undefined),
    onUpdateWorkspaceSettings: vi.fn().mockResolvedValue(undefined),
    scaleShortcutTitle: "Scale shortcut",
    scaleShortcutText: "Use Command +/-",
    onTestNotificationSound: vi.fn(),
    onTestSystemNotification: vi.fn(),
    dictationModelStatus: null,
    onDownloadDictationModel: vi.fn(),
    onCancelDictationDownload: vi.fn(),
    onRemoveDictationModel: vi.fn(),
  };

  render(<SettingsView {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "显示与声音" }));

  return { onUpdateAppSettings, onToggleTransparency };
};

const workspace = (
  overrides: Omit<Partial<WorkspaceInfo>, "settings"> &
    Pick<WorkspaceInfo, "id" | "name"> & {
      settings?: Partial<WorkspaceInfo["settings"]>;
    },
): WorkspaceInfo => ({
  id: overrides.id,
  name: overrides.name,
  path: overrides.path ?? `/tmp/${overrides.id}`,
  connected: overrides.connected ?? false,
  codex_bin: overrides.codex_bin ?? null,
  kind: overrides.kind ?? "main",
  parentId: overrides.parentId ?? null,
  worktree: overrides.worktree ?? null,
  settings: {
    sidebarCollapsed: false,
    sortOrder: null,
    groupId: null,
    gitRoot: null,
    codexHome: null,
    codexArgs: null,
    launchScript: null,
    launchScripts: null,
    worktreeSetupScript: null,
    ...overrides.settings,
  },
});

const renderEnvironmentsSection = (
  options: {
    groupedWorkspaces?: ComponentProps<typeof SettingsView>["groupedWorkspaces"];
    onUpdateWorkspaceSettings?: ComponentProps<typeof SettingsView>["onUpdateWorkspaceSettings"];
  } = {},
) => {
  cleanup();
  const onUpdateWorkspaceSettings =
    options.onUpdateWorkspaceSettings ?? vi.fn().mockResolvedValue(undefined);

  const props: ComponentProps<typeof SettingsView> = {
    reduceTransparency: false,
    onToggleTransparency: vi.fn(),
    appSettings: { ...baseSettings, remoteBackendProvider: "orbit" },
    openAppIconById: {},
    onUpdateAppSettings: vi.fn().mockResolvedValue(undefined),
    workspaceGroups: [],
    groupedWorkspaces:
      options.groupedWorkspaces ??
      [
        {
          id: null,
          name: "Ungrouped",
          workspaces: [
            workspace({
              id: "w1",
              name: "Project One",
              settings: {
                sidebarCollapsed: false,
                worktreeSetupScript: "echo one",
              },
            }),
          ],
        },
      ],
    ungroupedLabel: "Ungrouped",
    onClose: vi.fn(),
    onMoveWorkspace: vi.fn(),
    onDeleteWorkspace: vi.fn(),
    onCreateWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onRenameWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onMoveWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onDeleteWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onAssignWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onRunDoctor: vi.fn().mockResolvedValue(createDoctorResult()),
    onUpdateWorkspaceCodexBin: vi.fn().mockResolvedValue(undefined),
    onUpdateWorkspaceSettings,
    scaleShortcutTitle: "Scale shortcut",
    scaleShortcutText: "Use Command +/-",
    onTestNotificationSound: vi.fn(),
    onTestSystemNotification: vi.fn(),
    dictationModelStatus: null,
    onDownloadDictationModel: vi.fn(),
    onCancelDictationDownload: vi.fn(),
    onRemoveDictationModel: vi.fn(),
    initialSection: "environments",
  };

  render(<SettingsView {...props} />);
  return { onUpdateWorkspaceSettings };
};

const renderProjectsSection = (
  options: {
    workspaceGroups?: ComponentProps<typeof SettingsView>["workspaceGroups"];
    groupedWorkspaces?: ComponentProps<typeof SettingsView>["groupedWorkspaces"];
    appSettings?: Partial<AppSettings>;
    onCreateWorkspaceGroup?: ComponentProps<typeof SettingsView>["onCreateWorkspaceGroup"];
    onRenameWorkspaceGroup?: ComponentProps<typeof SettingsView>["onRenameWorkspaceGroup"];
    onDeleteWorkspaceGroup?: ComponentProps<typeof SettingsView>["onDeleteWorkspaceGroup"];
    onUpdateAppSettings?: ComponentProps<typeof SettingsView>["onUpdateAppSettings"];
  } = {},
) => {
  cleanup();
  const onCreateWorkspaceGroup =
    options.onCreateWorkspaceGroup ?? vi.fn().mockResolvedValue(null);
  const onRenameWorkspaceGroup =
    options.onRenameWorkspaceGroup ?? vi.fn().mockResolvedValue(null);
  const onDeleteWorkspaceGroup =
    options.onDeleteWorkspaceGroup ?? vi.fn().mockResolvedValue(null);
  const onUpdateAppSettings =
    options.onUpdateAppSettings ?? vi.fn().mockResolvedValue(undefined);

  const props: ComponentProps<typeof SettingsView> = {
    reduceTransparency: false,
    onToggleTransparency: vi.fn(),
    appSettings: {
      ...baseSettings,
      workspaceGroups: options.workspaceGroups ?? [],
      ...options.appSettings,
    },
    openAppIconById: {},
    onUpdateAppSettings,
    workspaceGroups: options.workspaceGroups ?? [],
    groupedWorkspaces: options.groupedWorkspaces ?? [],
    ungroupedLabel: "Ungrouped",
    onClose: vi.fn(),
    onMoveWorkspace: vi.fn(),
    onDeleteWorkspace: vi.fn(),
    onCreateWorkspaceGroup,
    onRenameWorkspaceGroup,
    onMoveWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onDeleteWorkspaceGroup,
    onAssignWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onRunDoctor: vi.fn().mockResolvedValue(createDoctorResult()),
    onUpdateWorkspaceCodexBin: vi.fn().mockResolvedValue(undefined),
    onUpdateWorkspaceSettings: vi.fn().mockResolvedValue(undefined),
    scaleShortcutTitle: "Scale shortcut",
    scaleShortcutText: "Use Command +/-",
    onTestNotificationSound: vi.fn(),
    onTestSystemNotification: vi.fn(),
    dictationModelStatus: null,
    onDownloadDictationModel: vi.fn(),
    onCancelDictationDownload: vi.fn(),
    onRemoveDictationModel: vi.fn(),
    initialSection: "projects",
  };

  render(<SettingsView {...props} />);
  return {
    onCreateWorkspaceGroup,
    onRenameWorkspaceGroup,
    onDeleteWorkspaceGroup,
    onUpdateAppSettings,
  };
};

describe("SettingsView Display", () => {
  it("updates the theme selection", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    renderDisplaySection({ onUpdateAppSettings });

    const select = screen.getByLabelText("主题");
    fireEvent.change(select, { target: { value: "dark" } });

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ theme: "dark" }),
      );
    });
  });

  it("updates thread scroll restore mode", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    renderDisplaySection({ onUpdateAppSettings });

    const select = screen.getByLabelText("线程切换滚动策略");
    fireEvent.change(select, { target: { value: "remember" } });

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ threadScrollRestoreMode: "remember" }),
      );
    });
  });

  it("toggles file path visibility in messages", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    renderDisplaySection({ onUpdateAppSettings });

    const row = screen
      .getByText("在消息中显示文件路径")
      .closest(".settings-toggle-row") as HTMLElement | null;
    if (!row) {
      throw new Error("Expected file path visibility row");
    }
    const toggle = row.querySelector(
      "button.settings-toggle",
    ) as HTMLButtonElement | null;
    if (!toggle) {
      throw new Error("Expected file path visibility toggle");
    }
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ showMessageFilePath: false }),
      );
    });
  });

  it("toggles reduce transparency", async () => {
    const onToggleTransparency = vi.fn();
    renderDisplaySection({ onToggleTransparency, reduceTransparency: false });

    const row = screen
      .getByText("降低透明效果")
      .closest(".settings-toggle-row") as HTMLElement | null;
    if (!row) {
      throw new Error("Expected reduce transparency row");
    }
    const toggle = row.querySelector(
      "button.settings-toggle",
    ) as HTMLButtonElement | null;
    if (!toggle) {
      throw new Error("Expected reduce transparency toggle");
    }
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(onToggleTransparency).toHaveBeenCalledWith(true);
    });
  });

  it("commits interface scale on blur and enter with clamping", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    renderDisplaySection({ onUpdateAppSettings });

    const scaleInput = screen.getByLabelText("界面缩放");

    fireEvent.change(scaleInput, { target: { value: "500%" } });
    fireEvent.blur(scaleInput);

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ uiScale: 3 }),
      );
    });

    fireEvent.change(scaleInput, { target: { value: "3%" } });
    fireEvent.keyDown(scaleInput, { key: "Enter" });

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ uiScale: 0.1 }),
      );
    });
  });

  it("restores scale input when value is invalid", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    renderDisplaySection({ onUpdateAppSettings, appSettings: { uiScale: 1.25 } });

    const scaleInput = screen.getByLabelText("界面缩放") as HTMLInputElement;
    fireEvent.change(scaleInput, { target: { value: "abc%" } });
    fireEvent.blur(scaleInput);

    await waitFor(() => {
      expect(scaleInput.value).toBe("130%");
    });
    expect(onUpdateAppSettings).not.toHaveBeenCalled();
  });

  it("does not update scale when reset at default", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    renderDisplaySection({ onUpdateAppSettings, appSettings: { uiScale: 1 } });

    fireEvent.click(screen.getAllByRole("button", { name: "重置" })[0]);

    await waitFor(() => {
      expect(
        (screen.getByLabelText("界面缩放") as HTMLInputElement).value,
      ).toBe("100%");
    });
    expect(onUpdateAppSettings).not.toHaveBeenCalled();
  });

  it("commits font family changes on blur and enter", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    renderDisplaySection({ onUpdateAppSettings });

    const uiFontInput = screen.getByLabelText("界面字体");
    fireEvent.change(uiFontInput, { target: { value: "Avenir, sans-serif" } });
    fireEvent.blur(uiFontInput);

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ uiFontFamily: "Avenir, sans-serif" }),
      );
    });

    const codeFontInput = screen.getByLabelText("代码字体");
    fireEvent.change(codeFontInput, {
      target: { value: "JetBrains Mono, monospace" },
    });
    fireEvent.keyDown(codeFontInput, { key: "Enter" });

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ codeFontFamily: "JetBrains Mono, monospace" }),
      );
    });
  });

  it("skips font updates when normalized value is unchanged", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    renderDisplaySection({
      onUpdateAppSettings,
      appSettings: {
        uiFontFamily: 'Avenir, "Helvetica Neue", sans-serif',
        codeFontFamily: "JetBrains Mono, monospace",
      },
    });

    fireEvent.change(screen.getByLabelText("界面字体"), {
      target: { value: 'Avenir, "Helvetica Neue", sans-serif' },
    });
    fireEvent.blur(screen.getByLabelText("界面字体"));

    fireEvent.change(screen.getByLabelText("代码字体"), {
      target: { value: "JetBrains Mono, monospace" },
    });
    fireEvent.keyDown(screen.getByLabelText("代码字体"), { key: "Enter" });

    await waitFor(() => {
      expect(
        (screen.getByLabelText("界面字体") as HTMLInputElement).value,
      ).toBe('Avenir, "Helvetica Neue", sans-serif');
      expect((screen.getByLabelText("代码字体") as HTMLInputElement).value).toBe(
        "JetBrains Mono, monospace",
      );
    });
    expect(onUpdateAppSettings).not.toHaveBeenCalled();
  });

  it("resets font families to defaults", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    renderDisplaySection({ onUpdateAppSettings });

    const resetButtons = screen.getAllByRole("button", { name: "重置" });
    fireEvent.click(resetButtons[1]);
    fireEvent.click(resetButtons[2]);

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          uiFontFamily: expect.stringContaining("system-ui"),
        }),
      );
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          codeFontFamily: expect.stringContaining("ui-monospace"),
        }),
      );
    });
  });

  it("updates code font size from the slider", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    renderDisplaySection({ onUpdateAppSettings });

    const slider = screen.getByLabelText("代码字号");
    fireEvent.change(slider, { target: { value: "14" } });

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ codeFontSize: 14 }),
      );
    });
  });

  it("toggles notification sounds", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    renderDisplaySection({
      onUpdateAppSettings,
      appSettings: { notificationSoundsEnabled: false },
    });

    const row = screen
      .getByText("通知声音")
      .closest(".settings-toggle-row") as HTMLElement | null;
    if (!row) {
      throw new Error("Expected notification sounds row");
    }
    fireEvent.click(within(row).getByRole("button"));

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ notificationSoundsEnabled: true }),
      );
    });
  });

  it("supports keyboard section tab navigation and resets content scroll", async () => {
    const props: ComponentProps<typeof SettingsView> = {
      reduceTransparency: false,
      onToggleTransparency: vi.fn(),
      appSettings: baseSettings,
      openAppIconById: {},
      onUpdateAppSettings: vi.fn().mockResolvedValue(undefined),
      workspaceGroups: [],
      groupedWorkspaces: [],
      ungroupedLabel: "Ungrouped",
      onClose: vi.fn(),
      onMoveWorkspace: vi.fn(),
      onDeleteWorkspace: vi.fn(),
      onCreateWorkspaceGroup: vi.fn().mockResolvedValue(null),
      onRenameWorkspaceGroup: vi.fn().mockResolvedValue(null),
      onMoveWorkspaceGroup: vi.fn().mockResolvedValue(null),
      onDeleteWorkspaceGroup: vi.fn().mockResolvedValue(null),
      onAssignWorkspaceGroup: vi.fn().mockResolvedValue(null),
      onRunDoctor: vi.fn().mockResolvedValue(createDoctorResult()),
      onUpdateWorkspaceCodexBin: vi.fn().mockResolvedValue(undefined),
      onUpdateWorkspaceSettings: vi.fn().mockResolvedValue(undefined),
      scaleShortcutTitle: "Scale shortcut",
      scaleShortcutText: "Use Command +/-",
      onTestNotificationSound: vi.fn(),
      onTestSystemNotification: vi.fn(),
      dictationModelStatus: null,
      onDownloadDictationModel: vi.fn(),
      onCancelDictationDownload: vi.fn(),
      onRemoveDictationModel: vi.fn(),
      initialSection: "server",
    };

    const { container } = render(<SettingsView {...props} />);
    const content = container.querySelector(".settings-content") as HTMLElement | null;
    if (!content) {
      throw new Error("Expected settings content container");
    }
    content.scrollTop = 120;

    const serverTab = screen.getByRole("tab", { name: "服务" });
    fireEvent.keyDown(serverTab, { key: "ArrowRight" });

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Codex" }).getAttribute("aria-selected")).toBe(
        "true",
      );
      expect(content.scrollTop).toBe(0);
    });
  });

  it("supports ArrowLeft, Home, and End navigation in section tabs", async () => {
    const props: ComponentProps<typeof SettingsView> = {
      reduceTransparency: false,
      onToggleTransparency: vi.fn(),
      appSettings: baseSettings,
      openAppIconById: {},
      onUpdateAppSettings: vi.fn().mockResolvedValue(undefined),
      workspaceGroups: [],
      groupedWorkspaces: [],
      ungroupedLabel: "Ungrouped",
      onClose: vi.fn(),
      onMoveWorkspace: vi.fn(),
      onDeleteWorkspace: vi.fn(),
      onCreateWorkspaceGroup: vi.fn().mockResolvedValue(null),
      onRenameWorkspaceGroup: vi.fn().mockResolvedValue(null),
      onMoveWorkspaceGroup: vi.fn().mockResolvedValue(null),
      onDeleteWorkspaceGroup: vi.fn().mockResolvedValue(null),
      onAssignWorkspaceGroup: vi.fn().mockResolvedValue(null),
      onRunDoctor: vi.fn().mockResolvedValue(createDoctorResult()),
      onUpdateWorkspaceCodexBin: vi.fn().mockResolvedValue(undefined),
      onUpdateWorkspaceSettings: vi.fn().mockResolvedValue(undefined),
      scaleShortcutTitle: "Scale shortcut",
      scaleShortcutText: "Use Command +/-",
      onTestNotificationSound: vi.fn(),
      onTestSystemNotification: vi.fn(),
      dictationModelStatus: null,
      onDownloadDictationModel: vi.fn(),
      onCancelDictationDownload: vi.fn(),
      onRemoveDictationModel: vi.fn(),
      initialSection: "server",
    };

    render(<SettingsView {...props} />);

    fireEvent.keyDown(screen.getByRole("tab", { name: "服务" }), {
      key: "ArrowLeft",
    });
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "模型代理" }).getAttribute("aria-selected")).toBe(
        "true",
      );
    });

    fireEvent.keyDown(screen.getByRole("tab", { name: "模型代理" }), {
      key: "Home",
    });
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "服务" }).getAttribute("aria-selected")).toBe("true");
    });

    fireEvent.keyDown(screen.getByRole("tab", { name: "服务" }), {
      key: "End",
    });
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "模型代理" }).getAttribute("aria-selected")).toBe(
        "true",
      );
    });
  });
});

describe("SettingsView Projects", () => {
  it("creates a workspace group and clears the draft", async () => {
    const onCreateWorkspaceGroup = vi.fn().mockResolvedValue({
      id: "g-new",
      name: "Frontend",
      color: null,
      sortOrder: 0,
      copiesFolder: null,
    });
    renderProjectsSection({ onCreateWorkspaceGroup });

    const input = screen.getByPlaceholderText("新分组名称");
    fireEvent.change(input, { target: { value: "Frontend" } });
    fireEvent.click(screen.getByRole("button", { name: "添加分组" }));

    await waitFor(() => {
      expect(onCreateWorkspaceGroup).toHaveBeenCalledWith("Frontend");
      expect((input as HTMLInputElement).value).toBe("");
    });
  });

  it("shows group error when creating a workspace group fails", async () => {
    const onCreateWorkspaceGroup = vi.fn().mockRejectedValue(new Error("create failed"));
    renderProjectsSection({ onCreateWorkspaceGroup });

    fireEvent.change(screen.getByPlaceholderText("新分组名称"), {
      target: { value: "Backend" },
    });
    fireEvent.click(screen.getByRole("button", { name: "添加分组" }));

    await waitFor(() => {
      expect(screen.getByText("create failed")).not.toBeNull();
    });
  });

  it("resets rename draft when blank and does not call rename API", async () => {
    const group = {
      id: "g-1",
      name: "Core Team",
      color: null,
      sortOrder: 0,
      copiesFolder: null,
    };
    const onRenameWorkspaceGroup = vi.fn().mockResolvedValue(true);
    renderProjectsSection({
      workspaceGroups: [group],
      appSettings: { workspaceGroups: [group] },
      onRenameWorkspaceGroup,
    });

    const input = screen.getByDisplayValue("Core Team");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe("Core Team");
    });
    expect(onRenameWorkspaceGroup).not.toHaveBeenCalled();
  });

  it("shows error and restores group name when rename fails", async () => {
    const group = {
      id: "g-1",
      name: "Core Team",
      color: null,
      sortOrder: 0,
      copiesFolder: null,
    };
    const onRenameWorkspaceGroup = vi.fn().mockRejectedValue(new Error("rename failed"));
    renderProjectsSection({
      workspaceGroups: [group],
      appSettings: { workspaceGroups: [group] },
      onRenameWorkspaceGroup,
    });

    const input = screen.getByDisplayValue("Core Team");
    fireEvent.change(input, { target: { value: "Renamed Team" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.getByText("rename failed")).not.toBeNull();
      expect((input as HTMLInputElement).value).toBe("Core Team");
    });
  });

  it("selects and clears group copies folder", async () => {
    const group = {
      id: "g-1",
      name: "Core Team",
      color: null,
      sortOrder: 0,
      copiesFolder: "/tmp/copies-old",
    };
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    vi.mocked(open).mockResolvedValue("/tmp/copies-next");
    renderProjectsSection({
      workspaceGroups: [group],
      appSettings: { workspaceGroups: [group] },
      onUpdateAppSettings,
    });

    fireEvent.click(screen.getByRole("button", { name: "选择…" }));

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceGroups: [
            expect.objectContaining({ id: "g-1", copiesFolder: "/tmp/copies-next" }),
          ],
        }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "清除" }));

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceGroups: [
            expect.objectContaining({ id: "g-1", copiesFolder: null }),
          ],
        }),
      );
    });
  });

  it("skips copies folder update when picker returns multiple selections", async () => {
    const group = {
      id: "g-1",
      name: "Core Team",
      color: null,
      sortOrder: 0,
      copiesFolder: null,
    };
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    vi.mocked(open).mockResolvedValue(["/tmp/a", "/tmp/b"]);
    renderProjectsSection({
      workspaceGroups: [group],
      appSettings: { workspaceGroups: [group] },
      onUpdateAppSettings,
    });

    fireEvent.click(screen.getByRole("button", { name: "选择…" }));

    await waitFor(() => {
      expect(open).toHaveBeenCalled();
    });
    expect(onUpdateAppSettings).not.toHaveBeenCalled();
  });

  it("does not delete group when confirmation is cancelled", async () => {
    const group = {
      id: "g-1",
      name: "Core Team",
      color: null,
      sortOrder: 0,
      copiesFolder: null,
    };
    const onDeleteWorkspaceGroup = vi.fn().mockResolvedValue(true);
    vi.mocked(ask).mockResolvedValue(false);
    renderProjectsSection({
      workspaceGroups: [group],
      appSettings: { workspaceGroups: [group] },
      groupedWorkspaces: [
        {
          id: "g-1",
          name: "Core Team",
          workspaces: [workspace({ id: "w1", name: "Project One" })],
        },
      ],
      onDeleteWorkspaceGroup,
    });

    fireEvent.click(screen.getByRole("button", { name: "删除分组" }));

    await waitFor(() => {
      expect(ask).toHaveBeenCalled();
    });
    expect(onDeleteWorkspaceGroup).not.toHaveBeenCalled();
  });

  it("shows group error when delete is confirmed but API fails", async () => {
    const group = {
      id: "g-1",
      name: "Core Team",
      color: null,
      sortOrder: 0,
      copiesFolder: null,
    };
    const onDeleteWorkspaceGroup = vi
      .fn()
      .mockRejectedValue(new Error("delete failed"));
    vi.mocked(ask).mockResolvedValue(true);
    renderProjectsSection({
      workspaceGroups: [group],
      appSettings: { workspaceGroups: [group] },
      onDeleteWorkspaceGroup,
    });

    fireEvent.click(screen.getByRole("button", { name: "删除分组" }));

    await waitFor(() => {
      expect(onDeleteWorkspaceGroup).toHaveBeenCalledWith("g-1");
      expect(screen.getByText("delete failed")).not.toBeNull();
    });
  });
});

describe("SettingsView Environments", () => {
  it("saves the setup script for the selected project", async () => {
    const onUpdateWorkspaceSettings = vi.fn().mockResolvedValue(undefined);
    renderEnvironmentsSection({ onUpdateWorkspaceSettings });

    expect(
      screen.getByText("环境", { selector: ".settings-section-title" }),
    ).not.toBeNull();
    const textarea = screen.getByPlaceholderText("pnpm install");
    expect((textarea as HTMLTextAreaElement).value).toBe("echo one");

    fireEvent.change(textarea, { target: { value: "echo updated" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(onUpdateWorkspaceSettings).toHaveBeenCalledWith("w1", {
        worktreeSetupScript: "echo updated",
      });
    });
  });

  it("normalizes whitespace-only scripts to null", async () => {
    const onUpdateWorkspaceSettings = vi.fn().mockResolvedValue(undefined);
    renderEnvironmentsSection({ onUpdateWorkspaceSettings });

    const textarea = screen.getByPlaceholderText("pnpm install");
    fireEvent.change(textarea, { target: { value: "   \n\t" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(onUpdateWorkspaceSettings).toHaveBeenCalledWith("w1", {
        worktreeSetupScript: null,
      });
    });
  });

  it("copies the setup script to the clipboard", async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    try {
      renderEnvironmentsSection();

      fireEvent.click(screen.getByRole("button", { name: "复制" }));

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith("echo one");
      });
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(navigator, "clipboard", originalDescriptor);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (navigator as any).clipboard;
      }
    }
  });

  it("shows error and keeps draft when saving setup script fails", async () => {
    const onUpdateWorkspaceSettings = vi
      .fn()
      .mockRejectedValue(new Error("save failed"));
    renderEnvironmentsSection({ onUpdateWorkspaceSettings });

    const textarea = screen.getByPlaceholderText("pnpm install");
    fireEvent.change(textarea, { target: { value: "echo broken" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(screen.getByText("save failed")).not.toBeNull();
      expect((textarea as HTMLTextAreaElement).value).toBe("echo broken");
      expect(
        (screen.getByRole("button", { name: "保存" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false);
    });
  });

  it("disables environment controls while setup script is saving", async () => {
    let resolveSave: (() => void) | null = null;
    const onUpdateWorkspaceSettings = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    renderEnvironmentsSection({ onUpdateWorkspaceSettings });

    fireEvent.change(screen.getByPlaceholderText("pnpm install"), {
      target: { value: "echo wait" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(
        (screen.getByRole("button", { name: "保存中..." }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
      expect(
        (screen.getByLabelText("项目") as HTMLSelectElement).disabled,
      ).toBe(true);
    });

    resolveSave?.();

    await waitFor(() => {
      expect(
        (screen.getByRole("button", { name: "保存" }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
    });
  });

  it("keeps save disabled when environment script has no changes", async () => {
    const onUpdateWorkspaceSettings = vi.fn().mockResolvedValue(undefined);
    renderEnvironmentsSection({ onUpdateWorkspaceSettings });

    expect(
      (screen.getByRole("button", { name: "保存" }) as HTMLButtonElement).disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(onUpdateWorkspaceSettings).not.toHaveBeenCalled();
  });

  it("switches project script draft when changing environment workspace", async () => {
    const onUpdateWorkspaceSettings = vi.fn().mockResolvedValue(undefined);
    renderEnvironmentsSection({
      onUpdateWorkspaceSettings,
      groupedWorkspaces: [
        {
          id: null,
          name: "Ungrouped",
          workspaces: [
            workspace({
              id: "w1",
              name: "Project One",
              settings: {
                sidebarCollapsed: false,
                worktreeSetupScript: "echo one",
              },
            }),
            workspace({
              id: "w2",
              name: "Project Two",
              settings: {
                sidebarCollapsed: false,
                worktreeSetupScript: "echo two",
              },
            }),
          ],
        },
      ],
    });

    const textarea = screen.getByPlaceholderText("pnpm install") as HTMLTextAreaElement;
    expect(textarea.value).toBe("echo one");
    fireEvent.change(textarea, { target: { value: "echo dirty" } });

    fireEvent.change(screen.getByLabelText("项目"), {
      target: { value: "w2" },
    });

    await waitFor(() => {
      expect((screen.getByPlaceholderText("pnpm install") as HTMLTextAreaElement).value).toBe(
        "echo two",
      );
      expect((screen.getByRole("button", { name: "保存" }) as HTMLButtonElement).disabled).toBe(
        true,
      );
    });
  });

  it("renders empty state when no main workspaces are available", async () => {
    renderEnvironmentsSection({
      groupedWorkspaces: [
        {
          id: null,
          name: "Ungrouped",
          workspaces: [
            workspace({
              id: "wt1",
              name: "Worktree Only",
              kind: "worktree",
              settings: {
                sidebarCollapsed: false,
                worktreeSetupScript: "echo ignored",
              },
            }),
          ],
        },
      ],
    });

    await waitFor(() => {
      expect(screen.getByText("暂无项目。")).not.toBeNull();
    });
    expect(screen.queryByLabelText("项目")).toBeNull();
    expect(screen.queryByRole("button", { name: "保存" })).toBeNull();
  });
});
