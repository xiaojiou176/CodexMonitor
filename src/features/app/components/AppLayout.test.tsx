// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppLayout } from "./AppLayout";

const phoneLayoutMock = vi.hoisted(() => vi.fn((props: Record<string, unknown>) => (
  <div data-testid="phone-layout" data-show-git-detail={String(props.showGitDetail)} />
)));
const tabletLayoutMock = vi.hoisted(() => vi.fn((props: Record<string, unknown>) => (
  <div data-testid="tablet-layout" data-show-workspace={String(props.showWorkspace)} />
)));
const desktopLayoutMock = vi.hoisted(() => vi.fn((props: Record<string, unknown>) => (
  <div data-testid="desktop-layout" data-show-workspace={String(props.showWorkspace)} />
)));

vi.mock("../../layout/components/PhoneLayout", () => ({
  PhoneLayout: (props: Record<string, unknown>) => phoneLayoutMock(props),
}));

vi.mock("../../layout/components/TabletLayout", () => ({
  TabletLayout: (props: Record<string, unknown>) => tabletLayoutMock(props),
}));

vi.mock("../../layout/components/DesktopLayout", () => ({
  DesktopLayout: (props: Record<string, unknown>) => desktopLayoutMock(props),
}));

function createProps() {
  return {
    isPhone: false,
    isTablet: false,
    showHome: false,
    showGitDetail: false,
    activeTab: "codex" as const,
    tabletTab: "codex" as const,
    centerMode: "chat" as const,
    preloadGitDiffs: false,
    hasActivePlan: false,
    activeWorkspace: true,
    sidebarNode: <div>sidebar</div>,
    messagesNode: <div>messages</div>,
    composerNode: <div>composer</div>,
    approvalToastsNode: <div>approval-toasts</div>,
    updateToastNode: <div>update-toast</div>,
    errorToastsNode: <div>error-toasts</div>,
    homeNode: <div>home</div>,
    mainHeaderNode: <div>main-header</div>,
    desktopTopbarLeftNode: <div>desktop-left</div>,
    codexTopbarActionsNode: <div>codex-actions</div>,
    tabletNavNode: <div>tablet-nav</div>,
    tabBarNode: <div>tab-bar</div>,
    gitDiffPanelNode: <div>git-diff-panel</div>,
    gitDiffViewerNode: <div>git-diff-viewer</div>,
    planPanelNode: <div>plan-panel</div>,
    debugPanelNode: <div>debug-panel</div>,
    debugPanelFullNode: <div>debug-panel-full</div>,
    terminalDockNode: <div>terminal-dock</div>,
    compactEmptyCodexNode: <div>compact-empty-codex</div>,
    compactEmptyGitNode: <div>compact-empty-git</div>,
    compactGitBackNode: <div>compact-git-back</div>,
    onSidebarResizeStart: vi.fn(),
    onRightPanelResizeStart: vi.fn(),
    onPlanPanelResizeStart: vi.fn(),
    onSidebarResizeKeyDown: vi.fn(),
    onRightPanelResizeKeyDown: vi.fn(),
    onPlanPanelResizeKeyDown: vi.fn(),
    sidebarWidth: 320,
    rightPanelWidth: 380,
    planPanelHeight: 260,
    sidebarResizeMin: 240,
    sidebarResizeMax: 520,
    rightPanelResizeMin: 280,
    rightPanelResizeMax: 620,
    planPanelResizeMin: 120,
    planPanelResizeMax: 520,
  };
}

describe("AppLayout", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders phone layout when isPhone=true", () => {
    const props = createProps();
    props.isPhone = true;
    props.showGitDetail = true;

    render(<AppLayout {...props} />);

    expect(screen.getByTestId("phone-layout")).toBeTruthy();
    expect(screen.queryByTestId("tablet-layout")).toBeNull();
    expect(screen.queryByTestId("desktop-layout")).toBeNull();
    expect(phoneLayoutMock).toHaveBeenCalledTimes(1);
    expect(phoneLayoutMock.mock.calls[0]?.[0]?.activeWorkspace).toBe(true);
    expect(phoneLayoutMock.mock.calls[0]?.[0]?.showGitDetail).toBe(true);
    expect(phoneLayoutMock.mock.calls[0]?.[0]?.topbarLeftNode).toBe(props.mainHeaderNode);
  });

  it("renders tablet layout and derives showWorkspace from activeWorkspace/showHome", () => {
    const props = createProps();
    props.isTablet = true;
    props.activeWorkspace = true;
    props.showHome = false;

    render(<AppLayout {...props} />);

    expect(screen.getByTestId("tablet-layout")).toBeTruthy();
    expect(screen.queryByTestId("phone-layout")).toBeNull();
    expect(screen.queryByTestId("desktop-layout")).toBeNull();
    expect(tabletLayoutMock).toHaveBeenCalledTimes(1);
    expect(tabletLayoutMock.mock.calls[0]?.[0]?.showWorkspace).toBe(true);
    expect(tabletLayoutMock.mock.calls[0]?.[0]?.topbarLeftNode).toBe(props.mainHeaderNode);
  });

  it("renders tablet empty-state branch when showHome=true", () => {
    const props = createProps();
    props.isTablet = true;
    props.activeWorkspace = true;
    props.showHome = true;

    render(<AppLayout {...props} />);

    expect(screen.getByTestId("tablet-layout")).toBeTruthy();
    expect(tabletLayoutMock.mock.calls[0]?.[0]?.showHome).toBe(true);
    expect(tabletLayoutMock.mock.calls[0]?.[0]?.showWorkspace).toBe(false);
  });

  it("renders desktop layout and propagates desktop-only props", () => {
    const props = createProps();
    props.centerMode = "diff";
    props.preloadGitDiffs = true;
    props.hasActivePlan = true;
    props.activeWorkspace = false;
    props.showHome = false;

    render(<AppLayout {...props} />);

    expect(screen.getByTestId("desktop-layout")).toBeTruthy();
    expect(screen.queryByTestId("phone-layout")).toBeNull();
    expect(screen.queryByTestId("tablet-layout")).toBeNull();
    expect(desktopLayoutMock).toHaveBeenCalledTimes(1);
    expect(desktopLayoutMock.mock.calls[0]?.[0]?.centerMode).toBe("diff");
    expect(desktopLayoutMock.mock.calls[0]?.[0]?.preloadGitDiffs).toBe(true);
    expect(desktopLayoutMock.mock.calls[0]?.[0]?.hasActivePlan).toBe(true);
    expect(desktopLayoutMock.mock.calls[0]?.[0]?.showWorkspace).toBe(false);
    expect(desktopLayoutMock.mock.calls[0]?.[0]?.topbarLeftNode).toBe(props.desktopTopbarLeftNode);
  });

  it("renders desktop workspace-content branch when home is hidden", () => {
    const props = createProps();
    props.activeWorkspace = true;
    props.showHome = false;

    render(<AppLayout {...props} />);

    expect(screen.getByTestId("desktop-layout")).toBeTruthy();
    expect(desktopLayoutMock.mock.calls[0]?.[0]?.showHome).toBe(false);
    expect(desktopLayoutMock.mock.calls[0]?.[0]?.showWorkspace).toBe(true);
  });
});
