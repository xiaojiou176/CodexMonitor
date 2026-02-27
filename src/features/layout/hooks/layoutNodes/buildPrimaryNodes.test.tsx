// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LayoutNodesOptions } from "./types";

const spies = vi.hoisted(() => ({
  sidebar: vi.fn(),
  messages: vi.fn(),
  composer: vi.fn(),
  mainHeader: vi.fn(),
}));

vi.mock("lucide-react/dist/esm/icons/arrow-left", () => ({
  default: () => <svg data-testid="arrow-left-icon" />,
}));

vi.mock("../../../app/components/Sidebar", () => ({
  Sidebar: (props: Record<string, unknown>) => {
    spies.sidebar(props);
    return <div data-testid="sidebar" />;
  },
}));

vi.mock("../../../messages/components/Messages", () => ({
  Messages: (props: Record<string, unknown>) => {
    spies.messages(props);
    return (
      <div
        data-testid="messages"
        data-streaming={String(props.isStreaming)}
        data-phase={String(props.threadPhase)}
        data-loading={String(props.isLoadingMessages)}
      />
    );
  },
}));

vi.mock("../../../composer/components/Composer", () => ({
  Composer: (props: Record<string, unknown>) => {
    spies.composer(props);
    return (
      <div
        data-testid="composer"
        data-send-label={String(props.sendLabel)}
        data-disabled={String(props.disabled)}
      />
    );
  },
}));

vi.mock("../../../app/components/MainHeader", () => ({
  MainHeader: (props: Record<string, unknown>) => {
    spies.mainHeader(props);
    return <div data-testid="main-header" />;
  },
}));

vi.mock("../../../app/components/ApprovalToasts", () => ({
  ApprovalToasts: () => <div data-testid="approval-toasts" />,
}));

vi.mock("../../../update/components/UpdateToast", () => ({
  UpdateToast: () => <div data-testid="update-toast" />,
}));

vi.mock("../../../notifications/components/ErrorToasts", () => ({
  ErrorToasts: () => <div data-testid="error-toasts" />,
}));

vi.mock("../../../home/components/Home", () => ({
  Home: () => <div data-testid="home" />,
}));

vi.mock("../../../app/components/TabBar", () => ({
  TabBar: () => <div data-testid="tab-bar" />,
}));

vi.mock("../../../app/components/TabletNav", () => ({
  TabletNav: () => <div data-testid="tablet-nav" />,
}));

import { buildPrimaryNodes } from "./buildPrimaryNodes";

function createOptions(
  overrides: Partial<LayoutNodesOptions> = {},
): LayoutNodesOptions {
  return {
    activeThreadId: "thread-1",
    threadStatusById: {},
    threadResumeLoadingById: {},
    isProcessing: false,
    activeItems: [],
    showComposer: true,
    isReviewing: false,
    activeWorkspace: null,
    activeParentWorkspace: null,
    isWorktreeWorkspace: false,
    centerMode: "chat",
    onExitDiff: vi.fn(),
    tabletNavTab: "codex",
    activeTab: "codex",
    onSelectTab: vi.fn(),
    threadListSortKey: "updated",
    showSubAgentThreadsInSidebar: false,
    onToggleShowSubAgentThreadsInSidebar: vi.fn(),
    workspaces: [],
    groupedWorkspaces: [],
    hasWorkspaceGroups: false,
    deletingWorktreeIds: new Set<string>(),
    threadsByWorkspace: {},
    threadParentById: {},
    threadListLoadingByWorkspace: {},
    threadListPagingByWorkspace: {},
    threadListCursorByWorkspace: {},
    onSetThreadListSortKey: vi.fn(),
    onRefreshAllThreads: vi.fn(),
    activeWorkspaceId: null,
    accountInfo: null,
    onSwitchAccount: vi.fn(),
    onCancelSwitchAccount: vi.fn(),
    accountSwitching: false,
    onOpenSettings: vi.fn(),
    onOpenDebug: vi.fn(),
    showDebugButton: false,
    approvals: [],
    handleApprovalDecision: vi.fn(),
    handleApprovalRemember: vi.fn(),
    updaterState: {} as LayoutNodesOptions["updaterState"],
    onUpdate: vi.fn(),
    onDismissUpdate: vi.fn(),
    errorToasts: [],
    onDismissErrorToast: vi.fn(),
    latestAgentRuns: [],
    isLoadingLatestAgents: false,
    localUsageSnapshot: null,
    isLoadingLocalUsage: false,
    localUsageError: null,
    onRefreshLocalUsage: vi.fn(),
    usageMetric: "tokens",
    onUsageMetricChange: vi.fn(),
    usageWorkspaceId: null,
    usageWorkspaceOptions: [],
    onUsageWorkspaceChange: vi.fn(),
    onSelectHomeThread: vi.fn(),
    ...overrides,
  } as unknown as LayoutNodesOptions;
}

