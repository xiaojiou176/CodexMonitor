/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { beforeEach } from "vitest";
import { describe, expect, it, vi } from "vitest";

import type { WorkspaceInfo } from "../../../types";
import { useAppMenuEvents } from "./useAppMenuEvents";

type MenuKey =
  | "newAgent"
  | "newWorktreeAgent"
  | "newCloneAgent"
  | "addWorkspace"
  | "addWorkspaceFromUrl"
  | "openSettings"
  | "nextAgent"
  | "prevAgent"
  | "nextWorkspace"
  | "prevWorkspace"
  | "openBranchSwitcher"
  | "toggleDebugPanel"
  | "toggleTerminal"
  | "toggleProjectsSidebar"
  | "toggleGitSidebar";

const eventsMock = vi.hoisted(() => {
  const handlers: Record<MenuKey, (() => void) | null> = {
    newAgent: null,
    newWorktreeAgent: null,
    newCloneAgent: null,
    addWorkspace: null,
    addWorkspaceFromUrl: null,
    openSettings: null,
    nextAgent: null,
    prevAgent: null,
    nextWorkspace: null,
    prevWorkspace: null,
    openBranchSwitcher: null,
    toggleDebugPanel: null,
    toggleTerminal: null,
    toggleProjectsSidebar: null,
    toggleGitSidebar: null,
  };

  const unlisteners: Record<MenuKey, ReturnType<typeof vi.fn>> = {
    newAgent: vi.fn(),
    newWorktreeAgent: vi.fn(),
    newCloneAgent: vi.fn(),
    addWorkspace: vi.fn(),
    addWorkspaceFromUrl: vi.fn(),
    openSettings: vi.fn(),
    nextAgent: vi.fn(),
    prevAgent: vi.fn(),
    nextWorkspace: vi.fn(),
    prevWorkspace: vi.fn(),
    openBranchSwitcher: vi.fn(),
    toggleDebugPanel: vi.fn(),
    toggleTerminal: vi.fn(),
    toggleProjectsSidebar: vi.fn(),
    toggleGitSidebar: vi.fn(),
  };

  const createSubscribe = (key: MenuKey) =>
    vi.fn((handler: () => void) => {
      handlers[key] = handler;
      return unlisteners[key];
    });

  const subscribes = {
    subscribeMenuNewAgent: createSubscribe("newAgent"),
    subscribeMenuNewWorktreeAgent: createSubscribe("newWorktreeAgent"),
    subscribeMenuNewCloneAgent: createSubscribe("newCloneAgent"),
    subscribeMenuAddWorkspace: createSubscribe("addWorkspace"),
    subscribeMenuAddWorkspaceFromUrl: createSubscribe("addWorkspaceFromUrl"),
    subscribeMenuOpenSettings: createSubscribe("openSettings"),
    subscribeMenuNextAgent: createSubscribe("nextAgent"),
    subscribeMenuPrevAgent: createSubscribe("prevAgent"),
    subscribeMenuNextWorkspace: createSubscribe("nextWorkspace"),
    subscribeMenuPrevWorkspace: createSubscribe("prevWorkspace"),
    subscribeMenuOpenBranchSwitcher: createSubscribe("openBranchSwitcher"),
    subscribeMenuToggleDebugPanel: createSubscribe("toggleDebugPanel"),
    subscribeMenuToggleTerminal: createSubscribe("toggleTerminal"),
    subscribeMenuToggleProjectsSidebar: createSubscribe("toggleProjectsSidebar"),
    subscribeMenuToggleGitSidebar: createSubscribe("toggleGitSidebar"),
  };

  const emit = (key: MenuKey) => {
    const handler = handlers[key];
    if (!handler) {
      throw new Error(`No handler registered for ${key}`);
    }
    handler();
  };

  const reset = () => {
    (Object.keys(handlers) as MenuKey[]).forEach((key) => {
      handlers[key] = null;
      unlisteners[key].mockClear();
    });
    Object.values(subscribes).forEach((subscribe) => {
      subscribe.mockClear();
    });
  };

  return {
    subscribes,
    unlisteners,
    emit,
    reset,
  };
});

vi.mock("../../../services/events", () => ({
  ...eventsMock.subscribes,
}));

const sampleWorkspace: WorkspaceInfo = {
  id: "ws-1",
  name: "Workspace 1",
  path: "/tmp/ws-1",
  connected: true,
  settings: {
    sidebarCollapsed: false,
    worktreeSetupScript: "",
  },
};

function createBaseParams(overrides: Partial<Parameters<typeof useAppMenuEvents>[0]> = {}) {
  return {
    activeWorkspaceRef: { current: sampleWorkspace },
    baseWorkspaceRef: { current: sampleWorkspace },
    onAddWorkspace: vi.fn(),
    onAddWorkspaceFromUrl: vi.fn(),
    onAddAgent: vi.fn(),
    onAddWorktreeAgent: vi.fn(),
    onAddCloneAgent: vi.fn(),
    onOpenSettings: vi.fn(),
    onCycleAgent: vi.fn(),
    onCycleWorkspace: vi.fn(),
    onOpenBranchSwitcher: vi.fn(),
    onToggleDebug: vi.fn(),
    onToggleTerminal: vi.fn(),
    sidebarCollapsed: false,
    rightPanelCollapsed: false,
    onExpandSidebar: vi.fn(),
    onCollapseSidebar: vi.fn(),
    onExpandRightPanel: vi.fn(),
    onCollapseRightPanel: vi.fn(),
    ...overrides,
  };
}

