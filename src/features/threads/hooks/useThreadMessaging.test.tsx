/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Sentry from "@sentry/react";
import {
  sendUserMessage as sendUserMessageService,
  steerTurn as steerTurnService,
  startReview as startReviewService,
  interruptTurn as interruptTurnService,
  getAppsList as getAppsListService,
  listMcpServerStatus as listMcpServerStatusService,
  compactThread as compactThreadService,
} from "../../../services/tauri";
import type { WorkspaceInfo } from "../../../types";
import { expandCustomPromptText } from "../../../utils/customPrompts";
import { useThreadMessaging } from "./useThreadMessaging";

vi.mock("@sentry/react", () => ({
  metrics: {
    count: vi.fn(),
  },
}));

vi.mock("../../../services/tauri", () => ({
  sendUserMessage: vi.fn(),
  steerTurn: vi.fn(),
  startReview: vi.fn(),
  interruptTurn: vi.fn(),
  getAppsList: vi.fn(),
  listMcpServerStatus: vi.fn(),
  compactThread: vi.fn(),
}));

vi.mock("../../../utils/customPrompts", () => ({
  expandCustomPromptText: vi.fn(() => null),
}));

const reviewPromptMocks = vi.hoisted(() => ({
  openReviewPrompt: vi.fn(),
  closeReviewPrompt: vi.fn(),
  showPresetStep: vi.fn(),
  choosePreset: vi.fn(),
  setHighlightedPresetIndex: vi.fn(),
  setHighlightedBranchIndex: vi.fn(),
  setHighlightedCommitIndex: vi.fn(),
  handleReviewPromptKeyDown: vi.fn(() => false),
  confirmBranch: vi.fn(),
  selectBranch: vi.fn(),
  selectBranchAtIndex: vi.fn(),
  selectCommit: vi.fn(),
  selectCommitAtIndex: vi.fn(),
  confirmCommit: vi.fn(),
  updateCustomInstructions: vi.fn(),
  confirmCustom: vi.fn(),
}));

vi.mock("./useReviewPrompt", () => ({
  useReviewPrompt: () => ({
    reviewPrompt: null,
    openReviewPrompt: reviewPromptMocks.openReviewPrompt,
    closeReviewPrompt: reviewPromptMocks.closeReviewPrompt,
    showPresetStep: reviewPromptMocks.showPresetStep,
    choosePreset: reviewPromptMocks.choosePreset,
    highlightedPresetIndex: 0,
    setHighlightedPresetIndex: reviewPromptMocks.setHighlightedPresetIndex,
    highlightedBranchIndex: 0,
    setHighlightedBranchIndex: reviewPromptMocks.setHighlightedBranchIndex,
    highlightedCommitIndex: 0,
    setHighlightedCommitIndex: reviewPromptMocks.setHighlightedCommitIndex,
    handleReviewPromptKeyDown: reviewPromptMocks.handleReviewPromptKeyDown,
    confirmBranch: reviewPromptMocks.confirmBranch,
    selectBranch: reviewPromptMocks.selectBranch,
    selectBranchAtIndex: reviewPromptMocks.selectBranchAtIndex,
    selectCommit: reviewPromptMocks.selectCommit,
    selectCommitAtIndex: reviewPromptMocks.selectCommitAtIndex,
    confirmCommit: reviewPromptMocks.confirmCommit,
    updateCustomInstructions: reviewPromptMocks.updateCustomInstructions,
    confirmCustom: reviewPromptMocks.confirmCustom,
  }),
}));

