import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import "./styles/base.css";
import "./styles/ds-tokens.css";
import "./styles/ds-modal.css";
import "./styles/ds-toast.css";
import "./styles/ds-panel.css";
import "./styles/ds-diff.css";
import "./styles/ds-popover.css";
import "./styles/buttons.css";
import "./styles/sidebar.css";
import "./styles/home.css";
import "./styles/workspace-home.css";
import "./styles/main.css";
import "./styles/messages.css";
import "./styles/approval-toasts.css";
import "./styles/error-toasts.css";
import "./styles/request-user-input.css";
import "./styles/update-toasts.css";
import "./styles/composer.css";
import "./styles/review-inline.css";
import "./styles/diff.css";
import "./styles/diff-viewer.css";
import "./styles/file-tree.css";
import "./styles/panel-tabs.css";
import "./styles/prompts.css";
import "./styles/debug.css";
import "./styles/terminal.css";
import "./styles/plan.css";
import "./styles/about.css";
import "./styles/tabbar.css";
import "./styles/worktree-modal.css";
import "./styles/clone-modal.css";
import "./styles/branch-switcher-modal.css";
import "./styles/settings.css";
import "./styles/compact-base.css";
import "./styles/compact-phone.css";
import "./styles/compact-tablet.css";
import "./styles/ecosystem-panels.css";
import successSoundUrl from "./assets/success-notification.mp3";
import errorSoundUrl from "./assets/error-notification.mp3";
import { AppLayout } from "./features/app/components/AppLayout";
import { AppModals } from "./features/app/components/AppModals";
import { useConfirmModal } from "./features/app/hooks/useConfirmModal";
import { MainHeaderActions } from "./features/app/components/MainHeaderActions";
import { CommandPalette, useCommandPalette, type CommandItem } from "./features/app/components/CommandPalette";
import { useLayoutNodes } from "./features/layout/hooks/useLayoutNodes";
import { useWorkspaceDropZone } from "./features/workspaces/hooks/useWorkspaceDropZone";
import { useThreads } from "./features/threads/hooks/useThreads";
import { useWindowDrag } from "./features/layout/hooks/useWindowDrag";
import { useGitPanelController } from "./features/app/hooks/useGitPanelController";
import { useGitRemote } from "./features/git/hooks/useGitRemote";
import { useGitRepoScan } from "./features/git/hooks/useGitRepoScan";
import { usePullRequestComposer } from "./features/git/hooks/usePullRequestComposer";
import { useGitActions } from "./features/git/hooks/useGitActions";
import { useAutoExitEmptyDiff } from "./features/git/hooks/useAutoExitEmptyDiff";
import { useModels } from "./features/models/hooks/useModels";
import { useCollaborationModes } from "./features/collaboration/hooks/useCollaborationModes";
import { useCollaborationModeSelection } from "./features/collaboration/hooks/useCollaborationModeSelection";
import { useSkills } from "./features/skills/hooks/useSkills";
import { useApps } from "./features/apps/hooks/useApps";
import { useCustomPrompts } from "./features/prompts/hooks/useCustomPrompts";
import { useWorkspaceFileListing } from "./features/app/hooks/useWorkspaceFileListing";
import { useGitBranches } from "./features/git/hooks/useGitBranches";
import { useBranchSwitcher } from "./features/git/hooks/useBranchSwitcher";
import { useDebugLog } from "./features/debug/hooks/useDebugLog";
import { useWorkspaceRefreshOnFocus } from "./features/workspaces/hooks/useWorkspaceRefreshOnFocus";
import { useWorkspaceRestore } from "./features/workspaces/hooks/useWorkspaceRestore";
import { useRenameWorktreePrompt } from "./features/workspaces/hooks/useRenameWorktreePrompt";
import { useLayoutController } from "./features/app/hooks/useLayoutController";
import { useWindowLabel } from "./features/layout/hooks/useWindowLabel";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  SidebarCollapseButton,
  TitlebarExpandControls,
} from "./features/layout/components/SidebarToggleControls";
import { useAppSettingsController } from "./features/app/hooks/useAppSettingsController";
import { useUpdaterController } from "./features/app/hooks/useUpdaterController";
import { useResponseRequiredNotificationsController } from "./features/app/hooks/useResponseRequiredNotificationsController";
import { useAppBadgeCount } from "./features/app/hooks/useAppBadgeCount";
import { useErrorToasts } from "./features/notifications/hooks/useErrorToasts";
import { useComposerShortcuts } from "./features/composer/hooks/useComposerShortcuts";
import { useComposerMenuActions } from "./features/composer/hooks/useComposerMenuActions";
import { useComposerEditorState } from "./features/composer/hooks/useComposerEditorState";
import { useDictationController } from "./features/app/hooks/useDictationController";
import { useComposerController } from "./features/app/hooks/useComposerController";
import { useComposerInsert } from "./features/app/hooks/useComposerInsert";
import { useRenameThreadPrompt } from "./features/threads/hooks/useRenameThreadPrompt";
import { useWorktreePrompt } from "./features/workspaces/hooks/useWorktreePrompt";
import { useClonePrompt } from "./features/workspaces/hooks/useClonePrompt";
import { useWorkspaceController } from "./features/app/hooks/useWorkspaceController";
import { useWorkspaceSelection } from "./features/workspaces/hooks/useWorkspaceSelection";
import { useLocalUsage } from "./features/home/hooks/useLocalUsage";
import { useGitHubPanelController } from "./features/app/hooks/useGitHubPanelController";
import { useSettingsModalState } from "./features/app/hooks/useSettingsModalState";
import { usePersistComposerSettings } from "./features/app/hooks/usePersistComposerSettings";
import { useSyncSelectedDiffPath } from "./features/app/hooks/useSyncSelectedDiffPath";
import { useMenuAcceleratorController } from "./features/app/hooks/useMenuAcceleratorController";
import { useAppMenuEvents } from "./features/app/hooks/useAppMenuEvents";
import { usePlanReadyActions } from "./features/app/hooks/usePlanReadyActions";
import { useWorkspaceActions } from "./features/app/hooks/useWorkspaceActions";
import { useWorkspaceCycling } from "./features/app/hooks/useWorkspaceCycling";
import { useThreadRows } from "./features/app/hooks/useThreadRows";
import { useInterruptShortcut } from "./features/app/hooks/useInterruptShortcut";
import { useArchiveShortcut } from "./features/app/hooks/useArchiveShortcut";
import { useLiquidGlassEffect } from "./features/app/hooks/useLiquidGlassEffect";
import { useCopyThread } from "./features/threads/hooks/useCopyThread";
import { useTerminalController } from "./features/terminal/hooks/useTerminalController";
import { useWorkspaceLaunchScript } from "./features/app/hooks/useWorkspaceLaunchScript";
import { useWorkspaceLaunchScripts } from "./features/app/hooks/useWorkspaceLaunchScripts";
import { useWorktreeSetupScript } from "./features/app/hooks/useWorktreeSetupScript";
import { useGitCommitController } from "./features/app/hooks/useGitCommitController";
import { WorkspaceHome } from "./features/workspaces/components/WorkspaceHome";
import { MobileServerSetupWizard } from "./features/mobile/components/MobileServerSetupWizard";
import { useMobileServerSetup } from "./features/mobile/hooks/useMobileServerSetup";
import { useWorkspaceHome } from "./features/workspaces/hooks/useWorkspaceHome";
import { useWorkspaceAgentMd } from "./features/workspaces/hooks/useWorkspaceAgentMd";
import { isMobilePlatform } from "./utils/platformPaths";
import { normalizeCodexArgsInput } from "./utils/codexArgsInput";
import {
  persistWorkspaceOrderWithWal,
  replayPendingWorkspaceReorder,
} from "./utils/workspaceOrderRecovery";
import type {
  ComposerEditorSettings,
  ThreadToolOutputMode,
  ThreadTranscriptOptions,
  WorkspaceInfo,
} from "./types";
import { OPEN_APP_STORAGE_KEY } from "./features/app/constants";
import { useOpenAppIcons } from "./features/app/hooks/useOpenAppIcons";
import { useCodeCssVars } from "./features/app/hooks/useCodeCssVars";
import { useAccountSwitching } from "./features/app/hooks/useAccountSwitching";
import { useNewAgentDraft } from "./features/app/hooks/useNewAgentDraft";
import { useSystemNotificationThreadLinks } from "./features/app/hooks/useSystemNotificationThreadLinks";
import { useThreadListSortKey } from "./features/app/hooks/useThreadListSortKey";
import { useThreadListActions } from "./features/app/hooks/useThreadListActions";
import { useGitRootSelection } from "./features/app/hooks/useGitRootSelection";
import { pushErrorToast } from "./services/toasts";
import { useTabActivationGuard } from "./features/app/hooks/useTabActivationGuard";
import { useRemoteThreadLiveConnection } from "./features/app/hooks/useRemoteThreadLiveConnection";
import {
  REMOTE_THREAD_POLL_INTERVAL_MS,
  useRemoteThreadRefreshOnFocus,
} from "./features/app/hooks/useRemoteThreadRefreshOnFocus";
import { createPendingThreadSeed } from "./features/threads/utils/threadCodexParamsSeed";
import {
  useThreadCodexBootstrapOrchestration,
  useThreadCodexSyncOrchestration,
  useThreadSelectionHandlersOrchestration,
} from "./features/app/orchestration/useThreadOrchestration";
import {
  buildLatestAgentRuns,
  buildRecentThreadsSnapshot,
  buildAppCssVars,
  buildCommandPaletteItems,
  buildCompactThreadConnectionIndicatorMeta,
  deriveFileStatusLabel,
  buildGitStatusForPanel,
  clampMessageFontSize,
  countDiffLineStats,
  deriveIsGitPanelVisible,
  deriveShowComposer,
  deriveShowCompactCodexThreadActions,
  deriveTabletTab,
  type DiffLineStats,
  loadMessageFontSize,
  MESSAGE_FONT_SIZE_STORAGE_NAME,
  resolveCompactThreadConnectionState,
  shouldLoadGitHubPanelData,
} from "./features/app/utils/appUiHelpers";

const AboutView = lazy(() =>
  import("./features/about/components/AboutView").then((module) => ({
    default: module.AboutView,
  })),
);

const SettingsView = lazy(() =>
  import("./features/settings/components/SettingsView").then((module) => ({
    default: module.SettingsView,
  })),
);

const GitHubPanelData = lazy(() =>
  import("./features/git/components/GitHubPanelData").then((module) => ({
    default: module.GitHubPanelData,
  })),
);

const CONTINUE_PROMPT_DEFAULT = "请继续完成我和你讨论的Plan！";

type ContinueThreadConfig = {
  enabled: boolean;
  prompt: string;
};

type MainHeaderCopyConfig = {
  includeUserInput: boolean;
  includeCodexReplies: boolean;
  toolOutputMode: ThreadToolOutputMode;
};

const THREAD_COPY_PRESET_DETAILED: ThreadTranscriptOptions = {
  includeUserInput: true,
  includeAssistantMessages: true,
  toolOutputMode: "detailed",
};

const THREAD_COPY_PRESET_COMPACT: ThreadTranscriptOptions = {
  includeUserInput: true,
  includeAssistantMessages: true,
  toolOutputMode: "compact",
};

