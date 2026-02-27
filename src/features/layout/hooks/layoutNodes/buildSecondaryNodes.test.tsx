// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSecondaryNodes } from "./buildSecondaryNodes";

const spies = vi.hoisted(() => ({
  planPanel: vi.fn(),
  terminalDock: vi.fn(),
  terminalPanel: vi.fn(),
  debugPanel: vi.fn(),
}));

vi.mock("../../../plan/components/PlanPanel", () => ({
  PlanPanel: (props: Record<string, unknown>) => {
    spies.planPanel(props);
    return <div data-testid="plan-panel" />;
  },
}));

vi.mock("../../../terminal/components/TerminalDock", () => ({
  TerminalDock: (props: Record<string, unknown>) => {
    spies.terminalDock(props);
    return (
      <div data-testid="terminal-dock">
        {props.terminalNode as ReactNode}
      </div>
    );
  },
}));

vi.mock("../../../terminal/components/TerminalPanel", () => ({
  TerminalPanel: (props: Record<string, unknown>) => {
    spies.terminalPanel(props);
    return <div data-testid="terminal-panel" />;
  },
}));

vi.mock("../../../debug/components/DebugPanel", () => ({
  DebugPanel: (props: Record<string, unknown>) => {
    spies.debugPanel(props);
    return <div data-testid="debug-panel" data-variant={String(props.variant ?? "default")} />;
  },
}));

function createOptions(overrides: Record<string, unknown> = {}) {
  return {
    plan: { id: "plan-1", title: "Plan" },
    isProcessing: true,
    terminalOpen: true,
    terminalTabs: [{ id: "t-1", title: "Shell" }],
    activeTerminalId: "t-1",
    onSelectTerminal: vi.fn(),
    onNewTerminal: vi.fn(),
    onCloseTerminal: vi.fn(),
    onResizeTerminal: vi.fn(),
    terminalState: {
      containerRef: { current: null },
      status: "ready",
      message: "ok",
    },
    debugOpen: true,
    debugEntries: [{ id: "d-1", level: "info", message: "debug" }],
    onClearDebug: vi.fn(),
    onCopyDebug: vi.fn(),
    onResizeDebug: vi.fn(),
    onGoProjects: vi.fn(),
    centerMode: "diff",
    selectedDiffPath: "src/main.ts",
    onBackFromDiff: vi.fn(),
    onShowSelectedDiff: vi.fn(),
    ...overrides,
  } as any;
}

describe("buildSecondaryNodes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders plan/terminal/debug nodes only when enabled", () => {
    const enabled = buildSecondaryNodes(createOptions());
    render(
      <>
        {enabled.planPanelNode}
        {enabled.terminalDockNode}
        {enabled.debugPanelNode}
      </>,
    );

    expect(screen.getByTestId("plan-panel")).toBeTruthy();
    expect(screen.getByTestId("terminal-dock")).toBeTruthy();
    expect(screen.getByTestId("debug-panel")).toBeTruthy();

    const disabled = buildSecondaryNodes(
      createOptions({ plan: null, terminalOpen: false, debugOpen: false }),
    );

    expect(disabled.planPanelNode).toBeNull();
    expect(disabled.terminalDockNode).toBeNull();
    expect(disabled.debugPanelNode).toBeNull();
  });

  it("passes terminal panel node only when terminal state exists", () => {
    const withState = buildSecondaryNodes(createOptions());
    render(<>{withState.terminalDockNode}</>);

    const withStateProps = spies.terminalDock.mock.calls[0][0] as {
      terminalNode: unknown;
    };
    expect(withStateProps.terminalNode).toBeTruthy();
    expect(spies.terminalPanel).toHaveBeenCalledTimes(1);

    cleanup();
    vi.clearAllMocks();

    const withoutState = buildSecondaryNodes(createOptions({ terminalState: null }));
    render(<>{withoutState.terminalDockNode}</>);

    const withoutStateProps = spies.terminalDock.mock.calls[0][0] as {
      terminalNode: unknown;
    };
    expect(withoutStateProps.terminalNode).toBeNull();
    expect(spies.terminalPanel).not.toHaveBeenCalled();
  });

  it("always builds full debug panel variant", () => {
    const nodes = buildSecondaryNodes(createOptions({ debugOpen: false }));
    render(<>{nodes.debugPanelFullNode}</>);

    expect(screen.getByTestId("debug-panel").getAttribute("data-variant")).toBe("full");
  });

  it("wires compact empty actions to projects handler", () => {
    const onGoProjects = vi.fn();
    const nodes = buildSecondaryNodes(createOptions({ onGoProjects }));

    render(
      <>
        {nodes.compactEmptyCodexNode}
        {nodes.compactEmptyGitNode}
      </>,
    );

    const buttons = screen.getAllByRole("button", { name: "Go to Projects" });
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);

    expect(onGoProjects).toHaveBeenCalledTimes(2);
  });

  it("toggles compact git switch active state and diff disabled state", () => {
    const onBackFromDiff = vi.fn();
    const onShowSelectedDiff = vi.fn();

    const activeDiff = buildSecondaryNodes(
      createOptions({
        centerMode: "diff",
        selectedDiffPath: "src/main.ts",
        onBackFromDiff,
        onShowSelectedDiff,
      }),
    );

    render(<>{activeDiff.compactGitBackNode}</>);
    let filesButton = screen.getByRole("button", { name: "Files" });
    let diffButton = screen.getByRole("button", { name: "Diff" });

    expect(filesButton.className).not.toContain("active");
    expect(diffButton.className).toContain("active");
    expect(diffButton.getAttribute("disabled")).toBeNull();

    fireEvent.click(filesButton);
    fireEvent.click(diffButton);
    expect(onBackFromDiff).toHaveBeenCalledTimes(1);
    expect(onShowSelectedDiff).toHaveBeenCalledTimes(1);

    cleanup();

    const inactiveDiff = buildSecondaryNodes(
      createOptions({ centerMode: "chat", selectedDiffPath: null }),
    );
    render(<>{inactiveDiff.compactGitBackNode}</>);

    filesButton = screen.getByRole("button", { name: "Files" });
    diffButton = screen.getByRole("button", { name: "Diff" });

    expect(filesButton.className).toContain("active");
    expect(diffButton.className).not.toContain("active");
    expect(diffButton.getAttribute("disabled")).not.toBeNull();
  });
});
