// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STORAGE_KEY_CUSTOM_NAMES,
  STORAGE_KEY_DETACHED_REVIEW_LINKS,
  STORAGE_KEY_PINNED_THREADS,
  STORAGE_KEY_THREAD_CODEX_PARAMS,
  loadCustomNames,
  loadDetachedReviewLinks,
  loadPinnedThreads,
  loadThreadActivity,
  loadThreadCodexParams,
  makeCustomNameKey,
  makePinKey,
  makeThreadCodexParamsKey,
  saveCustomName,
  saveCustomNames,
  saveDetachedReviewLinks,
  savePinnedThreads,
  saveThreadActivity,
  saveThreadCodexParams,
} from "./threadStorage";
import {
  __resetLocalStorageWriteSchedulerForTests,
  flushScheduledLocalStorageWrites,
} from "../../../utils/localStorageWriteScheduler";

const THREAD_ACTIVITY_KEY = "codexmonitor.threadLastUserActivity";

describe("threadStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetLocalStorageWriteSchedulerForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    __resetLocalStorageWriteSchedulerForTests();
  });

  it("builds stable storage keys", () => {
    expect(makeThreadCodexParamsKey("ws", "thread")).toBe("ws:thread");
    expect(makeCustomNameKey("ws", "thread")).toBe("ws:thread");
    expect(makePinKey("ws", "thread")).toBe("ws:thread");
  });

  it("loads empty objects for missing/invalid storage values", () => {
    window.localStorage.setItem(STORAGE_KEY_THREAD_CODEX_PARAMS, "not-json");
    window.localStorage.setItem(STORAGE_KEY_PINNED_THREADS, "[]");
    window.localStorage.setItem(STORAGE_KEY_CUSTOM_NAMES, "null");
    window.localStorage.setItem(STORAGE_KEY_DETACHED_REVIEW_LINKS, "{\"ok\":1}");
    window.localStorage.setItem(THREAD_ACTIVITY_KEY, "{]");

    expect(loadThreadCodexParams()).toEqual({});
    expect(loadPinnedThreads()).toEqual([]);
    expect(loadCustomNames()).toEqual({});
    expect(loadThreadActivity()).toEqual({});
    expect(loadDetachedReviewLinks()).toEqual({ ok: 1 });
  });

  it("returns empty structures when storage keys are missing", () => {
    expect(loadThreadCodexParams()).toEqual({});
    expect(loadPinnedThreads()).toEqual({});
    expect(loadCustomNames()).toEqual({});
    expect(loadThreadActivity()).toEqual({});
    expect(loadDetachedReviewLinks()).toEqual({});
  });

  it("persists and reloads codex params, pinned threads and custom names", () => {
    const codexParams = {
      "ws:thread": {
        modelId: "gpt-5",
        effort: "high",
        accessMode: null,
        collaborationModeId: null,
        codexArgsOverride: undefined,
        updatedAt: 1,
      },
    };
    saveThreadCodexParams(codexParams);
    expect(loadThreadCodexParams()).toEqual(codexParams);

    const pinned = { "ws:thread": 123 };
    savePinnedThreads(pinned);
    expect(loadPinnedThreads()).toEqual(pinned);

    saveCustomName("ws", "thread", "renamed");
    expect(loadCustomNames()).toEqual({ "ws:thread": "renamed" });

    saveCustomNames({ "ws:thread-2": "second" });
    expect(loadCustomNames()).toEqual({ "ws:thread-2": "second" });
  });

  it("queues thread activity writes and flushes to localStorage", () => {
    saveThreadActivity({ ws: { thread: 100 } });
    expect(window.localStorage.getItem(THREAD_ACTIVITY_KEY)).toBeNull();

    flushScheduledLocalStorageWrites(THREAD_ACTIVITY_KEY);
    expect(window.localStorage.getItem(THREAD_ACTIVITY_KEY)).toBe(
      JSON.stringify({ ws: { thread: 100 } }),
    );
  });

  it("persists detached review links", () => {
    const links = { ws: { thread: "https://example.com/review" } };
    saveDetachedReviewLinks(links);
    expect(loadDetachedReviewLinks()).toEqual(links);
  });

  it("swallows localStorage write failures as best-effort persistence", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    expect(() => saveThreadCodexParams({})).not.toThrow();
    expect(() => saveCustomName("ws", "thread", "name")).not.toThrow();
    expect(() => saveCustomNames({})).not.toThrow();
    expect(() => savePinnedThreads({})).not.toThrow();
    expect(() => saveDetachedReviewLinks({})).not.toThrow();
    expect(() => saveThreadActivity({ ws: { thread: 1 } })).not.toThrow();
    flushScheduledLocalStorageWrites(THREAD_ACTIVITY_KEY);
    expect(setItemSpy).toHaveBeenCalled();
  });

  it("returns empty values when localStorage getItem throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage read blocked");
    });

    expect(loadThreadCodexParams()).toEqual({});
    expect(loadPinnedThreads()).toEqual({});
    expect(loadCustomNames()).toEqual({});
    expect(loadThreadActivity()).toEqual({});
    expect(loadDetachedReviewLinks()).toEqual({});
  });

  it("no-ops all load/save APIs when window is unavailable", () => {
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: undefined,
    });
    try {
      expect(loadThreadCodexParams()).toEqual({});
      expect(loadPinnedThreads()).toEqual({});
      expect(loadCustomNames()).toEqual({});
      expect(loadThreadActivity()).toEqual({});
      expect(loadDetachedReviewLinks()).toEqual({});
      expect(() => saveThreadCodexParams({})).not.toThrow();
      expect(() => savePinnedThreads({})).not.toThrow();
      expect(() => saveCustomNames({})).not.toThrow();
      expect(() => saveCustomName("ws", "thread", "name")).not.toThrow();
      expect(() => saveDetachedReviewLinks({})).not.toThrow();
      expect(() => saveThreadActivity({ ws: { thread: 1 } })).not.toThrow();
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });
});