describe("useAppMenuEvents", () => {
  beforeEach(() => {
    eventsMock.reset();
  });

  it("registers all menu subscriptions and unbinds them on unmount", () => {
    const { unmount } = renderHook(() => useAppMenuEvents(createBaseParams()));

    Object.values(eventsMock.subscribes).forEach((subscribe) => {
      expect(subscribe).toHaveBeenCalledTimes(1);
    });

    unmount();

    Object.values(eventsMock.unlisteners).forEach((unlisten) => {
      expect(unlisten).toHaveBeenCalledTimes(1);
    });
  });

  it("routes menu events to matching handlers and directions", () => {
    const params = createBaseParams();
    renderHook(() => useAppMenuEvents(params));

    act(() => {
      eventsMock.emit("newAgent");
      eventsMock.emit("newWorktreeAgent");
      eventsMock.emit("newCloneAgent");
      eventsMock.emit("addWorkspace");
      eventsMock.emit("addWorkspaceFromUrl");
      eventsMock.emit("openSettings");
      eventsMock.emit("nextAgent");
      eventsMock.emit("prevAgent");
      eventsMock.emit("nextWorkspace");
      eventsMock.emit("prevWorkspace");
      eventsMock.emit("openBranchSwitcher");
      eventsMock.emit("toggleDebugPanel");
      eventsMock.emit("toggleTerminal");
    });

    expect(params.onAddAgent).toHaveBeenCalledWith(sampleWorkspace);
    expect(params.onAddWorktreeAgent).toHaveBeenCalledWith(sampleWorkspace);
    expect(params.onAddCloneAgent).toHaveBeenCalledWith(sampleWorkspace);
    expect(params.onAddWorkspace).toHaveBeenCalledTimes(1);
    expect(params.onAddWorkspaceFromUrl).toHaveBeenCalledTimes(1);
    expect(params.onOpenSettings).toHaveBeenCalledTimes(1);
    expect(params.onCycleAgent).toHaveBeenNthCalledWith(1, "next");
    expect(params.onCycleAgent).toHaveBeenNthCalledWith(2, "prev");
    expect(params.onCycleWorkspace).toHaveBeenNthCalledWith(1, "next");
    expect(params.onCycleWorkspace).toHaveBeenNthCalledWith(2, "prev");
    expect(params.onOpenBranchSwitcher).toHaveBeenCalledTimes(1);
    expect(params.onToggleDebug).toHaveBeenCalledTimes(1);
    expect(params.onToggleTerminal).toHaveBeenCalledTimes(1);
  });

  it("handles guard branches and latest collapsed-state toggles", () => {
    const params = createBaseParams({
      activeWorkspaceRef: { current: null },
      baseWorkspaceRef: { current: null },
      sidebarCollapsed: true,
      rightPanelCollapsed: true,
    });

    const { rerender } = renderHook(
      ({ p }: { p: ReturnType<typeof createBaseParams> }) => useAppMenuEvents(p),
      { initialProps: { p: params } },
    );

    act(() => {
      eventsMock.emit("newAgent");
      eventsMock.emit("newWorktreeAgent");
      eventsMock.emit("newCloneAgent");
      eventsMock.emit("toggleProjectsSidebar");
      eventsMock.emit("toggleGitSidebar");
    });

    expect(params.onAddAgent).not.toHaveBeenCalled();
    expect(params.onAddWorktreeAgent).not.toHaveBeenCalled();
    expect(params.onAddCloneAgent).not.toHaveBeenCalled();
    expect(params.onExpandSidebar).toHaveBeenCalledTimes(1);
    expect(params.onExpandRightPanel).toHaveBeenCalledTimes(1);

    const nextParams = {
      ...params,
      sidebarCollapsed: false,
      rightPanelCollapsed: false,
    };

    rerender({ p: nextParams });

    act(() => {
      eventsMock.emit("toggleProjectsSidebar");
      eventsMock.emit("toggleGitSidebar");
    });

    expect(params.onCollapseSidebar).toHaveBeenCalledTimes(1);
    expect(params.onCollapseRightPanel).toHaveBeenCalledTimes(1);
    Object.values(eventsMock.subscribes).forEach((subscribe) => {
      expect(subscribe).toHaveBeenCalledTimes(1);
    });
  });

  it("propagates handler exceptions for failure visibility", () => {
    renderHook(() =>
      useAppMenuEvents(
        createBaseParams({
          onAddWorkspace: () => {
            throw new Error("menu add workspace failed");
          },
        }),
      ),
    );

    expect(() => {
      act(() => {
        eventsMock.emit("addWorkspace");
      });
    }).toThrow("menu add workspace failed");
  });
});
