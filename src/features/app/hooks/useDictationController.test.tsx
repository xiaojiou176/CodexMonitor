// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings } from "../../../types";
import { useDictationController } from "./useDictationController";

const useDictationModelMock = vi.fn();
const useDictationMock = vi.fn();
const useHoldToDictateMock = vi.fn();
const requestDictationPermissionMock = vi.fn();

vi.mock("../../dictation/hooks/useDictationModel", () => ({
  useDictationModel: (modelId: string | null) => useDictationModelMock(modelId),
}));

vi.mock("../../dictation/hooks/useDictation", () => ({
  useDictation: () => useDictationMock(),
}));

vi.mock("../../dictation/hooks/useHoldToDictate", () => ({
  useHoldToDictate: (args: unknown) => useHoldToDictateMock(args),
}));

vi.mock("../../../services/tauri", () => ({
  requestDictationPermission: () => requestDictationPermissionMock(),
}));

function buildAppSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    dictationEnabled: true,
    dictationModelId: "model-a",
    dictationPreferredLanguage: "en-US",
    dictationHoldKey: "Space",
    ...overrides,
  } as AppSettings;
}

function buildDictationApi(overrides: Record<string, unknown> = {}) {
  return {
    state: "idle",
    level: 0,
    transcript: null,
    error: null,
    hint: null,
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    cancel: vi.fn(async () => undefined),
    clearTranscript: vi.fn(),
    clearError: vi.fn(),
    clearHint: vi.fn(),
    ...overrides,
  };
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useDictationController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestDictationPermissionMock.mockResolvedValue(true);
  });

  it("wires dictation state and lowercases hold key for hold-to-dictate", () => {
    const dictationApi = buildDictationApi({ state: "processing", level: 42 });
    const dictationModel = { status: { state: "ready" } };
    useDictationMock.mockReturnValue(dictationApi);
    useDictationModelMock.mockReturnValue(dictationModel);

    const { result } = renderHook(() => useDictationController(buildAppSettings()));

    expect(result.current.dictationState).toBe("processing");
    expect(result.current.dictationLevel).toBe(42);
    expect(result.current.dictationReady).toBe(true);
    expect(useHoldToDictateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        holdKey: "space",
        preferredLanguage: "en-US",
      }),
    );
  });

  it("toggles dictation state machine: start from idle and stop from listening", async () => {
    const startMock = vi.fn(async () => undefined);
    const stopMock = vi.fn(async () => undefined);
    const dictationApiRef = {
      current: buildDictationApi({ state: "idle", start: startMock, stop: stopMock }),
    };

    useDictationMock.mockImplementation(() => dictationApiRef.current);
    useDictationModelMock.mockReturnValue({ status: { state: "ready" } });

    const { result, rerender } = renderHook(() =>
      useDictationController(buildAppSettings({ dictationPreferredLanguage: "fr-FR" })),
    );

    await act(async () => {
      await result.current.handleToggleDictation();
    });
    expect(startMock).toHaveBeenCalledWith("fr-FR");
    expect(stopMock).not.toHaveBeenCalled();

    dictationApiRef.current = buildDictationApi({ state: "listening", start: startMock, stop: stopMock });
    rerender();

    await act(async () => {
      await result.current.handleToggleDictation();
    });
    expect(stopMock).toHaveBeenCalledTimes(1);
  });

  it("does not toggle when disabled or model is not ready", async () => {
    const startMock = vi.fn(async () => undefined);
    const stopMock = vi.fn(async () => undefined);
    useDictationMock.mockReturnValue(buildDictationApi({ start: startMock, stop: stopMock }));

    useDictationModelMock.mockReturnValue({ status: { state: "missing" } });
    const first = renderHook(() =>
      useDictationController(buildAppSettings({ dictationEnabled: true })),
    );
    await act(async () => {
      await first.result.current.handleToggleDictation();
    });

    first.unmount();
    useDictationModelMock.mockReturnValue({ status: { state: "ready" } });
    const second = renderHook(() =>
      useDictationController(buildAppSettings({ dictationEnabled: false })),
    );
    await act(async () => {
      await second.result.current.handleToggleDictation();
    });

    expect(startMock).not.toHaveBeenCalled();
    expect(stopMock).not.toHaveBeenCalled();
  });

  it("swallows toggle errors so UI action does not reject", async () => {
    const startMock = vi.fn(async () => {
      throw new Error("start failed");
    });
    useDictationMock.mockReturnValue(buildDictationApi({ state: "idle", start: startMock }));
    useDictationModelMock.mockReturnValue({ status: { state: "ready" } });

    const { result } = renderHook(() => useDictationController(buildAppSettings()));

    await expect(result.current.handleToggleDictation()).resolves.toBeUndefined();
    expect(startMock).toHaveBeenCalledTimes(1);
  });

  it("cancels with Escape only for listening/processing states", () => {
    const cancelMock = vi.fn(async () => undefined);
    const dictationApiRef = {
      current: buildDictationApi({ state: "idle", cancel: cancelMock }),
    };
    useDictationMock.mockImplementation(() => dictationApiRef.current);
    useDictationModelMock.mockReturnValue({ status: { state: "ready" } });

    const { rerender } = renderHook(() => useDictationController(buildAppSettings()));

    const idleEvent = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
    window.dispatchEvent(idleEvent);
    expect(cancelMock).not.toHaveBeenCalled();

    dictationApiRef.current = buildDictationApi({ state: "listening", cancel: cancelMock });
    rerender();
    const listeningEvent = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
    window.dispatchEvent(listeningEvent);

    expect(cancelMock).toHaveBeenCalledTimes(1);
    expect(listeningEvent.defaultPrevented).toBe(true);

    dictationApiRef.current = buildDictationApi({ state: "processing", cancel: cancelMock });
    rerender();
    const processingEvent = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
    window.dispatchEvent(processingEvent);

    expect(cancelMock).toHaveBeenCalledTimes(2);
    expect(processingEvent.defaultPrevented).toBe(true);
  });

  it("requests permission once when enabled and ready, and re-requests after readiness reset", async () => {
    const dictationModelRef = {
      current: { status: { state: "ready" } },
    };
    useDictationMock.mockReturnValue(buildDictationApi());
    useDictationModelMock.mockImplementation(() => dictationModelRef.current);

    const settings = buildAppSettings({ dictationEnabled: true });
    const { rerender } = renderHook(() => useDictationController(settings));

    await flushMicrotasks();
    expect(requestDictationPermissionMock).toHaveBeenCalledTimes(1);

    rerender();
    await flushMicrotasks();
    expect(requestDictationPermissionMock).toHaveBeenCalledTimes(1);

    dictationModelRef.current = { status: { state: "missing" } };
    rerender();
    await flushMicrotasks();

    dictationModelRef.current = { status: { state: "ready" } };
    rerender();
    await flushMicrotasks();

    expect(requestDictationPermissionMock).toHaveBeenCalledTimes(2);
  });

  it("does not request permission when disabled and ignores permission errors", async () => {
    useDictationMock.mockReturnValue(buildDictationApi());
    useDictationModelMock.mockReturnValue({ status: { state: "ready" } });
    requestDictationPermissionMock.mockRejectedValueOnce(new Error("permission denied"));

    const { rerender } = renderHook(() =>
      useDictationController(buildAppSettings({ dictationEnabled: true })),
    );

    await flushMicrotasks();
    expect(requestDictationPermissionMock).toHaveBeenCalledTimes(1);

    rerender(buildAppSettings({ dictationEnabled: false }));
    await flushMicrotasks();
    expect(requestDictationPermissionMock).toHaveBeenCalledTimes(1);
  });
});
