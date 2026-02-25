import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  isWorkspaceReorderDragging,
  setWorkspaceReorderDragging,
  subscribeWindowDragDrop,
} from "./dragDrop";

type DragDropCallback = (event: unknown) => void;

const flushMicrotaskQueue = () =>
  new Promise<void>((resolve) => {
    queueMicrotask(resolve);
  });

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(),
}));

describe("dragDrop service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setWorkspaceReorderDragging(false);
  });

  it("stores and returns workspace reorder dragging state", () => {
    expect(isWorkspaceReorderDragging()).toBe(false);
    setWorkspaceReorderDragging(true);
    expect(isWorkspaceReorderDragging()).toBe(true);
  });

  it("subscribes once and forwards drag-drop events to listeners", async () => {
    let callback: DragDropCallback = () => {};
    const unlisten = vi.fn();
    vi.mocked(getCurrentWindow).mockReturnValue({
      onDragDropEvent: vi.fn((listener: DragDropCallback) => {
        callback = listener;
        return Promise.resolve(unlisten);
      }),
    } as never);

    const first = vi.fn();
    const second = vi.fn(() => {
      throw new Error("listener failed");
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const cleanupFirst = subscribeWindowDragDrop(first);
    const cleanupSecond = subscribeWindowDragDrop(second);
    callback({
      payload: {
        type: "drop",
        position: { x: 10, y: 20 },
        paths: ["/tmp/a.txt"],
      },
    });

    expect(first).toHaveBeenCalledWith({
      payload: {
        type: "drop",
        position: { x: 10, y: 20 },
        paths: ["/tmp/a.txt"],
      },
    });
    expect(second).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      "[drag-drop] listener failed",
      expect.any(Error),
    );

    cleanupSecond();
    cleanupFirst();
    await flushMicrotaskQueue();
    expect(unlisten).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it("cleans up delayed listeners that resolve after unsubscribe", async () => {
    let resolveUnlisten: (value: any) => void = () => {};
    const unlisten = vi.fn();
    vi.mocked(getCurrentWindow).mockReturnValue({
      onDragDropEvent: vi.fn(
        () =>
          new Promise<(typeof unlisten)>((resolve) => {
            resolveUnlisten = resolve;
          }),
      ),
    } as never);

    const cleanup = subscribeWindowDragDrop(() => {});
    cleanup();

    resolveUnlisten(unlisten);
    await flushMicrotaskQueue();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it("reports startup errors when Tauri window listener setup throws", () => {
    const setupError = new Error("window bridge missing");
    vi.mocked(getCurrentWindow).mockImplementation(() => {
      throw setupError;
    });

    const onError = vi.fn();
    const cleanup = subscribeWindowDragDrop(() => {}, { onError });

    expect(onError).toHaveBeenCalledWith(setupError);
    cleanup();
  });

  it("reports async setup errors when listener promise rejects", async () => {
    const setupError = new Error("listen failed");
    vi.mocked(getCurrentWindow).mockReturnValue({
      onDragDropEvent: vi.fn(() => Promise.reject(setupError)),
    } as never);

    const onError = vi.fn();
    const cleanup = subscribeWindowDragDrop(() => {}, { onError });

    await flushMicrotaskQueue();
    await flushMicrotaskQueue();
    expect(onError).toHaveBeenCalledWith(setupError);
    cleanup();
  });
});
