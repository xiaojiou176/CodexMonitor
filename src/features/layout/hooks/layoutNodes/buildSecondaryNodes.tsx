import { DebugPanel } from "../../../debug/components/DebugPanel";
import { PlanPanel } from "../../../plan/components/PlanPanel";
import { TerminalDock } from "../../../terminal/components/TerminalDock";
import { TerminalPanel } from "../../../terminal/components/TerminalPanel";
import type { LayoutNodesOptions, LayoutNodesResult } from "./types";

type SecondaryLayoutNodes = Pick<
  LayoutNodesResult,
  | "planPanelNode"
  | "debugPanelNode"
  | "debugPanelFullNode"
  | "terminalDockNode"
  | "compactEmptyCodexNode"
  | "compactEmptyGitNode"
  | "compactGitBackNode"
>;

export function buildSecondaryNodes(options: LayoutNodesOptions): SecondaryLayoutNodes {
  // Only mount PlanPanel when there is an active plan to display
  const planPanelNode = options.plan ? (
    <PlanPanel plan={options.plan} isProcessing={options.isProcessing} />
  ) : null;

  // Only mount TerminalDock when it is open to avoid mounting hooks/XTerm when hidden
  const terminalDockNode = options.terminalOpen ? (
    <TerminalDock
      isOpen
      terminals={options.terminalTabs}
      activeTerminalId={options.activeTerminalId}
      onSelectTerminal={options.onSelectTerminal}
      onNewTerminal={options.onNewTerminal}
      onCloseTerminal={options.onCloseTerminal}
      onResizeStart={options.onResizeTerminal}
      terminalNode={
        options.terminalState ? (
          <TerminalPanel
            containerRef={options.terminalState.containerRef}
            status={options.terminalState.status}
            message={options.terminalState.message}
          />
        ) : null
      }
    />
  ) : null;

  // Only mount DebugPanel when it is visible
  const debugPanelNode = options.debugOpen ? (
    <DebugPanel
      entries={options.debugEntries}
      isOpen
      onClear={options.onClearDebug}
      onCopy={options.onCopyDebug}
      onResizeStart={options.onResizeDebug}
    />
  ) : null;

  const debugPanelFullNode = (
    <DebugPanel
      entries={options.debugEntries}
      isOpen
      onClear={options.onClearDebug}
      onCopy={options.onCopyDebug}
      variant="full"
    />
  );

  const compactEmptyCodexNode = (
    <div className="compact-empty">
      <h3>未选择工作区</h3>
      <p>选择一个项目开始对话。</p>
      <button className="ghost" onClick={options.onGoProjects}>
        Go to Projects
      </button>
    </div>
  );

  const compactEmptyGitNode = (
    <div className="compact-empty">
      <h3>未选择工作区</h3>
      <p>选择一个项目查看差异。</p>
      <button className="ghost" onClick={options.onGoProjects}>
        Go to Projects
      </button>
    </div>
  );

  const compactGitDiffActive =
    options.centerMode === "diff" && Boolean(options.selectedDiffPath);
  const compactGitBackNode = (
    <div className="compact-git-back">
      <button
        type="button"
        className={`compact-git-switch-button${compactGitDiffActive ? "" : " active"}`}
        onClick={options.onBackFromDiff}
      >
        Files
      </button>
      <button
        type="button"
        className={`compact-git-switch-button${compactGitDiffActive ? " active" : ""}`}
        onClick={options.onShowSelectedDiff}
        disabled={!options.selectedDiffPath}
      >
        Diff
      </button>
    </div>
  );

  return {
    planPanelNode,
    debugPanelNode,
    debugPanelFullNode,
    terminalDockNode,
    compactEmptyCodexNode,
    compactEmptyGitNode,
    compactGitBackNode,
  };
}
