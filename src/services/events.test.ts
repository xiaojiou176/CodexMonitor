import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Event, EventCallback, UnlistenFn } from "@tauri-apps/api/event";
import { listen } from "@tauri-apps/api/event";
import type { AppServerEvent } from "../types";
import {
  subscribeAppServerEvents,
  subscribeMenuAddWorkspace,
  subscribeMenuAddWorkspaceFromUrl,
  subscribeMenuCycleCollaborationMode,
  subscribeMenuCycleModel,
  subscribeMenuCycleReasoning,
  subscribeMenuNewAgent,
  subscribeMenuNewCloneAgent,
  subscribeMenuNewWorktreeAgent,
  subscribeMenuNextAgent,
  subscribeMenuNextWorkspace,
  subscribeMenuOpenBranchSwitcher,
  subscribeMenuOpenSettings,
  subscribeMenuPrevAgent,
  subscribeMenuPrevWorkspace,
  subscribeMenuToggleDebugPanel,
  subscribeMenuToggleGitSidebar,
  subscribeMenuToggleProjectsSidebar,
  subscribeMenuToggleTerminal,
  subscribeTerminalExit,
  subscribeTerminalOutput,
  subscribeUpdaterCheck,
} from "./events";

const flushMicrotaskQueue = () =>
  new Promise<void>((resolve) => {
    queueMicrotask(resolve);
  });

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

