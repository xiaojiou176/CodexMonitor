import { useMemo, useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import type { TerminalTab } from "../hooks/useTerminalTabs";

type TerminalDockProps = {
  isOpen: boolean;
  terminals: TerminalTab[];
  activeTerminalId: string | null;
  onSelectTerminal: (terminalId: string) => void;
  onNewTerminal: () => void;
  onCloseTerminal: (terminalId: string) => void;
  onResizeStart?: (event: ReactMouseEvent) => void;
  terminalNode: ReactNode;
};

export function TerminalDock({
  isOpen,
  terminals,
  activeTerminalId,
  onSelectTerminal,
  onNewTerminal,
  onCloseTerminal,
  onResizeStart,
  terminalNode,
}: TerminalDockProps) {
  const tabButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabPanelId = "terminal-tabpanel";
  const tabIds = useMemo(
    () =>
      terminals.map((tab) => ({
        id: tab.id,
        elementId: `terminal-tab-${tab.id}`,
      })),
    [terminals],
  );

  if (!isOpen) {
    return null;
  }

  const handleTabKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
    terminalId: string,
  ) => {
    const terminalCount = terminals.length;
    if (terminalCount === 0) {
      return;
    }
    const focusByIndex = (nextIndex: number) => {
      const normalizedIndex = (nextIndex + terminalCount) % terminalCount;
      const target = tabButtonRefs.current[normalizedIndex];
      if (!target) {
        return;
      }
      target.focus();
      onSelectTerminal(terminals[normalizedIndex].id);
    };

    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusByIndex(currentIndex + 1);
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusByIndex(currentIndex - 1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusByIndex(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      focusByIndex(terminalCount - 1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectTerminal(terminalId);
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onCloseTerminal(terminalId);
    }
  };

  const activeTabElementId =
    tabIds.find((item) => item.id === activeTerminalId)?.elementId ??
    tabIds[0]?.elementId;

  return (
    <section className="terminal-panel">
      {onResizeStart && (
        <div
          className="terminal-panel-resizer"
          role="separator"
          aria-orientation="horizontal"
          aria-label="调整终端面板大小"
          onMouseDown={onResizeStart}
        />
      )}
      <div className="terminal-header">
        <div
          className="terminal-tabs"
          role="tablist"
          aria-label="终端标签"
          aria-orientation="horizontal"
        >
          {terminals.map((tab, index) => {
            const tabElementId = tabIds[index]?.elementId ?? `terminal-tab-${tab.id}`;
            const isActive = tab.id === activeTerminalId;
            return (
              <div
                key={tab.id}
                className="terminal-tab-group"
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <button
                  type="button"
                  className={`terminal-tab${
                    isActive ? " active" : ""
                  }`}
                  id={tabElementId}
                  ref={(node) => {
                    tabButtonRefs.current[index] = node;
                  }}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={tabPanelId}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => onSelectTerminal(tab.id)}
                  onKeyDown={(event) => handleTabKeyDown(event, index, tab.id)}
                >
                  <span className="terminal-tab-label">{tab.title}</span>
                </button>
                <button
                  type="button"
                  className="terminal-tab-close"
                  aria-label={`关闭 ${tab.title}`}
                  title={`关闭 ${tab.title}`}
                  onClick={() => onCloseTerminal(tab.id)}
                >
                  <span aria-hidden>×</span>
                </button>
              </div>
            );
          })}
          <button
            className="terminal-tab-add"
            type="button"
            onClick={onNewTerminal}
            aria-label="新建终端"
            title="新建终端"
          >
            +
          </button>
        </div>
      </div>
      <div
        id={tabPanelId}
        className="terminal-body"
        role="tabpanel"
        aria-labelledby={activeTabElementId}
      >
        {terminalNode}
      </div>
    </section>
  );
}
