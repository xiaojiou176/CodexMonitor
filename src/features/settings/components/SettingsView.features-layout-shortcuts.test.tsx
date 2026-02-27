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
import type { AppSettings } from "../../../types";
import { DEFAULT_COMMIT_MESSAGE_PROMPT } from "../../../utils/commitMessagePrompt";
import * as tauriService from "../../../services/tauri";
import * as openerPlugin from "@tauri-apps/plugin-opener";
import { SettingsView } from "./SettingsView";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: vi.fn(),
  open: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-opener", () => ({
  revealItemInDir: vi.fn(),
}));

afterEach(async () => {
  await act(async () => {
    await new Promise<void>((resolve) => {
      queueMicrotask(resolve);
    });
  });
  vi.restoreAllMocks();
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

const renderFeaturesSection = (
  options: {
    appSettings?: Partial<AppSettings>;
    onUpdateAppSettings?: ComponentProps<typeof SettingsView>["onUpdateAppSettings"];
  } = {},
) => {
  cleanup();
  const onUpdateAppSettings =
    options.onUpdateAppSettings ?? vi.fn().mockResolvedValue(undefined);
  const props: ComponentProps<typeof SettingsView> = {
    reduceTransparency: false,
    onToggleTransparency: vi.fn(),
    appSettings: { ...baseSettings, ...options.appSettings },
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
    initialSection: "features",
  };

  render(<SettingsView {...props} />);
  return { onUpdateAppSettings };
};
describe("SettingsView Features", () => {
  it("opens Codex config path in file manager", async () => {
    const getPathSpy = vi
      .spyOn(tauriService, "getCodexConfigPath")
      .mockResolvedValue("/tmp/codex/config.toml");
    const revealSpy = vi.mocked(openerPlugin.revealItemInDir).mockResolvedValue(
      undefined,
    );
    renderFeaturesSection();

    const configRow = screen
      .getByText("配置文件")
      .closest(".settings-toggle-row") as HTMLElement | null;
    expect(configRow).not.toBeNull();
    if (!configRow) {
      throw new Error("Expected config row");
    }

    fireEvent.click(within(configRow).getByRole("button"));

    await waitFor(() => {
      expect(getPathSpy).toHaveBeenCalled();
      expect(revealSpy).toHaveBeenCalledWith("/tmp/codex/config.toml");
    });
  });

  it("shows open config error when reveal fails", async () => {
    vi.spyOn(tauriService, "getCodexConfigPath").mockResolvedValue(
      "/tmp/codex/config.toml",
    );
    vi.mocked(openerPlugin.revealItemInDir).mockRejectedValue(
      new Error("cannot reveal"),
    );
    renderFeaturesSection();

    const configRow = screen
      .getByText("配置文件")
      .closest(".settings-toggle-row") as HTMLElement | null;
    expect(configRow).not.toBeNull();
    if (!configRow) {
      throw new Error("Expected config row");
    }

    fireEvent.click(within(configRow).getByRole("button"));

    await waitFor(() => {
      expect(screen.getByText("cannot reveal")).not.toBeNull();
    });
  });

  it("falls back to generic open config error for non-Error failures", async () => {
    vi.spyOn(tauriService, "getCodexConfigPath").mockRejectedValue("boom");
    renderFeaturesSection();

    const configRow = screen
      .getByText("配置文件")
      .closest(".settings-toggle-row") as HTMLElement | null;
    expect(configRow).not.toBeNull();
    if (!configRow) {
      throw new Error("Expected config row");
    }

    fireEvent.click(within(configRow).getByRole("button"));

    await waitFor(() => {
      expect(screen.getByText("无法打开配置文件。")).not.toBeNull();
    });
  });

  it("updates personality selection", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    renderFeaturesSection({ onUpdateAppSettings });

    fireEvent.change(screen.getByLabelText("回复风格"), {
      target: { value: "pragmatic" },
    });

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ personality: "pragmatic" }),
      );
    });
  });

  it("toggles steer mode in stable features", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    renderFeaturesSection({
      onUpdateAppSettings,
      appSettings: { steerEnabled: true },
    });

    const steerTitle = screen.getByText("即时发送（Steer）");
    const steerRow = steerTitle.closest(".settings-toggle-row");
    expect(steerRow).not.toBeNull();

    const toggle = within(steerRow as HTMLElement).getByRole("button");
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ steerEnabled: false }),
      );
    });
  });

  it("toggles collaboration modes in stable features", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    renderFeaturesSection({
      onUpdateAppSettings,
      appSettings: { collaborationModesEnabled: true },
    });

    const title = screen.getByText("协作模式");
    const row = title.closest(".settings-toggle-row");
    expect(row).not.toBeNull();

    fireEvent.click(within(row as HTMLElement).getByRole("button"));

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ collaborationModesEnabled: false }),
      );
    });
  });

  it("toggles background terminal in stable features", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    renderFeaturesSection({
      onUpdateAppSettings,
      appSettings: { unifiedExecEnabled: true },
    });

    const terminalTitle = screen.getByText("后台终端");
    const terminalRow = terminalTitle.closest(".settings-toggle-row");
    expect(terminalRow).not.toBeNull();

    const toggle = within(terminalRow as HTMLElement).getByRole("button");
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ unifiedExecEnabled: false }),
      );
    });
  });

  it("toggles auto-archive for sub-agent threads", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    renderFeaturesSection({
      onUpdateAppSettings,
      appSettings: { autoArchiveSubAgentThreadsEnabled: true },
    });

    const toggleTitle = screen.getByText("自动归档子代理线程");
    const toggleRow = toggleTitle.closest(".settings-toggle-row");
    expect(toggleRow).not.toBeNull();

    const toggle = within(toggleRow as HTMLElement).getByRole("button");
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ autoArchiveSubAgentThreadsEnabled: false }),
      );
    });
  });

  it("toggles sub-agent thread visibility in sidebar", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    renderFeaturesSection({
      onUpdateAppSettings,
      appSettings: { showSubAgentThreadsInSidebar: true },
    });

    const toggleTitle = screen.getByText("侧边栏显示子代理线程");
    const toggleRow = toggleTitle.closest(".settings-toggle-row");
    expect(toggleRow).not.toBeNull();

    const toggle = within(toggleRow as HTMLElement).getByRole("button");
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ showSubAgentThreadsInSidebar: false }),
      );
    });
  });

  it("updates auto-archive max age with clamped minutes", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    renderFeaturesSection({
      onUpdateAppSettings,
      appSettings: {
        autoArchiveSubAgentThreadsEnabled: true,
        autoArchiveSubAgentThreadsMaxAgeMinutes: 30,
      },
    });

    fireEvent.change(screen.getByLabelText("自动归档分钟数"), {
      target: { value: "999" },
    });

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ autoArchiveSubAgentThreadsMaxAgeMinutes: 240 }),
      );
    });
  });

  it("keeps auto-archive minutes input disabled when auto-archive is off", async () => {
    renderFeaturesSection({
      appSettings: {
        remoteBackendProvider: "orbit",
        autoArchiveSubAgentThreadsEnabled: false,
        autoArchiveSubAgentThreadsMaxAgeMinutes: 30,
      },
    });

    const minutesInput = screen.getByLabelText(
      "自动归档分钟数",
    ) as HTMLInputElement;
    expect(minutesInput.disabled).toBe(true);
  });

  it("updates settings when enabling auto-archive from disabled state", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    renderFeaturesSection({
      onUpdateAppSettings,
      appSettings: {
        remoteBackendProvider: "orbit",
        autoArchiveSubAgentThreadsEnabled: false,
        autoArchiveSubAgentThreadsMaxAgeMinutes: 30,
      },
    });

    const minutesInput = screen.getByLabelText(
      "自动归档分钟数",
    ) as HTMLInputElement;
    expect(minutesInput.disabled).toBe(true);

    const title = screen.getByText("自动归档子代理线程");
    const row = title.closest(".settings-toggle-row");
    expect(row).not.toBeNull();
    fireEvent.click(within(row as HTMLElement).getByRole("button"));
    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ autoArchiveSubAgentThreadsEnabled: true }),
      );
    });
  });

  it("renders composer, dictation, open-apps, git, and model proxy sections", async () => {
    cleanup();
    render(
      <SettingsView
        workspaceGroups={[]}
        groupedWorkspaces={[]}
        ungroupedLabel="Ungrouped"
        onClose={vi.fn()}
        onMoveWorkspace={vi.fn()}
        onDeleteWorkspace={vi.fn()}
        onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        reduceTransparency={false}
        onToggleTransparency={vi.fn()}
        appSettings={{ ...baseSettings, remoteBackendProvider: "orbit" }}
        openAppIconById={{}}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
        onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
        onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
        onUpdateWorkspaceSettings={vi.fn().mockResolvedValue(undefined)}
        scaleShortcutTitle="Scale shortcut"
        scaleShortcutText="Use Command +/-"
        onTestNotificationSound={vi.fn()}
        onTestSystemNotification={vi.fn()}
        dictationModelStatus={null}
        onDownloadDictationModel={vi.fn()}
        onCancelDictationDownload={vi.fn()}
        onRemoveDictationModel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "输入" }));
    fireEvent.click(screen.getByRole("tab", { name: "编辑器" }));
    await waitFor(() => {
      expect(
        screen.getByText("预设方案", { selector: "label.settings-field-label" }),
      ).not.toBeNull();
    });

    fireEvent.click(screen.getByRole("tab", { name: "听写" }));
    await waitFor(() => {
      expect(
        screen.getByText("偏好听写语言", { selector: "label.settings-field-label" }),
      ).not.toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "交互" }));
    fireEvent.click(screen.getByRole("tab", { name: "打开方式" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "添加应用" })).not.toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Git" }));
    await waitFor(() => {
      expect(
        screen.getByText("Commit Message 生成提示词", {
          selector: ".settings-field-label",
        }),
      ).not.toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "AI 与服务" }));
    fireEvent.click(screen.getByRole("tab", { name: "模型代理" }));
    await waitFor(() => {
      expect(
        screen.getByText("CLIProxyAPI 集成", { selector: ".settings-section-title" }),
      ).not.toBeNull();
    });
  });

  it("saves edited commit message prompt", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    renderFeaturesSection({ onUpdateAppSettings });

    fireEvent.click(screen.getByRole("button", { name: "Git" }));
    await waitFor(() => {
      expect(
        screen.getByText("Commit Message 生成提示词", {
          selector: ".settings-field-label",
        }),
      ).not.toBeNull();
    });

    const field = screen
      .getByText("Commit Message 生成提示词", { selector: ".settings-field-label" })
      .closest(".settings-field");
    expect(field).not.toBeNull();
    if (!field) {
      throw new Error("Expected commit message prompt field");
    }

    const textarea = within(field).getByRole("textbox");
    const saveButton = within(field).getByRole("button", { name: "保存" });
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(textarea, {
      target: { value: "请基于 {diff} 生成简洁且可审核的提交说明。" },
    });
    expect((saveButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          commitMessagePrompt: "请基于 {diff} 生成简洁且可审核的提交说明。",
        }),
      );
    });
  });

  it("disables commit prompt actions while save is pending", async () => {
    let resolveSave: (() => void) | null = null;
    const onUpdateAppSettings = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    renderFeaturesSection({ onUpdateAppSettings });

    fireEvent.click(screen.getByRole("button", { name: "Git" }));
    await waitFor(() => {
      expect(
        screen.getByText("Commit Message 生成提示词", {
          selector: ".settings-field-label",
        }),
      ).not.toBeNull();
    });

    const field = screen
      .getByText("Commit Message 生成提示词", { selector: ".settings-field-label" })
      .closest(".settings-field");
    expect(field).not.toBeNull();
    if (!field) {
      throw new Error("Expected commit message prompt field");
    }

    const textarea = within(field).getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: { value: "pending save prompt" },
    });
    fireEvent.click(within(field).getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(
        within(field).getByRole("button", { name: "保存中..." }),
      ).not.toBeNull();
      expect((within(field).getByRole("button", { name: "重置" }) as HTMLButtonElement).disabled).toBe(
        true,
      );
      expect(textarea.disabled).toBe(true);
    });

    resolveSave?.();

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ commitMessagePrompt: "pending save prompt" }),
      );
    });
  });

  it("resets commit message prompt to default", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    renderFeaturesSection({
      onUpdateAppSettings,
      appSettings: { commitMessagePrompt: "custom prompt" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Git" }));
    await waitFor(() => {
      expect(
        screen.getByText("Commit Message 生成提示词", {
          selector: ".settings-field-label",
        }),
      ).not.toBeNull();
    });

    const field = screen
      .getByText("Commit Message 生成提示词", { selector: ".settings-field-label" })
      .closest(".settings-field");
    expect(field).not.toBeNull();
    if (!field) {
      throw new Error("Expected commit message prompt field");
    }

    const textarea = within(field).getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "temporary prompt" } });
    fireEvent.click(within(field).getByRole("button", { name: "重置" }));

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          commitMessagePrompt: DEFAULT_COMMIT_MESSAGE_PROMPT,
        }),
      );
    });
  });
});

