// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DesktopLayout } from "./DesktopLayout";

afterEach(() => {
  cleanup();
});

function createBaseProps() {
  return {
    sidebarNode: <div data-testid="sidebar-node" />,
    updateToastNode: <div data-testid="update-toast-node" />,
    approvalToastsNode: <div data-testid="approval-toasts-node" />,
    errorToastsNode: <div data-testid="error-toasts-node" />,
    homeNode: <section data-testid="home-node">home</section>,
    showHome: false,
    showWorkspace: true,
    topbarLeftNode: <div data-testid="topbar-left-node">left</div>,
    centerMode: "chat" as const,
    preloadGitDiffs: false,
    messagesNode: <div data-testid="messages-node">messages</div>,
    gitDiffViewerNode: <button data-testid="git-diff-viewer-node">diff</button>,
    gitDiffPanelNode: <div data-testid="git-diff-panel-node" />,
    planPanelNode: <div data-testid="plan-panel-node" />,
    composerNode: <div data-testid="composer-node" />,
    terminalDockNode: <div data-testid="terminal-dock-node" />,
    debugPanelNode: <div data-testid="debug-panel-node" />,
    hasActivePlan: true,
    onSidebarResizeStart: vi.fn(),
    onRightPanelResizeStart: vi.fn(),
    onPlanPanelResizeStart: vi.fn(),
    onSidebarResizeKeyDown: vi.fn(),
    onRightPanelResizeKeyDown: vi.fn(),
    onPlanPanelResizeKeyDown: vi.fn(),
    sidebarWidth: 260,
    rightPanelWidth: 360,
    planPanelHeight: 180,
    sidebarResizeMin: 200,
    sidebarResizeMax: 420,
    rightPanelResizeMin: 280,
    rightPanelResizeMax: 520,
    planPanelResizeMin: 120,
    planPanelResizeMax: 360,
  };
}

describe("DesktopLayout", () => {
  it("renders home without workspace chrome when showWorkspace is false", () => {
    const props = createBaseProps();

    render(<DesktopLayout {...props} showHome showWorkspace={false} />);

    expect(screen.getByTestId("home-node")).toBeTruthy();
    expect(screen.queryByTestId("topbar-left-node")).toBeNull();
    expect(screen.queryByTestId("approval-toasts-node")).toBeNull();
    expect(screen.queryByTestId("composer-node")).toBeNull();
  });

  it("renders chat mode paths and wires all resizer handlers", () => {
    const props = createBaseProps();

    render(<DesktopLayout {...props} hasActivePlan={false} />);

    expect(screen.getByTestId("messages-node")).toBeTruthy();
    expect(screen.queryByTestId("git-diff-viewer-node")).toBeNull();

    const contentLayers = document.querySelectorAll<HTMLDivElement>(".content-layer");
    expect(contentLayers).toHaveLength(2);

    const diffLayer = contentLayers[0];
    const chatLayer = contentLayers[1];
    expect(diffLayer.getAttribute("aria-hidden")).toBe("true");
    expect(diffLayer.hasAttribute("inert")).toBe(true);
    expect(chatLayer.getAttribute("aria-hidden")).toBe("false");
    expect(chatLayer.hasAttribute("inert")).toBe(false);

    const rightPanel = document.querySelector(".right-panel");
    expect(rightPanel?.classList.contains("plan-collapsed")).toBe(true);

    const sidebarResizer = screen.getByLabelText("调整侧栏大小");
    const rightResizer = screen.getByLabelText("调整右侧面板大小");
    const planResizer = screen.getByLabelText("调整方案面板大小");

    expect(sidebarResizer.getAttribute("aria-valuenow")).toBe("260");
    expect(rightResizer.getAttribute("aria-valuenow")).toBe("360");
    expect(planResizer.getAttribute("aria-valuenow")).toBe("180");

    fireEvent.mouseDown(sidebarResizer);
    fireEvent.keyDown(sidebarResizer, { key: "ArrowLeft" });
    fireEvent.mouseDown(rightResizer);
    fireEvent.keyDown(rightResizer, { key: "ArrowRight" });
    fireEvent.mouseDown(planResizer);
    fireEvent.keyDown(planResizer, { key: "ArrowDown" });

    expect(props.onSidebarResizeStart).toHaveBeenCalledTimes(1);
    expect(props.onSidebarResizeKeyDown).toHaveBeenCalledTimes(1);
    expect(props.onRightPanelResizeStart).toHaveBeenCalledTimes(1);
    expect(props.onRightPanelResizeKeyDown).toHaveBeenCalledTimes(1);
    expect(props.onPlanPanelResizeStart).toHaveBeenCalledTimes(1);
    expect(props.onPlanPanelResizeKeyDown).toHaveBeenCalledTimes(1);
  });

  it("keeps diff viewer preloaded and blurs focused element when switching modes", () => {
    const props = createBaseProps();

    const chatFocusNode = <button data-testid="chat-focus-node">chat-focus</button>;
    const { rerender } = render(
      <DesktopLayout
        {...props}
        preloadGitDiffs
        centerMode="chat"
        messagesNode={chatFocusNode}
      />,
    );

    expect(screen.getByTestId("git-diff-viewer-node")).toBeTruthy();

    const chatButton = screen.getByTestId("chat-focus-node");
    chatButton.focus();
    expect(document.activeElement).toBe(chatButton);

    rerender(
      <DesktopLayout
        {...props}
        preloadGitDiffs
        centerMode="diff"
        messagesNode={chatFocusNode}
      />,
    );

    const contentLayers = document.querySelectorAll<HTMLDivElement>(".content-layer");
    const diffLayer = contentLayers[0];
    const chatLayer = contentLayers[1];

    expect(diffLayer.getAttribute("aria-hidden")).toBe("false");
    expect(diffLayer.hasAttribute("inert")).toBe(false);
    expect(chatLayer.getAttribute("aria-hidden")).toBe("true");
    expect(chatLayer.hasAttribute("inert")).toBe(true);
    expect(document.activeElement).toBe(document.body);
  });
});
