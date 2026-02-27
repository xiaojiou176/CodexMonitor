// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QueuedMessage, WorkspaceInfo } from "../../../types";
import { useComposerImages } from "../../composer/hooks/useComposerImages";
import { useQueuedSend } from "../../threads/hooks/useQueuedSend";
import { useComposerController } from "./useComposerController";

vi.mock("../../composer/hooks/useComposerImages", () => ({
  useComposerImages: vi.fn(),
}));

vi.mock("../../threads/hooks/useQueuedSend", () => ({
  useQueuedSend: vi.fn(),
}));

const workspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "Workspace 1",
  path: "/tmp/workspace-1",
  connected: true,
  settings: { sidebarCollapsed: false },
};

function createQueuedMessage(overrides: Partial<QueuedMessage> = {}): QueuedMessage {
  return {
    id: "queued-1",
    text: "hello",
    createdAt: 1700000000000,
    images: ["/tmp/a.png"],
    ...overrides,
  };
}

function createComposerImagesApi() {
  return {
    activeImages: ["/tmp/current.png"],
    attachImages: vi.fn(),
    pickImages: vi.fn(),
    removeImage: vi.fn(),
    clearActiveImages: vi.fn(),
    setImagesForThread: vi.fn(),
    removeImagesForThread: vi.fn(),
  };
}

function createQueuedSendApi() {
  return {
    activeQueue: [createQueuedMessage()],
    legacyQueueMessageCount: 2,
    queueHealthEntries: [{ threadId: "thread-1", queueLength: 1, inFlight: false, blockedReason: null, lastFailureReason: null }],
    handleSend: vi.fn(),
    queueMessage: vi.fn(),
    queueMessageForThread: vi.fn(),
    removeQueuedMessage: vi.fn(),
    steerQueuedMessage: vi.fn().mockResolvedValue(true),
    retryThreadQueue: vi.fn(),
    migrateLegacyQueueWorkspaceIds: vi.fn(),
  };
}

function makeProps(
  overrides: Partial<Parameters<typeof useComposerController>[0]> = {},
): Parameters<typeof useComposerController>[0] {
  return {
    activeThreadId: "thread-1",
    activeTurnId: null,
    activeWorkspaceId: workspace.id,
    activeWorkspace: workspace,
    isProcessing: false,
    isReviewing: false,
    threadStatusById: {},
    threadWorkspaceById: {},
    itemsByThread: {},
    workspacesById: new Map([[workspace.id, workspace]]),
    steerEnabled: true,
    appsEnabled: true,
    activeModel: null,
    activeEffort: null,
    activeCollaborationMode: null,
    connectWorkspace: vi.fn(),
    startThreadForWorkspace: vi.fn(),
    sendUserMessage: vi.fn(),
    sendUserMessageToThread: vi.fn(),
    startFork: vi.fn(),
    startReview: vi.fn(),
    startResume: vi.fn(),
    startCompact: vi.fn(),
    startApps: vi.fn(),
    startMcp: vi.fn(),
    startStatus: vi.fn(),
    getWorkspaceLastAliveAt: vi.fn(),
    onRecoverStaleThread: vi.fn(),
    ...overrides,
  };
}