describe("SettingsView mobile layout", () => {
  it("uses a master/detail flow on narrow mobile widths", async () => {
    cleanup();
    const originalMatchMedia = window.matchMedia;
    const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(
      window.navigator,
      "platform",
    );
    const originalUserAgentDescriptor = Object.getOwnPropertyDescriptor(
      window.navigator,
      "userAgent",
    );
    const originalTouchPointsDescriptor = Object.getOwnPropertyDescriptor(
      window.navigator,
      "maxTouchPoints",
    );

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("max-width: 720px"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      value: "iPhone",
    });
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
    });
    Object.defineProperty(window.navigator, "maxTouchPoints", {
      configurable: true,
      value: 5,
    });

    try {
      const rendered = render(
        <SettingsView
          workspaceGroups={[]}
          groupedWorkspaces={[]}
          ungroupedLabel="Ungrouped"
          onClose={vi.fn()}
          onMoveWorkspace={vi.fn()}
          onDeleteWorkspace={vi.fn()}
          onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          reduceTransparency={false}
          onToggleTransparency={vi.fn()}
          appSettings={baseSettings}
          openAppIconById={{}}
          onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
          onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
          onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
          onUpdateWorkspaceSettings={vi.fn().mockResolvedValue(undefined)}
          scaleShortcutTitle="Scale shortcut"
          scaleShortcutText="Use Command +/-"
          onTestNotificationSound={vi.fn()}
          onTestSystemNotification={vi.fn()}
          dictationModelStatus={null}
          onDownloadDictationModel={vi.fn()}
          onCancelDictationDownload={vi.fn()}
          onRemoveDictationModel={vi.fn()}
        />,
      );

      expect(
        within(rendered.container).queryByText("Sections"),
      ).toBeNull();
      expect(
        rendered.container.querySelectorAll(".ds-panel-nav-item-disclosure")
          .length,
      ).toBeGreaterThan(0);

      fireEvent.click(
        within(rendered.container).getByRole("button", {
          name: "显示与声音",
        }),
      );

      await waitFor(() => {
        expect(
          within(rendered.container).getByRole("button", {
            name: "返回设置分区",
          }),
        ).not.toBeNull();
        expect(
          within(rendered.container).getByText("显示与声音", {
            selector: ".settings-mobile-detail-title",
          }),
        ).not.toBeNull();
      });

      fireEvent.click(
        within(rendered.container).getByRole("button", {
          name: "返回设置分区",
        }),
      );

      await waitFor(() => {
        expect(within(rendered.container).queryByText("Sections")).toBeNull();
      });
    } finally {
      if (originalMatchMedia) {
        Object.defineProperty(window, "matchMedia", {
          configurable: true,
          writable: true,
          value: originalMatchMedia,
        });
      } else {
        Reflect.deleteProperty(window, "matchMedia");
      }
      if (originalPlatformDescriptor) {
        Object.defineProperty(window.navigator, "platform", originalPlatformDescriptor);
      } else {
        Reflect.deleteProperty(window.navigator, "platform");
      }
      if (originalUserAgentDescriptor) {
        Object.defineProperty(window.navigator, "userAgent", originalUserAgentDescriptor);
      } else {
        Reflect.deleteProperty(window.navigator, "userAgent");
      }
      if (originalTouchPointsDescriptor) {
        Object.defineProperty(
          window.navigator,
          "maxTouchPoints",
          originalTouchPointsDescriptor,
        );
      } else {
        Reflect.deleteProperty(window.navigator, "maxTouchPoints");
      }
    }
  });
});