describe("buildPrimaryNodes", () => {
  beforeEach(() => {
    spies.sidebar.mockClear();
    spies.messages.mockClear();
    spies.composer.mockClear();
    spies.mainHeader.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("uses thread phase as streaming source and applies resume-loading flag", () => {
    const { messagesNode } = buildPrimaryNodes(
      createOptions({
        activeThreadId: "thread-1",
        threadStatusById: {
          "thread-1": { isProcessing: true, hasUnread: false, isReviewing: false, phase: "streaming" },
        },
        threadResumeLoadingById: { "thread-1": true },
      }),
    );

    render(<>{messagesNode}</>);
    const messages = screen.getByTestId("messages");
    expect(messages.getAttribute("data-streaming")).toBe("true");
    expect(messages.getAttribute("data-phase")).toBe("streaming");
    expect(messages.getAttribute("data-loading")).toBe("true");
  });

  it("falls back to filtering active items to derive streaming status", () => {
    const { messagesNode } = buildPrimaryNodes(
      createOptions({
        isProcessing: true,
        activeItems: [
          { kind: "message", role: "user" },
          { kind: "tool_result", role: "assistant" },
        ] as LayoutNodesOptions["activeItems"],
      }),
    );

    render(<>{messagesNode}</>);
    expect(screen.getByTestId("messages").getAttribute("data-streaming")).toBe("true");
  });

  it("does not mark streaming when only user messages exist", () => {
    const { messagesNode } = buildPrimaryNodes(
      createOptions({
        isProcessing: true,
        activeItems: [
          { kind: "message", role: "user" },
          { kind: "message", role: "user" },
        ] as LayoutNodesOptions["activeItems"],
      }),
    );

    render(<>{messagesNode}</>);
    expect(screen.getByTestId("messages").getAttribute("data-streaming")).toBe("false");
  });

  it("builds composer conditionally and applies default send label logic", () => {
    const processingCase = buildPrimaryNodes(
      createOptions({ showComposer: true, isProcessing: true, isReviewing: true }),
    );

    render(<>{processingCase.composerNode}</>);
    expect(screen.getByTestId("composer").getAttribute("data-send-label")).toBe("Queue");
    expect(screen.getByTestId("composer").getAttribute("data-disabled")).toBe("true");

    const idleCase = buildPrimaryNodes(
      createOptions({ showComposer: true, isProcessing: false, isReviewing: false }),
    );

    render(<>{idleCase.composerNode}</>);
    expect(screen.getAllByTestId("composer")[1].getAttribute("data-send-label")).toBe("Send");

    const hiddenCase = buildPrimaryNodes(createOptions({ showComposer: false }));
    expect(hiddenCase.composerNode).toBeNull();
  });

  it("renders diff back button only in diff mode and wires click handler", () => {
    const onExitDiff = vi.fn();
    const diffCase = buildPrimaryNodes(
      createOptions({ centerMode: "diff", onExitDiff }),
    );

    render(<>{diffCase.desktopTopbarLeftNode}</>);
    fireEvent.click(screen.getByRole("button", { name: "返回聊天" }));
    expect(onExitDiff).toHaveBeenCalledTimes(1);

    const chatCase = buildPrimaryNodes(createOptions({ centerMode: "chat" }));
    render(<>{chatCase.desktopTopbarLeftNode}</>);
    expect(screen.getAllByRole("button", { name: "返回聊天" })).toHaveLength(1);
  });

  it("passes sidebar sorting/filtering props and renders main header only with active workspace", () => {
    const sortChange = vi.fn();
    const toggleSubAgent = vi.fn();

    const withoutWorkspace = buildPrimaryNodes(
      createOptions({
        threadListSortKey: "updated",
        showSubAgentThreadsInSidebar: true,
        onSetThreadListSortKey: sortChange,
        onToggleShowSubAgentThreadsInSidebar: toggleSubAgent,
        activeWorkspace: null,
      }),
    );

    render(<>{withoutWorkspace.sidebarNode}</>);
    const sidebarProps = spies.sidebar.mock.lastCall?.[0] as Record<string, unknown>;
    expect(sidebarProps.threadListSortKey).toBe("updated");
    expect(sidebarProps.showSubAgentThreadsInSidebar).toBe(true);
    expect(sidebarProps.onSetThreadListSortKey).toBe(sortChange);
    expect(sidebarProps.onToggleShowSubAgentThreadsInSidebar).toBe(toggleSubAgent);
    expect(withoutWorkspace.mainHeaderNode).toBeNull();

    const withWorkspace = buildPrimaryNodes(
      createOptions({
        activeWorkspace: {
          id: "ws-1",
          name: "Workspace",
          path: "/tmp/ws",
          connected: true,
          settings: { sidebarCollapsed: false },
        } as LayoutNodesOptions["activeWorkspace"],
      }),
    );

    render(<>{withWorkspace.mainHeaderNode}</>);
    expect(screen.queryByTestId("main-header")).not.toBeNull();
  });
});
