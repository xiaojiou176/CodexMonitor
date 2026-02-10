import type {
  AppSettings,
  OpenAppTarget,
  OrbitConnectTestResult,
  OrbitRunnerStatus,
  OrbitSignInPollResult,
  OrbitSignOutResult,
  WorkspaceInfo,
} from "../../../types";
import type { OpenAppDraft, ShortcutDrafts } from "./settingsTypes";
import { SETTINGS_MOBILE_BREAKPOINT_PX } from "./settingsViewConstants";

export const normalizeOverrideValue = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export const normalizeWorktreeSetupScript = (
  value: string | null | undefined,
): string | null => {
  const next = value ?? "";
  return next.trim().length > 0 ? next : null;
};

export const buildWorkspaceOverrideDrafts = (
  projects: WorkspaceInfo[],
  prev: Record<string, string>,
  getValue: (workspace: WorkspaceInfo) => string | null | undefined,
): Record<string, string> => {
  const next: Record<string, string> = {};
  projects.forEach((workspace) => {
    const existing = prev[workspace.id];
    next[workspace.id] = existing ?? getValue(workspace) ?? "";
  });
  return next;
};

export const isNarrowSettingsViewport = (): boolean => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(`(max-width: ${SETTINGS_MOBILE_BREAKPOINT_PX}px)`).matches;
};

export const delay = (durationMs: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });

export type OrbitActionResult =
  | OrbitConnectTestResult
  | OrbitSignInPollResult
  | OrbitSignOutResult
  | OrbitRunnerStatus;

export const getOrbitStatusText = (
  value: OrbitActionResult,
  fallback: string,
): string => {
  if ("ok" in value) {
    if (!value.ok) {
      return value.message || fallback;
    }
    if (value.message.trim()) {
      return value.message;
    }
    if (typeof value.latencyMs === "number") {
      return `已连接到 Orbit 中继，延迟 ${value.latencyMs}ms。`;
    }
    return fallback;
  }

  if ("status" in value) {
    if (value.message && value.message.trim()) {
      return value.message;
    }
    switch (value.status) {
      case "pending":
        return "等待 Orbit 登录授权。";
      case "authorized":
        return "Orbit 登录完成。";
      case "denied":
        return "Orbit 登录被拒绝。";
      case "expired":
        return "Orbit 登录验证码已过期。";
      case "error":
        return "Orbit 登录失败。";
      default:
        return fallback;
    }
  }

  if ("success" in value) {
    if (!value.success && value.message && value.message.trim()) {
      return value.message;
    }
    return value.success ? "已从 Orbit 退出。" : fallback;
  }

  if (value.state === "running") {
    return value.pid
      ? `Orbit 运行器正在运行（pid ${value.pid}）。`
      : "Orbit 运行器正在运行。";
  }
  if (value.state === "error") {
    return value.lastError?.trim() || "Orbit 运行器处于错误状态。";
  }
  return "Orbit 运行器已停止。";
};

export const buildOpenAppDrafts = (targets: OpenAppTarget[]): OpenAppDraft[] =>
  targets.map((target) => ({
    ...target,
    argsText: target.args.join(" "),
  }));

const isOpenAppLabelValid = (label: string) => label.trim().length > 0;

export const isOpenAppDraftComplete = (draft: OpenAppDraft) => {
  if (!isOpenAppLabelValid(draft.label)) {
    return false;
  }
  if (draft.kind === "app") {
    return Boolean(draft.appName?.trim());
  }
  if (draft.kind === "command") {
    return Boolean(draft.command?.trim());
  }
  return true;
};

export const isOpenAppTargetComplete = (target: OpenAppTarget) => {
  if (!isOpenAppLabelValid(target.label)) {
    return false;
  }
  if (target.kind === "app") {
    return Boolean(target.appName?.trim());
  }
  if (target.kind === "command") {
    return Boolean(target.command?.trim());
  }
  return true;
};

export const normalizeOpenAppTargets = (
  drafts: OpenAppDraft[],
): OpenAppTarget[] =>
  drafts.map(({ argsText, ...target }) => ({
    ...target,
    label: target.label.trim(),
    appName: (target.appName?.trim() ?? "") || null,
    command: (target.command?.trim() ?? "") || null,
    args: argsText.trim() ? argsText.trim().split(/\s+/) : [],
  }));

export const createOpenAppId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `open-app-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const buildShortcutDrafts = (appSettings: AppSettings): ShortcutDrafts => ({
  model: appSettings.composerModelShortcut ?? "",
  reasoning: appSettings.composerReasoningShortcut ?? "",
  collaboration: appSettings.composerCollaborationShortcut ?? "",
  interrupt: appSettings.interruptShortcut ?? "",
  newAgent: appSettings.newAgentShortcut ?? "",
  newWorktreeAgent: appSettings.newWorktreeAgentShortcut ?? "",
  newCloneAgent: appSettings.newCloneAgentShortcut ?? "",
  archiveThread: appSettings.archiveThreadShortcut ?? "",
  projectsSidebar: appSettings.toggleProjectsSidebarShortcut ?? "",
  gitSidebar: appSettings.toggleGitSidebarShortcut ?? "",
  branchSwitcher: appSettings.branchSwitcherShortcut ?? "",
  debugPanel: appSettings.toggleDebugPanelShortcut ?? "",
  terminal: appSettings.toggleTerminalShortcut ?? "",
  cycleAgentNext: appSettings.cycleAgentNextShortcut ?? "",
  cycleAgentPrev: appSettings.cycleAgentPrevShortcut ?? "",
  cycleWorkspaceNext: appSettings.cycleWorkspaceNextShortcut ?? "",
  cycleWorkspacePrev: appSettings.cycleWorkspacePrevShortcut ?? "",
});

type EditorContentMetaInput = {
  isLoading: boolean;
  isSaving: boolean;
  exists: boolean;
  truncated: boolean;
  isDirty: boolean;
};

export const buildEditorContentMeta = ({
  isLoading,
  isSaving,
  exists,
  truncated,
  isDirty,
}: EditorContentMetaInput) => {
  const status = isLoading ? "加载中…" : isSaving ? "保存中…" : exists ? "" : "未找到";
  const metaParts: string[] = [];
  if (status) {
    metaParts.push(status);
  }
  if (truncated) {
    metaParts.push("已截断");
  }

  return {
    meta: metaParts.join(" · "),
    saveLabel: exists ? "保存" : "创建",
    saveDisabled: isLoading || isSaving || !isDirty,
    refreshDisabled: isLoading || isSaving,
  };
};
