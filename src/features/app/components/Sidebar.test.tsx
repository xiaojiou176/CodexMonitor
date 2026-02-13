// @vitest-environment jsdom
import { cleanup, createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { Sidebar } from "./Sidebar";

afterEach(() => {
  if (vi.isFakeTimers()) {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  }
  window.localStorage.clear();
  cleanup();
});

const baseProps = {
  workspaces: [],
  groupedWorkspaces: [],
  hasWorkspaceGroups: false,
  deletingWorktreeIds: new Set<string>(),
  threadsByWorkspace: {},
  threadParentById: {},
  threadStatusById: {},
  threadListLoadingByWorkspace: {},
  threadListPagingByWorkspace: {},
  threadListCursorByWorkspace: {},
  threadListSortKey: "updated_at" as const,
  onSetThreadListSortKey: vi.fn(),
  onRefreshAllThreads: vi.fn(),
  activeWorkspaceId: null,
  activeThreadId: null,
  accountInfo: null,
  onSwitchAccount: vi.fn(),
  onCancelSwitchAccount: vi.fn(),
  accountSwitching: false,
  onOpenSettings: vi.fn(),
  onOpenDebug: vi.fn(),
  showDebugButton: false,
  onAddWorkspace: vi.fn(),
  onSelectHome: vi.fn(),
  onSelectWorkspace: vi.fn(),
  onConnectWorkspace: vi.fn(),
  onAddAgent: vi.fn(),
  onAddWorktreeAgent: vi.fn(),
  onAddCloneAgent: vi.fn(),
  onToggleWorkspaceCollapse: vi.fn(),
  onSelectThread: vi.fn(),
  onDeleteThread: vi.fn(),
  pinThread: vi.fn(() => false),
  unpinThread: vi.fn(),
  isThreadPinned: vi.fn(() => false),
  getPinTimestamp: vi.fn(() => null),
  onRenameThread: vi.fn(),
  onDeleteWorkspace: vi.fn(),
  onDeleteWorktree: vi.fn(),
  onLoadOlderThreads: vi.fn(),
  onReloadWorkspaceThreads: vi.fn(),
  workspaceDropTargetRef: createRef<HTMLElement>(),
  isWorkspaceDropActive: false,
  workspaceDropText: "将项目拖放到此处",
  onWorkspaceDragOver: vi.fn(),
  onWorkspaceDragEnter: vi.fn(),
  onWorkspaceDragLeave: vi.fn(),
  onWorkspaceDrop: vi.fn(),
};

describe("Sidebar", () => {
  it("toggles the search bar from the header icon", () => {
    vi.useFakeTimers();
    render(<Sidebar {...baseProps} />);

    const toggleButton = screen.getByRole("button", { name: "切换搜索" });
    expect(screen.queryByLabelText("搜索项目")).toBeNull();

    act(() => {
      fireEvent.click(toggleButton);
    });
    const input = screen.getByLabelText("搜索项目") as HTMLInputElement;
    expect(input).toBeTruthy();

    act(() => {
      fireEvent.change(input, { target: { value: "alpha" } });
      vi.runOnlyPendingTimers();
    });
    expect(input.value).toBe("alpha");

    act(() => {
      fireEvent.click(toggleButton);
      vi.runOnlyPendingTimers();
    });
    expect(screen.queryByLabelText("搜索项目")).toBeNull();

    act(() => {
      fireEvent.click(toggleButton);
      vi.runOnlyPendingTimers();
    });
    const reopened = screen.getByLabelText("搜索项目") as HTMLInputElement;
    expect(reopened.value).toBe("");
  });

  it("opens thread sort menu from the header filter button", () => {
    const onSetThreadListSortKey = vi.fn();
    render(
      <Sidebar
        {...baseProps}
        threadListSortKey="updated_at"
        onSetThreadListSortKey={onSetThreadListSortKey}
      />,
    );

    const button = screen.getByRole("button", { name: "排序对话" });
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(button);
    const option = screen.getByRole("menuitemradio", { name: "最新创建" });
    fireEvent.click(option);

    expect(onSetThreadListSortKey).toHaveBeenCalledWith("created_at");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("refreshes all workspace threads from the header button", () => {
    const onRefreshAllThreads = vi.fn();
    render(
      <Sidebar
        {...baseProps}
        workspaces={[
          {
            id: "ws-1",
            name: "Workspace",
            path: "/tmp/workspace",
            connected: true,
            settings: { sidebarCollapsed: false },
          },
        ]}
        groupedWorkspaces={[
          {
            id: null,
            name: "Workspaces",
            workspaces: [
              {
                id: "ws-1",
                name: "Workspace",
                path: "/tmp/workspace",
                connected: true,
                settings: { sidebarCollapsed: false },
              },
            ],
          },
        ]}
        onRefreshAllThreads={onRefreshAllThreads}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "刷新全部工作区对话" }));
    expect(onRefreshAllThreads).toHaveBeenCalledTimes(1);
  });

  it("spins the refresh icon while workspace threads are refreshing", () => {
    render(
      <Sidebar
        {...baseProps}
        workspaces={[
          {
            id: "ws-1",
            name: "Workspace",
            path: "/tmp/workspace",
            connected: true,
            settings: { sidebarCollapsed: false },
          },
        ]}
        groupedWorkspaces={[
          {
            id: null,
            name: "Workspaces",
            workspaces: [
              {
                id: "ws-1",
                name: "Workspace",
                path: "/tmp/workspace",
                connected: true,
                settings: { sidebarCollapsed: false },
              },
            ],
          },
        ]}
        threadListLoadingByWorkspace={{ "ws-1": true }}
      />,
    );

    const refreshButton = screen.getByRole("button", { name: "刷新全部工作区对话" });
    expect(refreshButton.getAttribute("aria-busy")).toBe("true");
    const icon = refreshButton.querySelector("svg");
    expect(icon?.getAttribute("class") ?? "").toContain("spinning");
  });

  it("shows a top New Agent draft row and selects workspace when clicked", () => {
    const onSelectWorkspace = vi.fn();
    const props = {
      ...baseProps,
      workspaces: [
        {
          id: "ws-1",
          name: "Workspace",
          path: "/tmp/workspace",
          connected: true,
          settings: { sidebarCollapsed: false },
        },
      ],
      groupedWorkspaces: [
        {
          id: null,
          name: "Workspaces",
          workspaces: [
            {
              id: "ws-1",
              name: "Workspace",
              path: "/tmp/workspace",
              connected: true,
              settings: { sidebarCollapsed: false },
            },
          ],
        },
      ],
      newAgentDraftWorkspaceId: "ws-1",
      activeWorkspaceId: "ws-1",
      activeThreadId: null,
      onSelectWorkspace,
    };

    render(<Sidebar {...props} />);

    const draftRow = screen.getByRole("button", { name: /新建对话/i });
    expect(draftRow).toBeTruthy();
    expect(draftRow.className).toContain("thread-row-draft");
    expect(draftRow.className).toContain("active");

    fireEvent.click(draftRow);
    expect(onSelectWorkspace).toHaveBeenCalledWith("ws-1");
  });

  it("supports dragging thread rows after target in lower half", async () => {
    const workspace = {
      id: "ws-1",
      name: "Workspace",
      path: "/tmp/workspace",
      connected: true,
      settings: { sidebarCollapsed: false },
    };

    const { container } = render(
      <Sidebar
        {...baseProps}
        workspaces={[workspace]}
        groupedWorkspaces={[
          {
            id: null,
            name: "Workspaces",
            workspaces: [workspace],
          },
        ]}
        threadsByWorkspace={{
          "ws-1": [
            { id: "thread-1", name: "Alpha", updatedAt: 1000 },
            { id: "thread-2", name: "Beta", updatedAt: 900 },
          ],
        }}
      />,
    );

    const alphaRow = screen.getByText("Alpha").closest(".thread-row");
    const betaRow = screen.getByText("Beta").closest(".thread-row");
    expect(alphaRow?.getAttribute("draggable")).toBe("true");
    expect(betaRow?.getAttribute("draggable")).toBe("true");

    if (!alphaRow || !betaRow) {
      throw new Error("Missing thread rows for drag test");
    }

    vi.spyOn(betaRow, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 100,
      top: 100,
      left: 0,
      right: 240,
      bottom: 140,
      width: 240,
      height: 40,
      toJSON: () => ({}),
    });

    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      setData: vi.fn(),
      getData: vi.fn(),
    } as unknown as DataTransfer;

    fireEvent.dragStart(alphaRow, { dataTransfer });

    const dragOverEvent = createEvent.dragOver(betaRow, { dataTransfer });
    Object.defineProperty(dragOverEvent, "clientY", { value: 135 });
    fireEvent(betaRow, dragOverEvent);

    const dropEvent = createEvent.drop(betaRow, { dataTransfer });
    Object.defineProperty(dropEvent, "clientY", { value: 135 });
    fireEvent(betaRow, dropEvent);

    await waitFor(() => {
      const threadNames = Array.from(
        container.querySelectorAll(".thread-row .thread-name"),
      ).map((node) => node.textContent?.trim());
      expect(threadNames.slice(0, 2)).toEqual(["Beta", "Alpha"]);
    });

    const stored = window.localStorage.getItem("codexmonitor.threadOrderByWorkspace");
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored ?? "{}")).toEqual({
      "ws-1": ["thread-2", "thread-1"],
    });
  });

  it("supports dragging thread rows before target in upper half", async () => {
    const workspace = {
      id: "ws-1",
      name: "Workspace",
      path: "/tmp/workspace",
      connected: true,
      settings: { sidebarCollapsed: false },
    };

    const { container } = render(
      <Sidebar
        {...baseProps}
        workspaces={[workspace]}
        groupedWorkspaces={[
          {
            id: null,
            name: "Workspaces",
            workspaces: [workspace],
          },
        ]}
        threadsByWorkspace={{
          "ws-1": [
            { id: "thread-1", name: "Alpha", updatedAt: 1000 },
            { id: "thread-2", name: "Beta", updatedAt: 900 },
          ],
        }}
      />,
    );

    const alphaRow = screen.getByText("Alpha").closest(".thread-row");
    const betaRow = screen.getByText("Beta").closest(".thread-row");
    if (!alphaRow || !betaRow) {
      throw new Error("Missing thread rows for drag test");
    }

    vi.spyOn(alphaRow, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 100,
      top: 100,
      left: 0,
      right: 240,
      bottom: 140,
      width: 240,
      height: 40,
      toJSON: () => ({}),
    });

    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      setData: vi.fn(),
      getData: vi.fn(),
    } as unknown as DataTransfer;

    fireEvent.dragStart(betaRow, { dataTransfer });

    const dragOverEvent = createEvent.dragOver(alphaRow, { dataTransfer });
    Object.defineProperty(dragOverEvent, "clientY", { value: 105 });
    fireEvent(alphaRow, dragOverEvent);

    const dropEvent = createEvent.drop(alphaRow, { dataTransfer });
    Object.defineProperty(dropEvent, "clientY", { value: 105 });
    fireEvent(alphaRow, dropEvent);

    await waitFor(() => {
      const threadNames = Array.from(
        container.querySelectorAll(".thread-row .thread-name"),
      ).map((node) => node.textContent?.trim());
      expect(threadNames.slice(0, 2)).toEqual(["Beta", "Alpha"]);
    });

    const stored = window.localStorage.getItem("codexmonitor.threadOrderByWorkspace");
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored ?? "{}")).toEqual({
      "ws-1": ["thread-2", "thread-1"],
    });
  });

  it("keeps New Agent draft row visible when only starting state remains", () => {
    render(
      <Sidebar
        {...baseProps}
        workspaces={[
          {
            id: "ws-1",
            name: "Workspace",
            path: "/tmp/workspace",
            connected: true,
            settings: { sidebarCollapsed: false },
          },
        ]}
        groupedWorkspaces={[
          {
            id: null,
            name: "Workspaces",
            workspaces: [
              {
                id: "ws-1",
                name: "Workspace",
                path: "/tmp/workspace",
                connected: true,
                settings: { sidebarCollapsed: false },
              },
            ],
          },
        ]}
        newAgentDraftWorkspaceId={null}
        startingDraftThreadWorkspaceId="ws-1"
        activeWorkspaceId="ws-2"
        activeThreadId="thread-existing"
      />,
    );

    const draftRow = screen.getByRole("button", { name: /新建对话/i });
    expect(draftRow).toBeTruthy();
    expect(draftRow.className).toContain("thread-row-draft");
  });

  it("supports dragging workspace rows after target in lower half", async () => {
    const workspaceA = {
      id: "ws-1",
      name: "Alpha Repo",
      path: "/tmp/alpha",
      connected: true,
      settings: { sidebarCollapsed: false },
    };
    const workspaceB = {
      id: "ws-2",
      name: "Beta Repo",
      path: "/tmp/beta",
      connected: true,
      settings: { sidebarCollapsed: false },
    };
    const onReorderWorkspaceGroup = vi.fn().mockResolvedValue(undefined);

    const { container } = render(
      <Sidebar
        {...baseProps}
        onReorderWorkspaceGroup={onReorderWorkspaceGroup}
        workspaces={[workspaceA, workspaceB]}
        groupedWorkspaces={[
          {
            id: null,
            name: "Workspaces",
            workspaces: [workspaceA, workspaceB],
          },
        ]}
      />,
    );

    const alphaRow = screen.getByText("Alpha Repo").closest(".workspace-row");
    const betaRow = screen.getByText("Beta Repo").closest(".workspace-row");
    expect(alphaRow?.getAttribute("draggable")).toBe("true");
    expect(betaRow?.getAttribute("draggable")).toBe("true");

    if (!alphaRow || !betaRow) {
      throw new Error("Missing workspace rows for drag test");
    }

    vi.spyOn(betaRow, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 200,
      top: 200,
      left: 0,
      right: 280,
      bottom: 248,
      width: 280,
      height: 48,
      toJSON: () => ({}),
    });

    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      setData: vi.fn(),
      getData: vi.fn(),
    } as unknown as DataTransfer;

    fireEvent.dragStart(alphaRow, { dataTransfer });

    const dragOverEvent = createEvent.dragOver(betaRow, { dataTransfer });
    Object.defineProperty(dragOverEvent, "clientY", { value: 245 });
    fireEvent(betaRow, dragOverEvent);

    const dropEvent = createEvent.drop(betaRow, { dataTransfer });
    Object.defineProperty(dropEvent, "clientY", { value: 245 });
    fireEvent(betaRow, dropEvent);

    await waitFor(() => {
      const workspaceNames = Array.from(
        container.querySelectorAll(".workspace-row .workspace-name"),
      ).map((node) => node.textContent?.trim());
      expect(workspaceNames.slice(0, 2)).toEqual(["Beta Repo", "Alpha Repo"]);
    });

    const stored = window.localStorage.getItem("codexmonitor.workspaceOrderByGroup");
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored ?? "{}")).toEqual({
      __ungrouped_workspace_group__: ["ws-2", "ws-1"],
    });
    expect(onReorderWorkspaceGroup).toHaveBeenCalledWith(null, ["ws-2", "ws-1"]);
  });

  it("supports dragging workspace rows before target in upper half", async () => {
    const workspaceA = {
      id: "ws-1",
      name: "Alpha Repo",
      path: "/tmp/alpha",
      connected: true,
      settings: { sidebarCollapsed: false },
    };
    const workspaceB = {
      id: "ws-2",
      name: "Beta Repo",
      path: "/tmp/beta",
      connected: true,
      settings: { sidebarCollapsed: false },
    };

    const { container } = render(
      <Sidebar
        {...baseProps}
        workspaces={[workspaceA, workspaceB]}
        groupedWorkspaces={[
          {
            id: null,
            name: "Workspaces",
            workspaces: [workspaceA, workspaceB],
          },
        ]}
      />,
    );

    const alphaRow = screen.getByText("Alpha Repo").closest(".workspace-row");
    const betaRow = screen.getByText("Beta Repo").closest(".workspace-row");
    if (!alphaRow || !betaRow) {
      throw new Error("Missing workspace rows for drag test");
    }

    vi.spyOn(alphaRow, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 200,
      top: 200,
      left: 0,
      right: 280,
      bottom: 248,
      width: 280,
      height: 48,
      toJSON: () => ({}),
    });

    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      setData: vi.fn(),
      getData: vi.fn(),
    } as unknown as DataTransfer;

    fireEvent.dragStart(betaRow, { dataTransfer });

    const dragOverEvent = createEvent.dragOver(alphaRow, { dataTransfer });
    Object.defineProperty(dragOverEvent, "clientY", { value: 205 });
    fireEvent(alphaRow, dragOverEvent);

    const dropEvent = createEvent.drop(alphaRow, { dataTransfer });
    Object.defineProperty(dropEvent, "clientY", { value: 205 });
    fireEvent(alphaRow, dropEvent);

    await waitFor(() => {
      const workspaceNames = Array.from(
        container.querySelectorAll(".workspace-row .workspace-name"),
      ).map((node) => node.textContent?.trim());
      expect(workspaceNames.slice(0, 2)).toEqual(["Beta Repo", "Alpha Repo"]);
    });

    const stored = window.localStorage.getItem("codexmonitor.workspaceOrderByGroup");
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored ?? "{}")).toEqual({
      __ungrouped_workspace_group__: ["ws-2", "ws-1"],
    });
  });

  it("persists grouped workspace reorder callback with group id", async () => {
    const workspaceA = {
      id: "ws-1",
      name: "Alpha Repo",
      path: "/tmp/alpha",
      connected: true,
      settings: { sidebarCollapsed: false },
    };
    const workspaceB = {
      id: "ws-2",
      name: "Beta Repo",
      path: "/tmp/beta",
      connected: true,
      settings: { sidebarCollapsed: false },
    };
    const onReorderWorkspaceGroup = vi.fn().mockResolvedValue(undefined);

    const { container } = render(
      <Sidebar
        {...baseProps}
        onReorderWorkspaceGroup={onReorderWorkspaceGroup}
        workspaces={[workspaceA, workspaceB]}
        groupedWorkspaces={[
          {
            id: "group-1",
            name: "Team",
            workspaces: [workspaceA, workspaceB],
          },
        ]}
      />,
    );

    const alphaRow = screen.getByText("Alpha Repo").closest(".workspace-row");
    const betaRow = screen.getByText("Beta Repo").closest(".workspace-row");
    if (!alphaRow || !betaRow) {
      throw new Error("Missing grouped workspace rows for drag test");
    }

    vi.spyOn(betaRow, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 200,
      top: 200,
      left: 0,
      right: 280,
      bottom: 248,
      width: 280,
      height: 48,
      toJSON: () => ({}),
    });

    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      setData: vi.fn(),
      getData: vi.fn(),
    } as unknown as DataTransfer;

    fireEvent.dragStart(alphaRow, { dataTransfer });

    const dragOverEvent = createEvent.dragOver(betaRow, { dataTransfer });
    Object.defineProperty(dragOverEvent, "clientY", { value: 245 });
    fireEvent(betaRow, dragOverEvent);

    const dropEvent = createEvent.drop(betaRow, { dataTransfer });
    Object.defineProperty(dropEvent, "clientY", { value: 245 });
    fireEvent(betaRow, dropEvent);

    await waitFor(() => {
      const workspaceNames = Array.from(
        container.querySelectorAll(".workspace-row .workspace-name"),
      ).map((node) => node.textContent?.trim());
      expect(workspaceNames.slice(0, 2)).toEqual(["Beta Repo", "Alpha Repo"]);
    });

    const stored = window.localStorage.getItem("codexmonitor.workspaceOrderByGroup");
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored ?? "{}")).toEqual({
      "group-1": ["ws-2", "ws-1"],
    });
    expect(onReorderWorkspaceGroup).toHaveBeenCalledWith("group-1", ["ws-2", "ws-1"]);
  });

  it("reorders workspaces when dropped on sidebar container fallback", async () => {
    const workspaceA = {
      id: "ws-1",
      name: "Alpha Repo",
      path: "/tmp/alpha",
      connected: true,
      settings: { sidebarCollapsed: false },
    };
    const workspaceB = {
      id: "ws-2",
      name: "Beta Repo",
      path: "/tmp/beta",
      connected: true,
      settings: { sidebarCollapsed: false },
    };
    const onReorderWorkspaceGroup = vi.fn().mockResolvedValue(undefined);
    const onWorkspaceDrop = vi.fn();

    const { container } = render(
      <Sidebar
        {...baseProps}
        onWorkspaceDrop={onWorkspaceDrop}
        onReorderWorkspaceGroup={onReorderWorkspaceGroup}
        workspaces={[workspaceA, workspaceB]}
        groupedWorkspaces={[
          {
            id: null,
            name: "Workspaces",
            workspaces: [workspaceA, workspaceB],
          },
        ]}
      />,
    );

    const alphaRow = screen.getByText("Alpha Repo").closest(".workspace-row");
    const betaRow = screen.getByText("Beta Repo").closest(".workspace-row");
    const sidebar = container.querySelector(".sidebar");
    if (!alphaRow || !betaRow || !sidebar) {
      throw new Error("Missing workspace drag elements for sidebar fallback test");
    }

    vi.spyOn(betaRow, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 200,
      top: 200,
      left: 0,
      right: 280,
      bottom: 248,
      width: 280,
      height: 48,
      toJSON: () => ({}),
    });

    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      setData: vi.fn(),
      getData: vi.fn(),
      types: ["text/plain", "application/x-codexmonitor-workspace-group"],
      files: [],
      items: [],
    } as unknown as DataTransfer;

    fireEvent.dragStart(alphaRow, { dataTransfer });
    const dropEvent = createEvent.drop(sidebar, { dataTransfer });
    Object.defineProperty(dropEvent, "clientY", { value: 245 });
    Object.defineProperty(dropEvent, "target", { value: betaRow });
    fireEvent(sidebar, dropEvent);

    await waitFor(() => {
      const workspaceNames = Array.from(
        container.querySelectorAll(".workspace-row .workspace-name"),
      ).map((node) => node.textContent?.trim());
      expect(workspaceNames.slice(0, 2)).toEqual(["Beta Repo", "Alpha Repo"]);
    });

    expect(onReorderWorkspaceGroup).toHaveBeenCalledWith(null, ["ws-2", "ws-1"]);
    expect(onWorkspaceDrop).not.toHaveBeenCalled();
  });

  it("reorders workspaces from pointer position when drop target is not a row", async () => {
    const workspaceA = {
      id: "ws-1",
      name: "Alpha Repo",
      path: "/tmp/alpha",
      connected: true,
      settings: { sidebarCollapsed: false },
    };
    const workspaceB = {
      id: "ws-2",
      name: "Beta Repo",
      path: "/tmp/beta",
      connected: true,
      settings: { sidebarCollapsed: false },
    };
    const onReorderWorkspaceGroup = vi.fn().mockResolvedValue(undefined);
    const onWorkspaceDrop = vi.fn();

    const { container } = render(
      <Sidebar
        {...baseProps}
        onWorkspaceDrop={onWorkspaceDrop}
        onReorderWorkspaceGroup={onReorderWorkspaceGroup}
        workspaces={[workspaceA, workspaceB]}
        groupedWorkspaces={[
          {
            id: null,
            name: "Workspaces",
            workspaces: [workspaceA, workspaceB],
          },
        ]}
      />,
    );

    const alphaRow = screen.getByText("Alpha Repo").closest(".workspace-row");
    const betaRow = screen.getByText("Beta Repo").closest(".workspace-row");
    const sidebar = container.querySelector(".sidebar");
    const sidebarBody = container.querySelector(".sidebar-body");
    if (!alphaRow || !betaRow || !sidebar || !sidebarBody) {
      throw new Error("Missing workspace drag elements for pointer fallback test");
    }

    vi.spyOn(alphaRow, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 200,
      top: 200,
      left: 0,
      right: 280,
      bottom: 248,
      width: 280,
      height: 48,
      toJSON: () => ({}),
    });
    vi.spyOn(betaRow, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 260,
      top: 260,
      left: 0,
      right: 280,
      bottom: 308,
      width: 280,
      height: 48,
      toJSON: () => ({}),
    });

    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      setData: vi.fn(),
      getData: vi.fn(),
      types: ["text/plain", "application/x-codexmonitor-workspace-group"],
      files: [],
      items: [],
    } as unknown as DataTransfer;

    fireEvent.dragStart(alphaRow, { dataTransfer });
    const dropEvent = createEvent.drop(sidebar, { dataTransfer });
    Object.defineProperty(dropEvent, "clientY", { value: 295 });
    Object.defineProperty(dropEvent, "target", { value: sidebarBody });
    fireEvent(sidebar, dropEvent);

    await waitFor(() => {
      const workspaceNames = Array.from(
        container.querySelectorAll(".workspace-row .workspace-name"),
      ).map((node) => node.textContent?.trim());
      expect(workspaceNames.slice(0, 2)).toEqual(["Beta Repo", "Alpha Repo"]);
    });

    expect(onReorderWorkspaceGroup).toHaveBeenCalledWith(null, ["ws-2", "ws-1"]);
    expect(onWorkspaceDrop).not.toHaveBeenCalled();
  });

  it("reorders workspaces with pointer fallback when html5 drop does not fire", async () => {
    const workspaceA = {
      id: "ws-1",
      name: "Alpha Repo",
      path: "/tmp/alpha",
      connected: true,
      settings: { sidebarCollapsed: false },
    };
    const workspaceB = {
      id: "ws-2",
      name: "Beta Repo",
      path: "/tmp/beta",
      connected: true,
      settings: { sidebarCollapsed: false },
    };
    const onReorderWorkspaceGroup = vi.fn().mockResolvedValue(undefined);

    const { container } = render(
      <Sidebar
        {...baseProps}
        onReorderWorkspaceGroup={onReorderWorkspaceGroup}
        workspaces={[workspaceA, workspaceB]}
        groupedWorkspaces={[
          {
            id: null,
            name: "Workspaces",
            workspaces: [workspaceA, workspaceB],
          },
        ]}
      />,
    );

    const alphaRow = screen.getByText("Alpha Repo").closest(".workspace-row");
    const betaRow = screen.getByText("Beta Repo").closest(".workspace-row");
    if (!alphaRow || !betaRow) {
      throw new Error("Missing workspace rows for pointer drag fallback test");
    }

    vi.spyOn(alphaRow, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 200,
      top: 200,
      left: 0,
      right: 280,
      bottom: 248,
      width: 280,
      height: 48,
      toJSON: () => ({}),
    });
    vi.spyOn(betaRow, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 260,
      top: 260,
      left: 0,
      right: 280,
      bottom: 308,
      width: 280,
      height: 48,
      toJSON: () => ({}),
    });
    fireEvent.pointerDown(alphaRow, { button: 0, clientX: 20, clientY: 205 });
    fireEvent.pointerMove(window, { buttons: 1, clientX: 20, clientY: 295 });
    fireEvent.pointerUp(window, { clientX: 20, clientY: 295 });

    await waitFor(() => {
      const workspaceNames = Array.from(
        container.querySelectorAll(".workspace-row .workspace-name"),
      ).map((node) => node.textContent?.trim());
      expect(workspaceNames.slice(0, 2)).toEqual(["Beta Repo", "Alpha Repo"]);
    });

    expect(onReorderWorkspaceGroup).toHaveBeenCalledWith(null, ["ws-2", "ws-1"]);
  });

  it("uses custom workspace alias from localStorage", () => {
    window.localStorage.setItem(
      "codexmonitor.workspaceAliasesById",
      JSON.stringify({ "ws-1": "Design System" }),
    );

    render(
      <Sidebar
        {...baseProps}
        workspaces={[
          {
            id: "ws-1",
            name: "Workspace",
            path: "/tmp/workspace",
            connected: true,
            settings: { sidebarCollapsed: false },
          },
        ]}
        groupedWorkspaces={[
          {
            id: null,
            name: "Workspaces",
            workspaces: [
              {
                id: "ws-1",
                name: "Workspace",
                path: "/tmp/workspace",
                connected: true,
                settings: { sidebarCollapsed: false },
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("Design System")).toBeTruthy();
  });

});
