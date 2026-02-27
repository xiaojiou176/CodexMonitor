// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TerminalTab } from "../hooks/useTerminalTabs";
import { TerminalDock } from "./TerminalDock";

function renderDock(options?: {
  terminals?: TerminalTab[];
  activeTerminalId?: string | null;
  isOpen?: boolean;
  onResizeStart?: (event: ReactMouseEvent) => void;
}) {
  const onSelectTerminal = vi.fn();
  const onNewTerminal = vi.fn();
  const onCloseTerminal = vi.fn();
  const terminals = options?.terminals ?? [
    { id: "term-1", title: "Terminal 1" },
    { id: "term-2", title: "Terminal 2" },
    { id: "term-3", title: "Terminal 3" },
  ];

  render(
    <TerminalDock
      isOpen={options?.isOpen ?? true}
      terminals={terminals}
      activeTerminalId={options?.activeTerminalId ?? terminals[0]?.id ?? null}
      onSelectTerminal={onSelectTerminal}
      onNewTerminal={onNewTerminal}
      onCloseTerminal={onCloseTerminal}
      onResizeStart={options?.onResizeStart}
      terminalNode={
        <div>
          <p>暂无终端会话</p>
          <button type="button">快捷入口</button>
        </div>
      }
    />,
  );

  return { onSelectTerminal, onNewTerminal, onCloseTerminal };
}

describe("TerminalDock", () => {
  afterEach(() => {
    cleanup();
  });

  it("does not render when closed", () => {
    renderDock({ isOpen: false });
    expect(screen.queryByRole("tablist", { name: "终端标签" })).toBeNull();
  });

  it("renders empty-state terminal node and quick-entry button", () => {
    const { onNewTerminal } = renderDock({
      terminals: [],
      activeTerminalId: null,
    });

    expect(screen.getByText("暂无终端会话").textContent).toBe("暂无终端会话");
    expect(screen.getByRole("button", { name: "快捷入口" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "新建终端" }));
    expect(onNewTerminal).toHaveBeenCalledTimes(1);
  });

  it("switches and closes tabs via click actions", () => {
    const { onSelectTerminal, onCloseTerminal } = renderDock();

    fireEvent.click(screen.getByRole("tab", { name: "Terminal 2" }));
    fireEvent.click(screen.getByRole("button", { name: "关闭 Terminal 1" }));

    expect(onSelectTerminal).toHaveBeenCalledWith("term-2");
    expect(onCloseTerminal).toHaveBeenCalledWith("term-1");
  });

  it("supports keyboard navigation and close keys on tabs", () => {
    const { onSelectTerminal, onCloseTerminal } = renderDock();
    const tab1 = screen.getByRole("tab", { name: "Terminal 1" });
    const tab2 = screen.getByRole("tab", { name: "Terminal 2" });
    const tab3 = screen.getByRole("tab", { name: "Terminal 3" });

    fireEvent.keyDown(tab1, { key: "ArrowRight" });
    fireEvent.keyDown(tab2, { key: "ArrowLeft" });
    fireEvent.keyDown(tab1, { key: "End" });
    fireEvent.keyDown(tab3, { key: "Home" });
    fireEvent.keyDown(tab1, { key: "Enter" });
    fireEvent.keyDown(tab1, { key: " " });
    fireEvent.keyDown(tab2, { key: "Delete" });
    fireEvent.keyDown(tab3, { key: "Backspace" });

    expect(onSelectTerminal).toHaveBeenNthCalledWith(1, "term-2");
    expect(onSelectTerminal).toHaveBeenNthCalledWith(2, "term-1");
    expect(onSelectTerminal).toHaveBeenNthCalledWith(3, "term-3");
    expect(onSelectTerminal).toHaveBeenNthCalledWith(4, "term-1");
    expect(onSelectTerminal).toHaveBeenNthCalledWith(5, "term-1");
    expect(onSelectTerminal).toHaveBeenNthCalledWith(6, "term-1");
    expect(onCloseTerminal).toHaveBeenNthCalledWith(1, "term-2");
    expect(onCloseTerminal).toHaveBeenNthCalledWith(2, "term-3");
  });

  it("renders optional separator and forwards resize start", () => {
    const onResizeStart = vi.fn();
    renderDock({ onResizeStart });

    fireEvent.mouseDown(screen.getByRole("separator"));
    expect(onResizeStart).toHaveBeenCalledTimes(1);
  });
});