describe("useComposerController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useComposerImages).mockReturnValue(createComposerImagesApi());
    vi.mocked(useQueuedSend).mockReturnValue(createQueuedSendApi());
  });

  it("manages draft, prefill and insert state for active thread", () => {
    const { result } = renderHook(() => useComposerController(makeProps()));

    expect(result.current.activeDraft).toBe("");

    act(() => {
      result.current.handleDraftChange("draft value");
    });
    expect(result.current.activeDraft).toBe("draft value");

    const insertMessage = createQueuedMessage({ id: "insert-1", text: "insert" });
    act(() => {
      result.current.setComposerInsert(insertMessage);
    });
    expect(result.current.composerInsert).toEqual(insertMessage);

    const prefillMessage = createQueuedMessage({ id: "prefill-1", text: "prefill" });
    act(() => {
      result.current.setPrefillDraft(prefillMessage);
    });
    expect(result.current.prefillDraft).toEqual(prefillMessage);

    act(() => {
      result.current.clearDraftForThread("unknown-thread");
    });
    expect(result.current.activeDraft).toBe("draft value");

    act(() => {
      result.current.clearDraftForThread("thread-1");
    });
    expect(result.current.activeDraft).toBe("");
  });

  it("ignores draft updates when no active thread exists", () => {
    const { result } = renderHook(() =>
      useComposerController(
        makeProps({
          activeThreadId: null,
        }),
      ),
    );

    act(() => {
      result.current.handleDraftChange("should-not-apply");
    });

    expect(result.current.activeDraft).toBe("");
  });

  it("sends prompt only when input has non-whitespace content", () => {
    const queuedApi = createQueuedSendApi();
    vi.mocked(useQueuedSend).mockReturnValue(queuedApi);

    const { result } = renderHook(() => useComposerController(makeProps()));

    act(() => {
      result.current.handleSendPrompt("   ");
      result.current.handleSendPrompt("ship it");
    });

    expect(queuedApi.handleSend).toHaveBeenCalledTimes(1);
    expect(queuedApi.handleSend).toHaveBeenCalledWith("ship it", []);
  });

  it("edits queued message by removing it and prefilling draft/images", () => {
    const imagesApi = createComposerImagesApi();
    const queuedApi = createQueuedSendApi();
    vi.mocked(useComposerImages).mockReturnValue(imagesApi);
    vi.mocked(useQueuedSend).mockReturnValue(queuedApi);

    const { result } = renderHook(() => useComposerController(makeProps()));
    const item = createQueuedMessage({ id: "queued-edit", images: ["/tmp/reuse.png"] });

    act(() => {
      result.current.handleEditQueued(item);
    });

    expect(queuedApi.removeQueuedMessage).toHaveBeenCalledWith("thread-1", "queued-edit");
    expect(imagesApi.setImagesForThread).toHaveBeenCalledWith("thread-1", ["/tmp/reuse.png"]);
    expect(result.current.prefillDraft).toEqual(item);
  });

  it("skips edit and delete queued actions when active thread is missing", () => {
    const imagesApi = createComposerImagesApi();
    const queuedApi = createQueuedSendApi();
    vi.mocked(useComposerImages).mockReturnValue(imagesApi);
    vi.mocked(useQueuedSend).mockReturnValue(queuedApi);

    const { result } = renderHook(() =>
      useComposerController(
        makeProps({
          activeThreadId: null,
        }),
      ),
    );

    act(() => {
      result.current.handleEditQueued(createQueuedMessage({ id: "queued-missing" }));
      result.current.handleDeleteQueued("queued-missing");
    });

    expect(queuedApi.removeQueuedMessage).not.toHaveBeenCalled();
    expect(imagesApi.setImagesForThread).not.toHaveBeenCalled();
    expect(result.current.prefillDraft).toBe(null);
  });

  it("deletes queued message from the active thread", () => {
    const queuedApi = createQueuedSendApi();
    vi.mocked(useQueuedSend).mockReturnValue(queuedApi);

    const { result } = renderHook(() => useComposerController(makeProps()));

    act(() => {
      result.current.handleDeleteQueued("queued-2");
    });

    expect(queuedApi.removeQueuedMessage).toHaveBeenCalledWith("thread-1", "queued-2");
  });

  it("returns steer result for active thread and false without active thread", async () => {
    const queuedApi = createQueuedSendApi();
    queuedApi.steerQueuedMessage.mockResolvedValueOnce(true);
    vi.mocked(useQueuedSend).mockReturnValue(queuedApi);

    const { result } = renderHook(() => useComposerController(makeProps()));
    await expect(result.current.handleSteerQueued("queued-1")).resolves.toBe(true);
    expect(queuedApi.steerQueuedMessage).toHaveBeenCalledWith("thread-1", "queued-1");

    const noThread = renderHook(() =>
      useComposerController(
        makeProps({
          activeThreadId: null,
        }),
      ),
    );
    await expect(noThread.result.current.handleSteerQueued("queued-1")).resolves.toBe(false);
  });

  it("exposes delegated queue/image operations and retry alias", () => {
    const imagesApi = createComposerImagesApi();
    const queuedApi = createQueuedSendApi();
    vi.mocked(useComposerImages).mockReturnValue(imagesApi);
    vi.mocked(useQueuedSend).mockReturnValue(queuedApi);

    const { result } = renderHook(() => useComposerController(makeProps()));

    expect(result.current.activeImages).toBe(imagesApi.activeImages);
    expect(result.current.activeQueue).toBe(queuedApi.activeQueue);
    expect(result.current.queueHealthEntries).toBe(queuedApi.queueHealthEntries);
    expect(result.current.attachImages).toBe(imagesApi.attachImages);
    expect(result.current.pickImages).toBe(imagesApi.pickImages);
    expect(result.current.removeImage).toBe(imagesApi.removeImage);
    expect(result.current.clearActiveImages).toBe(imagesApi.clearActiveImages);
    expect(result.current.setImagesForThread).toBe(imagesApi.setImagesForThread);
    expect(result.current.removeImagesForThread).toBe(imagesApi.removeImagesForThread);
    expect(result.current.handleSend).toBe(queuedApi.handleSend);
    expect(result.current.queueMessage).toBe(queuedApi.queueMessage);
    expect(result.current.queueMessageForThread).toBe(queuedApi.queueMessageForThread);
    expect(result.current.removeQueuedMessage).toBe(queuedApi.removeQueuedMessage);
    expect(result.current.retryQueuedThread).toBe(queuedApi.retryThreadQueue);
    expect(result.current.migrateLegacyQueueWorkspaceIds).toBe(queuedApi.migrateLegacyQueueWorkspaceIds);
  });
});