describe("events subscriptions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("delivers payloads and unsubscribes on cleanup", async () => {
    let listener: EventCallback<AppServerEvent> = () => {};
    const unlisten = vi.fn();

    vi.mocked(listen).mockImplementation((_event, handler) => {
      listener = handler as EventCallback<AppServerEvent>;
      return Promise.resolve(unlisten);
    });

    const onEvent = vi.fn();
    const cleanup = subscribeAppServerEvents(onEvent);
    const payload: AppServerEvent = {
      workspace_id: "ws-1",
      message: { method: "ping" },
    };

    const event: Event<AppServerEvent> = {
      event: "app-server-event",
      id: 1,
      payload,
    };
    listener(event);
    expect(onEvent).toHaveBeenCalledWith(payload);

    cleanup();
    await flushMicrotaskQueue();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it("cleans up listeners that resolve after unsubscribe", async () => {
    let resolveListener: (handler: UnlistenFn) => void = () => {};
    const unlisten = vi.fn();

    vi.mocked(listen).mockImplementation(
      () =>
        new Promise<UnlistenFn>((resolve) => {
          resolveListener = resolve;
        }),
    );

    const cleanup = subscribeMenuNewAgent(() => {});
    cleanup();

    resolveListener(unlisten);
    await flushMicrotaskQueue();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it("delivers menu events to subscribers", async () => {
    let listener: EventCallback<void> = () => {};
    const unlisten = vi.fn();

    vi.mocked(listen).mockImplementation((_event, handler) => {
      listener = handler as EventCallback<void>;
      return Promise.resolve(unlisten);
    });

    const onEvent = vi.fn();
    const cleanup = subscribeMenuCycleModel(onEvent);

    const event: Event<void> = {
      event: "menu-composer-cycle-model",
      id: 1,
      payload: undefined,
    };
    listener(event);
    expect(onEvent).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it("delivers collaboration cycle menu events to subscribers", async () => {
    let listener: EventCallback<void> = () => {};
    const unlisten = vi.fn();

    vi.mocked(listen).mockImplementation((_event, handler) => {
      listener = handler as EventCallback<void>;
      return Promise.resolve(unlisten);
    });

    const onEvent = vi.fn();
    const cleanup = subscribeMenuCycleCollaborationMode(onEvent);

    const event: Event<void> = {
      event: "menu-composer-cycle-collaboration",
      id: 1,
      payload: undefined,
    };
    listener(event);
    expect(onEvent).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it("delivers branch switcher menu events to subscribers", async () => {
    let listener: EventCallback<void> = () => {};
    const unlisten = vi.fn();

    vi.mocked(listen).mockImplementation((_event, handler) => {
      listener = handler as EventCallback<void>;
      return Promise.resolve(unlisten);
    });

    const onEvent = vi.fn();
    const cleanup = subscribeMenuOpenBranchSwitcher(onEvent);

    const event: Event<void> = {
      event: "menu-open-branch-switcher",
      id: 1,
      payload: undefined,
    };
    listener(event);
    expect(onEvent).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it("delivers add-workspace-from-url menu events to subscribers", async () => {
    let listener: EventCallback<void> = () => {};
    const unlisten = vi.fn();

    vi.mocked(listen).mockImplementation((_event, handler) => {
      listener = handler as EventCallback<void>;
      return Promise.resolve(unlisten);
    });

    const onEvent = vi.fn();
    const cleanup = subscribeMenuAddWorkspaceFromUrl(onEvent);

    const event: Event<void> = {
      event: "menu-add-workspace-from-url",
      id: 1,
      payload: undefined,
    };
    listener(event);
    expect(onEvent).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it("reports listen errors through options", async () => {
    const error = new Error("nope");
    vi.mocked(listen).mockRejectedValueOnce(error);

    const onError = vi.fn();
    const cleanup = subscribeTerminalOutput(() => {}, { onError });

    await flushMicrotaskQueue();
    await flushMicrotaskQueue();
    expect(onError).toHaveBeenCalledWith(error);

    cleanup();
  });

  it("wires additional menu/terminal/updater hubs and forwards payloads", async () => {
    const subscriptions: Array<{
      eventName: string;
      subscribe: (listener: () => void) => () => void;
    }> = [
      { eventName: "menu-new-worktree-agent", subscribe: subscribeMenuNewWorktreeAgent },
      { eventName: "menu-new-clone-agent", subscribe: subscribeMenuNewCloneAgent },
      { eventName: "menu-add-workspace", subscribe: subscribeMenuAddWorkspace },
      { eventName: "menu-open-settings", subscribe: subscribeMenuOpenSettings },
      { eventName: "menu-toggle-projects-sidebar", subscribe: subscribeMenuToggleProjectsSidebar },
      { eventName: "menu-toggle-git-sidebar", subscribe: subscribeMenuToggleGitSidebar },
      { eventName: "menu-toggle-debug-panel", subscribe: subscribeMenuToggleDebugPanel },
      { eventName: "menu-toggle-terminal", subscribe: subscribeMenuToggleTerminal },
      { eventName: "menu-next-agent", subscribe: subscribeMenuNextAgent },
      { eventName: "menu-prev-agent", subscribe: subscribeMenuPrevAgent },
      { eventName: "menu-next-workspace", subscribe: subscribeMenuNextWorkspace },
      { eventName: "menu-prev-workspace", subscribe: subscribeMenuPrevWorkspace },
      { eventName: "menu-composer-cycle-reasoning", subscribe: subscribeMenuCycleReasoning },
      { eventName: "updater-check", subscribe: subscribeUpdaterCheck },
    ];

    for (const entry of subscriptions) {
      let listener: EventCallback<void> = () => {};
      const unlisten = vi.fn();
      vi.mocked(listen).mockImplementationOnce((event, handler) => {
        expect(event).toBe(entry.eventName);
        listener = handler as EventCallback<void>;
        return Promise.resolve(unlisten);
      });

      const onEvent = vi.fn();
      const cleanup = entry.subscribe(onEvent);
      listener({ event: entry.eventName, id: 1, payload: undefined });
      expect(onEvent).toHaveBeenCalledTimes(1);
      cleanup();
      await flushMicrotaskQueue();
      expect(unlisten).toHaveBeenCalledTimes(1);
    }
  });

  it("delivers terminal exit payloads", async () => {
    let listener: EventCallback<{ workspaceId: string; terminalId: string }> = () => {};
    const unlisten = vi.fn();

    vi.mocked(listen).mockImplementation((_event, handler) => {
      listener = handler as EventCallback<{ workspaceId: string; terminalId: string }>;
      return Promise.resolve(unlisten);
    });

    const onEvent = vi.fn();
    const cleanup = subscribeTerminalExit(onEvent);

    listener({
      event: "terminal-exit",
      id: 1,
      payload: { workspaceId: "ws-1", terminalId: "term-1" },
    });
    expect(onEvent).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      terminalId: "term-1",
    });

    cleanup();
  });
});