describe("SettingsView Server tailscale errors", () => {
  it("renders tailscale status raw error for string failures", async () => {
    vi.spyOn(tauriService, "tailscaleStatus").mockRejectedValue("status failed");
    vi.spyOn(tauriService, "tailscaleDaemonCommandPreview").mockResolvedValue({
      command: "tailscale up",
      tokenConfigured: true,
    });
    vi.spyOn(tauriService, "tailscaleDaemonStatus").mockResolvedValue({
      state: "stopped",
      pid: null,
      startedAtMs: null,
      lastError: null,
      listenAddr: "127.0.0.1:4732",
    });

    render(
      <SettingsView
        workspaceGroups={[]}
        groupedWorkspaces={[]}
        ungroupedLabel="Ungrouped"
        onClose={vi.fn()}
        onMoveWorkspace={vi.fn()}
        onDeleteWorkspace={vi.fn()}
        onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        reduceTransparency={false}
        onToggleTransparency={vi.fn()}
        appSettings={{ ...baseSettings, remoteBackendProvider: "tcp" }}
        openAppIconById={{}}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
        onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
        onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
        onUpdateWorkspaceSettings={vi.fn().mockResolvedValue(undefined)}
        scaleShortcutTitle="Scale shortcut"
        scaleShortcutText="Use Command +/-"
        onTestNotificationSound={vi.fn()}
        onTestSystemNotification={vi.fn()}
        dictationModelStatus={null}
        onDownloadDictationModel={vi.fn()}
        onCancelDictationDownload={vi.fn()}
        onRemoveDictationModel={vi.fn()}
        initialSection="server"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("status failed")).not.toBeNull();
    });
  });

  it("renders tailscale command error for object message failures", async () => {
    vi.spyOn(tauriService, "tailscaleStatus").mockResolvedValue({
      installed: true,
      running: true,
      version: "1.0.0",
      tailnetName: "dev-tailnet",
      machineName: "dev-mac",
      tailscaleIps: ["100.64.0.1"],
      suggestedRemoteHost: null,
      message: "ok",
    });
    vi.spyOn(tauriService, "tailscaleDaemonCommandPreview").mockRejectedValue({
      message: "preview failed",
    });
    vi.spyOn(tauriService, "tailscaleDaemonStatus").mockResolvedValue({
      state: "stopped",
      pid: null,
      startedAtMs: null,
      lastError: null,
      listenAddr: "127.0.0.1:4732",
    });

    render(
      <SettingsView
        workspaceGroups={[]}
        groupedWorkspaces={[]}
        ungroupedLabel="Ungrouped"
        onClose={vi.fn()}
        onMoveWorkspace={vi.fn()}
        onDeleteWorkspace={vi.fn()}
        onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        reduceTransparency={false}
        onToggleTransparency={vi.fn()}
        appSettings={{ ...baseSettings, remoteBackendProvider: "tcp" }}
        openAppIconById={{}}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
        onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
        onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
        onUpdateWorkspaceSettings={vi.fn().mockResolvedValue(undefined)}
        scaleShortcutTitle="Scale shortcut"
        scaleShortcutText="Use Command +/-"
        onTestNotificationSound={vi.fn()}
        onTestSystemNotification={vi.fn()}
        dictationModelStatus={null}
        onDownloadDictationModel={vi.fn()}
        onCancelDictationDownload={vi.fn()}
        onRemoveDictationModel={vi.fn()}
        initialSection="server"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("preview failed")).not.toBeNull();
    });
  });
});

