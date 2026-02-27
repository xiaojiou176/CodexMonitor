// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act, createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar";

afterEach(() => {
  if (vi.isFakeTimers()) {
    act(() => {
      vi.runOnlyPendingTimers();
    });
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
  showSubAgentThreadsInSidebar: true,
  onToggleShowSubAgentThreadsInSidebar: vi.fn(),
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
  onAddWorkspaceFromUrl: vi.fn(),
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
  it("keeps rendering when persisted sidebar state payloads are malformed", () => {
    window.localStorage.setItem("codexmonitor.threadOrderByWorkspace", "{bad-json");
    window.localStorage.setItem("codexmonitor.workspaceOrderByGroup", "null");
    window.localStorage.setItem(
      "codexmonitor.subAgentRootCollapseByWorkspace",
      JSON.stringify({ "ws-1": ["invalid-shape"] }),
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

    expect(screen.getByText("Workspace")).not.toBeNull();
  });

  it("applies persisted workspace/thread order and ignores invalid ids", () => {
    window.localStorage.setItem(
      "codexmonitor.workspaceOrderByGroup",
      JSON.stringify({ __ungrouped_workspace_group__: ["ws-2", "missing", "ws-2", "ws-1"] }),
    );
    window.localStorage.setItem(
      "codexmonitor.threadOrderByWorkspace",
      JSON.stringify({ "ws-2": ["thread-2", "missing", "thread-2", "thread-1"] }),
    );

    const { container } = render(
      <Sidebar
        {...baseProps}
        workspaces={[
          {
            id: "ws-1",
            name: "Alpha Repo",
            path: "/tmp/alpha",
            connected: true,
            settings: { sidebarCollapsed: false },
          },
          {
            id: "ws-2",
            name: "Beta Repo",
            path: "/tmp/beta",
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
                name: "Alpha Repo",
                path: "/tmp/alpha",
                connected: true,
                settings: { sidebarCollapsed: false },
              },
              {
                id: "ws-2",
                name: "Beta Repo",
                path: "/tmp/beta",
                connected: true,
                settings: { sidebarCollapsed: false },
              },
            ],
          },
        ]}
        threadsByWorkspace={{
          "ws-2": [
            { id: "thread-1", name: "Alpha Thread", updatedAt: 3000 },
            { id: "thread-2", name: "Beta Thread", updatedAt: 2000 },
          ],
        }}
        activeWorkspaceId="ws-2"
      />,
    );

    const workspaceNames = Array.from(
      container.querySelectorAll(".workspace-row .workspace-name"),
    ).map((node) => node.textContent?.trim());
    expect(workspaceNames.slice(0, 2)).toEqual(["Beta Repo", "Alpha Repo"]);

    const threadNames = Array.from(
      container.querySelectorAll(".thread-row .thread-name"),
    ).map((node) => node.textContent?.trim());
    expect(threadNames.slice(0, 2)).toEqual(["Beta Thread", "Alpha Thread"]);
  });

  it("toggles the search bar from the header icon", async () => {
    vi.useFakeTimers();
    render(<Sidebar {...baseProps} />);

    const toggleButton = screen.getByRole("button", { name: "切换搜索" });
    expect(
      screen.queryByRole("textbox", { name: "搜索工作区和对话" }),
    ).toBeNull();

    await act(async () => {
      fireEvent.click(toggleButton);
    });
    const input = screen.getByRole("textbox", {
      name: "搜索工作区和对话",
    }) as HTMLInputElement;
    expect(input).not.toBeNull();

    await act(async () => {
      fireEvent.change(input, { target: { value: "alpha" } });
      vi.runOnlyPendingTimers();
    });
    expect(input.value).toBe("alpha");

    await act(async () => {
      fireEvent.click(toggleButton);
      vi.runOnlyPendingTimers();
    });
    expect(
      screen.queryByRole("textbox", { name: "搜索工作区和对话" }),
    ).toBeNull();

    await act(async () => {
      fireEvent.click(toggleButton);
      vi.runOnlyPendingTimers();
    });
    const reopened = screen.getByRole("textbox", {
      name: "搜索工作区和对话",
    }) as HTMLInputElement;
    expect(reopened.value).toBe("");
  });

  it("closes and clears search when pressing Escape", async () => {
    vi.useFakeTimers();
    render(<Sidebar {...baseProps} />);

    const toggleButton = screen.getByRole("button", { name: "切换搜索" });
    await act(async () => {
      fireEvent.click(toggleButton);
      vi.runOnlyPendingTimers();
    });
    const input = screen.getByRole("textbox", {
      name: "搜索工作区和对话",
    }) as HTMLInputElement;

    await act(async () => {
      fireEvent.change(input, { target: { value: "workspace" } });
      vi.runOnlyPendingTimers();
    });
    expect(input.value).toBe("workspace");

    await act(async () => {
      fireEvent.keyDown(input, { key: "Escape" });
      vi.runOnlyPendingTimers();
    });
    expect(
      screen.queryByRole("textbox", { name: "搜索工作区和对话" }),
    ).toBeNull();

    await act(async () => {
      fireEvent.click(toggleButton);
      vi.runOnlyPendingTimers();
    });
    const reopened = screen.getByRole("textbox", {
      name: "搜索工作区和对话",
    }) as HTMLInputElement;
    expect(reopened.value).toBe("");
  });

  it("clears search query from the clear button", async () => {
    vi.useFakeTimers();
    render(<Sidebar {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "切换搜索" }));
    const input = screen.getByRole("textbox", {
      name: "搜索工作区和对话",
    }) as HTMLInputElement;

    await act(async () => {
      fireEvent.change(input, { target: { value: "workspace" } });
      vi.runOnlyPendingTimers();
    });
    expect(input.value).toBe("workspace");
    fireEvent.click(screen.getByRole("button", { name: "清除搜索" }));
    expect(input.value).toBe("");
  });

  it("opens add-workspace-from-url prompt from header action", async () => {
    const onAddWorkspaceFromUrl = vi.fn();
    render(<Sidebar {...baseProps} onAddWorkspaceFromUrl={onAddWorkspaceFromUrl} />);

    const button = screen.getByRole("button", { name: "从 URL 添加工作区" });
    await act(async () => {
      fireEvent.click(button);
    });

    expect(onAddWorkspaceFromUrl).toHaveBeenCalledTimes(1);
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

  it("supports keyboard navigation and close for thread sort menu", async () => {
    render(<Sidebar {...baseProps} />);

    const toggleButton = screen.getByRole("button", { name: "排序对话" });
    toggleButton.focus();
    fireEvent.keyDown(toggleButton, { key: "ArrowDown" });

    const menu = screen.getByRole("menu");
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    const firstOption = screen.getByRole("menuitemradio", { name: "最近更新" });
    expect(document.activeElement).toBe(firstOption);

    fireEvent.keyDown(menu, { key: "Escape" });

    expect(screen.queryByRole("menu")).toBeNull();
    await waitFor(() => {
      expect(document.activeElement).toBe(toggleButton);
    });
  });

  it("supports ArrowUp focus entry for thread sort menu", async () => {
    render(<Sidebar {...baseProps} />);

    const toggleButton = screen.getByRole("button", { name: "排序对话" });
    toggleButton.focus();
    fireEvent.keyDown(toggleButton, { key: "ArrowUp" });

    const secondOption = screen.getByRole("menuitemradio", { name: "最新创建" });
    await waitFor(() => {
      expect(document.activeElement).toBe(secondOption);
    });
  });

  it("closes thread sort menu when clicking outside", async () => {
    render(<Sidebar {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "排序对话" }));
    expect(screen.getByRole("menu")).not.toBeNull();

    fireEvent.mouseDown(document.body);
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
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

  it("disables refresh action when all workspaces are disconnected", () => {
    const onRefreshAllThreads = vi.fn();
    render(
      <Sidebar
        {...baseProps}
        onRefreshAllThreads={onRefreshAllThreads}
        workspaces={[
          {
            id: "ws-1",
            name: "Workspace",
            path: "/tmp/workspace",
            connected: false,
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
                connected: false,
                settings: { sidebarCollapsed: false },
              },
            ],
          },
        ]}
      />,
    );

    const refreshButton = screen.getByRole("button", { name: "刷新全部工作区对话" });
    expect((refreshButton as HTMLButtonElement).disabled).toBeTruthy();
    fireEvent.click(refreshButton);
    expect(onRefreshAllThreads).not.toHaveBeenCalled();
  });

  it("uses one shared ticker interval for pinned and workspace thread lists", () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");

    const workspace = {
      id: "ws-1",
      name: "Workspace",
      path: "/tmp/workspace",
      connected: true,
      settings: { sidebarCollapsed: false },
    };
    const { unmount } = render(
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
            { id: "thread-pinned", name: "Pinned", updatedAt: 1000 },
            { id: "thread-regular", name: "Regular", updatedAt: 900 },
          ],
        }}
        threadStatusById={{
          "thread-pinned": { isProcessing: true, hasUnread: false, isReviewing: false },
          "thread-regular": { isProcessing: true, hasUnread: false, isReviewing: false },
        }}
        getPinTimestamp={vi.fn((workspaceId: string, threadId: string) =>
          workspaceId === "ws-1" && threadId === "thread-pinned" ? 1 : null,
        )}
        isThreadPinned={vi.fn((workspaceId: string, threadId: string) =>
          workspaceId === "ws-1" && threadId === "thread-pinned",
        )}
      />,
    );

    expect(screen.getByText("Pinned")).not.toBeNull();
    expect(screen.getByText("Regular")).not.toBeNull();
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it("toggles global sub-agent visibility from the header button", () => {
    const onToggleShowSubAgentThreadsInSidebar = vi.fn();
    render(
      <Sidebar
        {...baseProps}
        onToggleShowSubAgentThreadsInSidebar={onToggleShowSubAgentThreadsInSidebar}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "隐藏子代理线程" }));
    expect(onToggleShowSubAgentThreadsInSidebar).toHaveBeenCalledTimes(1);
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
    expect(refreshButton.getAttribute("aria-busy") === "true").toBeTruthy();
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
    expect(draftRow).not.toBeNull();
    expect(draftRow.className).toContain("thread-row-draft");
    expect(draftRow.className).toContain("active");

    fireEvent.click(draftRow);
    expect(onSelectWorkspace).toHaveBeenCalledWith("ws-1");
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
    expect(draftRow).not.toBeNull();
    expect(draftRow.className).toContain("thread-row-draft");
  });

  it("uses persisted workspace displayName from settings", () => {
    render(
      <Sidebar
        {...baseProps}
        workspaces={[
          {
            id: "ws-1",
            name: "Workspace",
            path: "/tmp/workspace",
            connected: true,
            settings: { sidebarCollapsed: false, displayName: "Design System" },
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
                settings: { sidebarCollapsed: false, displayName: "Design System" },
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("Design System")).not.toBeNull();
  });

  it("shows selection bar for multi-select and clears it from cancel action", () => {
    const workspace = {
      id: "ws-1",
      name: "Workspace",
      path: "/tmp/workspace",
      connected: true,
      settings: { sidebarCollapsed: false },
    };
    render(
      <Sidebar
        {...baseProps}
        activeWorkspaceId="ws-1"
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

    const alpha = screen.getByText("Alpha").closest(".thread-row");
    const beta = screen.getByText("Beta").closest(".thread-row");
    if (!alpha || !beta) {
      throw new Error("Missing thread rows for selection test");
    }

    fireEvent.click(alpha);
    fireEvent.click(beta, { ctrlKey: true });
    expect(screen.getByText("已选 2 条")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.queryByText("已选 2 条")).toBeNull();
  });

  it("opens add menu, triggers each option, and closes on scroll", async () => {
    const onAddAgent = vi.fn();
    const onAddWorktreeAgent = vi.fn();
    const onAddCloneAgent = vi.fn();
    const workspace = {
      id: "ws-1",
      name: "Workspace",
      path: "/tmp/workspace",
      connected: true,
      settings: { sidebarCollapsed: false },
    };

    render(
      <Sidebar
        {...baseProps}
        onAddAgent={onAddAgent}
        onAddWorktreeAgent={onAddWorktreeAgent}
        onAddCloneAgent={onAddCloneAgent}
        activeWorkspaceId="ws-1"
        workspaces={[workspace]}
        groupedWorkspaces={[
          {
            id: null,
            name: "Workspaces",
            workspaces: [workspace],
          },
        ]}
      />,
    );

    const openAddMenu = () => fireEvent.click(screen.getByRole("button", { name: "添加对话选项" }));

    openAddMenu();
    fireEvent.click(screen.getByRole("button", { name: "新建对话" }));
    expect(onAddAgent).toHaveBeenCalledWith(expect.objectContaining({ id: "ws-1" }));
    expect(screen.queryByRole("button", { name: "新建工作树对话" })).toBeNull();

    openAddMenu();
    fireEvent.click(screen.getByRole("button", { name: "新建工作树对话" }));
    expect(onAddWorktreeAgent).toHaveBeenCalledWith(expect.objectContaining({ id: "ws-1" }));

    openAddMenu();
    fireEvent.click(screen.getByRole("button", { name: "新建克隆对话" }));
    expect(onAddCloneAgent).toHaveBeenCalledWith(expect.objectContaining({ id: "ws-1" }));

    openAddMenu();
    fireEvent.scroll(window);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "新建对话" })).toBeNull();
    });
  });

  it("closes workspace add menu when clicking outside", async () => {
    const workspace = {
      id: "ws-1",
      name: "Workspace",
      path: "/tmp/workspace",
      connected: true,
      settings: { sidebarCollapsed: false },
    };

    render(
      <Sidebar
        {...baseProps}
        activeWorkspaceId="ws-1"
        workspaces={[workspace]}
        groupedWorkspaces={[
          {
            id: null,
            name: "Workspaces",
            workspaces: [workspace],
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "添加对话选项" }));
    expect(screen.getByRole("button", { name: "新建对话" })).not.toBeNull();

    fireEvent.mouseDown(document.body);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "新建对话" })).toBeNull();
    });
  });

  it("keeps account switch action disabled while switching and allows cancel", () => {
    const onSwitchAccount = vi.fn();
    const onCancelSwitchAccount = vi.fn();
    const workspace = {
      id: "ws-1",
      name: "Workspace",
      path: "/tmp/workspace",
      connected: true,
      settings: { sidebarCollapsed: false },
    };

    render(
      <Sidebar
        {...baseProps}
        onSwitchAccount={onSwitchAccount}
        onCancelSwitchAccount={onCancelSwitchAccount}
        accountSwitching
        accountInfo={{ type: "chatgpt", email: "dev@example.com" }}
        activeWorkspaceId="ws-1"
        workspaces={[workspace]}
        groupedWorkspaces={[
          {
            id: null,
            name: "Workspaces",
            workspaces: [workspace],
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "账户" }));
    const switchButton = screen.getByRole("button", { name: "切换账户" });
    expect((switchButton as HTMLButtonElement).disabled).toBeTruthy();
    fireEvent.click(switchButton);
    expect(onSwitchAccount).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "取消切换账户" }));
    expect(onCancelSwitchAccount).toHaveBeenCalledTimes(1);
  });

  it("renders busy workspace drop overlay state", () => {
    const { container } = render(
      <Sidebar
        {...baseProps}
        isWorkspaceDropActive
        workspaceDropText="正在添加项目..."
      />,
    );

    const overlay = container.querySelector(".workspace-drop-overlay");
    const overlayText = container.querySelector(".workspace-drop-overlay-text");
    const overlayIcon = container.querySelector(".workspace-drop-overlay-icon");
    expect(overlay?.className).toContain("is-active");
    expect(overlayText?.className).toContain("is-busy");
    expect(overlayIcon).toBeNull();
  });

  it("submits workspace custom name through callback", () => {
    const onUpdateWorkspaceDisplayName = vi.fn();

    render(
      <Sidebar
        {...baseProps}
        onUpdateWorkspaceDisplayName={onUpdateWorkspaceDisplayName}
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

    fireEvent.doubleClick(screen.getByText("Workspace"));

    const input = screen.getByLabelText("工作区自定义名称");
    fireEvent.change(input, { target: { value: "Design System" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onUpdateWorkspaceDisplayName).toHaveBeenCalledWith("ws-1", "Design System");
  });

  it("hides sub-agent threads when global sidebar visibility is disabled", () => {
    render(
      <Sidebar
        {...baseProps}
        showSubAgentThreadsInSidebar={false}
        threadParentById={{ "thread-child": "thread-parent" }}
        threadsByWorkspace={{
          "ws-1": [
            { id: "thread-parent", name: "Parent", updatedAt: 3 },
            { id: "thread-child", name: "Child", updatedAt: 2 },
          ],
        }}
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

    expect(screen.getByText("Parent")).not.toBeNull();
    expect(screen.queryByText("Child")).toBeNull();
  });

  it("restores root collapse state from localStorage and can expand it", () => {
    window.localStorage.setItem(
      "codexmonitor.subAgentRootCollapseByWorkspace",
      JSON.stringify({ "ws-1": { "thread-parent": true } }),
    );

    render(
      <Sidebar
        {...baseProps}
        threadParentById={{ "thread-child": "thread-parent" }}
        threadsByWorkspace={{
          "ws-1": [
            { id: "thread-parent", name: "Parent", updatedAt: 3 },
            { id: "thread-child", name: "Child", updatedAt: 2 },
          ],
        }}
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

    expect(screen.queryByText("Child")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "展开子代理" }));
    expect(screen.getByText("Child")).not.toBeNull();
  });

  it("shows API key account label and login action when workspace is active", () => {
    const onSwitchAccount = vi.fn();
    const workspace = {
      id: "ws-1",
      name: "Workspace",
      path: "/tmp/workspace",
      connected: true,
      settings: { sidebarCollapsed: false },
    };

    render(
      <Sidebar
        {...baseProps}
        onSwitchAccount={onSwitchAccount}
        accountInfo={{ type: "apikey", email: "" }}
        activeWorkspaceId="ws-1"
        workspaces={[workspace]}
        groupedWorkspaces={[
          {
            id: null,
            name: "Workspaces",
            workspaces: [workspace],
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "账户" }));
    expect(screen.getByText("API 密钥")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "登录" }));
    expect(onSwitchAccount).toHaveBeenCalledTimes(1);
  });

  it("hides account switcher without active workspace and toggles debug action visibility", () => {
    const onOpenDebug = vi.fn();
    const { rerender } = render(
      <Sidebar
        {...baseProps}
        onOpenDebug={onOpenDebug}
        activeWorkspaceId={null}
        showDebugButton={false}
      />,
    );

    expect(screen.queryByRole("button", { name: "账户" })).toBeNull();
    expect(screen.queryByRole("button", { name: "打开调试日志" })).toBeNull();

    rerender(
      <Sidebar
        {...baseProps}
        onOpenDebug={onOpenDebug}
        activeWorkspaceId={null}
        showDebugButton
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "打开调试日志" }));
    expect(onOpenDebug).toHaveBeenCalledTimes(1);
  });
});
