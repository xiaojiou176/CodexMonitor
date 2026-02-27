/* @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDebugLog } from "./useDebugLog";

const { logWarnMock, writeTextMock } = vi.hoisted(() => ({
  logWarnMock: vi.fn(),
  writeTextMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../services/logger", () => ({
  logWarn: logWarnMock,
}));

describe("useDebugLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });
  });

  it("stores alert entries while closed and ignores non-alert entries", () => {
    const { result } = renderHook(() => useDebugLog());

    act(() => {
      result.current.addDebugEntry({
        id: "normal-1",
        timestamp: 1000,
        source: "client",
        label: "normal/info",
        payload: "ok",
      });
      result.current.addDebugEntry({
        id: "warn-1",
        timestamp: 2000,
        source: "stderr",
        label: "stderr/warn",
        payload: "x".repeat(3000),
      });
    });

    expect(result.current.debugEntries).toHaveLength(1);
    expect(result.current.debugEntries[0]?.id).toBe("warn-1");
    expect(result.current.hasDebugAlerts).toBe(true);
    expect(result.current.showDebugButton).toBe(true);
    expect(logWarnMock).toHaveBeenCalledWith("useDebugLog", "stderr/warn", {
      source: "stderr",
      payload: "x".repeat(2000),
    });
  });

  it("stores entries when opened, pins debug button, and clears alerts", () => {
    const { result } = renderHook(() => useDebugLog());

    act(() => {
      result.current.setDebugOpen(true);
      result.current.addDebugEntry({
        id: "normal-2",
        timestamp: 3000,
        source: "client",
        label: "normal/info",
        payload: "visible while open",
      });
      result.current.setDebugOpen((prev) => !prev);
      result.current.clearDebugEntries();
    });

    expect(result.current.debugOpen).toBe(false);
    expect(result.current.debugEntries).toEqual([]);
    expect(result.current.hasDebugAlerts).toBe(false);
    expect(result.current.showDebugButton).toBe(true);
  });

  it("copies readable payload text and strips ANSI escape sequences", async () => {
    const { result } = renderHook(() => useDebugLog());

    act(() => {
      result.current.setDebugOpen(true);
    });

    act(() => {
      result.current.addDebugEntry({
        id: "ansi-1",
        timestamp: 1700000000000,
        source: "server",
        label: "ansi/message",
        payload: "\\u001b[31mERROR\\u001b[0m happened",
      });
      result.current.addDebugEntry({
        id: "obj-1",
        timestamp: 1700000001000,
        source: "event",
        label: "object/message",
        payload: { count: 2 },
      });
    });

    await act(async () => {
      await result.current.handleCopyDebug();
    });

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    const copied = String(writeTextMock.mock.calls[0]?.[0] ?? "");
    expect(copied).toContain("SERVER");
    expect(copied).toContain("ansi/message");
    expect(copied).toContain("ERROR happened");
    expect(copied).not.toContain("\\u001b");
    expect(copied).toContain('"count": 2');
  });

  it("does not write clipboard when there is no debug text", async () => {
    const { result } = renderHook(() => useDebugLog());

    await act(async () => {
      await result.current.handleCopyDebug();
    });

    expect(writeTextMock).not.toHaveBeenCalled();
  });
});