describe("SettingsView Shortcuts", () => {
  it("closes on Cmd+W", async () => {
    const onClose = vi.fn();
    render(
      <SettingsView
        workspaceGroups={[]}
        groupedWorkspaces={[]}
        ungroupedLabel="Ungrouped"
        onClose={onClose}
        onMoveWorkspace={vi.fn()}
        onDeleteWorkspace={vi.fn()}
        onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        reduceTransparency={false}
        onToggleTransparency={vi.fn()}
        appSettings={baseSettings}
        openAppIconById={{}}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
        onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
        onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
        onUpdateWorkspaceSettings={vi.fn().mockResolvedValue(undefined)}
        scaleShortcutTitle="Scale shortcut"
        scaleShortcutText="Use Command +/-"
        onTestNotificationSound={vi.fn()}
        onTestSystemNotification={vi.fn()}
        dictationModelStatus={null}
        onDownloadDictationModel={vi.fn()}
        onCancelDictationDownload={vi.fn()}
        onRemoveDictationModel={vi.fn()}
      />,
    );

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "w", metaKey: true, bubbles: true }),
      );
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(
      <SettingsView
        workspaceGroups={[]}
        groupedWorkspaces={[]}
        ungroupedLabel="Ungrouped"
        onClose={onClose}
        onMoveWorkspace={vi.fn()}
        onDeleteWorkspace={vi.fn()}
        onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        reduceTransparency={false}
        onToggleTransparency={vi.fn()}
        appSettings={baseSettings}
        openAppIconById={{}}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
        onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
        onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
        onUpdateWorkspaceSettings={vi.fn().mockResolvedValue(undefined)}
        scaleShortcutTitle="Scale shortcut"
        scaleShortcutText="Use Command +/-"
        onTestNotificationSound={vi.fn()}
        onTestSystemNotification={vi.fn()}
        dictationModelStatus={null}
        onDownloadDictationModel={vi.fn()}
        onCancelDictationDownload={vi.fn()}
        onRemoveDictationModel={vi.fn()}
      />,
    );

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("closes when clicking the modal backdrop", async () => {
    const onClose = vi.fn();
    const { container } = render(
      <SettingsView
        workspaceGroups={[]}
        groupedWorkspaces={[]}
        ungroupedLabel="Ungrouped"
        onClose={onClose}
        onMoveWorkspace={vi.fn()}
        onDeleteWorkspace={vi.fn()}
        onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        reduceTransparency={false}
        onToggleTransparency={vi.fn()}
        appSettings={baseSettings}
        openAppIconById={{}}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
        onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
        onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
        onUpdateWorkspaceSettings={vi.fn().mockResolvedValue(undefined)}
        scaleShortcutTitle="Scale shortcut"
        scaleShortcutText="Use Command +/-"
        onTestNotificationSound={vi.fn()}
        onTestSystemNotification={vi.fn()}
        dictationModelStatus={null}
        onDownloadDictationModel={vi.fn()}
        onCancelDictationDownload={vi.fn()}
        onRemoveDictationModel={vi.fn()}
      />,
    );

    const backdrop = container.querySelector(".ds-modal-backdrop");
    expect(backdrop).not.toBeNull();
    if (!backdrop) {
      throw new Error("Expected settings modal backdrop");
    }

    await act(async () => {
      fireEvent.click(backdrop);
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