describe("useThreadMessaging telemetry", () => {
  const workspace: WorkspaceInfo = {
    id: "ws-1",
    name: "Workspace",
    path: "/tmp/workspace",
    connected: true,
    settings: {
      sidebarCollapsed: false,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(expandCustomPromptText).mockReturnValue(null);
    vi.mocked(sendUserMessageService).mockResolvedValue({
      result: {
        turn: { id: "turn-1" },
      },
    } as unknown as Awaited<ReturnType<typeof sendUserMessageService>>);
    vi.mocked(steerTurnService).mockResolvedValue(
      {
        result: {
          turnId: "turn-1",
        },
      } as unknown as Awaited<ReturnType<typeof steerTurnService>>,
    );
    vi.mocked(startReviewService).mockResolvedValue(
      {} as Awaited<ReturnType<typeof startReviewService>>,
    );
    vi.mocked(interruptTurnService).mockResolvedValue(
      {} as Awaited<ReturnType<typeof interruptTurnService>>,
    );
    vi.mocked(getAppsListService).mockResolvedValue(
      {} as Awaited<ReturnType<typeof getAppsListService>>,
    );
    vi.mocked(listMcpServerStatusService).mockResolvedValue(
      {} as Awaited<ReturnType<typeof listMcpServerStatusService>>,
    );
    vi.mocked(compactThreadService).mockResolvedValue(
      {} as Awaited<ReturnType<typeof compactThreadService>>,
    );
  });

  it("records prompt_sent once for one message send", async () => {
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "hello",
        [],
      );
    });

    expect(Sentry.metrics.count).toHaveBeenCalledTimes(1);
    expect(Sentry.metrics.count).toHaveBeenCalledWith(
      "prompt_sent",
      1,
      expect.objectContaining({
        attributes: expect.objectContaining({
          workspace_id: "ws-1",
          thread_id: "thread-1",
          has_images: "false",
          text_length: "5",
        }),
      }),
    );
  });

  it("uses turn/steer when steer mode is enabled and an active turn is present", async () => {
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: true,
        customPrompts: [],
        threadStatusById: {
          "thread-1": {
            isProcessing: true,
            isReviewing: false,
            hasUnread: false,
            phase: "starting",
            processingStartedAt: 0,
            lastDurationMs: null,
          },
        },
        activeTurnIdByThread: {
          "thread-1": "turn-1",
        },
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "steer this",
        [],
      );
    });

    expect(steerTurnService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "turn-1",
      "steer this",
      [],
      undefined,
      [],
    );
    expect(sendUserMessageService).not.toHaveBeenCalled();
  });

  it("extracts and forwards skill mentions from final message text", async () => {
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        skills: [
          { name: "deep_debug", path: "/Users/me/.codex/skills/_深度模式/深度调试模式/SKILL.md" },
          { name: "relativeSkill", path: "skills/relative/SKILL.md" },
        ],
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "run $deep_debug then again $deep_debug",
        [],
      );
    });

    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "run $deep_debug then again $deep_debug",
      expect.objectContaining({
        skillMentions: [
          {
            name: "deep_debug",
            path: "/Users/me/.codex/skills/_深度模式/深度调试模式/SKILL.md",
          },
        ],
      }),
    );
  });

  it("extracts and forwards unicode skill mentions from final message text", async () => {
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        skills: [
          { name: "深度调试模式", path: "/Users/me/.codex/skills/_深度模式/深度调试模式/SKILL.md" },
        ],
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "请执行 $深度调试模式 并继续",
        [],
      );
    });

    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "请执行 $深度调试模式 并继续",
      expect.objectContaining({
        skillMentions: [
          {
            name: "深度调试模式",
            path: "/Users/me/.codex/skills/_深度模式/深度调试模式/SKILL.md",
          },
        ],
      }),
    );
  });

  it("extracts unicode skill mentions when token has a space after $", async () => {
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        skills: [
          { name: "深度调试模式", path: "/Users/me/.codex/skills/_深度模式/深度调试模式/SKILL.md" },
        ],
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "请执行 $ 深度调试模式 并继续",
        [],
      );
    });

    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "请执行 $ 深度调试模式 并继续",
      expect.objectContaining({
        skillMentions: [
          {
            name: "深度调试模式",
            path: "/Users/me/.codex/skills/_深度模式/深度调试模式/SKILL.md",
          },
        ],
      }),
    );
  });

  it("extracts unicode skill mentions from full-width dollar tokens", async () => {
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        skills: [
          { name: "深度调试模式", path: "/Users/me/.codex/skills/_深度模式/深度调试模式/SKILL.md" },
        ],
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "请执行 ＄深度调试模式 并继续",
        [],
      );
    });

    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "请执行 ＄深度调试模式 并继续",
      expect.objectContaining({
        skillMentions: [
          {
            name: "深度调试模式",
            path: "/Users/me/.codex/skills/_深度模式/深度调试模式/SKILL.md",
          },
        ],
      }),
    );
  });

  it("extracts spaced skill-name mentions such as $my skill", async () => {
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        skills: [
          { name: "my skill", path: "/Users/me/.codex/skills/my-skill/SKILL.md" },
        ],
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "run $my skill now",
        [],
      );
    });

    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "run $my skill now",
      expect.objectContaining({
        skillMentions: [
          {
            name: "my skill",
            path: "/Users/me/.codex/skills/my-skill/SKILL.md",
          },
        ],
      }),
    );
  });

  it("enforces sub-agent model inheritance in collaboration settings", async () => {
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        model: "gpt-5.3-codex",
        effort: null,
        collaborationMode: {
          mode: "default",
          settings: {
            developer_instructions: "Keep responses concise.",
          },
        },
        reviewDeliveryMode: "inline",
        steerEnabled: false,
        customPrompts: [],
        threadStatusById: {},
        activeTurnIdByThread: {},
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "run this",
        [],
      );
    });

    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "run this",
      expect.objectContaining({
        model: "gpt-5.3-codex",
        collaborationMode: expect.objectContaining({
          settings: expect.objectContaining({
            model: "gpt-5.3-codex",
            developer_instructions: expect.stringContaining(
              "[codexmonitor-subagent-model-inherit-v1]",
            ),
          }),
        }),
      }),
    );
  });

  it("falls back to turn/start when turn/steer is unsupported and remembers fallback", async () => {
    vi.mocked(steerTurnService).mockResolvedValueOnce({
      error: {
        message:
          "Invalid request: unknown variant `turn/steer`, expected one of `turn/start`, `turn/interrupt`",
      },
    } as unknown as Awaited<ReturnType<typeof steerTurnService>>);

    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: true,
        customPrompts: [],
        threadStatusById: {
          "thread-1": {
            isProcessing: true,
            isReviewing: false,
            hasUnread: false,
            phase: "starting",
            processingStartedAt: 0,
            lastDurationMs: null,
          },
        },
        activeTurnIdByThread: {
          "thread-1": "turn-1",
        },
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "fallback once",
        [],
      );
    });
    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "fallback twice",
        [],
      );
    });

    expect(steerTurnService).toHaveBeenCalledTimes(1);
    expect(sendUserMessageService).toHaveBeenCalledTimes(2);
    expect(sendUserMessageService).toHaveBeenNthCalledWith(
      1,
      "ws-1",
      "thread-1",
      "fallback once",
      expect.any(Object),
    );
    expect(sendUserMessageService).toHaveBeenNthCalledWith(
      2,
      "ws-1",
      "thread-1",
      "fallback twice",
      expect.any(Object),
    );
  });

  it("falls back to turn/start when remote reports unknown method turn_steer", async () => {
    vi.mocked(steerTurnService).mockRejectedValueOnce(
      new Error("unknown method: turn_steer"),
    );

    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: true,
        customPrompts: [],
        threadStatusById: {
          "thread-1": {
            isProcessing: true,
            isReviewing: false,
            hasUnread: false,
            phase: "starting",
            processingStartedAt: 0,
            lastDurationMs: null,
          },
        },
        activeTurnIdByThread: {
          "thread-1": "turn-1",
        },
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId: vi.fn(),
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage: vi.fn(),
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "fallback remote method",
        [],
      );
    });

    expect(steerTurnService).toHaveBeenCalledTimes(1);
    expect(sendUserMessageService).toHaveBeenCalledTimes(1);
    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "fallback remote method",
      expect.any(Object),
    );
  });

  it("retries turn/steer with server-reported active turn id when ids drift", async () => {
    vi.mocked(steerTurnService)
      .mockResolvedValueOnce({
        error: {
          message: "expected active turn id turn-1 but found turn-2",
        },
      } as unknown as Awaited<ReturnType<typeof steerTurnService>>)
      .mockResolvedValueOnce({
        result: {
          turnId: "turn-2",
        },
      } as unknown as Awaited<ReturnType<typeof steerTurnService>>);

    const setActiveTurnId = vi.fn();
    const pushThreadErrorMessage = vi.fn();
    const { result } = renderHook(() =>
      useThreadMessaging({
        activeWorkspace: workspace,
        activeThreadId: "thread-1",
        model: null,
        effort: null,
        collaborationMode: null,
        reviewDeliveryMode: "inline",
        steerEnabled: true,
        customPrompts: [],
        threadStatusById: {
          "thread-1": {
            isProcessing: true,
            isReviewing: false,
            hasUnread: false,
            phase: "starting",
            processingStartedAt: 0,
            lastDurationMs: null,
          },
        },
        activeTurnIdByThread: {
          "thread-1": "turn-1",
        },
        rateLimitsByWorkspace: {},
        pendingInterruptsRef: { current: new Set<string>() },
        dispatch: vi.fn(),
        getCustomName: vi.fn(() => undefined),
        markProcessing: vi.fn(),
        markReviewing: vi.fn(),
        setActiveTurnId,
        recordThreadActivity: vi.fn(),
        safeMessageActivity: vi.fn(),
        onDebug: vi.fn(),
        pushThreadErrorMessage,
        ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
        ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
        refreshThread: vi.fn(async () => null),
        forkThreadForWorkspace: vi.fn(async () => null),
        updateThreadParent: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "steer drift",
        [],
      );
    });

    expect(steerTurnService).toHaveBeenCalledTimes(2);
    expect(steerTurnService).toHaveBeenNthCalledWith(
      1,
      "ws-1",
      "thread-1",
      "turn-1",
      "steer drift",
      [],
      undefined,
      [],
    );
    expect(steerTurnService).toHaveBeenNthCalledWith(
      2,
      "ws-1",
      "thread-1",
      "turn-2",
      "steer drift",
      [],
      undefined,
      [],
    );
    expect(setActiveTurnId).toHaveBeenCalledWith("thread-1", "turn-2");
    expect(pushThreadErrorMessage).not.toHaveBeenCalled();
    expect(sendUserMessageService).not.toHaveBeenCalled();
  });
});

