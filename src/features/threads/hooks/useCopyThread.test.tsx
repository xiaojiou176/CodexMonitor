// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";
import { buildThreadTranscript } from "../../../utils/threadText";
import { useCopyThread } from "./useCopyThread";

vi.mock("../../../utils/threadText", () => ({
  buildThreadTranscript: vi.fn(),
}));

const makeItems = (): ConversationItem[] => [
  {
    id: "msg-1",
    kind: "message",
    role: "assistant",
    text: "hello",
  },
];

describe("useCopyThread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    });
  });

  it("does nothing when there are no active items", async () => {
    const onDebug = vi.fn();
    const { result } = renderHook(() =>
      useCopyThread({ activeItems: [], onDebug }),
    );

    await act(async () => {
      await result.current.handleCopyThread();
    });

    expect(buildThreadTranscript).not.toHaveBeenCalled();
    expect(globalThis.navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(onDebug).not.toHaveBeenCalled();
  });

  it("copies transcript with default and compact/full handlers", async () => {
    vi.mocked(buildThreadTranscript).mockReturnValue("transcript body");
    const onDebug = vi.fn();
    const { result } = renderHook(() =>
      useCopyThread({ activeItems: makeItems(), onDebug }),
    );

    await act(async () => {
      await result.current.handleCopyThread();
      await result.current.handleCopyThreadCompact();
      await result.current.handleCopyThreadFull();
    });

    expect(buildThreadTranscript).toHaveBeenNthCalledWith(1, makeItems(), {
      toolOutputMode: "detailed",
    });
    expect(buildThreadTranscript).toHaveBeenNthCalledWith(2, makeItems(), {
      toolOutputMode: "compact",
    });
    expect(buildThreadTranscript).toHaveBeenNthCalledWith(3, makeItems(), {
      toolOutputMode: "detailed",
    });
    expect(globalThis.navigator.clipboard.writeText).toHaveBeenCalledTimes(3);
    expect(onDebug).not.toHaveBeenCalled();
  });

  it("records debug details when clipboard write fails", async () => {
    vi.mocked(buildThreadTranscript).mockReturnValue("transcript body");
    const onDebug = vi.fn();
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockRejectedValue(new Error("clipboard blocked")),
      },
      configurable: true,
    });

    const { result } = renderHook(() =>
      useCopyThread({ activeItems: makeItems(), onDebug }),
    );

    await act(async () => {
      await result.current.handleCopyThreadWithOptions({ toolOutputMode: "none" });
    });

    expect(buildThreadTranscript).toHaveBeenCalledWith(makeItems(), {
      toolOutputMode: "none",
    });
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "error",
        label: "thread/copy error",
        payload: "clipboard blocked",
      }),
    );
  });

  it("skips clipboard write when transcript is empty", async () => {
    vi.mocked(buildThreadTranscript).mockReturnValue("");
    const onDebug = vi.fn();
    const { result } = renderHook(() =>
      useCopyThread({ activeItems: makeItems(), onDebug }),
    );

    await act(async () => {
      await result.current.handleCopyThread();
    });

    expect(buildThreadTranscript).toHaveBeenCalledTimes(1);
    expect(globalThis.navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(onDebug).not.toHaveBeenCalled();
  });

  it("stringifies non-Error clipboard failures", async () => {
    vi.mocked(buildThreadTranscript).mockReturnValue("transcript body");
    const onDebug = vi.fn();
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockRejectedValue("permission denied"),
      },
      configurable: true,
    });

    const { result } = renderHook(() =>
      useCopyThread({ activeItems: makeItems(), onDebug }),
    );

    await act(async () => {
      await result.current.handleCopyThreadWithOptions({ toolOutputMode: "compact" });
    });

    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "thread/copy error",
        payload: "permission denied",
      }),
    );
  });
});