function MainApp() {
  const {
    appSettings,
    setAppSettings,
    doctor,
    codexUpdate,
    appSettingsLoading,
    reduceTransparency,
    setReduceTransparency,
    scaleShortcutTitle,
    scaleShortcutText,
    queueSaveSettings,
  } = useAppSettingsController();
  useCodeCssVars(appSettings);
  const {
    dictationModel,
    dictationState,
    dictationLevel,
    dictationTranscript,
    dictationError,
    dictationHint,
    dictationReady,
    handleToggleDictation,
    clearDictationTranscript,
    clearDictationError,
    clearDictationHint,
  } = useDictationController(appSettings);
  const {
    debugOpen,
    setDebugOpen,
    debugEntries,
    showDebugButton,
    addDebugEntry,
    handleCopyDebug,
    clearDebugEntries,
  } = useDebugLog();
  const shouldReduceTransparency = reduceTransparency || isMobilePlatform();
  useLiquidGlassEffect({ reduceTransparency: shouldReduceTransparency, onDebug: addDebugEntry });
  const { threadListSortKey, setThreadListSortKey } = useThreadListSortKey();
  const [messageFontSize, setMessageFontSize] = useState<number>(() => loadMessageFontSize());
  const [continueConfigByThread, setContinueConfigByThread] = useState<
    Record<string, ContinueThreadConfig>
  >({});
  const continuePendingImmediateByThreadRef = useRef<Record<string, boolean>>({});
  const continueLastHandledByThreadRef = useRef<Record<string, number>>({});
  const continueTriggeringByThreadRef = useRef<Record<string, boolean>>({});
  const handleMessageFontSizeChange = useCallback((next: number) => {
    const clamped = clampMessageFontSize(next);
    setMessageFontSize(clamped);
    try {
      window.localStorage.setItem(MESSAGE_FONT_SIZE_STORAGE_NAME, String(clamped));
    } catch {
      // Best-effort persistence.
    }
  }, []);
  const [activeTab, setActiveTab] = useState<
    "home" | "projects" | "codex" | "git" | "log"
  >("codex");
  const [mobileThreadRefreshLoading, setMobileThreadRefreshLoading] = useState(false);
  const tabletTab = deriveTabletTab(activeTab);
  const {
    workspaces,
    workspaceGroups,
    groupedWorkspaces,
    getWorkspaceGroupName,
    ungroupedLabel,
    activeWorkspace,
    activeWorkspaceId,
    setActiveWorkspaceId,
    addWorkspace,
    addWorkspacesFromPaths,
    addWorkspaceFromPath,
    mobileRemoteWorkspacePathPrompt,
    updateMobileRemoteWorkspacePathInput,
    cancelMobileRemoteWorkspacePathPrompt,
    submitMobileRemoteWorkspacePathPrompt,
    workspaceFromUrlPrompt,
    openWorkspaceFromUrlPrompt,
    closeWorkspaceFromUrlPrompt,
    chooseWorkspaceFromUrlDestinationPath,
    submitWorkspaceFromUrlPrompt,
    updateWorkspaceFromUrlUrl,
    updateWorkspaceFromUrlTargetFolderName,
    clearWorkspaceFromUrlDestinationPath,
    canSubmitWorkspaceFromUrlPrompt,
    addCloneAgent,
    addWorktreeAgent,
    connectWorkspace,
    markWorkspaceConnected,
    updateWorkspaceSettings,
    updateWorkspaceCodexBin,
    createWorkspaceGroup,
    renameWorkspaceGroup,
    moveWorkspaceGroup,
    deleteWorkspaceGroup,
    assignWorkspaceGroup,
    removeWorkspace,
    removeWorktree,
    renameWorktree,
    renameWorktreeUpstream,
    deletingWorktreeIds,
    hasLoaded,
    refreshWorkspaces,
  } = useWorkspaceController({
    appSettings,
    addDebugEntry,
    queueSaveSettings,
  });
  const {
    isMobileRuntime,
    showMobileSetupWizard,
    mobileSetupWizardProps,
    handleMobileConnectSuccess,
  } = useMobileServerSetup({
    appSettings,
    appSettingsLoading,
    queueSaveSettings,
    refreshWorkspaces,
  });
  const updaterEnabled = !isMobileRuntime;

  const workspacesById = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace])),
    [workspaces],
  );
  const {
    threadCodexParamsVersion,
    getThreadCodexParams,
    patchThreadCodexParams,
    accessMode,
    setAccessMode,
    preferredModelId,
    setPreferredModelId,
    preferredEffort,
    setPreferredEffort,
    setPreferredCollabModeId,
    preferredCodexArgsOverride,
    setPreferredCodexArgsOverride,
    threadCodexSelectionKey,
    setThreadCodexSelectionKey,
    activeThreadIdRef,
    pendingNewThreadSeedRef,
    persistThreadCodexParams,
  } = useThreadCodexBootstrapOrchestration({
    activeWorkspaceId,
  });
  const persistWorkspaceDisplayName = useCallback(
    async (workspaceId: string, displayName: string | null) => {
      const workspace = workspacesById.get(workspaceId);
      if (!workspace) {
        return;
      }
      const normalized = displayName?.trim() ?? "";
      const nextDisplayName =
        normalized && normalized !== workspace.name ? normalized : null;
      if ((workspace.settings.displayName ?? null) === nextDisplayName) {
        return;
      }
      await updateWorkspaceSettings(workspaceId, {
        displayName: nextDisplayName,
      });
    },
    [updateWorkspaceSettings, workspacesById],
  );
  const persistThreadDisplayName = useCallback(
    async (workspaceId: string, threadId: string, displayName: string | null) => {
      const workspace = workspacesById.get(workspaceId);
      if (!workspace) {
        return;
      }
      const current = workspace.settings.threadDisplayNames ?? {};
      const next = { ...current };
      const normalized = displayName?.trim() ?? "";
      if (!normalized) {
        delete next[threadId];
      } else {
        next[threadId] = normalized;
      }
      const hasEntries = Object.keys(next).length > 0;
      const nextThreadDisplayNames = hasEntries ? next : null;
      const currentThreadDisplayNames = workspace.settings.threadDisplayNames ?? null;
      if (
        JSON.stringify(currentThreadDisplayNames ?? {}) ===
        JSON.stringify(nextThreadDisplayNames ?? {})
      ) {
        return;
      }
      await updateWorkspaceSettings(workspaceId, {
        threadDisplayNames: nextThreadDisplayNames,
      });
    },
    [updateWorkspaceSettings, workspacesById],
  );
  const isSubAgentThreadRef = useRef<
    (workspaceId: string, threadId: string) => boolean
  >(() => false);
  const {
    sidebarWidth,
    rightPanelWidth,
    onSidebarResizeStart,
    onRightPanelResizeStart,
    planPanelHeight,
    onPlanPanelResizeStart,
    terminalPanelHeight,
    onTerminalPanelResizeStart,
    debugPanelHeight,
    onDebugPanelResizeStart,
    onSidebarResizeKeyDown,
    onRightPanelResizeKeyDown,
    onPlanPanelResizeKeyDown,
    sidebarResizeMin,
    sidebarResizeMax,
    rightPanelResizeMin,
    rightPanelResizeMax,
    planPanelResizeMin,
    planPanelResizeMax,
    isCompact,
    isTablet,
    isPhone,
    sidebarCollapsed,
    rightPanelCollapsed,
    collapseSidebar,
    expandSidebar,
    collapseRightPanel,
    expandRightPanel,
    terminalOpen,
    handleDebugClick,
    handleToggleTerminal,
    openTerminal,
    closeTerminal: closeTerminalPanel,
  } = useLayoutController({
    activeWorkspaceId,
    setActiveTab,
    setDebugOpen,
    toggleDebugPanelShortcut: appSettings.toggleDebugPanelShortcut,
    toggleTerminalShortcut: appSettings.toggleTerminalShortcut,
  });
  const sidebarToggleProps = useMemo(
    () => ({
      isCompact,
      sidebarCollapsed,
      rightPanelCollapsed,
      onCollapseSidebar: collapseSidebar,
      onExpandSidebar: expandSidebar,
      onCollapseRightPanel: collapseRightPanel,
      onExpandRightPanel: expandRightPanel,
    }),
    [
      isCompact,
      sidebarCollapsed,
      rightPanelCollapsed,
      collapseSidebar,
      expandSidebar,
      collapseRightPanel,
      expandRightPanel,
    ],
  );
  const {
    settingsOpen,
    settingsSection,
    openSettings,
    closeSettings,
  } = useSettingsModalState();
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const appRootRef = useRef<HTMLDivElement | null>(null);

  const getWorkspaceName = useCallback(
    (workspaceId: string) => workspacesById.get(workspaceId)?.name,
    [workspacesById],
  );

  const recordPendingThreadLinkRef = useRef<
    (workspaceId: string, threadId: string) => void
  >(() => {});

  const {
    updaterState,
    startUpdate,
    dismissUpdate,
    handleTestNotificationSound,
    handleTestSystemNotification,
  } = useUpdaterController({
    enabled: updaterEnabled,
    notificationSoundsEnabled: appSettings.notificationSoundsEnabled,
    systemNotificationsEnabled: appSettings.systemNotificationsEnabled,
    getWorkspaceName,
    isSubAgentThread: (workspaceId, threadId) =>
      isSubAgentThreadRef.current(workspaceId, threadId),
    onThreadNotificationSent: (workspaceId, threadId) =>
      recordPendingThreadLinkRef.current(workspaceId, threadId),
    onDebug: addDebugEntry,
    successSoundUrl,
    errorSoundUrl,
  });

  const { errorToasts, dismissErrorToast } = useErrorToasts();

  const {
    gitIssues,
    gitIssuesTotal,
    gitIssuesLoading,
    gitIssuesError,
    gitPullRequests,
    gitPullRequestsTotal,
    gitPullRequestsLoading,
    gitPullRequestsError,
    gitPullRequestDiffs,
    gitPullRequestDiffsLoading,
    gitPullRequestDiffsError,
    gitPullRequestComments,
    gitPullRequestCommentsLoading,
    gitPullRequestCommentsError,
    handleGitIssuesChange,
    handleGitPullRequestsChange,
    handleGitPullRequestDiffsChange,
    handleGitPullRequestCommentsChange,
    resetGitHubPanelState,
  } = useGitHubPanelController();
  const isGitPanelVisible = deriveIsGitPanelVisible({
    hasActiveWorkspace: Boolean(activeWorkspace),
    isCompact,
    isTablet,
    tabletTab,
    activeTab,
    rightPanelCollapsed,
  });

  const {
    centerMode,
    setCenterMode,
    selectedDiffPath,
    setSelectedDiffPath,
    diffScrollRequestId,
    gitPanelMode,
    setGitPanelMode,
    gitDiffViewStyle,
    setGitDiffViewStyle,
    filePanelMode,
    setFilePanelMode,
    selectedPullRequest,
    setSelectedPullRequest,
    selectedCommitSha,
    setSelectedCommitSha,
    diffSource,
    setDiffSource,
    gitStatus,
    refreshGitStatus,
    queueGitStatusRefresh,
    refreshGitDiffs,
    gitLogEntries,
    gitLogTotal,
    gitLogAhead,
    gitLogBehind,
    gitLogAheadEntries,
    gitLogBehindEntries,
    gitLogUpstream,
    gitLogLoading,
    gitLogError,
    refreshGitLog,
    gitCommitDiffs,
    shouldLoadDiffs,
    activeDiffs,
    activeDiffLoading,
    activeDiffError,
    handleSelectDiff,
    handleSelectCommit,
    handleActiveDiffPath,
    handleGitPanelModeChange,
    activeWorkspaceIdRef,
    activeWorkspaceRef,
  } = useGitPanelController({
    activeWorkspace,
    gitDiffPreloadEnabled: appSettings.preloadGitDiffs,
    gitDiffIgnoreWhitespaceChanges: appSettings.gitDiffIgnoreWhitespaceChanges,
    gitPanelVisible: isGitPanelVisible,
    isCompact,
    isTablet,
    activeTab,
    tabletTab,
    setActiveTab,
    prDiffs: gitPullRequestDiffs,
    prDiffsLoading: gitPullRequestDiffsLoading,
    prDiffsError: gitPullRequestDiffsError,
  });

  const shouldLoadGitHubPanelDataValue = shouldLoadGitHubPanelData({
    isGitPanelVisible,
    gitPanelMode,
    shouldLoadDiffs,
    diffSource,
  });
  const [lazyDiffStatsByPath, setLazyDiffStatsByPath] = useState<
    Record<string, DiffLineStats>
  >({});

  useEffect(() => {
    setLazyDiffStatsByPath({});
  }, [activeWorkspace?.id]);

  useEffect(() => {
    if (diffSource !== "local" || !selectedDiffPath) {
      return;
    }
    const selectedEntry = activeDiffs.find((entry) => entry.path === selectedDiffPath);
    if (!selectedEntry?.diff?.trim()) {
      return;
    }
    const nextStats = countDiffLineStats(selectedEntry.diff);
    setLazyDiffStatsByPath((current) => {
      const previous = current[selectedDiffPath];
      if (
        previous &&
        previous.additions === nextStats.additions &&
        previous.deletions === nextStats.deletions
      ) {
        return current;
      }
      return {
        ...current,
        [selectedDiffPath]: nextStats,
      };
    });
  }, [activeDiffs, diffSource, selectedDiffPath]);

  const gitStatusForPanel = useMemo(() => {
    return buildGitStatusForPanel(gitStatus, lazyDiffStatsByPath);
  }, [gitStatus, lazyDiffStatsByPath]);

  useEffect(() => {
    resetGitHubPanelState();
  }, [activeWorkspaceId, resetGitHubPanelState]);
  const { remote: gitRemoteUrl } = useGitRemote(activeWorkspace);
  const {
    repos: gitRootCandidates,
    isLoading: gitRootScanLoading,
    error: gitRootScanError,
    depth: gitRootScanDepth,
    hasScanned: gitRootScanHasScanned,
    scan: scanGitRoots,
    setDepth: setGitRootScanDepth,
    clear: clearGitRootCandidates,
  } = useGitRepoScan(activeWorkspace);
  const {
    models,
    selectedModel,
    selectedModelId,
    setSelectedModelId,
    reasoningSupported,
    reasoningOptions,
    selectedEffort,
    setSelectedEffort
  } = useModels({
    activeWorkspace,
    onDebug: addDebugEntry,
    preferredModelId,
    preferredEffort,
  });

  const {
    collaborationModes,
    selectedCollaborationMode,
    selectedCollaborationModeId,
    setSelectedCollaborationModeId,
  } = useCollaborationModes({
    activeWorkspace,
    enabled: appSettings.collaborationModesEnabled,
    onDebug: addDebugEntry,
  });
  const [selectedCodexArgsOverride, setSelectedCodexArgsOverride] = useState<string | null>(
    null,
  );
  useEffect(() => {
    setSelectedCodexArgsOverride(normalizeCodexArgsInput(preferredCodexArgsOverride));
  }, [preferredCodexArgsOverride, threadCodexSelectionKey]);

  const {
    handleSelectModel,
    handleSelectEffort,
    handleSelectCollaborationMode,
    handleSelectAccessMode,
    handleSelectCodexArgsOverride,
  } = useThreadSelectionHandlersOrchestration({
    appSettingsLoading,
    setAppSettings,
    queueSaveSettings,
    activeThreadIdRef,
    setSelectedModelId,
    setSelectedEffort,
    setSelectedCollaborationModeId,
    setAccessMode,
    setSelectedCodexArgsOverride,
    persistThreadCodexParams,
  });
  void handleSelectAccessMode;
  void handleSelectCodexArgsOverride;

  const composerShortcuts = {
    modelShortcut: appSettings.composerModelShortcut,
    reasoningShortcut: appSettings.composerReasoningShortcut,
    collaborationShortcut: appSettings.collaborationModesEnabled
      ? appSettings.composerCollaborationShortcut
      : null,
    models,
    collaborationModes,
    selectedModelId,
    onSelectModel: handleSelectModel,
    selectedCollaborationModeId,
    onSelectCollaborationMode: handleSelectCollaborationMode,
    reasoningOptions,
    selectedEffort,
    onSelectEffort: handleSelectEffort,
    reasoningSupported,
  };

  useComposerShortcuts({
    textareaRef: composerInputRef,
    ...composerShortcuts,
  });

  useComposerMenuActions({
    models,
    selectedModelId,
    onSelectModel: handleSelectModel,
    collaborationModes,
    selectedCollaborationModeId,
    onSelectCollaborationMode: handleSelectCollaborationMode,
    reasoningOptions,
    selectedEffort,
    onSelectEffort: handleSelectEffort,
    reasoningSupported,
    onFocusComposer: () => composerInputRef.current?.focus(),
  });
  const { skills } = useSkills({ activeWorkspace, onDebug: addDebugEntry });
  const { apps } = useApps({
    activeWorkspace,
    enabled: appSettings.experimentalAppsEnabled,
    onDebug: addDebugEntry,
  });
  const {
    prompts,
    createPrompt,
    updatePrompt,
    deletePrompt,
    movePrompt,
    getWorkspacePromptsDir,
    getGlobalPromptsDir,
  } = useCustomPrompts({ activeWorkspace, onDebug: addDebugEntry });
  const { branches, checkoutBranch, createBranch } = useGitBranches({
    activeWorkspace,
    onDebug: addDebugEntry
  });
  const handleCheckoutBranch = async (name: string) => {
    await checkoutBranch(name);
    refreshGitStatus();
  };
  const handleCreateBranch = async (name: string) => {
    await createBranch(name);
    refreshGitStatus();
  };
  const currentBranch = gitStatus.branchName ?? null;
  const {
    branchSwitcher,
    openBranchSwitcher,
    closeBranchSwitcher,
    handleBranchSelect,
  } = useBranchSwitcher({
    activeWorkspace,
    checkoutBranch: handleCheckoutBranch,
    setActiveWorkspaceId,
  });
  const isBranchSwitcherEnabled =
    Boolean(activeWorkspace?.connected) && activeWorkspace?.kind !== "worktree";
  const alertError = useCallback((error: unknown) => {
    pushErrorToast({
      title: "操作失败",
      message: error instanceof Error ? error.message : String(error),
    });
  }, []);
  const {
    applyWorktreeChanges: handleApplyWorktreeChanges,
    revertAllGitChanges: handleRevertAllGitChanges,
    revertGitFile: handleRevertGitFile,
    stageGitAll: handleStageGitAll,
    stageGitFile: handleStageGitFile,
    unstageGitFile: handleUnstageGitFile,
    worktreeApplyError,
    worktreeApplyLoading,
    worktreeApplySuccess,
  } = useGitActions({
    activeWorkspace,
    onRefreshGitStatus: refreshGitStatus,
    onRefreshGitDiffs: refreshGitDiffs,
    onError: alertError,
  });

  const resolvedModel = selectedModel?.model ?? selectedModel?.id ?? null;
  const resolvedEffort = reasoningSupported ? selectedEffort : null;
  const { activeGitRoot, handleSetGitRoot, handlePickGitRoot } = useGitRootSelection({
    activeWorkspace,
    updateWorkspaceSettings,
    clearGitRootCandidates,
    refreshGitStatus,
  });
  const fileStatus = deriveFileStatusLabel({
    hasError: Boolean(gitStatusForPanel.error),
    changedFileCount: gitStatusForPanel.files.length,
  });

  usePersistComposerSettings({
    appSettingsLoading,
    selectedModelId,
    selectedEffort,
    setAppSettings,
    queueSaveSettings,
  });

  const { isExpanded: composerEditorExpanded, toggleExpanded: toggleComposerEditorExpanded } =
    useComposerEditorState();

  const composerEditorSettings = useMemo<ComposerEditorSettings>(
    () => ({
      preset: appSettings.composerEditorPreset,
      expandFenceOnSpace: appSettings.composerFenceExpandOnSpace,
      expandFenceOnEnter: appSettings.composerFenceExpandOnEnter,
      fenceLanguageTags: appSettings.composerFenceLanguageTags,
      fenceWrapSelection: appSettings.composerFenceWrapSelection,
      autoWrapPasteMultiline: appSettings.composerFenceAutoWrapPasteMultiline,
      autoWrapPasteCodeLike: appSettings.composerFenceAutoWrapPasteCodeLike,
      continueListOnShiftEnter: appSettings.composerListContinuation,
    }),
    [
      appSettings.composerEditorPreset,
      appSettings.composerFenceExpandOnSpace,
      appSettings.composerFenceExpandOnEnter,
      appSettings.composerFenceLanguageTags,
      appSettings.composerFenceWrapSelection,
      appSettings.composerFenceAutoWrapPasteMultiline,
      appSettings.composerFenceAutoWrapPasteCodeLike,
      appSettings.composerListContinuation,
    ],
  );


  useSyncSelectedDiffPath({
    diffSource,
    centerMode,
    gitPullRequestDiffs,
    gitCommitDiffs,
    selectedDiffPath,
    setSelectedDiffPath,
  });

  const { collaborationModePayload } = useCollaborationModeSelection({
    selectedCollaborationMode,
    selectedCollaborationModeId,
    selectedEffort: resolvedEffort,
    resolvedModel,
  });

  const {
    setActiveThreadId,
    activeThreadId,
    activeItems,
    itemsByThread,
    approvals,
    userInputRequests,
    threadsByWorkspace,
    threadParentById,
    threadStatusById,
    threadResumeLoadingById,
    threadListLoadingByWorkspace,
    threadListPagingByWorkspace,
    threadListCursorByWorkspace,
    activeTurnIdByThread,
    tokenUsageByThread,
    accountByWorkspace,
    planByThread,
    lastAgentMessageByThread,
    interruptTurn,
    removeThreads,
    pinThread,
    unpinThread,
    isThreadPinned,
    isSubAgentThread,
    getPinTimestamp,
    renameThread,
    startThreadForWorkspace,
    listThreadsForWorkspace,
    loadOlderThreadsForWorkspace,
    resetWorkspaceThreads,
    refreshThread,
    loadOlderMessagesForThread,
    sendUserMessage,
    sendUserMessageToThread,
    startFork,
    startReview,
    startResume,
    startCompact,
    startApps,
    startMcp,
    startStatus,
    reviewPrompt,
    closeReviewPrompt,
    showPresetStep,
    choosePreset,
    highlightedPresetIndex,
    setHighlightedPresetIndex,
    highlightedBranchIndex,
    setHighlightedBranchIndex,
    highlightedCommitIndex,
    setHighlightedCommitIndex,
    handleReviewPromptKeyDown,
    confirmBranch,
    selectBranch,
    selectBranchAtIndex,
    selectCommit,
    selectCommitAtIndex,
    confirmCommit,
    updateCustomInstructions,
    confirmCustom,
    handleApprovalDecision,
    handleApprovalRemember,
    handleUserInputSubmit,
    refreshAccountInfo,
    refreshAccountRateLimits,
    getWorkspaceLastAliveAt,
    resetThreadRuntimeState,
  } = useThreads({
    workspaces,
    activeWorkspace,
    onWorkspaceConnected: markWorkspaceConnected,
    onDebug: addDebugEntry,
    model: resolvedModel,
    effort: resolvedEffort,
    collaborationMode: collaborationModePayload,
    skills,
    reviewDeliveryMode: appSettings.reviewDeliveryMode,
    steerEnabled: appSettings.steerEnabled,
    autoArchiveSubAgentThreadsEnabled:
      appSettings.autoArchiveSubAgentThreadsEnabled,
    autoArchiveSubAgentThreadsMaxAgeMinutes:
      appSettings.autoArchiveSubAgentThreadsMaxAgeMinutes,
    threadTitleAutogenerationEnabled: appSettings.threadTitleAutogenerationEnabled,
    customPrompts: prompts,
    onMessageActivity: queueGitStatusRefresh,
    threadSortKey: threadListSortKey,
    persistThreadDisplayName,
  });

  const { openConfirm, ConfirmModalNode } = useConfirmModal();

  const remoteBackgroundThreadIds = useMemo(() => {
    if (!activeWorkspace) {
      return [];
    }
    const threads = threadsByWorkspace[activeWorkspace.id] ?? [];
    return threads
      .map((thread) => thread.id)
      .filter((threadId) => threadId !== activeThreadId);
  }, [activeThreadId, activeWorkspace, threadsByWorkspace]);

  const { connectionState: remoteThreadConnectionState, reconnectLive } =
    useRemoteThreadLiveConnection({
      backendMode: appSettings.backendMode,
      activeWorkspace,
      activeThreadId,
      backgroundThreadIds: remoteBackgroundThreadIds,
      activeThreadIsProcessing: Boolean(
        activeThreadId && threadStatusById[activeThreadId]?.isProcessing,
      ),
      refreshThread,
      reconnectWorkspace: connectWorkspace,
    });

  const handleMobileThreadRefresh = useCallback(() => {
    if (mobileThreadRefreshLoading || !activeWorkspace) {
      return;
    }
    setMobileThreadRefreshLoading(true);
    void (async () => {
      let threadId = activeThreadId;
      if (!threadId) {
        threadId = await startThreadForWorkspace(activeWorkspace.id, {
          activate: true,
        });
      }
      if (!threadId) {
        return;
      }
      await refreshThread(activeWorkspace.id, threadId);
      await reconnectLive(activeWorkspace.id, threadId, { runResume: false });
    })()
      .catch(() => {
        // Errors are surfaced by existing thread actions.
      })
      .finally(() => {
        setMobileThreadRefreshLoading(false);
      });
  }, [
    activeThreadId,
    activeWorkspace,
    mobileThreadRefreshLoading,
    reconnectLive,
    refreshThread,
    startThreadForWorkspace,
  ]);

  useEffect(() => {
    isSubAgentThreadRef.current = isSubAgentThread;
  }, [isSubAgentThread]);

  const threadWorkspaceById = useMemo(() => {
    const result: Record<string, string> = {};
    for (const workspace of workspaces) {
      const threads = threadsByWorkspace[workspace.id] ?? [];
      for (const thread of threads) {
        result[thread.id] = workspace.id;
      }
    }
    return result;
  }, [threadsByWorkspace, workspaces]);

  const { handleSetThreadListSortKey, handleRefreshAllWorkspaceThreads } =
    useThreadListActions({
      threadListSortKey,
      setThreadListSortKey,
      workspaces,
      listThreadsForWorkspace,
      resetWorkspaceThreads,
    });

  useResponseRequiredNotificationsController({
    systemNotificationsEnabled: appSettings.systemNotificationsEnabled,
    approvals,
    userInputRequests,
    isSubAgentThread,
    getWorkspaceName,
    onDebug: addDebugEntry,
  });
  useAppBadgeCount({
    threadStatusById,
    approvals,
    userInputRequests,
    isSubAgentThread,
    threadsByWorkspace,
  });

  const {
    activeAccount,
    accountSwitching,
    handleSwitchAccount,
    handleCancelSwitchAccount,
  } = useAccountSwitching({
    activeWorkspaceId,
    accountByWorkspace,
    refreshAccountInfo,
    refreshAccountRateLimits,
    alertError,
  });
  const {
    newAgentDraftWorkspaceId,
    startingDraftThreadWorkspaceId,
    isDraftModeForActiveWorkspace: isNewAgentDraftMode,
    startNewAgentDraft,
    clearDraftStateIfDifferentWorkspace,
    clearDraftStateOnNavigation,
    runWithDraftStart,
  } = useNewAgentDraft({
    activeWorkspace,
    activeWorkspaceId,
    activeThreadId,
  });
  const { getThreadRows } = useThreadRows(threadParentById);

  useThreadCodexSyncOrchestration({
    activeWorkspaceId,
    activeThreadId,
    appSettings: {
      lastComposerModelId: appSettings.lastComposerModelId,
      lastComposerReasoningEffort: appSettings.lastComposerReasoningEffort,
    },
    threadCodexParamsVersion,
    getThreadCodexParams,
    patchThreadCodexParams,
    setThreadCodexSelectionKey,
    setAccessMode,
    setPreferredModelId,
    setPreferredEffort,
    setPreferredCollabModeId,
    setPreferredCodexArgsOverride,
    activeThreadIdRef,
    pendingNewThreadSeedRef,
    selectedModelId,
    resolvedEffort,
    accessMode,
    selectedCollaborationModeId,
    selectedCodexArgsOverride,
  });

  const { recordPendingThreadLink } = useSystemNotificationThreadLinks({
    hasLoadedWorkspaces: hasLoaded,
    workspacesById,
    refreshWorkspaces,
    connectWorkspace,
    setActiveTab,
    setCenterMode,
    setSelectedDiffPath,
    setActiveWorkspaceId,
    setActiveThreadId,
  });

  useEffect(() => {
    recordPendingThreadLinkRef.current = recordPendingThreadLink;
    return () => {
      recordPendingThreadLinkRef.current = () => {};
    };
  }, [recordPendingThreadLink]);

  useAutoExitEmptyDiff({
    centerMode,
    autoExitEnabled: diffSource === "local",
    activeDiffCount: activeDiffs.length,
    activeDiffLoading,
    activeDiffError,
    activeThreadId,
    isCompact,
    setCenterMode,
    setSelectedDiffPath,
    setActiveTab,
  });

  const {
    handleCopyThread,
    handleCopyThreadWithOptions,
    handleCopyThreadFull,
    handleCopyThreadCompact,
  } = useCopyThread({
    activeItems,
    onDebug: addDebugEntry,
  });

  const copyThreadConfig = useMemo<Required<ThreadTranscriptOptions>>(
    () => ({
      includeUserInput: appSettings.threadCopyIncludeUserInput,
      includeAssistantMessages: appSettings.threadCopyIncludeAssistantMessages,
      toolOutputMode: appSettings.threadCopyToolOutputMode,
      includeToolOutput: appSettings.threadCopyToolOutputMode !== "none",
    }),
    [
      appSettings.threadCopyIncludeUserInput,
      appSettings.threadCopyIncludeAssistantMessages,
      appSettings.threadCopyToolOutputMode,
    ],
  );

  const mainHeaderCopyConfig = useMemo<MainHeaderCopyConfig>(
    () => ({
      includeUserInput: copyThreadConfig.includeUserInput,
      includeCodexReplies: copyThreadConfig.includeAssistantMessages,
      toolOutputMode: copyThreadConfig.toolOutputMode,
    }),
    [copyThreadConfig],
  );

  const persistCopyThreadConfig = useCallback(
    (next: ThreadTranscriptOptions) => {
      setAppSettings((current) => {
        const nextIncludeUserInput =
          next.includeUserInput ?? current.threadCopyIncludeUserInput;
        const nextIncludeAssistantMessages =
          next.includeAssistantMessages ?? current.threadCopyIncludeAssistantMessages;
        const nextToolOutputMode =
          next.toolOutputMode ?? current.threadCopyToolOutputMode;
        if (
          current.threadCopyIncludeUserInput === nextIncludeUserInput &&
          current.threadCopyIncludeAssistantMessages === nextIncludeAssistantMessages &&
          current.threadCopyToolOutputMode === nextToolOutputMode
        ) {
          return current;
        }
        const nextSettings = {
          ...current,
          threadCopyIncludeUserInput: nextIncludeUserInput,
          threadCopyIncludeAssistantMessages: nextIncludeAssistantMessages,
          threadCopyToolOutputMode: nextToolOutputMode,
        };
        void queueSaveSettings(nextSettings);
        return nextSettings;
      });
    },
    [queueSaveSettings, setAppSettings],
  );

  const handleCopyThreadCurrentConfig = useCallback(() => {
    return handleCopyThreadWithOptions(copyThreadConfig);
  }, [copyThreadConfig, handleCopyThreadWithOptions]);

  const handleApplyDetailedCopyPreset = useCallback(() => {
    persistCopyThreadConfig(THREAD_COPY_PRESET_DETAILED);
    return handleCopyThreadWithOptions(THREAD_COPY_PRESET_DETAILED);
  }, [handleCopyThreadWithOptions, persistCopyThreadConfig]);

  const handleApplyCompactCopyPreset = useCallback(() => {
    persistCopyThreadConfig(THREAD_COPY_PRESET_COMPACT);
    return handleCopyThreadWithOptions(THREAD_COPY_PRESET_COMPACT);
  }, [handleCopyThreadWithOptions, persistCopyThreadConfig]);

  const handleCopyThreadConfigChange = useCallback(
    (next: MainHeaderCopyConfig) => {
      persistCopyThreadConfig({
        includeUserInput: next.includeUserInput,
        includeAssistantMessages: next.includeCodexReplies,
        toolOutputMode: next.toolOutputMode,
      });
    },
    [persistCopyThreadConfig],
  );

  const {
    renamePrompt,
    openRenamePrompt,
    handleRenamePromptChange,
    handleRenamePromptCancel,
    handleRenamePromptConfirm,
  } = useRenameThreadPrompt({
    threadsByWorkspace,
    renameThread,
  });

  const {
    renamePrompt: renameWorktreePrompt,
    notice: renameWorktreeNotice,
    upstreamPrompt: renameWorktreeUpstreamPrompt,
    confirmUpstream: confirmRenameWorktreeUpstream,
    openRenamePrompt: openRenameWorktreePrompt,
    handleRenameChange: handleRenameWorktreeChange,
    handleRenameCancel: handleRenameWorktreeCancel,
    handleRenameConfirm: handleRenameWorktreeConfirm,
  } = useRenameWorktreePrompt({
    workspaces,
    activeWorkspaceId,
    renameWorktree,
    renameWorktreeUpstream,
    onRenameSuccess: (workspace) => {
      resetWorkspaceThreads(workspace.id);
      void listThreadsForWorkspace(workspace);
      if (activeThreadId && activeWorkspaceId === workspace.id) {
        void refreshThread(workspace.id, activeThreadId);
      }
    },
  });

  const handleRenameThread = useCallback(
    (workspaceId: string, threadId: string) => {
      openRenamePrompt(workspaceId, threadId);
    },
    [openRenamePrompt],
  );

  const handleOpenRenameWorktree = useCallback(() => {
    if (activeWorkspace) {
      openRenameWorktreePrompt(activeWorkspace.id);
    }
  }, [activeWorkspace, openRenameWorktreePrompt]);

  const {
    terminalTabs,
    activeTerminalId,
    onSelectTerminal,
    onNewTerminal,
    onCloseTerminal,
    terminalState,
    ensureTerminalWithTitle,
    restartTerminalSession,
  } = useTerminalController({
    activeWorkspaceId,
    activeWorkspace,
    terminalOpen,
    onCloseTerminalPanel: closeTerminalPanel,
    onDebug: addDebugEntry,
  });

  const ensureLaunchTerminal = useCallback(
    (workspaceId: string) => ensureTerminalWithTitle(workspaceId, "launch", "启动"),
    [ensureTerminalWithTitle],
  );

  const launchScriptState = useWorkspaceLaunchScript({
    activeWorkspace,
    updateWorkspaceSettings,
    openTerminal,
    ensureLaunchTerminal,
    restartLaunchSession: restartTerminalSession,
    terminalState,
    activeTerminalId,
  });

  const launchScriptsState = useWorkspaceLaunchScripts({
    activeWorkspace,
    updateWorkspaceSettings,
    openTerminal,
    ensureLaunchTerminal: (workspaceId, entry, title) => {
      const label = entry.label?.trim() || entry.icon;
      return ensureTerminalWithTitle(
        workspaceId,
        `launch:${entry.id}`,
        title || `启动 ${label}`,
      );
    },
    restartLaunchSession: restartTerminalSession,
    terminalState,
    activeTerminalId,
  });

  const worktreeSetupScriptState = useWorktreeSetupScript({
    ensureTerminalWithTitle,
    restartTerminalSession,
    openTerminal,
    onDebug: addDebugEntry,
  });

  const handleWorktreeCreated = useCallback(
    async (worktree: WorkspaceInfo, _parentWorkspace?: WorkspaceInfo) => {
      await worktreeSetupScriptState.maybeRunWorktreeSetupScript(worktree);
    },
    [worktreeSetupScriptState],
  );

  const { exitDiffView, selectWorkspace, selectHome } = useWorkspaceSelection({
    workspaces,
    isCompact,
    activeWorkspaceId,
    setActiveTab,
    setActiveWorkspaceId,
    updateWorkspaceSettings,
    setCenterMode,
    setSelectedDiffPath,
  });
  const {
    worktreePrompt,
    openPrompt: openWorktreePrompt,
    confirmPrompt: confirmWorktreePrompt,
    cancelPrompt: cancelWorktreePrompt,
    updateName: updateWorktreeName,
    updateBranch: updateWorktreeBranch,
    updateCopyAgentsMd: updateWorktreeCopyAgentsMd,
    updateSetupScript: updateWorktreeSetupScript,
  } = useWorktreePrompt({
    addWorktreeAgent,
    updateWorkspaceSettings,
    connectWorkspace,
    onSelectWorkspace: selectWorkspace,
    onWorktreeCreated: handleWorktreeCreated,
    onCompactActivate: isCompact ? () => setActiveTab("codex") : undefined,
    onError: (message) => {
      addDebugEntry({
        id: `${Date.now()}-client-add-worktree-error`,
        timestamp: Date.now(),
        source: "error",
        label: "worktree/add error",
        payload: message,
      });
    },
  });

  const resolveCloneProjectContext = useCallback(
    (workspace: WorkspaceInfo) => {
      const groupId = workspace.settings.groupId ?? null;
      const group = groupId
        ? appSettings.workspaceGroups.find((entry) => entry.id === groupId)
        : null;
      return {
        groupId,
        copiesFolder: group?.copiesFolder ?? null,
      };
    },
    [appSettings.workspaceGroups],
  );

  const handleSelectOpenAppId = useCallback(
    (id: string) => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(OPEN_APP_STORAGE_KEY, id);
      }
      setAppSettings((current) => {
        if (current.selectedOpenAppId === id) {
          return current;
        }
        const nextSettings = {
          ...current,
          selectedOpenAppId: id,
        };
        void queueSaveSettings(nextSettings);
        return nextSettings;
      });
    },
    [queueSaveSettings, setAppSettings],
  );

  const openAppIconById = useOpenAppIcons(appSettings.openAppTargets);

  const persistProjectCopiesFolder = useCallback(
    async (groupId: string, copiesFolder: string) => {
      await queueSaveSettings({
        ...appSettings,
        workspaceGroups: appSettings.workspaceGroups.map((entry) =>
          entry.id === groupId ? { ...entry, copiesFolder } : entry,
        ),
      });
    },
    [appSettings, queueSaveSettings],
  );

  const {
    clonePrompt,
    openPrompt: openClonePrompt,
    confirmPrompt: confirmClonePrompt,
    cancelPrompt: cancelClonePrompt,
    updateCopyName: updateCloneCopyName,
    chooseCopiesFolder: chooseCloneCopiesFolder,
    useSuggestedCopiesFolder: useSuggestedCloneCopiesFolder,
    clearCopiesFolder: clearCloneCopiesFolder,
  } = useClonePrompt({
    addCloneAgent,
    connectWorkspace,
    onSelectWorkspace: selectWorkspace,
    resolveProjectContext: resolveCloneProjectContext,
    persistProjectCopiesFolder,
    onCompactActivate: isCompact ? () => setActiveTab("codex") : undefined,
    onError: (message) => {
      addDebugEntry({
        id: `${Date.now()}-client-add-clone-error`,
        timestamp: Date.now(),
        source: "error",
        label: "clone/add error",
        payload: message,
      });
    },
  });

  const latestAgentRuns = useMemo(() => {
    return buildLatestAgentRuns({
      workspaces,
      threadsByWorkspace,
      lastAgentMessageByThread,
      threadStatusById,
      getWorkspaceGroupName,
      limit: 3,
    });
  }, [
    lastAgentMessageByThread,
    getWorkspaceGroupName,
    threadStatusById,
    threadsByWorkspace,
    workspaces
  ]);
  const isLoadingLatestAgents = useMemo(
    () =>
      !hasLoaded ||
      workspaces.some(
        (workspace) => threadListLoadingByWorkspace[workspace.id] ?? false
      ),
    [hasLoaded, threadListLoadingByWorkspace, workspaces]
  );

  const activeTokenUsage = activeThreadId
    ? tokenUsageByThread[activeThreadId] ?? null
    : null;
  const activePlan = activeThreadId
    ? planByThread[activeThreadId] ?? null
    : null;
  const hasActivePlan = Boolean(
    activePlan && (activePlan.steps.length > 0 || activePlan.explanation)
  );
  const showHome = !activeWorkspace;
  const showWorkspaceHome = Boolean(activeWorkspace && !activeThreadId && !isNewAgentDraftMode);
  const showComposer = deriveShowComposer({
    isCompact,
    centerMode,
    isTablet,
    tabletTab,
    activeTab,
    showWorkspaceHome,
  });
  const { files, isLoading: isFilesLoading, setFileAutocompleteActive } =
    useWorkspaceFileListing({
      activeWorkspace,
      activeWorkspaceId,
      filePanelMode,
      isCompact,
      isTablet,
      activeTab,
      tabletTab,
      rightPanelCollapsed,
      hasComposerSurface: showComposer || showWorkspaceHome,
      onDebug: addDebugEntry,
    });
  const [usageMetric, setUsageMetric] = useState<"tokens" | "time">("tokens");
  const [usageWorkspaceId, setUsageWorkspaceId] = useState<string | null>(null);
  const usageWorkspaceOptions = useMemo(
    () =>
      workspaces.map((workspace) => {
        const groupName = getWorkspaceGroupName(workspace.id);
        const label = groupName
          ? `${groupName} / ${workspace.name}`
          : workspace.name;
        return { id: workspace.id, label };
      }),
    [getWorkspaceGroupName, workspaces],
  );
  const usageWorkspacePath = useMemo(() => {
    if (!usageWorkspaceId) {
      return null;
    }
    return workspacesById.get(usageWorkspaceId)?.path ?? null;
  }, [usageWorkspaceId, workspacesById]);
  useEffect(() => {
    if (!usageWorkspaceId) {
      return;
    }
    if (workspaces.some((workspace) => workspace.id === usageWorkspaceId)) {
      return;
    }
    setUsageWorkspaceId(null);
  }, [usageWorkspaceId, workspaces]);
  const {
    snapshot: localUsageSnapshot,
    isLoading: isLoadingLocalUsage,
    error: localUsageError,
    refresh: refreshLocalUsage,
  } = useLocalUsage(showHome, usageWorkspacePath);
  const canInterrupt = activeThreadId
    ? threadStatusById[activeThreadId]?.isProcessing ?? false
    : false;
  const isStartingDraftThread =
    Boolean(activeWorkspaceId) && startingDraftThreadWorkspaceId === activeWorkspaceId;
  const isProcessing =
    (activeThreadId ? threadStatusById[activeThreadId]?.isProcessing ?? false : false) ||
    isStartingDraftThread;
  const isReviewing = activeThreadId
    ? threadStatusById[activeThreadId]?.isReviewing ?? false
    : false;
  const activeTurnId = activeThreadId
    ? activeTurnIdByThread[activeThreadId] ?? null
    : null;
  const {
    activeImages,
    attachImages,
    pickImages,
    removeImage,
    clearActiveImages,
    removeImagesForThread,
    activeQueue,
    queueHealthEntries,
    legacyQueueMessageCount,
    handleSend,
    queueMessage,
    queueMessageForThread,
    migrateLegacyQueueWorkspaceIds,
    retryQueuedThread,
    prefillDraft,
    setPrefillDraft,
    composerInsert,
    setComposerInsert,
    activeDraft,
    handleDraftChange,
    handleSendPrompt,
    handleEditQueued,
    handleDeleteQueued,
    handleSteerQueued,
    clearDraftForThread,
  } = useComposerController({
    activeThreadId,
    activeTurnId,
    activeWorkspaceId,
    activeWorkspace,
    isProcessing,
    isReviewing,
    threadStatusById,
    threadWorkspaceById,
    itemsByThread,
    workspacesById,
    steerEnabled: appSettings.steerEnabled,
    appsEnabled: appSettings.experimentalAppsEnabled,
    activeModel: resolvedModel,
    activeEffort: resolvedEffort,
    activeCollaborationMode: collaborationModePayload,
    connectWorkspace,
    startThreadForWorkspace,
    sendUserMessage,
    sendUserMessageToThread,
    startFork,
    startReview,
    startResume,
    startCompact,
    startApps,
    startMcp,
    startStatus,
    getWorkspaceLastAliveAt,
    onRecoverStaleThread: resetThreadRuntimeState,
  });

  const activeQueueHealthEntries = useMemo(
    () => (activeThreadId ? queueHealthEntries.filter((entry) => entry.threadId === activeThreadId) : []),
    [activeThreadId, queueHealthEntries],
  );
  const queueArtifactsByThread = useMemo(() => {
    const byThread: Record<string, { queueLength: number; inFlight: boolean }> = {};
    queueHealthEntries.forEach((entry) => {
      byThread[entry.threadId] = {
        queueLength: entry.queueLength,
        inFlight: entry.inFlight,
      };
    });
    return byThread;
  }, [queueHealthEntries]);
  const activeContinueConfig = activeThreadId
    ? continueConfigByThread[activeThreadId] ?? { enabled: false, prompt: CONTINUE_PROMPT_DEFAULT }
    : { enabled: false, prompt: CONTINUE_PROMPT_DEFAULT };
  const activeContinueEnabled = activeContinueConfig.enabled;
  const activeContinuePrompt = activeContinueConfig.prompt;

  const handleContinueModeEnabledChange = useCallback(
    (next: boolean) => {
      if (!activeThreadId) {
        return;
      }
      setContinueConfigByThread((prev) => ({
        ...prev,
        [activeThreadId]: {
          enabled: next,
          prompt: prev[activeThreadId]?.prompt ?? CONTINUE_PROMPT_DEFAULT,
        },
      }));
      if (next) {
        continuePendingImmediateByThreadRef.current[activeThreadId] = true;
        continueLastHandledByThreadRef.current[activeThreadId] = 0;
      } else {
        continuePendingImmediateByThreadRef.current[activeThreadId] = false;
        continueTriggeringByThreadRef.current[activeThreadId] = false;
      }
    },
    [activeThreadId],
  );

  const handleContinuePromptChange = useCallback(
    (next: string) => {
      if (!activeThreadId) {
        return;
      }
      setContinueConfigByThread((prev) => ({
        ...prev,
        [activeThreadId]: {
          enabled: prev[activeThreadId]?.enabled ?? false,
          prompt: next,
        },
      }));
    },
    [activeThreadId],
  );

  useEffect(() => {
    const enabledEntries = Object.entries(continueConfigByThread).filter(
      ([, config]) => config.enabled,
    );
    if (enabledEntries.length === 0) {
      return;
    }

    enabledEntries.forEach(([threadId, config]) => {
      const prompt = config.prompt.trim();
      if (!prompt) {
        return;
      }

      const status = threadStatusById[threadId];
      const isThreadProcessing =
        threadId === activeThreadId
          ? isProcessing
          : Boolean(status?.isProcessing);
      const isThreadReviewing =
        threadId === activeThreadId
          ? isReviewing
          : Boolean(status?.isReviewing);
      const hasActiveTurn = Boolean(activeTurnIdByThread[threadId]);
      const threadQueueArtifacts = queueArtifactsByThread[threadId];
      const hasQueueOrInFlight =
        (threadQueueArtifacts?.queueLength ?? 0) > 0
        || Boolean(threadQueueArtifacts?.inFlight);

      if (isThreadProcessing || isThreadReviewing || hasActiveTurn || hasQueueOrInFlight) {
        return;
      }

      const completionTimestamp = lastAgentMessageByThread[threadId]?.timestamp ?? 0;
      const isImmediatePending =
        continuePendingImmediateByThreadRef.current[threadId] === true;
      const lastHandledTimestamp =
        continueLastHandledByThreadRef.current[threadId] ?? 0;

      if (
        !isImmediatePending
        && (!completionTimestamp || completionTimestamp <= lastHandledTimestamp)
      ) {
        return;
      }

      if (continueTriggeringByThreadRef.current[threadId]) {
        return;
      }

      continueTriggeringByThreadRef.current[threadId] = true;
      const markHandledTimestamp =
        completionTimestamp > 0 ? completionTimestamp : Date.now();

      void (async () => {
        try {
          await queueMessageForThread(threadId, prompt, []);
        } catch {
          try {
            await queueMessageForThread(threadId, prompt, []);
          } catch {
            // Continue mode adopts "retry once" and then waits for next completion.
          }
        } finally {
          continuePendingImmediateByThreadRef.current[threadId] = false;
          continueLastHandledByThreadRef.current[threadId] =
            markHandledTimestamp;
          continueTriggeringByThreadRef.current[threadId] = false;
        }
      })();
    });
  }, [
    activeThreadId,
    activeTurnIdByThread,
    continueConfigByThread,
    isProcessing,
    isReviewing,
    lastAgentMessageByThread,
    queueArtifactsByThread,
    queueMessageForThread,
    threadStatusById,
  ]);

  const {
    runs: workspaceRuns,
  } = useWorkspaceHome({
    activeWorkspace,
    models,
    selectedModelId,
    effort: resolvedEffort,
    collaborationMode: collaborationModePayload,
    addWorktreeAgent,
    connectWorkspace,
    startThreadForWorkspace,
    sendUserMessageToThread,
    onWorktreeCreated: handleWorktreeCreated,
  });

  const canInsertComposerText = Boolean(activeThreadId);
  const handleInsertComposerText = useComposerInsert({
    isEnabled: canInsertComposerText,
    draftText: activeDraft,
    onDraftChange: handleDraftChange,
    textareaRef: composerInputRef,
  });
  const RECENT_THREAD_LIMIT = 8;
  const { recentThreadInstances, recentThreadsUpdatedAt } = useMemo(() => {
    return buildRecentThreadsSnapshot({
      activeWorkspaceId,
      threadsByWorkspace,
      recentThreadLimit: RECENT_THREAD_LIMIT,
    });
  }, [activeWorkspaceId, threadsByWorkspace]);
  const {
    content: agentMdContent,
    exists: agentMdExists,
    truncated: agentMdTruncated,
    isLoading: agentMdLoading,
    isSaving: agentMdSaving,
    error: agentMdError,
    isDirty: agentMdDirty,
    setContent: setAgentMdContent,
    refresh: refreshAgentMd,
    save: saveAgentMd,
  } = useWorkspaceAgentMd({
    activeWorkspace,
    onDebug: addDebugEntry,
  });

  const {
    commitMessage,
    commitMessageLoading,
    commitMessageError,
    commitLoading,
    pullLoading,
    fetchLoading,
    pushLoading,
    syncLoading,
    commitError,
    pullError,
    fetchError,
    pushError,
    syncError,
    onCommitMessageChange: handleCommitMessageChange,
    onGenerateCommitMessage: handleGenerateCommitMessage,
    onCommit: handleCommit,
    onCommitAndPush: handleCommitAndPush,
    onCommitAndSync: handleCommitAndSync,
    onPull: handlePull,
    onFetch: handleFetch,
    onPush: handlePush,
    onSync: handleSync,
  } = useGitCommitController({
    activeWorkspace,
    activeWorkspaceId,
    activeWorkspaceIdRef,
    gitStatus,
    refreshGitStatus,
    refreshGitLog,
  });

  const handleSendPromptToNewAgent = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!activeWorkspace || !trimmed) {
        return;
      }
      if (!activeWorkspace.connected) {
        await connectWorkspace(activeWorkspace);
      }
      const threadId = await startThreadForWorkspace(activeWorkspace.id, {
        activate: false,
      });
      if (!threadId) {
        return;
      }
      await sendUserMessageToThread(activeWorkspace, threadId, trimmed, []);
    },
    [activeWorkspace, connectWorkspace, sendUserMessageToThread, startThreadForWorkspace],
  );


  const handleCreatePrompt = useCallback(
    async (data: {
      scope: "workspace" | "global";
      name: string;
      description?: string | null;
      argumentHint?: string | null;
      content: string;
    }) => {
      try {
        await createPrompt(data);
      } catch (error) {
        alertError(error);
      }
    },
    [alertError, createPrompt],
  );

  const handleUpdatePrompt = useCallback(
    async (data: {
      path: string;
      name: string;
      description?: string | null;
      argumentHint?: string | null;
      content: string;
    }) => {
      try {
        await updatePrompt(data);
      } catch (error) {
        alertError(error);
      }
    },
    [alertError, updatePrompt],
  );

  const handleDeletePrompt = useCallback(
    async (path: string) => {
      try {
        await deletePrompt(path);
      } catch (error) {
        alertError(error);
      }
    },
    [alertError, deletePrompt],
  );

  const handleMovePrompt = useCallback(
    async (data: { path: string; scope: "workspace" | "global" }) => {
      try {
        await movePrompt(data);
      } catch (error) {
        alertError(error);
      }
    },
    [alertError, movePrompt],
  );

  const handleRevealWorkspacePrompts = useCallback(async () => {
    try {
      const path = await getWorkspacePromptsDir();
      await revealItemInDir(path);
    } catch (error) {
      alertError(error);
    }
  }, [alertError, getWorkspacePromptsDir]);

  const handleRevealGeneralPrompts = useCallback(async () => {
    try {
      const path = await getGlobalPromptsDir();
      if (!path) {
        return;
      }
      await revealItemInDir(path);
    } catch (error) {
      alertError(error);
    }
  }, [alertError, getGlobalPromptsDir]);

  const isWorktreeWorkspace = activeWorkspace?.kind === "worktree";
  const activeParentWorkspace = isWorktreeWorkspace
    ? workspacesById.get(activeWorkspace?.parentId ?? "") ?? null
    : null;
  const worktreeLabel = isWorktreeWorkspace
    ? (activeWorkspace?.name?.trim() || activeWorkspace?.worktree?.branch) ?? null
    : null;
  const activeRenamePrompt =
    renameWorktreePrompt?.workspaceId === activeWorkspace?.id
      ? renameWorktreePrompt
      : null;
  const worktreeRename =
    isWorktreeWorkspace && activeWorkspace
      ? {
          name: activeRenamePrompt?.name ?? worktreeLabel ?? "",
          error: activeRenamePrompt?.error ?? null,
          notice: renameWorktreeNotice,
          isSubmitting: activeRenamePrompt?.isSubmitting ?? false,
          isDirty: activeRenamePrompt
            ? activeRenamePrompt.name.trim() !==
              activeRenamePrompt.originalName.trim()
            : false,
          upstream:
            renameWorktreeUpstreamPrompt?.workspaceId === activeWorkspace.id
              ? {
                  oldBranch: renameWorktreeUpstreamPrompt.oldBranch,
                  newBranch: renameWorktreeUpstreamPrompt.newBranch,
                  error: renameWorktreeUpstreamPrompt.error,
                  isSubmitting: renameWorktreeUpstreamPrompt.isSubmitting,
                  onConfirm: confirmRenameWorktreeUpstream,
                }
              : null,
          onFocus: handleOpenRenameWorktree,
          onChange: handleRenameWorktreeChange,
          onCancel: handleRenameWorktreeCancel,
          onCommit: handleRenameWorktreeConfirm,
        }
      : null;
  const baseWorkspaceRef = useRef(activeParentWorkspace ?? activeWorkspace);

  useEffect(() => {
    baseWorkspaceRef.current = activeParentWorkspace ?? activeWorkspace;
  }, [activeParentWorkspace, activeWorkspace]);

  useTabActivationGuard({
    activeTab,
    activeWorkspace,
    isPhone,
    isTablet,
    setActiveTab,
  });

  useWindowDrag("titlebar");

  const resolvePreferredThreadIdOnRestore = useCallback(
    ({
      workspaceId,
      activeWorkspaceId: restoreActiveWorkspaceId,
      activeThreadId: restoreActiveThreadId,
    }: {
      workspaceId: string;
      activeWorkspaceId: string | null;
      activeThreadId: string | null;
    }) => {
      if (restoreActiveWorkspaceId === workspaceId && restoreActiveThreadId) {
        return restoreActiveThreadId;
      }
      return threadsByWorkspace[workspaceId]?.[0]?.id ?? null;
    },
    [threadsByWorkspace],
  );

  useWorkspaceRestore({
    workspaces,
    hasLoaded,
    backendMode: appSettings.backendMode,
    activeWorkspaceId,
    activeThreadId,
    connectWorkspace,
    listThreadsForWorkspace,
    resolvePreferredThreadId: resolvePreferredThreadIdOnRestore,
    refreshThreadRuntime: refreshThread,
  });
  useWorkspaceRefreshOnFocus({
    workspaces,
    refreshWorkspaces,
    listThreadsForWorkspace
  });

  useRemoteThreadRefreshOnFocus({
    backendMode: appSettings.backendMode,
    activeWorkspace,
    activeThreadId,
    activeThreadIsProcessing: Boolean(
      activeThreadId && threadStatusById[activeThreadId]?.isProcessing,
    ),
    suspendPolling: appSettings.backendMode === "remote" && remoteThreadConnectionState === "live",
    reconnectWorkspace: connectWorkspace,
    refreshThread,
  });

  const {
    handleAddWorkspace,
    handleAddWorkspaceFromUrl,
    handleAddAgent,
    handleAddWorktreeAgent,
    handleAddCloneAgent,
  } = useWorkspaceActions({
    isCompact,
    addWorkspace,
    openWorkspaceFromUrlPrompt,
    addWorkspaceFromPath,
    setActiveThreadId,
    setActiveTab,
    exitDiffView,
    selectWorkspace,
    onStartNewAgentDraft: startNewAgentDraft,
    openWorktreePrompt,
    openClonePrompt,
    composerInputRef,
    onDebug: addDebugEntry,
  });

  const handleDropWorkspacePaths = useCallback(
    async (paths: string[]) => {
      const uniquePaths = Array.from(
        new Set(paths.filter((path) => path.length > 0)),
      );
      if (uniquePaths.length === 0) {
        return;
      }
      await addWorkspacesFromPaths(uniquePaths);
    },
    [addWorkspacesFromPaths],
  );

  const {
    dropTargetRef: workspaceDropTargetRef,
    isDragOver: isWorkspaceDropActive,
    handleDragOver: handleWorkspaceDragOver,
    handleDragEnter: handleWorkspaceDragEnter,
    handleDragLeave: handleWorkspaceDragLeave,
    handleDrop: handleWorkspaceDrop,
  } = useWorkspaceDropZone({
    onDropPaths: handleDropWorkspacePaths,
  });

  const handleArchiveActiveThread = useCallback(() => {
    if (!activeWorkspaceId || !activeThreadId) {
      return;
    }
    void removeThreads(activeWorkspaceId, [activeThreadId]).then((result) => {
      result.okIds.forEach((threadId) => {
        clearDraftForThread(threadId);
        removeImagesForThread(threadId);
      });
    });
  }, [
    activeThreadId,
    activeWorkspaceId,
    clearDraftForThread,
    removeThreads,
    removeImagesForThread,
  ]);

  useInterruptShortcut({
    isEnabled: canInterrupt,
    shortcut: appSettings.interruptShortcut,
    onTrigger: () => {
      void interruptTurn();
    },
  });

  const {
    handleSelectPullRequest,
    resetPullRequestSelection,
    composerSendLabel,
    handleComposerSend,
    handleComposerQueue,
  } = usePullRequestComposer({
    activeWorkspace,
    selectedPullRequest,
    gitPullRequestDiffs,
    filePanelMode,
    gitPanelMode,
    centerMode,
    isCompact,
    setSelectedPullRequest,
    setDiffSource,
    setSelectedDiffPath,
    setCenterMode,
    setGitPanelMode,
    setPrefillDraft,
    setActiveTab,
    connectWorkspace,
    startThreadForWorkspace,
    sendUserMessageToThread,
    clearActiveImages,
    handleSend,
    queueMessage,
  });
  const handleComposerSendWithDraftStart = useCallback(
    (text: string, images: string[]) => {
      pendingNewThreadSeedRef.current = createPendingThreadSeed({
        activeThreadId: activeThreadId ?? null,
        activeWorkspaceId: activeWorkspaceId ?? null,
        selectedCollaborationModeId,
        accessMode,
        codexArgsOverride: selectedCodexArgsOverride ?? null,
      });
      return runWithDraftStart(() => handleComposerSend(text, images));
    },
    [
      accessMode,
      activeThreadId,
      activeWorkspaceId,
      handleComposerSend,
      pendingNewThreadSeedRef,
      runWithDraftStart,
      selectedCollaborationModeId,
      selectedCodexArgsOverride,
    ],
  );
  const handleComposerQueueWithDraftStart = useCallback(
    (text: string, images: string[]) => {
      pendingNewThreadSeedRef.current = createPendingThreadSeed({
        activeThreadId: activeThreadId ?? null,
        activeWorkspaceId: activeWorkspaceId ?? null,
        selectedCollaborationModeId,
        accessMode,
        codexArgsOverride: selectedCodexArgsOverride ?? null,
      });
      // Queueing without an active thread would no-op; bootstrap through send so user input is not lost.
      const runner = activeThreadId
        ? () => handleComposerQueue(text, images)
        : () => handleComposerSend(text, images);
      return runWithDraftStart(runner);
    },
    [
      accessMode,
      activeThreadId,
      activeWorkspaceId,
      handleComposerQueue,
      handleComposerSend,
      pendingNewThreadSeedRef,
      runWithDraftStart,
      selectedCollaborationModeId,
      selectedCodexArgsOverride,
    ],
  );

  const handleSelectWorkspaceInstance = useCallback(
    (workspaceId: string, threadId: string) => {
      exitDiffView();
      resetPullRequestSelection();
      clearDraftStateOnNavigation();
      selectWorkspace(workspaceId);
      setActiveThreadId(threadId, workspaceId);
      if (isCompact) {
        setActiveTab("codex");
      }
    },
    [
      clearDraftStateOnNavigation,
      exitDiffView,
      isCompact,
      resetPullRequestSelection,
      selectWorkspace,
      setActiveTab,
      setActiveThreadId,
    ],
  );

  const handleOpenThreadLink = useCallback(
    (threadId: string) => {
      if (!activeWorkspaceId) {
        return;
      }
      exitDiffView();
      resetPullRequestSelection();
      clearDraftStateOnNavigation();
      setActiveThreadId(threadId, activeWorkspaceId);
    },
    [
      activeWorkspaceId,
      clearDraftStateOnNavigation,
      exitDiffView,
      resetPullRequestSelection,
      setActiveThreadId,
    ],
  );

  const { handlePlanAccept, handlePlanSubmitChanges } = usePlanReadyActions({
    activeWorkspace,
    activeThreadId,
    collaborationModes,
    resolvedModel,
    resolvedEffort,
    connectWorkspace,
    sendUserMessageToThread,
    setSelectedCollaborationModeId: handleSelectCollaborationMode,
  });

  const orderValue = (entry: WorkspaceInfo) =>
    typeof entry.settings.sortOrder === "number"
      ? entry.settings.sortOrder
      : Number.MAX_SAFE_INTEGER;

  const persistWorkspaceOrderToBackend = useCallback(
    async (orderedWorkspaces: WorkspaceInfo[], groupId: string | null) => {
      if (orderedWorkspaces.length <= 1) {
        return;
      }
      await Promise.all(
        orderedWorkspaces.map((entry, idx) =>
          updateWorkspaceSettings(entry.id, {
            sortOrder: idx,
            groupId,
          }),
        ),
      );
    },
    [updateWorkspaceSettings],
  );

  const persistWorkspaceOrder = useCallback(
    async (orderedWorkspaces: WorkspaceInfo[], groupId: string | null) => {
      await persistWorkspaceOrderWithWal(
        orderedWorkspaces,
        groupId,
        persistWorkspaceOrderToBackend,
      );
    },
    [persistWorkspaceOrderToBackend],
  );

  const hasReplayedWorkspaceOrderWalRef = useRef(false);
  useEffect(() => {
    if (hasReplayedWorkspaceOrderWalRef.current || !hasLoaded || workspaces.length === 0) {
      return;
    }
    hasReplayedWorkspaceOrderWalRef.current = true;
    void replayPendingWorkspaceReorder(
      workspacesById,
      persistWorkspaceOrderToBackend,
    ).catch((error) => {
      console.error("Failed to replay pending workspace reorder", error);
    });
  }, [hasLoaded, persistWorkspaceOrderToBackend, workspaces.length, workspacesById]);

  const handleMoveWorkspace = async (
    workspaceId: string,
    direction: "up" | "down"
  ) => {
    const target = workspacesById.get(workspaceId);
    if (!target || (target.kind ?? "main") === "worktree") {
      return;
    }
    const targetGroupId = target.settings.groupId ?? null;
    const ordered = workspaces
      .filter(
        (entry) =>
          (entry.kind ?? "main") !== "worktree" &&
          (entry.settings.groupId ?? null) === targetGroupId,
      )
      .slice()
      .sort((a, b) => {
        const orderDiff = orderValue(a) - orderValue(b);
        if (orderDiff !== 0) {
          return orderDiff;
        }
        return a.name.localeCompare(b.name);
      });
    const index = ordered.findIndex((entry) => entry.id === workspaceId);
    if (index === -1) {
      return;
    }
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= ordered.length) {
      return;
    }
    const next = ordered.slice();
    const temp = next[index];
    next[index] = next[nextIndex];
    next[nextIndex] = temp;
    await persistWorkspaceOrder(next, targetGroupId);
  };

  const handleReorderWorkspaceGroup = useCallback(
    async (groupId: string | null, orderedWorkspaceIds: string[]) => {
      const orderedWorkspaces: WorkspaceInfo[] = [];
      orderedWorkspaceIds.forEach((workspaceId) => {
        const workspace = workspacesById.get(workspaceId);
        if (!workspace || (workspace.kind ?? "main") === "worktree") {
          return;
        }
        orderedWorkspaces.push(workspace);
      });
      await persistWorkspaceOrder(orderedWorkspaces, groupId);
    },
    [persistWorkspaceOrder, workspacesById],
  );

  const activeItemsLengthRef = useRef(activeItems.length);
  const activeFirstItemIdRef = useRef<string | null>(activeItems[0]?.id ?? null);
  const activeLastItemIdRef = useRef<string | null>(
    activeItems[activeItems.length - 1]?.id ?? null,
  );
  useEffect(() => {
    activeItemsLengthRef.current = activeItems.length;
    activeFirstItemIdRef.current = activeItems[0]?.id ?? null;
    activeLastItemIdRef.current = activeItems[activeItems.length - 1]?.id ?? null;
  }, [activeItems]);

  const topHistoryLoadStateRef = useRef<{
    key: string | null;
    inFlight: boolean;
    lastAt: number;
  }>({ key: null, inFlight: false, lastAt: 0 });

  const handleReachMessagesTop = useCallback(async () => {
    const workspaceId = activeWorkspace?.id ?? null;
    const threadId = activeThreadId ?? null;
    if (!workspaceId || !threadId) {
      return false;
    }
    if (threadStatusById[threadId]?.isProcessing) {
      return false;
    }
    const key = `${workspaceId}:${threadId}`;
    const state = topHistoryLoadStateRef.current;
    if (state.key !== key) {
      state.key = key;
      state.inFlight = false;
      state.lastAt = 0;
    }
    const now = Date.now();
    if (state.inFlight || now - state.lastAt < 180) {
      return false;
    }
    state.inFlight = true;
    state.lastAt = now;
    const beforeCount = activeItemsLengthRef.current;
    const beforeFirstItemId = activeFirstItemIdRef.current;
    const beforeLastItemId = activeLastItemIdRef.current;
    try {
      await loadOlderMessagesForThread(workspaceId, threadId);

      const waitStartedAt = Date.now();
      let afterCount = activeItemsLengthRef.current;
      let afterFirstItemId = activeFirstItemIdRef.current;
      let afterLastItemId = activeLastItemIdRef.current;

      while (
        Date.now() - waitStartedAt < 900 &&
        afterCount === beforeCount &&
        afterFirstItemId === beforeFirstItemId &&
        afterLastItemId === beforeLastItemId
      ) {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 50);
        });
        afterCount = activeItemsLengthRef.current;
        afterFirstItemId = activeFirstItemIdRef.current;
        afterLastItemId = activeLastItemIdRef.current;
      }

      const didLoadOlder =
        afterCount > beforeCount ||
        (Boolean(beforeFirstItemId) &&
          Boolean(afterFirstItemId) &&
          afterFirstItemId !== beforeFirstItemId);

      const didThreadItemsChange =
        afterCount !== beforeCount ||
        afterFirstItemId !== beforeFirstItemId ||
        afterLastItemId !== beforeLastItemId;

      if (!didLoadOlder && !didThreadItemsChange) {
        state.lastAt = Date.now();
        return false;
      }

      return true;
    } finally {
      state.inFlight = false;
    }
  }, [
    activeThreadId,
    activeWorkspace,
    loadOlderMessagesForThread,
    threadStatusById,
  ]);

  const showGitDetail =
    Boolean(selectedDiffPath) && isPhone && centerMode === "diff";
  const isThreadOpen = Boolean(activeThreadId && showComposer);

  useArchiveShortcut({
    isEnabled: isThreadOpen,
    shortcut: appSettings.archiveThreadShortcut,
    onTrigger: handleArchiveActiveThread,
  });

  const { handleCycleAgent, handleCycleWorkspace } = useWorkspaceCycling({
    workspaces,
    groupedWorkspaces,
    threadsByWorkspace,
    getThreadRows,
    getPinTimestamp,
    activeWorkspaceIdRef,
    activeThreadIdRef,
    exitDiffView,
    resetPullRequestSelection,
    selectWorkspace,
    setActiveThreadId,
  });

  useAppMenuEvents({
    activeWorkspaceRef,
    baseWorkspaceRef,
    onAddWorkspace: () => {
      void handleAddWorkspace();
    },
    onAddWorkspaceFromUrl: () => {
      handleAddWorkspaceFromUrl();
    },
    onAddAgent: (workspace) => {
      void handleAddAgent(workspace);
    },
    onAddWorktreeAgent: (workspace) => {
      void handleAddWorktreeAgent(workspace);
    },
    onAddCloneAgent: (workspace) => {
      void handleAddCloneAgent(workspace);
    },
    onOpenSettings: () => openSettings(),
    onCycleAgent: handleCycleAgent,
    onCycleWorkspace: handleCycleWorkspace,
    onOpenBranchSwitcher: () => {
      if (isBranchSwitcherEnabled) {
        openBranchSwitcher();
      }
    },
    onToggleDebug: handleDebugClick,
    onToggleTerminal: handleToggleTerminal,
    sidebarCollapsed,
    rightPanelCollapsed,
    onExpandSidebar: expandSidebar,
    onCollapseSidebar: collapseSidebar,
    onExpandRightPanel: expandRightPanel,
    onCollapseRightPanel: collapseRightPanel,
  });

  useMenuAcceleratorController({ appSettings, onDebug: addDebugEntry });
  const dropOverlayActive = isWorkspaceDropActive;
  const dropOverlayText = "将项目拖放到此处";
  const appClassName = `app ${isCompact ? "layout-compact" : "layout-desktop"}${
    isPhone ? " layout-phone" : ""
  }${isTablet ? " layout-tablet" : ""}${
    shouldReduceTransparency ? " reduced-transparency" : ""
  }${!isCompact && sidebarCollapsed ? " sidebar-collapsed" : ""}${
    !isCompact && rightPanelCollapsed ? " right-panel-collapsed" : ""
  }`;
  const showCompactCodexThreadActions = deriveShowCompactCodexThreadActions({
    hasActiveWorkspace: Boolean(activeWorkspace),
    isCompact,
    isPhone,
    isTablet,
    activeTab,
    tabletTab,
  });
  const showMobilePollingFetchStatus =
    showCompactCodexThreadActions &&
    Boolean(activeWorkspace?.connected) &&
    appSettings.backendMode === "remote" &&
    remoteThreadConnectionState === "polling";
  const {
    sidebarNode,
    messagesNode,
    composerNode,
    approvalToastsNode,
    updateToastNode,
    errorToastsNode,
    homeNode,
    mainHeaderNode,
    desktopTopbarLeftNode,
    tabletNavNode,
    tabBarNode,
    gitDiffPanelNode,
    gitDiffViewerNode,
    planPanelNode,
    debugPanelNode,
    debugPanelFullNode,
    terminalDockNode,
    compactEmptyCodexNode,
    compactEmptyGitNode,
    compactGitBackNode,
  } = useLayoutNodes({
    workspaces,
    groupedWorkspaces,
    hasWorkspaceGroups: workspaceGroups.length > 0,
    deletingWorktreeIds,
    newAgentDraftWorkspaceId,
    startingDraftThreadWorkspaceId,
    threadsByWorkspace,
    threadParentById,
    threadStatusById,
    threadResumeLoadingById,
    threadListLoadingByWorkspace,
    threadListPagingByWorkspace,
    threadListCursorByWorkspace,
    threadListSortKey,
    onSetThreadListSortKey: handleSetThreadListSortKey,
    onRefreshAllThreads: handleRefreshAllWorkspaceThreads,
    showSubAgentThreadsInSidebar: appSettings.showSubAgentThreadsInSidebar,
    onToggleShowSubAgentThreadsInSidebar: () => {
      setAppSettings((current) => {
        const next = {
          ...current,
          showSubAgentThreadsInSidebar: !current.showSubAgentThreadsInSidebar,
        };
        void queueSaveSettings(next);
        return next;
      });
    },
    activeWorkspaceId,
    activeThreadId,
    activeItems,
    showPollingFetchStatus: showMobilePollingFetchStatus,
    pollingIntervalMs: REMOTE_THREAD_POLL_INTERVAL_MS,
    accountInfo: activeAccount,
    onSwitchAccount: handleSwitchAccount,
    onCancelSwitchAccount: handleCancelSwitchAccount,
    accountSwitching,
    codeBlockCopyUseModifier: appSettings.composerCodeBlockCopyUseModifier,
    showMessageFilePath: appSettings.showMessageFilePath,
    threadScrollRestoreMode: appSettings.threadScrollRestoreMode,
    messageFontSize,
    onMessageFontSizeChange: handleMessageFontSizeChange,
    openAppTargets: appSettings.openAppTargets,
    openAppIconById,
    selectedOpenAppId: appSettings.selectedOpenAppId,
    onSelectOpenAppId: handleSelectOpenAppId,
    approvals,
    userInputRequests,
    handleApprovalDecision,
    handleApprovalRemember,
    handleUserInputSubmit,
    onPlanAccept: handlePlanAccept,
    onPlanSubmitChanges: handlePlanSubmitChanges,
    onReachMessagesTop: handleReachMessagesTop,
    onOpenSettings: () => openSettings(),
    onOpenDictationSettings: () => openSettings("dictation"),
    onOpenDebug: handleDebugClick,
    showDebugButton,
    onAddWorkspace: handleAddWorkspace,
    onAddWorkspaceFromUrl: handleAddWorkspaceFromUrl,
    onSelectHome: () => {
      resetPullRequestSelection();
      clearDraftStateOnNavigation();
      selectHome();
    },
    onSelectWorkspace: (workspaceId) => {
      exitDiffView();
      resetPullRequestSelection();
      clearDraftStateIfDifferentWorkspace(workspaceId);
      selectWorkspace(workspaceId);
      setActiveThreadId(null, workspaceId);
    },
    onConnectWorkspace: async (workspace) => {
      await connectWorkspace(workspace);
      if (isCompact) {
        setActiveTab("codex");
      }
    },
    onAddAgent: handleAddAgent,
    onAddWorktreeAgent: handleAddWorktreeAgent,
    onAddCloneAgent: handleAddCloneAgent,
    onToggleWorkspaceCollapse: (workspaceId, collapsed) => {
      const target = workspacesById.get(workspaceId);
      if (!target) {
        return;
      }
      void updateWorkspaceSettings(workspaceId, {
        sidebarCollapsed: collapsed,
      });
    },
    onUpdateWorkspaceDisplayName: (workspaceId, displayName) => {
      void persistWorkspaceDisplayName(workspaceId, displayName);
    },
    onSelectThread: (workspaceId, threadId) => {
      exitDiffView();
      resetPullRequestSelection();
      clearDraftStateOnNavigation();
      selectWorkspace(workspaceId);
      setActiveThreadId(threadId, workspaceId);
    },
    onOpenThreadLink: handleOpenThreadLink,
    onDeleteThread: (workspaceId, threadId) => {
      openConfirm("确认归档此对话？", () => {
        void removeThreads(workspaceId, [threadId]).then((result) => {
          result.okIds.forEach((okId) => {
            clearDraftForThread(okId);
            removeImagesForThread(okId);
          });
        });
      });
    },
    onDeleteThreads: (workspaceId, threadIds) => {
      openConfirm(`确认归档所选 ${threadIds.length} 条对话？`, () => {
        void removeThreads(workspaceId, threadIds).then((result) => {
          result.okIds.forEach((okId) => {
            clearDraftForThread(okId);
            removeImagesForThread(okId);
          });
        });
      });
    },
    pinThread,
    unpinThread,
    isThreadPinned,
    getPinTimestamp,
    onRenameThread: (workspaceId, threadId) => {
      handleRenameThread(workspaceId, threadId);
    },
    onDeleteWorkspace: (workspaceId) => {
      openConfirm("确认删除工作区？此操作不可撤销。", () => {
        void removeWorkspace(workspaceId);
      });
    },
    onDeleteWorktree: (workspaceId) => {
      void removeWorktree(workspaceId);
    },
    onLoadOlderThreads: (workspaceId) => {
      const workspace = workspacesById.get(workspaceId);
      if (!workspace) {
        return;
      }
      void loadOlderThreadsForWorkspace(workspace);
    },
    onReloadWorkspaceThreads: (workspaceId) => {
      const workspace = workspacesById.get(workspaceId);
      if (!workspace) {
        return;
      }
      void listThreadsForWorkspace(workspace);
    },
    updaterState,
    onUpdate: startUpdate,
    onDismissUpdate: dismissUpdate,
    errorToasts,
    onDismissErrorToast: dismissErrorToast,
    latestAgentRuns,
    isLoadingLatestAgents,
    localUsageSnapshot,
    isLoadingLocalUsage,
    localUsageError,
    onRefreshLocalUsage: () => {
      refreshLocalUsage()?.catch(() => {});
    },
    usageMetric,
    onUsageMetricChange: setUsageMetric,
    usageWorkspaceId,
    usageWorkspaceOptions,
    onUsageWorkspaceChange: setUsageWorkspaceId,
    onSelectHomeThread: (workspaceId, threadId) => {
      exitDiffView();
      clearDraftStateOnNavigation();
      selectWorkspace(workspaceId);
      setActiveThreadId(threadId, workspaceId);
      if (isCompact) {
        setActiveTab("codex");
      }
    },
    activeWorkspace,
    activeParentWorkspace,
    worktreeLabel,
    worktreeRename: worktreeRename ?? undefined,
    isWorktreeWorkspace,
    branchName: gitStatus.branchName || "unknown",
    branches,
    onCheckoutBranch: handleCheckoutBranch,
    onCreateBranch: handleCreateBranch,
    onCopyThread: handleCopyThread,
    onCopyThreadFull: handleCopyThreadFull,
    onCopyThreadCompact: handleCopyThreadCompact,
    copyThreadConfig: mainHeaderCopyConfig,
    onCopyThreadConfigChange: handleCopyThreadConfigChange,
    onApplyDetailedCopyPreset: handleApplyDetailedCopyPreset,
    onApplyCompactCopyPreset: handleApplyCompactCopyPreset,
    onCopyThreadCurrentConfig: handleCopyThreadCurrentConfig,
    onToggleTerminal: handleToggleTerminal,
    showTerminalButton: !isCompact,
    showWorkspaceTools: !isCompact,
    launchScript: launchScriptState.launchScript,
    launchScriptEditorOpen: launchScriptState.editorOpen,
    launchScriptDraft: launchScriptState.draftScript,
    launchScriptSaving: launchScriptState.isSaving,
    launchScriptError: launchScriptState.error,
    onRunLaunchScript: launchScriptState.onRunLaunchScript,
    onOpenLaunchScriptEditor: launchScriptState.onOpenEditor,
    onCloseLaunchScriptEditor: launchScriptState.onCloseEditor,
    onLaunchScriptDraftChange: launchScriptState.onDraftScriptChange,
    onSaveLaunchScript: launchScriptState.onSaveLaunchScript,
    launchScriptsState,
    mainHeaderActionsNode: (
      <>
        {showCompactCodexThreadActions ? (
          <button
            type="button"
            className="ghost main-header-action"
            onClick={handleMobileThreadRefresh}
            data-tauri-drag-region="false"
            aria-label="Refresh current thread from server"
            title="Refresh current thread from server"
            disabled={mobileThreadRefreshLoading}
          >
            <RefreshCw
              className={`compact-codex-refresh-icon${mobileThreadRefreshLoading ? " spinning" : ""}`}
              size={14}
              aria-hidden
            />
          </button>
        ) : null}
        <MainHeaderActions
          centerMode={centerMode}
          gitDiffViewStyle={gitDiffViewStyle}
          onSelectDiffViewStyle={setGitDiffViewStyle}
          isCompact={isCompact}
          rightPanelCollapsed={rightPanelCollapsed}
          sidebarToggleProps={sidebarToggleProps}
        />
      </>
    ),
    filePanelMode,
    onFilePanelModeChange: setFilePanelMode,
    fileTreeLoading: isFilesLoading,
    centerMode,
    onExitDiff: () => {
      setCenterMode("chat");
      setSelectedDiffPath(null);
    },
    activeTab,
    onSelectTab: (tab) => {
      if (tab === "home") {
        resetPullRequestSelection();
        clearDraftStateOnNavigation();
        selectHome();
        return;
      }
      setActiveTab(tab);
    },
    tabletNavTab: tabletTab,
    gitPanelMode,
    onGitPanelModeChange: handleGitPanelModeChange,
    isPhone,
    gitDiffViewStyle,
    gitDiffIgnoreWhitespaceChanges:
      appSettings.gitDiffIgnoreWhitespaceChanges && diffSource !== "pr",
    worktreeApplyLabel: "应用",
    worktreeApplyTitle: activeParentWorkspace?.name
      ? `将更改应用到 ${activeParentWorkspace.name}`
      : "将更改应用到父工作区",
    worktreeApplyLoading: isWorktreeWorkspace ? worktreeApplyLoading : false,
    worktreeApplyError: isWorktreeWorkspace ? worktreeApplyError : null,
    worktreeApplySuccess: isWorktreeWorkspace ? worktreeApplySuccess : false,
    onApplyWorktreeChanges: isWorktreeWorkspace
      ? handleApplyWorktreeChanges
      : undefined,
    gitStatus: gitStatusForPanel,
    fileStatus,
    selectedDiffPath,
    diffScrollRequestId,
    onSelectDiff: handleSelectDiff,
    diffSource,
    gitLogEntries,
    gitLogTotal,
    gitLogAhead,
    gitLogBehind,
    gitLogAheadEntries,
    gitLogBehindEntries,
    gitLogUpstream,
    gitLogError,
    gitLogLoading,
    selectedCommitSha,
    gitIssues,
    gitIssuesTotal,
    gitIssuesLoading,
    gitIssuesError,
    gitPullRequests,
    gitPullRequestsTotal,
    gitPullRequestsLoading,
    gitPullRequestsError,
    selectedPullRequestNumber: selectedPullRequest?.number ?? null,
    selectedPullRequest: diffSource === "pr" ? selectedPullRequest : null,
    selectedPullRequestComments: diffSource === "pr" ? gitPullRequestComments : [],
    selectedPullRequestCommentsLoading: gitPullRequestCommentsLoading,
    selectedPullRequestCommentsError: gitPullRequestCommentsError,
    onSelectPullRequest: (pullRequest) => {
      setSelectedCommitSha(null);
      handleSelectPullRequest(pullRequest);
    },
    onSelectCommit: (entry) => {
      handleSelectCommit(entry.sha);
    },
    gitRemoteUrl,
    gitRoot: activeGitRoot,
    gitRootCandidates,
    gitRootScanDepth,
    gitRootScanLoading,
    gitRootScanError,
    gitRootScanHasScanned,
    onGitRootScanDepthChange: setGitRootScanDepth,
    onScanGitRoots: scanGitRoots,
    onSelectGitRoot: (path) => {
      void handleSetGitRoot(path);
    },
    onClearGitRoot: () => {
      void handleSetGitRoot(null);
    },
    onPickGitRoot: handlePickGitRoot,
    onStageGitAll: handleStageGitAll,
    onStageGitFile: handleStageGitFile,
    onUnstageGitFile: handleUnstageGitFile,
    onRevertGitFile: handleRevertGitFile,
    onRevertAllGitChanges: handleRevertAllGitChanges,
    gitDiffs: activeDiffs,
    gitDiffLoading: activeDiffLoading,
    gitDiffError: activeDiffError,
    onDiffActivePathChange: handleActiveDiffPath,
    commitMessage,
    commitMessageLoading,
    commitMessageError,
    onCommitMessageChange: handleCommitMessageChange,
    onGenerateCommitMessage: handleGenerateCommitMessage,
    onCommit: handleCommit,
    onCommitAndPush: handleCommitAndPush,
    onCommitAndSync: handleCommitAndSync,
    onPull: handlePull,
    onFetch: handleFetch,
    onPush: handlePush,
    onSync: handleSync,
    commitLoading,
    pullLoading,
    fetchLoading,
    pushLoading,
    syncLoading,
    commitError,
    pullError,
    fetchError,
    pushError,
    syncError,
    commitsAhead: gitLogAhead,
    onSendPrompt: handleSendPrompt,
    onSendPromptToNewAgent: handleSendPromptToNewAgent,
    onCreatePrompt: handleCreatePrompt,
    onUpdatePrompt: handleUpdatePrompt,
    onDeletePrompt: handleDeletePrompt,
    onMovePrompt: handleMovePrompt,
    onRevealWorkspacePrompts: handleRevealWorkspacePrompts,
    onRevealGeneralPrompts: handleRevealGeneralPrompts,
    canRevealGeneralPrompts: Boolean(activeWorkspace),
    onSend: handleComposerSendWithDraftStart,
    onQueue: handleComposerQueueWithDraftStart,
    onStop: interruptTurn,
    canStop: canInterrupt,
    onFileAutocompleteActiveChange: setFileAutocompleteActive,
    isReviewing,
    isProcessing,
    steerEnabled: appSettings.steerEnabled,
    reviewPrompt,
    onReviewPromptClose: closeReviewPrompt,
    onReviewPromptShowPreset: showPresetStep,
    onReviewPromptChoosePreset: choosePreset,
    highlightedPresetIndex,
    onReviewPromptHighlightPreset: setHighlightedPresetIndex,
    highlightedBranchIndex,
    onReviewPromptHighlightBranch: setHighlightedBranchIndex,
    highlightedCommitIndex,
    onReviewPromptHighlightCommit: setHighlightedCommitIndex,
    onReviewPromptKeyDown: handleReviewPromptKeyDown,
    onReviewPromptSelectBranch: selectBranch,
    onReviewPromptSelectBranchAtIndex: selectBranchAtIndex,
    onReviewPromptConfirmBranch: confirmBranch,
    onReviewPromptSelectCommit: selectCommit,
    onReviewPromptSelectCommitAtIndex: selectCommitAtIndex,
    onReviewPromptConfirmCommit: confirmCommit,
    onReviewPromptUpdateCustomInstructions: updateCustomInstructions,
    onReviewPromptConfirmCustom: confirmCustom,
    activeTokenUsage,
    activeQueue,
    queueHealthEntries: activeQueueHealthEntries,
    legacyQueueMessageCount,
    draftText: activeDraft,
    onDraftChange: handleDraftChange,
    activeImages,
    onPickImages: pickImages,
    onAttachImages: attachImages,
    onRemoveImage: removeImage,
    prefillDraft,
    onPrefillHandled: (id) => {
      if (prefillDraft?.id === id) {
        setPrefillDraft(null);
      }
    },
    insertText: composerInsert,
    onInsertHandled: (id) => {
      if (composerInsert?.id === id) {
        setComposerInsert(null);
      }
    },
    onEditQueued: handleEditQueued,
    onDeleteQueued: handleDeleteQueued,
    onSteerQueued: handleSteerQueued,
    onRetryQueuedThread: (threadId) => {
      retryQueuedThread(threadId);
    },
    onMigrateLegacyQueueWorkspaceIds: migrateLegacyQueueWorkspaceIds,
    canSteerQueued: Boolean(activeThreadId) && appSettings.steerEnabled,
    collaborationModes,
    selectedCollaborationModeId,
    onSelectCollaborationMode: handleSelectCollaborationMode,
    models,
    selectedModelId,
    onSelectModel: handleSelectModel,
    reasoningOptions,
    selectedEffort,
    onSelectEffort: handleSelectEffort,
    reasoningSupported,
    continueModeEnabled: Boolean(activeThreadId) && activeContinueEnabled,
    onContinueModeEnabledChange: handleContinueModeEnabledChange,
    continuePrompt: activeContinuePrompt,
    onContinuePromptChange: handleContinuePromptChange,
    backendMode: appSettings.backendMode,
    skills,
    appsEnabled: appSettings.experimentalAppsEnabled,
    apps,
    prompts,
    files,
    onInsertComposerText: handleInsertComposerText,
    canInsertComposerText,
    textareaRef: composerInputRef,
    composerEditorSettings,
    composerEditorExpanded,
    onToggleComposerEditorExpanded: toggleComposerEditorExpanded,
    dictationEnabled: appSettings.dictationEnabled && dictationReady,
    dictationState,
    dictationLevel,
    onToggleDictation: handleToggleDictation,
    dictationTranscript,
    onDictationTranscriptHandled: (id) => {
      clearDictationTranscript(id);
    },
    dictationError,
    onDismissDictationError: clearDictationError,
    dictationHint,
    onDismissDictationHint: clearDictationHint,
    composerSendLabel,
    showComposer,
    plan: activePlan,
    debugEntries,
    debugOpen,
    terminalOpen,
    terminalTabs,
    activeTerminalId,
    onSelectTerminal,
    onNewTerminal,
    onCloseTerminal,
    terminalState,
    onClearDebug: clearDebugEntries,
    onCopyDebug: handleCopyDebug,
    onResizeDebug: onDebugPanelResizeStart,
    onResizeTerminal: onTerminalPanelResizeStart,
    onBackFromDiff: () => {
      setCenterMode("chat");
    },
    onShowSelectedDiff: () => {
      if (!selectedDiffPath) {
        return;
      }
      setCenterMode("diff");
      if (isPhone) {
        setActiveTab("git");
      }
    },
    onGoProjects: () => setActiveTab("projects"),
    workspaceDropTargetRef,
    isWorkspaceDropActive: dropOverlayActive,
    workspaceDropText: dropOverlayText,
    onWorkspaceDragOver: handleWorkspaceDragOver,
    onWorkspaceDragEnter: handleWorkspaceDragEnter,
    onWorkspaceDragLeave: handleWorkspaceDragLeave,
    onWorkspaceDrop: handleWorkspaceDrop,
    onReorderWorkspaceGroup: handleReorderWorkspaceGroup,
  });

  const workspaceHomeNode = activeWorkspace ? (
    <WorkspaceHome
      workspace={activeWorkspace}
      runs={workspaceRuns}
      recentThreadInstances={recentThreadInstances}
      recentThreadsUpdatedAt={recentThreadsUpdatedAt}
      activeWorkspaceId={activeWorkspaceId}
      activeThreadId={activeThreadId}
      threadStatusById={threadStatusById}
      onSelectInstance={handleSelectWorkspaceInstance}
      agentMdContent={agentMdContent}
      agentMdExists={agentMdExists}
      agentMdTruncated={agentMdTruncated}
      agentMdLoading={agentMdLoading}
      agentMdSaving={agentMdSaving}
      agentMdError={agentMdError}
      agentMdDirty={agentMdDirty}
      onAgentMdChange={setAgentMdContent}
      onAgentMdRefresh={() => {
        void refreshAgentMd();
      }}
      onAgentMdSave={() => {
        void saveAgentMd();
      }}
    />
  ) : null;

  const mainMessagesNode = showWorkspaceHome ? workspaceHomeNode : messagesNode;
  const showCompactThreadConnectionIndicator =
    showCompactCodexThreadActions && Boolean(activeThreadId) && activeItems.length > 0;
  const compactThreadConnectionState = resolveCompactThreadConnectionState({
    isWorkspaceConnected: Boolean(activeWorkspace?.connected),
    backendMode: appSettings.backendMode,
    remoteThreadConnectionState,
  });
  const compactThreadConnectionIndicatorMeta = buildCompactThreadConnectionIndicatorMeta(
    compactThreadConnectionState,
  );
  const codexTopbarActionsNode = showCompactThreadConnectionIndicator ? (
    <span
      className={`compact-workspace-live-indicator ${compactThreadConnectionIndicatorMeta.stateClassName}`}
      title={compactThreadConnectionIndicatorMeta.title}
    >
      {compactThreadConnectionIndicatorMeta.label}
    </span>
  ) : null;

  const desktopTopbarLeftNodeWithToggle = !isCompact ? (
    <div className="topbar-leading">
      <SidebarCollapseButton {...sidebarToggleProps} />
      {desktopTopbarLeftNode}
    </div>
  ) : (
    desktopTopbarLeftNode
  );

  // ── Command Palette (⌘K) ──
  const commandItems: CommandItem[] = useMemo(
    () =>
      buildCommandPaletteItems({
        activeWorkspace,
        newAgentShortcut: appSettings.newAgentShortcut,
        newWorktreeAgentShortcut: appSettings.newWorktreeAgentShortcut,
        toggleTerminalShortcut: appSettings.toggleTerminalShortcut,
        toggleProjectsSidebarShortcut: appSettings.toggleProjectsSidebarShortcut,
        sidebarCollapsed,
        onAddWorkspace: () => {
          void handleAddWorkspace();
        },
        onAddWorkspaceFromUrl: handleAddWorkspaceFromUrl,
        onAddAgent: (workspace) => {
          void handleAddAgent(workspace);
        },
        onAddWorktreeAgent: (workspace) => {
          void handleAddWorktreeAgent(workspace);
        },
        onToggleTerminal: handleToggleTerminal,
        onExpandSidebar: sidebarToggleProps.onExpandSidebar,
        onCollapseSidebar: sidebarToggleProps.onCollapseSidebar,
        onOpenSettings: () => {
          openSettings();
        },
      }),
    [
      appSettings,
      activeWorkspace,
      handleAddAgent,
      handleAddWorkspace,
      handleAddWorkspaceFromUrl,
      handleAddWorktreeAgent,
      handleToggleTerminal,
      sidebarCollapsed,
      sidebarToggleProps,
      openSettings,
    ],
  );

  const cmdPalette = useCommandPalette(commandItems);
  const appCssVars = useMemo(
    () =>
      buildAppCssVars({
        isCompact,
        sidebarWidth,
        sidebarCollapsed,
        rightPanelWidth,
        rightPanelCollapsed,
        planPanelHeight,
        terminalPanelHeight,
        debugPanelHeight,
        uiFontFamily: appSettings.uiFontFamily,
        codeFontFamily: appSettings.codeFontFamily,
        codeFontSize: appSettings.codeFontSize,
        messageFontSize,
      }),
    [
      appSettings.codeFontFamily,
      appSettings.codeFontSize,
      appSettings.uiFontFamily,
      debugPanelHeight,
      isCompact,
      messageFontSize,
      planPanelHeight,
      rightPanelCollapsed,
      rightPanelWidth,
      sidebarCollapsed,
      sidebarWidth,
      terminalPanelHeight,
    ],
  );

  useLayoutEffect(() => {
    const appRoot = appRootRef.current;
    if (!appRoot) {
      return;
    }
    Object.entries(appCssVars).forEach(([key, value]) => {
      appRoot.style.setProperty(key, value);
    });
  }, [appCssVars]);

  return (
    <div
      ref={appRootRef}
      className={appClassName}
    >
      <h1 className="sr-only">Codex Monitor</h1>
      <div className="drag-strip" id="titlebar" data-tauri-drag-region />
      <TitlebarExpandControls {...sidebarToggleProps} />
      <CommandPalette commands={cmdPalette.commands} open={cmdPalette.open} onClose={cmdPalette.close} />
      {shouldLoadGitHubPanelDataValue ? (
        <Suspense fallback={null}>
          <GitHubPanelData
            activeWorkspace={activeWorkspace}
            gitPanelMode={gitPanelMode}
            shouldLoadDiffs={shouldLoadDiffs}
            diffSource={diffSource}
            selectedPullRequestNumber={selectedPullRequest?.number ?? null}
            onIssuesChange={handleGitIssuesChange}
            onPullRequestsChange={handleGitPullRequestsChange}
            onPullRequestDiffsChange={handleGitPullRequestDiffsChange}
            onPullRequestCommentsChange={handleGitPullRequestCommentsChange}
          />
        </Suspense>
      ) : null}
      <AppLayout
        isPhone={isPhone}
        isTablet={isTablet}
        showHome={showHome}
        showGitDetail={showGitDetail}
        activeTab={activeTab}
        tabletTab={tabletTab}
        centerMode={centerMode}
        preloadGitDiffs={appSettings.preloadGitDiffs}
        hasActivePlan={hasActivePlan}
        activeWorkspace={Boolean(activeWorkspace)}
        sidebarNode={sidebarNode}
        messagesNode={mainMessagesNode}
        composerNode={composerNode}
        approvalToastsNode={approvalToastsNode}
        updateToastNode={updateToastNode}
        errorToastsNode={errorToastsNode}
        homeNode={homeNode}
        mainHeaderNode={mainHeaderNode}
        desktopTopbarLeftNode={desktopTopbarLeftNodeWithToggle}
        codexTopbarActionsNode={codexTopbarActionsNode}
        tabletNavNode={tabletNavNode}
        tabBarNode={tabBarNode}
        gitDiffPanelNode={gitDiffPanelNode}
        gitDiffViewerNode={gitDiffViewerNode}
        planPanelNode={planPanelNode}
        debugPanelNode={debugPanelNode}
        debugPanelFullNode={debugPanelFullNode}
        terminalDockNode={terminalDockNode}
        compactEmptyCodexNode={compactEmptyCodexNode}
        compactEmptyGitNode={compactEmptyGitNode}
        compactGitBackNode={compactGitBackNode}
        onSidebarResizeStart={onSidebarResizeStart}
        onRightPanelResizeStart={onRightPanelResizeStart}
        onPlanPanelResizeStart={onPlanPanelResizeStart}
        onSidebarResizeKeyDown={onSidebarResizeKeyDown}
        onRightPanelResizeKeyDown={onRightPanelResizeKeyDown}
        onPlanPanelResizeKeyDown={onPlanPanelResizeKeyDown}
        sidebarWidth={sidebarWidth}
        rightPanelWidth={rightPanelWidth}
        planPanelHeight={planPanelHeight}
        sidebarResizeMin={sidebarResizeMin}
        sidebarResizeMax={sidebarResizeMax}
        rightPanelResizeMin={rightPanelResizeMin}
        rightPanelResizeMax={rightPanelResizeMax}
        planPanelResizeMin={planPanelResizeMin}
        planPanelResizeMax={planPanelResizeMax}
      />
      <AppModals
        renamePrompt={renamePrompt}
        onRenamePromptChange={handleRenamePromptChange}
        onRenamePromptCancel={handleRenamePromptCancel}
        onRenamePromptConfirm={handleRenamePromptConfirm}
        worktreePrompt={worktreePrompt}
        onWorktreePromptNameChange={updateWorktreeName}
        onWorktreePromptChange={updateWorktreeBranch}
        onWorktreePromptCopyAgentsMdChange={updateWorktreeCopyAgentsMd}
        onWorktreeSetupScriptChange={updateWorktreeSetupScript}
        onWorktreePromptCancel={cancelWorktreePrompt}
        onWorktreePromptConfirm={confirmWorktreePrompt}
        clonePrompt={clonePrompt}
        onClonePromptCopyNameChange={updateCloneCopyName}
        onClonePromptChooseCopiesFolder={chooseCloneCopiesFolder}
        onClonePromptUseSuggestedFolder={useSuggestedCloneCopiesFolder}
        onClonePromptClearCopiesFolder={clearCloneCopiesFolder}
        onClonePromptCancel={cancelClonePrompt}
        onClonePromptConfirm={confirmClonePrompt}
        workspaceFromUrlPrompt={workspaceFromUrlPrompt}
        canSubmitWorkspaceFromUrlPrompt={canSubmitWorkspaceFromUrlPrompt}
        onWorkspaceFromUrlPromptUrlChange={updateWorkspaceFromUrlUrl}
        onWorkspaceFromUrlPromptTargetFolderNameChange={
          updateWorkspaceFromUrlTargetFolderName
        }
        onWorkspaceFromUrlPromptChooseDestinationPath={
          chooseWorkspaceFromUrlDestinationPath
        }
        onWorkspaceFromUrlPromptClearDestinationPath={
          clearWorkspaceFromUrlDestinationPath
        }
        onWorkspaceFromUrlPromptCancel={closeWorkspaceFromUrlPrompt}
        onWorkspaceFromUrlPromptConfirm={submitWorkspaceFromUrlPrompt}
        mobileRemoteWorkspacePathPrompt={mobileRemoteWorkspacePathPrompt}
        onMobileRemoteWorkspacePathInputChange={updateMobileRemoteWorkspacePathInput}
        onMobileRemoteWorkspacePathPromptCancel={cancelMobileRemoteWorkspacePathPrompt}
        onMobileRemoteWorkspacePathPromptConfirm={submitMobileRemoteWorkspacePathPrompt}
        branchSwitcher={branchSwitcher}
        branches={branches}
        workspaces={workspaces}
        activeWorkspace={activeWorkspace}
        currentBranch={currentBranch}
        onBranchSwitcherSelect={handleBranchSelect}
        onBranchSwitcherCancel={closeBranchSwitcher}
        settingsOpen={settingsOpen}
        settingsSection={settingsSection ?? undefined}
        onCloseSettings={closeSettings}
        SettingsViewComponent={SettingsView}
        settingsProps={{
          workspaceGroups,
          groupedWorkspaces,
          ungroupedLabel,
          onMoveWorkspace: handleMoveWorkspace,
          onDeleteWorkspace: (workspaceId) => {
            void removeWorkspace(workspaceId);
          },
          onCreateWorkspaceGroup: createWorkspaceGroup,
          onRenameWorkspaceGroup: renameWorkspaceGroup,
          onMoveWorkspaceGroup: moveWorkspaceGroup,
          onDeleteWorkspaceGroup: deleteWorkspaceGroup,
          onAssignWorkspaceGroup: assignWorkspaceGroup,
          reduceTransparency,
          onToggleTransparency: setReduceTransparency,
          appSettings,
          openAppIconById,
          onUpdateAppSettings: async (next) => {
            await queueSaveSettings(next);
          },
          onRunDoctor: doctor,
          onRunCodexUpdate: codexUpdate,
          onUpdateWorkspaceCodexBin: async (id, codexBin) => {
            await updateWorkspaceCodexBin(id, codexBin);
          },
          onUpdateWorkspaceSettings: async (id, settings) => {
            await updateWorkspaceSettings(id, settings);
          },
          scaleShortcutTitle,
          scaleShortcutText,
          onTestNotificationSound: handleTestNotificationSound,
          onTestSystemNotification: handleTestSystemNotification,
          onMobileConnectSuccess: handleMobileConnectSuccess,
          dictationModelStatus: dictationModel.status,
          onDownloadDictationModel: dictationModel.download,
          onCancelDictationDownload: dictationModel.cancel,
          onRemoveDictationModel: dictationModel.remove,
        }}
      />
      {showMobileSetupWizard && (
        <MobileServerSetupWizard {...mobileSetupWizardProps} />
      )}
      {ConfirmModalNode}
    </div>
  );
}

function App() {
  const windowLabel = useWindowLabel();
  if (windowLabel === "about") {
    return (
      <Suspense fallback={null}>
        <AboutView />
      </Suspense>
    );
  }
  return <MainApp />;
}

export default App;