describe("useThreadMessaging branch coverage", () => {
  const workspace: WorkspaceInfo = {
    id: "ws-1",
    name: "Workspace",
    path: "/tmp/workspace",
    connected: true,
    settings: {
      sidebarCollapsed: false,
    },
  };

  type HookOptions = Parameters<typeof useThreadMessaging>[0];

  const createOptions = (overrides: Partial<HookOptions> = {}): HookOptions => ({
    activeWorkspace: workspace,
    activeThreadId: "thread-1",
    model: null,
    effort: null,
    collaborationMode: null,
    reviewDeliveryMode: "inline",
    steerEnabled: false,
    skills: [],
    customPrompts: [],
    threadStatusById: {},
    activeTurnIdByThread: {},
    rateLimitsByWorkspace: {},
    pendingInterruptsRef: { current: new Set<string>() },
    dispatch: vi.fn(),
    getCustomName: vi.fn(() => undefined),
    markProcessing: vi.fn(),
    markReviewing: vi.fn(),
    setActiveTurnId: vi.fn(),
    recordThreadActivity: vi.fn(),
    safeMessageActivity: vi.fn(),
    onDebug: vi.fn(),
    pushThreadErrorMessage: vi.fn(),
    ensureThreadForActiveWorkspace: vi.fn(async () => "thread-1"),
    ensureThreadForWorkspace: vi.fn(async () => "thread-1"),
    refreshThread: vi.fn(async () => null),
    forkThreadForWorkspace: vi.fn(async () => null),
    updateThreadParent: vi.fn(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(expandCustomPromptText).mockReturnValue(null);
    vi.mocked(sendUserMessageService).mockResolvedValue({
      result: {
        turn: { id: "turn-1" },
      },
    } as Awaited<ReturnType<typeof sendUserMessageService>>);
    vi.mocked(steerTurnService).mockResolvedValue({
      result: {
        turnId: "turn-1",
      },
    } as Awaited<ReturnType<typeof steerTurnService>>);
    vi.mocked(startReviewService).mockResolvedValue(
      {} as Awaited<ReturnType<typeof startReviewService>>,
    );
    vi.mocked(interruptTurnService).mockResolvedValue(
      {} as Awaited<ReturnType<typeof interruptTurnService>>,
    );
    vi.mocked(getAppsListService).mockResolvedValue(
      {} as Awaited<ReturnType<typeof getAppsListService>>,
    );
    vi.mocked(listMcpServerStatusService).mockResolvedValue(
      {} as Awaited<ReturnType<typeof listMcpServerStatusService>>,
    );
    vi.mocked(compactThreadService).mockResolvedValue(
      {} as Awaited<ReturnType<typeof compactThreadService>>,
    );
  });

  it("keeps collaboration settings unchanged when settings payload is not an object", async () => {
    const collaborationMode = {
      mode: "default",
      settings: ["invalid-shape"],
    } as unknown as NonNullable<HookOptions["collaborationMode"]>;
    const options = createOptions({
      collaborationMode,
      model: "gpt-5.3-codex",
    });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "hello", []);
    });

    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "hello",
      expect.objectContaining({
        collaborationMode,
      }),
    );
  });

  it("normalizes object collaboration mode without settings to null in send payload", async () => {
    const options = createOptions({
      collaborationMode: { mode: "default" } as NonNullable<HookOptions["collaborationMode"]>,
    });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "hello", []);
    });

    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "hello",
      expect.objectContaining({
        collaborationMode: null,
      }),
    );
  });

  it("ignores marker-only segments and still matches skills with internal multi-space names", async () => {
    const options = createOptions({
      skills: [
        {
          name: "pair   review",
          path: "/Users/me/.codex/skills/pair-review/SKILL.md",
        },
      ],
    });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "run $   then $pair review now",
        [],
      );
    });

    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "run $   then $pair review now",
      expect.objectContaining({
        skillMentions: [
          {
            name: "pair   review",
            path: "/Users/me/.codex/skills/pair-review/SKILL.md",
          },
        ],
      }),
    );
  });

  it("supports windows absolute skill paths and ignores unmatched markers", async () => {
    const options = createOptions({
      skills: [
        { name: "win skill", path: "C:\\Users\\me\\.codex\\skills\\win-skill\\SKILL.md" },
      ],
    });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "run $win skill then $not-installed",
        [],
      );
    });

    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "run $win skill then $not-installed",
      expect.objectContaining({
        skillMentions: [
          {
            name: "win skill",
            path: "C:\\Users\\me\\.codex\\skills\\win-skill\\SKILL.md",
          },
        ],
      }),
    );
  });

  it("returns early for empty sendUserMessageToThread input", async () => {
    const options = createOptions();
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "  ", []);
    });

    expect(sendUserMessageService).not.toHaveBeenCalled();
    expect(Sentry.metrics.count).not.toHaveBeenCalled();
  });

  it("sends when only images are provided even if text is blank", async () => {
    const options = createOptions();
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "   ", ["img://1"]);
    });

    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "",
      expect.objectContaining({
        images: ["img://1"],
      }),
    );
    expect(Sentry.metrics.count).toHaveBeenCalledWith(
      "prompt_sent",
      1,
      expect.objectContaining({
        attributes: expect.objectContaining({
          has_images: "true",
          text_length: "0",
        }),
      }),
    );
  });

  it("skips prompt expansion when skipPromptExpansion is true", async () => {
    vi.mocked(expandCustomPromptText).mockReturnValue({ error: "should be ignored" });
    const options = createOptions();
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "  keep original text  ",
        [],
        { skipPromptExpansion: true },
      );
    });

    expect(expandCustomPromptText).not.toHaveBeenCalled();
    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "keep original text",
      expect.any(Object),
    );
  });

  it("supports UNC absolute skill paths in mention extraction", async () => {
    const uncPath = String.raw`\\server\share\.codex\skills\net-skill\SKILL.md`;
    const options = createOptions({
      skills: [
        {
          name: "net skill",
          path: uncPath,
        },
      ],
    });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "run $net skill",
        [],
      );
    });

    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "run $net skill",
      expect.objectContaining({
        skillMentions: [
          {
            name: "net skill",
            path: uncPath,
          },
        ],
      }),
    );
  });

  it("surfaces prompt expansion errors for thread sends", async () => {
    vi.mocked(expandCustomPromptText).mockReturnValueOnce({
      error: "bad prompt",
    });
    const pushThreadErrorMessage = vi.fn();
    const safeMessageActivity = vi.fn();
    const options = createOptions({ pushThreadErrorMessage, safeMessageActivity });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "hello", []);
    });

    expect(pushThreadErrorMessage).toHaveBeenCalledWith("thread-1", "bad prompt");
    expect(safeMessageActivity).toHaveBeenCalledTimes(1);
    expect(sendUserMessageService).not.toHaveBeenCalled();
  });

  it("forceSteer interrupts pending turn when no active turn id exists", async () => {
    const options = createOptions({
      steerEnabled: true,
      threadStatusById: {
        "thread-1": {
          isProcessing: true,
          isReviewing: false,
          hasUnread: false,
          phase: "starting",
          processingStartedAt: 0,
          lastDurationMs: null,
        },
      },
      activeTurnIdByThread: {},
    });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "continue",
        [],
        { forceSteer: true },
      );
    });

    expect(interruptTurnService).toHaveBeenCalledWith("ws-1", "thread-1", "pending");
    expect(sendUserMessageService).toHaveBeenCalledTimes(1);
    expect(steerTurnService).not.toHaveBeenCalled();
  });

  it("falls back to turn/start when steer mismatch does not expose a retry id", async () => {
    vi.mocked(steerTurnService).mockRejectedValueOnce(
      new Error("expected active turn id turn-1 but found null"),
    );
    const setActiveTurnId = vi.fn();
    const options = createOptions({
      steerEnabled: true,
      threadStatusById: {
        "thread-1": {
          isProcessing: true,
          isReviewing: false,
          hasUnread: false,
          phase: "starting",
          processingStartedAt: 0,
          lastDurationMs: null,
        },
      },
      activeTurnIdByThread: {
        "thread-1": "turn-1",
      },
      setActiveTurnId,
    });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "fallback", []);
    });

    expect(steerTurnService).toHaveBeenCalledTimes(1);
    expect(sendUserMessageService).toHaveBeenCalledTimes(1);
    expect(setActiveTurnId).toHaveBeenCalledWith("thread-1", "turn-1");
  });

  it("reports steer errors when steer throws a non-fallback error", async () => {
    vi.mocked(steerTurnService).mockRejectedValueOnce(new Error("permission denied"));
    const pushThreadErrorMessage = vi.fn();
    const safeMessageActivity = vi.fn();
    const options = createOptions({
      steerEnabled: true,
      threadStatusById: {
        "thread-1": {
          isProcessing: true,
          isReviewing: false,
          hasUnread: false,
          phase: "starting",
          processingStartedAt: 0,
          lastDurationMs: null,
        },
      },
      activeTurnIdByThread: {
        "thread-1": "turn-1",
      },
      pushThreadErrorMessage,
      safeMessageActivity,
    });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "steer", []);
    });

    expect(pushThreadErrorMessage).toHaveBeenCalledWith(
      "thread-1",
      "Turn steer failed: permission denied",
    );
    expect(safeMessageActivity).toHaveBeenCalled();
    expect(sendUserMessageService).not.toHaveBeenCalled();
  });

  it("retries turn/start after not found error when refresh succeeds", async () => {
    vi.mocked(sendUserMessageService)
      .mockResolvedValueOnce({
        error: { message: "thread not found" },
      } as Awaited<ReturnType<typeof sendUserMessageService>>)
      .mockResolvedValueOnce({
        result: { turn: { id: "turn-2" } },
      } as Awaited<ReturnType<typeof sendUserMessageService>>);

    const refreshThread = vi.fn(async () => "thread-1");
    const pushThreadErrorMessage = vi.fn();
    const options = createOptions({ refreshThread, pushThreadErrorMessage });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "retry", []);
    });

    expect(refreshThread).toHaveBeenCalledWith("ws-1", "thread-1");
    expect(sendUserMessageService).toHaveBeenCalledTimes(2);
    expect(pushThreadErrorMessage).not.toHaveBeenCalled();
  });

  it("emits a generic error when turn/start succeeds without a turn id", async () => {
    vi.mocked(sendUserMessageService).mockResolvedValueOnce({
      result: {},
    } as Awaited<ReturnType<typeof sendUserMessageService>>);
    const markProcessing = vi.fn();
    const setActiveTurnId = vi.fn();
    const pushThreadErrorMessage = vi.fn();
    const options = createOptions({
      markProcessing,
      setActiveTurnId,
      pushThreadErrorMessage,
    });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "missing turn", []);
    });

    expect(pushThreadErrorMessage).toHaveBeenCalledWith("thread-1", "Turn failed to start.");
    expect(markProcessing).toHaveBeenCalledWith("thread-1", false);
    expect(setActiveTurnId).toHaveBeenCalledWith("thread-1", null);
  });

  it("startStatus includes usage resets and unlimited credits", async () => {
    const dispatch = vi.fn();
    const options = createOptions({
      model: "gpt-5",
      effort: "high",
      collaborationMode: {
        settings: { id: "pair" },
      },
      dispatch,
      rateLimitsByWorkspace: {
        "ws-1": {
          primary: { usedPercent: 41, windowDurationMins: 300, resetsAt: 1_700_000_000 },
          secondary: { usedPercent: 65, windowDurationMins: 10080, resetsAt: 1_700_000_500 },
          credits: { hasCredits: true, unlimited: true, balance: "" },
          planType: null,
        },
      },
    });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.startStatus("/status");
    });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "addAssistantMessage",
        threadId: "thread-1",
        text: expect.stringContaining("Credits: unlimited"),
      }),
    );
  });

  it("startMcp shows empty-state and failure-state messages", async () => {
    vi.mocked(listMcpServerStatusService)
      .mockResolvedValueOnce({
        result: { data: [] },
      } as Awaited<ReturnType<typeof listMcpServerStatusService>>)
      .mockRejectedValueOnce(new Error("mcp unavailable"));

    const dispatch = vi.fn();
    const options = createOptions({ dispatch });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.startMcp("/mcp");
    });
    await act(async () => {
      await result.current.startMcp("/mcp");
    });

    expect(dispatch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: "addAssistantMessage",
        text: expect.stringContaining("No MCP servers configured."),
      }),
    );
    expect(dispatch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: "addAssistantMessage",
        text: expect.stringContaining("mcp unavailable"),
      }),
    );
  });

  it("startApps renders install links and falls back to a generic error message", async () => {
    vi.mocked(getAppsListService)
      .mockResolvedValueOnce({
        result: {
          data: [
            {
              id: "app-1",
              name: "Builder",
              is_accessible: false,
              install_url: "https://apps.local/install",
              description: "Build app flows",
            },
          ],
        },
      } as Awaited<ReturnType<typeof getAppsListService>>)
      .mockRejectedValueOnce("boom");

    const dispatch = vi.fn();
    const options = createOptions({ dispatch });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.startApps("/apps");
    });
    await act(async () => {
      await result.current.startApps("/apps");
    });

    expect(dispatch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: "addAssistantMessage",
        text: expect.stringContaining("install: https://apps.local/install"),
      }),
    );
    expect(dispatch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: "addAssistantMessage",
        text: expect.stringContaining("Failed to load apps."),
      }),
    );
  });

  it("startReview opens preset prompt for bare /review and returns false on rpc error", async () => {
    vi.mocked(startReviewService).mockResolvedValueOnce({
      error: { message: "review blocked" },
    } as Awaited<ReturnType<typeof startReviewService>>);
    const pushThreadErrorMessage = vi.fn();
    const markProcessing = vi.fn();
    const markReviewing = vi.fn();
    const setActiveTurnId = vi.fn();
    const options = createOptions({
      pushThreadErrorMessage,
      markProcessing,
      markReviewing,
      setActiveTurnId,
    });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.startReview("/review");
    });
    await act(async () => {
      await result.current.startReview("/review branch:main");
    });

    expect(reviewPromptMocks.openReviewPrompt).toHaveBeenCalledTimes(1);
    expect(pushThreadErrorMessage).toHaveBeenCalledWith(
      "thread-1",
      "Review failed to start: review blocked",
    );
    expect(markProcessing).toHaveBeenCalledWith("thread-1", false);
    expect(markReviewing).toHaveBeenCalledWith("thread-1", false);
    expect(setActiveTurnId).toHaveBeenCalledWith("thread-1", null);
  });

  it("startResume bails out while processing and startCompact reports failures", async () => {
    const refreshThread = vi.fn(async () => null);
    const pushThreadErrorMessage = vi.fn();
    vi.mocked(compactThreadService).mockRejectedValueOnce(new Error("compact failed"));

    const options = createOptions({
      threadStatusById: {
        "thread-1": {
          isProcessing: true,
          isReviewing: false,
          hasUnread: false,
          phase: "streaming",
          processingStartedAt: 0,
          lastDurationMs: null,
        },
      },
      refreshThread,
      pushThreadErrorMessage,
    });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.startResume("/resume");
    });
    await act(async () => {
      await result.current.startCompact("/compact");
    });

    expect(refreshThread).not.toHaveBeenCalled();
    expect(pushThreadErrorMessage).toHaveBeenCalledWith("thread-1", "compact failed");
  });

  it("sendUserMessage emits debug when prompt expansion fails without active thread", async () => {
    vi.mocked(expandCustomPromptText).mockReturnValueOnce({ error: "bad user prompt" });
    const onDebug = vi.fn();
    const pushThreadErrorMessage = vi.fn();
    const options = createOptions({
      activeThreadId: null,
      onDebug,
      pushThreadErrorMessage,
    });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.sendUserMessage("bad", []);
    });

    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "error",
        label: "prompt/expand error",
        payload: "bad user prompt",
      }),
    );
    expect(pushThreadErrorMessage).not.toHaveBeenCalled();
  });

  it("interruptTurn queues pending interrupts when active turn id is missing", async () => {
    const dispatch = vi.fn();
    const markProcessing = vi.fn();
    const setActiveTurnId = vi.fn();
    const pendingInterruptsRef = { current: new Set<string>() };
    const options = createOptions({
      dispatch,
      markProcessing,
      setActiveTurnId,
      pendingInterruptsRef,
      activeTurnIdByThread: {},
    });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.interruptTurn();
    });

    expect(markProcessing).toHaveBeenCalledWith("thread-1", false);
    expect(setActiveTurnId).toHaveBeenCalledWith("thread-1", null);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "addAssistantMessage",
        threadId: "thread-1",
        text: "Session stopped.",
      }),
    );
    expect(interruptTurnService).toHaveBeenCalledWith("ws-1", "thread-1", "pending");
    expect(pendingInterruptsRef.current.has("thread-1")).toBe(true);
  });

  it("startFork updates parent and forwards trailing prompt to the new thread", async () => {
    const forkThreadForWorkspace = vi.fn(async () => "thread-2");
    const updateThreadParent = vi.fn();
    const options = createOptions({
      forkThreadForWorkspace,
      updateThreadParent,
    });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.startFork("/fork continue from here");
    });

    expect(forkThreadForWorkspace).toHaveBeenCalledWith("ws-1", "thread-1");
    expect(updateThreadParent).toHaveBeenCalledWith("thread-1", ["thread-2"]);
    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-2",
      "continue from here",
      expect.any(Object),
    );
  });

  it("startResume refreshes active thread when idle", async () => {
    const refreshThread = vi.fn(async () => null);
    const safeMessageActivity = vi.fn();
    const options = createOptions({
      threadStatusById: {
        "thread-1": {
          isProcessing: false,
          isReviewing: false,
          hasUnread: false,
          phase: "completed",
          processingStartedAt: 0,
          lastDurationMs: null,
        },
      },
      refreshThread,
      safeMessageActivity,
    });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.startResume("/resume");
    });

    expect(refreshThread).toHaveBeenCalledWith("ws-1", "thread-1");
    expect(safeMessageActivity).toHaveBeenCalledTimes(1);
  });

  it("startMcp renders server rows with tools and template counts", async () => {
    vi.mocked(listMcpServerStatusService).mockResolvedValueOnce({
      result: {
        data: [
          {
            name: "zeta",
            auth_status: { status: "ok" },
            tools: { mcp__zeta__search: {}, mcp__zeta__fetch: {} },
            resources: [{ id: 1 }],
            resource_templates: [{ id: 2 }],
          },
        ],
      },
    } as Awaited<ReturnType<typeof listMcpServerStatusService>>);
    const dispatch = vi.fn();
    const options = createOptions({ dispatch });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.startMcp("/mcp");
    });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "addAssistantMessage",
        text: expect.stringContaining("tools: fetch, search"),
      }),
    );
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "addAssistantMessage",
        text: expect.stringContaining("resources: 1, templates: 1"),
      }),
    );
  });

  it("does not duplicate sub-agent policy marker when already present", async () => {
    const options = createOptions({
      model: "gpt-5.4-mini",
      collaborationMode: {
        mode: "default",
        settings: {
          developer_instructions:
            "Keep concise.\n[codexmonitor-subagent-model-inherit-v1]\nalready here.",
        },
      },
    });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "hello", []);
    });

    const sentPayload = vi.mocked(sendUserMessageService).mock.calls[0]?.[3] as
      | { collaborationMode?: { settings?: { developer_instructions?: string } } }
      | undefined;
    const instructions =
      sentPayload?.collaborationMode?.settings?.developer_instructions ?? "";
    expect((instructions.match(/\[codexmonitor-subagent-model-inherit-v1\]/g) ?? []).length).toBe(1);
  });

  it("sendUserMessage returns early without active workspace", async () => {
    const options = createOptions({
      activeWorkspace: null,
    });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.sendUserMessage("hello", []);
    });

    expect(sendUserMessageService).not.toHaveBeenCalled();
  });

  it("startCompact exits when no thread can be resolved", async () => {
    const safeMessageActivity = vi.fn();
    const options = createOptions({
      activeThreadId: null,
      ensureThreadForActiveWorkspace: vi.fn(async () => null),
      safeMessageActivity,
    });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.startCompact("/compact");
    });

    expect(compactThreadService).not.toHaveBeenCalled();
    expect(safeMessageActivity).not.toHaveBeenCalled();
  });

  it("startCompact reports generic error for non-Error throwables", async () => {
    vi.mocked(compactThreadService).mockRejectedValueOnce("compact down");
    const pushThreadErrorMessage = vi.fn();
    const options = createOptions({ pushThreadErrorMessage });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.startCompact("/compact");
    });

    expect(pushThreadErrorMessage).toHaveBeenCalledWith(
      "thread-1",
      "Failed to start context compaction.",
    );
  });

  it("filters invalid skill entries and keeps boundary-safe mention matching", async () => {
    const options = createOptions({
      skills: [
        { name: "   ", path: "/Users/me/.codex/skills/invalid/SKILL.md" },
        { name: "debug", path: "" },
        { name: "deep_debug", path: "/Users/me/.codex/skills/deep-debug/SKILL.md" },
      ],
    });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "run $deep_debug2 and $deep_debug",
        [],
      );
    });

    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "run $deep_debug2 and $deep_debug",
      expect.objectContaining({
        skillMentions: [
          {
            name: "deep_debug",
            path: "/Users/me/.codex/skills/deep-debug/SKILL.md",
          },
        ],
      }),
    );
  });

  it("continues with turn/start when forceSteer preemption interrupt fails", async () => {
    vi.mocked(interruptTurnService).mockRejectedValueOnce(new Error("ignore interrupt"));
    const options = createOptions({
      steerEnabled: true,
      threadStatusById: {
        "thread-1": {
          isProcessing: true,
          isReviewing: false,
          hasUnread: false,
          phase: "starting",
          processingStartedAt: 0,
          lastDurationMs: null,
        },
      },
      activeTurnIdByThread: {},
    });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "continue despite interrupt failure",
        [],
        { forceSteer: true },
      );
    });

    expect(interruptTurnService).toHaveBeenCalledWith("ws-1", "thread-1", "pending");
    expect(sendUserMessageService).toHaveBeenCalledTimes(1);
  });

  it("surfaces steer rpc errors from response payload", async () => {
    vi.mocked(steerTurnService).mockResolvedValueOnce({
      error: { message: "steer rpc denied" },
    } as Awaited<ReturnType<typeof steerTurnService>>);
    const markProcessing = vi.fn();
    const setActiveTurnId = vi.fn();
    const pushThreadErrorMessage = vi.fn();
    const options = createOptions({
      steerEnabled: true,
      threadStatusById: {
        "thread-1": {
          isProcessing: true,
          isReviewing: false,
          hasUnread: false,
          phase: "starting",
          processingStartedAt: 0,
          lastDurationMs: null,
        },
      },
      activeTurnIdByThread: {
        "thread-1": "turn-1",
      },
      markProcessing,
      setActiveTurnId,
      pushThreadErrorMessage,
    });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "steer rpc", []);
    });

    expect(pushThreadErrorMessage).toHaveBeenCalledWith(
      "thread-1",
      "Turn steer failed: steer rpc denied",
    );
    expect(markProcessing).not.toHaveBeenCalledWith("thread-1", false);
    expect(setActiveTurnId).not.toHaveBeenCalledWith("thread-1", null);
  });

  it("returns from steer mode without updating turn id when response has no turn id", async () => {
    vi.mocked(steerTurnService).mockResolvedValueOnce({
      result: {},
    } as Awaited<ReturnType<typeof steerTurnService>>);
    const setActiveTurnId = vi.fn();
    const options = createOptions({
      steerEnabled: true,
      threadStatusById: {
        "thread-1": {
          isProcessing: true,
          isReviewing: false,
          hasUnread: false,
          phase: "starting",
          processingStartedAt: 0,
          lastDurationMs: null,
        },
      },
      activeTurnIdByThread: {
        "thread-1": "turn-1",
      },
      setActiveTurnId,
    });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "steer", []);
    });

    expect(steerTurnService).toHaveBeenCalledTimes(1);
    expect(setActiveTurnId).not.toHaveBeenCalledWith("thread-1", null);
  });

  it("handles turn/start thrown non-Error values and clears processing state", async () => {
    vi.mocked(sendUserMessageService).mockRejectedValueOnce("start exploded");
    const markProcessing = vi.fn();
    const setActiveTurnId = vi.fn();
    const pushThreadErrorMessage = vi.fn();
    const options = createOptions({
      markProcessing,
      setActiveTurnId,
      pushThreadErrorMessage,
    });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "boom", []);
    });

    expect(markProcessing).toHaveBeenCalledWith("thread-1", false);
    expect(setActiveTurnId).toHaveBeenCalledWith("thread-1", null);
    expect(pushThreadErrorMessage).toHaveBeenCalledWith("thread-1", "start exploded");
  });

  it("emits start rpc error when refresh cannot recover not found", async () => {
    vi.mocked(sendUserMessageService).mockResolvedValueOnce({
      error: { message: "Thread not found" },
    } as Awaited<ReturnType<typeof sendUserMessageService>>);
    const refreshThread = vi.fn(async () => null);
    const pushThreadErrorMessage = vi.fn();
    const options = createOptions({
      refreshThread,
      pushThreadErrorMessage,
    });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "recover", []);
    });

    expect(refreshThread).toHaveBeenCalledWith("ws-1", "thread-1");
    expect(pushThreadErrorMessage).toHaveBeenCalledWith(
      "thread-1",
      "Turn failed to start: Thread not found",
    );
  });

  it("sendUserMessage bails on blank text and when thread provisioning fails", async () => {
    const ensureThreadForActiveWorkspace = vi.fn(async () => null);
    const options = createOptions({ ensureThreadForActiveWorkspace });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.sendUserMessage("   ", []);
    });
    await act(async () => {
      await result.current.sendUserMessage("hello", []);
    });

    expect(ensureThreadForActiveWorkspace).toHaveBeenCalledTimes(1);
    expect(sendUserMessageService).not.toHaveBeenCalled();
  });

  it("sendUserMessage forwards expanded text and option overrides", async () => {
    vi.mocked(expandCustomPromptText).mockReturnValueOnce({
      expanded: "expanded prompt",
    });
    const options = createOptions({
      model: "default-model",
      effort: "default-effort",
    });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.sendUserMessage(
        "raw prompt",
        [],
        {
          model: "override-model",
          effort: "override-effort",
          collaborationMode: { settings: {} },
        },
      );
    });

    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "expanded prompt",
      expect.objectContaining({
        model: "override-model",
        effort: "override-effort",
      }),
    );
  });

  it("interruptTurn early-returns without active thread and logs non-Error failures", async () => {
    const onDebug = vi.fn();
    const noThreadOptions = createOptions({ activeThreadId: null });
    const { result: noThreadResult } = renderHook(() => useThreadMessaging(noThreadOptions));
    await act(async () => {
      await noThreadResult.current.interruptTurn();
    });
    expect(interruptTurnService).not.toHaveBeenCalled();

    vi.mocked(interruptTurnService).mockRejectedValueOnce("stop failed");
    const withThreadOptions = createOptions({ onDebug });
    const { result } = renderHook(() => useThreadMessaging(withThreadOptions));
    await act(async () => {
      await result.current.interruptTurn();
    });
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "error",
        label: "turn/interrupt error",
        payload: "stop failed",
      }),
    );
  });

  it("startReview handles success path and updates parent for detached review thread", async () => {
    vi.mocked(startReviewService).mockResolvedValueOnce({
      result: { reviewThreadId: "review-thread-2" },
    } as Awaited<ReturnType<typeof startReviewService>>);
    const updateThreadParent = vi.fn();
    const options = createOptions({ updateThreadParent });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.startReview("/review branch:main");
    });

    expect(startReviewService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      expect.any(Object),
      "inline",
    );
    expect(updateThreadParent).toHaveBeenCalledWith("thread-1", ["review-thread-2"]);
  });

  it("startStatus covers no-workspace guard, missing thread, and credit balance branch", async () => {
    const noWorkspaceOptions = createOptions({ activeWorkspace: null });
    const { result: noWorkspaceResult } = renderHook(() => useThreadMessaging(noWorkspaceOptions));
    await act(async () => {
      await noWorkspaceResult.current.startStatus("/status");
    });

    const missingThreadOptions = createOptions({
      ensureThreadForActiveWorkspace: vi.fn(async () => null),
    });
    const { result: missingThreadResult } = renderHook(() =>
      useThreadMessaging(missingThreadOptions),
    );
    await act(async () => {
      await missingThreadResult.current.startStatus("/status");
    });

    const dispatch = vi.fn();
    const options = createOptions({
      dispatch,
      collaborationMode: { settings: { id: "pair-id" } },
      rateLimitsByWorkspace: {
        "ws-1": {
          primary: { usedPercent: 20, windowDurationMins: 300, resetsAt: null },
          secondary: { usedPercent: 30, windowDurationMins: 10080, resetsAt: null },
          credits: { hasCredits: true, unlimited: false, balance: "$12.34" },
          planType: null,
        },
      },
    });
    const { result } = renderHook(() => useThreadMessaging(options));
    await act(async () => {
      await result.current.startStatus("/status");
    });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "addAssistantMessage",
        text: expect.stringContaining("Credits: $12.34"),
      }),
    );
  });

  it("startStatus shows collaboration off when collaboration settings are not an object", async () => {
    const dispatch = vi.fn();
    const options = createOptions({
      dispatch,
      collaborationMode: {
        settings: ["invalid-collab-settings"],
      } as unknown as NonNullable<HookOptions["collaborationMode"]>,
    });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.startStatus("/status");
    });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "addAssistantMessage",
        text: expect.stringContaining("Collaboration: off"),
      }),
    );
  });

  it("startMcp covers null guards and string auth/tool-none formatting", async () => {
    const noWorkspaceOptions = createOptions({ activeWorkspace: null });
    const { result: noWorkspaceResult } = renderHook(() => useThreadMessaging(noWorkspaceOptions));
    await act(async () => {
      await noWorkspaceResult.current.startMcp("/mcp");
    });

    const missingThreadOptions = createOptions({
      ensureThreadForActiveWorkspace: vi.fn(async () => null),
    });
    const { result: missingThreadResult } = renderHook(() =>
      useThreadMessaging(missingThreadOptions),
    );
    await act(async () => {
      await missingThreadResult.current.startMcp("/mcp");
    });

    vi.mocked(listMcpServerStatusService).mockResolvedValueOnce({
      result: {
        data: [
          {
            name: "alpha",
            authStatus: "pending",
            tools: null,
            resources: [],
            resourceTemplates: [{ id: 1 }],
          },
        ],
      },
    } as Awaited<ReturnType<typeof listMcpServerStatusService>>);
    const dispatch = vi.fn();
    const options = createOptions({ dispatch });
    const { result } = renderHook(() => useThreadMessaging(options));
    await act(async () => {
      await result.current.startMcp("/mcp");
    });

    const lastCall = dispatch.mock.calls[dispatch.mock.calls.length - 1];
    const text = (lastCall?.[0] as { text?: string } | undefined)?.text ?? "";
    expect(text).toContain("alpha (auth: pending)");
    expect(text).toContain("tools: none");
    expect(text).toContain("resources: 0, templates: 1");
  });

  it("startApps covers no-workspace, missing-thread, empty-data, and Error-path messaging", async () => {
    const noWorkspaceOptions = createOptions({ activeWorkspace: null });
    const { result: noWorkspaceResult } = renderHook(() => useThreadMessaging(noWorkspaceOptions));
    await act(async () => {
      await noWorkspaceResult.current.startApps("/apps");
    });

    const missingThreadOptions = createOptions({
      ensureThreadForActiveWorkspace: vi.fn(async () => null),
    });
    const { result: missingThreadResult } = renderHook(() =>
      useThreadMessaging(missingThreadOptions),
    );
    await act(async () => {
      await missingThreadResult.current.startApps("/apps");
    });

    vi.mocked(getAppsListService)
      .mockResolvedValueOnce({
        result: { data: [] },
      } as Awaited<ReturnType<typeof getAppsListService>>)
      .mockRejectedValueOnce(new Error("apps backend down"));

    const dispatch = vi.fn();
    const options = createOptions({ dispatch });
    const { result } = renderHook(() => useThreadMessaging(options));
    await act(async () => {
      await result.current.startApps("/apps");
    });
    await act(async () => {
      await result.current.startApps("/apps");
    });

    expect(dispatch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: "addAssistantMessage",
        text: expect.stringContaining("No apps available."),
      }),
    );
    expect(dispatch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: "addAssistantMessage",
        text: expect.stringContaining("apps backend down"),
      }),
    );
  });

  it("startFork handles guards and null fork results without sending", async () => {
    const noWorkspaceOptions = createOptions({ activeWorkspace: null });
    const { result: noWorkspaceResult } = renderHook(() => useThreadMessaging(noWorkspaceOptions));
    await act(async () => {
      await noWorkspaceResult.current.startFork("/fork anything");
    });

    const options = createOptions({
      forkThreadForWorkspace: vi.fn(async () => null),
    });
    const { result } = renderHook(() => useThreadMessaging(options));
    await act(async () => {
      await result.current.startFork("/fork");
    });

    expect(sendUserMessageService).not.toHaveBeenCalled();
    expect(options.updateThreadParent).not.toHaveBeenCalled();
  });

  it("startResume covers no-workspace and unresolved-thread guards", async () => {
    const noWorkspaceOptions = createOptions({ activeWorkspace: null });
    const { result: noWorkspaceResult } = renderHook(() => useThreadMessaging(noWorkspaceOptions));
    await act(async () => {
      await noWorkspaceResult.current.startResume("/resume");
    });

    const refreshThread = vi.fn(async () => null);
    const unresolvedOptions = createOptions({
      activeThreadId: null,
      ensureThreadForActiveWorkspace: vi.fn(async () => null),
      refreshThread,
    });
    const { result } = renderHook(() => useThreadMessaging(unresolvedOptions));
    await act(async () => {
      await result.current.startResume("/resume");
    });

    expect(refreshThread).not.toHaveBeenCalled();
  });

  it("startCompact covers no-workspace guard and successful compaction path", async () => {
    const safeMessageActivity = vi.fn();
    const noWorkspaceOptions = createOptions({
      activeWorkspace: null,
      safeMessageActivity,
    });
    const { result: noWorkspaceResult } = renderHook(() => useThreadMessaging(noWorkspaceOptions));
    await act(async () => {
      await noWorkspaceResult.current.startCompact("/compact");
    });
    expect(safeMessageActivity).not.toHaveBeenCalled();

    const options = createOptions({ safeMessageActivity });
    const { result } = renderHook(() => useThreadMessaging(options));
    await act(async () => {
      await result.current.startCompact("/compact");
    });

    expect(compactThreadService).toHaveBeenCalledWith("ws-1", "thread-1");
    expect(safeMessageActivity).toHaveBeenCalledTimes(1);
  });

  it("sendUserMessage reports prompt expansion errors to active thread", async () => {
    vi.mocked(expandCustomPromptText).mockReturnValueOnce({ error: "expand failed" });
    const pushThreadErrorMessage = vi.fn();
    const safeMessageActivity = vi.fn();
    const options = createOptions({ pushThreadErrorMessage, safeMessageActivity });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.sendUserMessage("bad prompt", []);
    });

    expect(pushThreadErrorMessage).toHaveBeenCalledWith("thread-1", "expand failed");
    expect(safeMessageActivity).toHaveBeenCalledTimes(1);
    expect(sendUserMessageService).not.toHaveBeenCalled();
  });

  it("retries steer when thrown mismatch reports a quoted retry turn id", async () => {
    vi.mocked(steerTurnService)
      .mockRejectedValueOnce(
        new Error("expected active turn id turn-1 but found `turn-9`"),
      )
      .mockResolvedValueOnce({
        result: { turnId: "turn-9" },
      } as Awaited<ReturnType<typeof steerTurnService>>);
    const setActiveTurnId = vi.fn();
    const options = createOptions({
      steerEnabled: true,
      threadStatusById: {
        "thread-1": {
          isProcessing: true,
          isReviewing: false,
          hasUnread: false,
          phase: "starting",
          processingStartedAt: 0,
          lastDurationMs: null,
        },
      },
      activeTurnIdByThread: {
        "thread-1": "turn-1",
      },
      setActiveTurnId,
    });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "steer drift", []);
    });

    expect(steerTurnService).toHaveBeenCalledTimes(2);
    expect(steerTurnService).toHaveBeenNthCalledWith(
      2,
      "ws-1",
      "thread-1",
      "turn-9",
      "steer drift",
      [],
      undefined,
      [],
    );
    expect(setActiveTurnId).toHaveBeenCalledWith("thread-1", "turn-9");
  });

  it("falls back to start when steer rpc mismatch does not provide a retry id", async () => {
    vi.mocked(steerTurnService).mockResolvedValueOnce({
      error: { message: "expected active turn id turn-1 but found ''" },
    } as Awaited<ReturnType<typeof steerTurnService>>);
    const options = createOptions({
      steerEnabled: true,
      threadStatusById: {
        "thread-1": {
          isProcessing: true,
          isReviewing: false,
          hasUnread: false,
          phase: "starting",
          processingStartedAt: 0,
          lastDurationMs: null,
        },
      },
      activeTurnIdByThread: {
        "thread-1": "turn-1",
      },
    });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "fallback", []);
    });

    expect(steerTurnService).toHaveBeenCalledTimes(1);
    expect(sendUserMessageService).toHaveBeenCalledTimes(1);
  });

  it("startReview reports thrown non-Error failures and resets review state", async () => {
    vi.mocked(startReviewService).mockRejectedValueOnce("review crashed");
    const markProcessing = vi.fn();
    const markReviewing = vi.fn();
    const pushThreadErrorMessage = vi.fn();
    const safeMessageActivity = vi.fn();
    const options = createOptions({
      markProcessing,
      markReviewing,
      pushThreadErrorMessage,
      safeMessageActivity,
    });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.startReview("/review branch:main");
    });

    expect(markProcessing).toHaveBeenCalledWith("thread-1", false);
    expect(markReviewing).toHaveBeenCalledWith("thread-1", false);
    expect(pushThreadErrorMessage).toHaveBeenCalledWith("thread-1", "review crashed");
    expect(safeMessageActivity).toHaveBeenCalled();
  });

  it("startMcp normalizes non-array data payloads to empty state", async () => {
    vi.mocked(listMcpServerStatusService).mockResolvedValueOnce({
      result: {
        data: { invalid: true },
      },
    } as Awaited<ReturnType<typeof listMcpServerStatusService>>);
    const dispatch = vi.fn();
    const { result } = renderHook(() => useThreadMessaging(createOptions({ dispatch })));

    await act(async () => {
      await result.current.startMcp("/mcp");
    });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "addAssistantMessage",
        text: expect.stringContaining("No MCP servers configured."),
      }),
    );
  });

  it("startApps parses fallback name/id and camelCase accessibility fields", async () => {
    vi.mocked(getAppsListService).mockResolvedValueOnce({
      result: {
        data: [
          {
            isAccessible: true,
            description: 42,
          },
        ],
      },
    } as Awaited<ReturnType<typeof getAppsListService>>);
    const dispatch = vi.fn();
    const { result } = renderHook(() => useThreadMessaging(createOptions({ dispatch })));

    await act(async () => {
      await result.current.startApps("/apps");
    });

    const payload = dispatch.mock.calls[0]?.[0] as { text?: string } | undefined;
    const text = payload?.text ?? "";
    expect(text).toContain("- unknown — connected");
  });

  it("handles turn/start Error throws and surfaces the error message", async () => {
    vi.mocked(sendUserMessageService).mockRejectedValueOnce(new Error("start failed hard"));
    const pushThreadErrorMessage = vi.fn();
    const options = createOptions({ pushThreadErrorMessage });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "boom", []);
    });

    expect(pushThreadErrorMessage).toHaveBeenCalledWith("thread-1", "start failed hard");
  });

  it("startApps handles direct data payload with connected app rows", async () => {
    vi.mocked(getAppsListService).mockResolvedValueOnce({
      data: [
        {
          id: "app-direct",
          isAccessible: true,
          description: "   ",
          installUrl: "https://apps.local/direct-install",
        },
      ],
    } as Awaited<ReturnType<typeof getAppsListService>>);
    const dispatch = vi.fn();
    const options = createOptions({ dispatch });
    const { result } = renderHook(() => useThreadMessaging(options));

    await act(async () => {
      await result.current.startApps("/apps");
    });

    const lastCall2 = dispatch.mock.calls[dispatch.mock.calls.length - 1];
    const text = (lastCall2?.[0] as { text?: string } | undefined)?.text ?? "";
    expect(text).toContain("- app-direct (app-direct) — connected");
    expect(text).not.toContain("install:");
  });

  it("ignores skill mentions when names or paths normalize to invalid values", async () => {
    const { result } = renderHook(() =>
      useThreadMessaging(
        createOptions({
          skills: [
            { name: "   ", path: "/Users/me/.codex/skills/blank/SKILL.md" },
            { name: "validSkill", path: "   " },
          ],
        }),
      ),
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        "thread-1",
        "run $validSkill now",
        [],
      );
    });

    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "run $validSkill now",
      expect.objectContaining({
        skillMentions: [],
      }),
    );
  });

  it("falls back to turn/start when steer mismatch reports null active turn id", async () => {
    vi.mocked(steerTurnService).mockRejectedValueOnce(
      new Error("expected active turn id turn-1 but found null"),
    );

    const { result } = renderHook(() =>
      useThreadMessaging(
        createOptions({
          steerEnabled: true,
          threadStatusById: {
            "thread-1": {
              isProcessing: true,
              isReviewing: false,
              hasUnread: false,
              phase: "streaming",
              processingStartedAt: 0,
              lastDurationMs: null,
            },
          },
          activeTurnIdByThread: {
            "thread-1": "turn-1",
          },
        }),
      ),
    );

    await act(async () => {
      await result.current.sendUserMessageToThread(workspace, "thread-1", "fallback", []);
    });

    expect(steerTurnService).toHaveBeenCalledTimes(1);
    expect(sendUserMessageService).toHaveBeenCalledTimes(1);
    expect(sendUserMessageService).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "fallback",
      expect.any(Object),
    );
  });

  it("startMcp falls back to generic message for non-Error failures", async () => {
    vi.mocked(listMcpServerStatusService).mockRejectedValueOnce("mcp exploded");
    const dispatch = vi.fn();
    const { result } = renderHook(() => useThreadMessaging(createOptions({ dispatch })));

    await act(async () => {
      await result.current.startMcp("/mcp");
    });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "addAssistantMessage",
        text: "MCP tools:\n- Failed to load MCP status.",
      }),
    );
  });

  it("startReview no-ops for whitespace input", async () => {
    const { result } = renderHook(() => useThreadMessaging(createOptions()));

    await act(async () => {
      await result.current.startReview("   ");
    });

    expect(reviewPromptMocks.openReviewPrompt).not.toHaveBeenCalled();
    expect(startReviewService).not.toHaveBeenCalled();
  });

  it("startMcp renders top-level payloads with auth object and resource_templates fallback", async () => {
    vi.mocked(listMcpServerStatusService).mockResolvedValueOnce({
      data: [
        {
          name: "serverB",
          auth_status: { status: "required" },
          tools: {
            mcp__serverB__beta: {},
            alpha: {},
          },
          resources: [{ id: "r1" }],
          resource_templates: [{ id: "t1" }, { id: "t2" }],
        },
      ],
    } as Awaited<ReturnType<typeof listMcpServerStatusService>>);
    const dispatch = vi.fn();
    const { result } = renderHook(() => useThreadMessaging(createOptions({ dispatch })));

    await act(async () => {
      await result.current.startMcp("/mcp");
    });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "addAssistantMessage",
        text: expect.stringContaining("- serverB (auth: required)"),
      }),
    );
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "addAssistantMessage",
        text: expect.stringContaining("tools: alpha, beta"),
      }),
    );
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "addAssistantMessage",
        text: expect.stringContaining("resources: 1, templates: 2"),
      }),
    );
  });

  it("startApps treats invalid payload as empty list and reports no-op state", async () => {
    vi.mocked(getAppsListService).mockResolvedValueOnce({
      result: {
        data: "not-an-array",
      },
    } as Awaited<ReturnType<typeof getAppsListService>>);
    const dispatch = vi.fn();
    const { result } = renderHook(() => useThreadMessaging(createOptions({ dispatch })));

    await act(async () => {
      await result.current.startApps("/apps");
    });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "addAssistantMessage",
        text: "Apps:\n- No apps available.",
      }),
    );
  });

  it("startApps renders top-level data payload and skips install link for accessible apps", async () => {
    vi.mocked(getAppsListService).mockResolvedValueOnce({
      data: [
        {
          id: "app-2",
          isAccessible: true,
          description: "   ",
        },
      ],
    } as Awaited<ReturnType<typeof getAppsListService>>);
    const dispatch = vi.fn();
    const { result } = renderHook(() => useThreadMessaging(createOptions({ dispatch })));

    await act(async () => {
      await result.current.startApps("/apps");
    });

    const action = dispatch.mock.calls[0]?.[0];
    expect(action).toEqual(
      expect.objectContaining({
        type: "addAssistantMessage",
      }),
    );
    expect(String(action?.text)).toContain("- app-2 (app-2) — connected");
    expect(String(action?.text)).not.toContain("install:");
  });

  it("startMcp tolerates invalid event payload rows and omits empty resource output", async () => {
    vi.mocked(listMcpServerStatusService).mockResolvedValueOnce({
      result: {
        data: [
          {
            name: null,
            auth_status: null,
            tools: "invalid-tools",
            resources: "invalid-resources",
            resource_templates: "invalid-templates",
          },
          {
            name: "zeta",
            auth_status: { status: "ok" },
            tools: { mcp__zeta__tool_b: {}, mcp__zeta__tool_a: {} },
            resources: [],
            resourceTemplates: [],
          },
        ],
      },
    } as Awaited<ReturnType<typeof listMcpServerStatusService>>);
    const dispatch = vi.fn();
    const { result } = renderHook(() => useThreadMessaging(createOptions({ dispatch })));

    await act(async () => {
      await result.current.startMcp("/mcp");
    });

    const payload = dispatch.mock.calls[0]?.[0] as { text?: string } | undefined;
    const text = payload?.text ?? "";
    expect(text).toContain("MCP tools:");
    expect(text).toContain("- unknown");
    expect(text).toContain("- zeta (auth: ok)");
    expect(text).toContain("tools: tool_a, tool_b");
    expect(text).toContain("tools: none");
    expect(text).not.toContain("resources: 0, templates: 0");
  });

  it("startApps sorts multiple invalid event rows and keeps no-output install section hidden", async () => {
    vi.mocked(getAppsListService).mockResolvedValueOnce({
      result: {
        data: [
          {
            id: "beta-id",
            name: "Beta",
            is_accessible: "false",
            description: "   ",
            install_url: 42,
          },
          {
            id: "alpha-id",
            name: "Alpha",
            is_accessible: false,
            description: "",
            install_url: "",
          },
        ],
      },
    } as Awaited<ReturnType<typeof getAppsListService>>);
    const dispatch = vi.fn();
    const { result } = renderHook(() => useThreadMessaging(createOptions({ dispatch })));

    await act(async () => {
      await result.current.startApps("/apps");
    });

    const payload = dispatch.mock.calls[0]?.[0] as { text?: string } | undefined;
    const text = payload?.text ?? "";
    expect(text).toContain("Apps:");
    expect(text.indexOf("- Alpha (alpha-id)")).toBeGreaterThan(-1);
    expect(text.indexOf("- Beta (beta-id)")).toBeGreaterThan(text.indexOf("- Alpha (alpha-id)"));
    expect(text).toContain("- Alpha (alpha-id) — can be installed");
    expect(text).toContain("- Beta (beta-id) — connected");
    expect(text).not.toContain("install:");
  });
});
