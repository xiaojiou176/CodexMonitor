// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DebugEntry } from "../../../types";
import { DebugPanel } from "./DebugPanel";

function createEntry(overrides: Partial<DebugEntry>): DebugEntry {
  return {
    id: overrides.id ?? "entry-id",
    timestamp: overrides.timestamp ?? Date.UTC(2026, 1, 27, 10, 0, 0),
    source: overrides.source ?? "client",
    label: overrides.label ?? "default label",
    payload: overrides.payload,
  };
}

describe("DebugPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("does not render when dock variant is closed", () => {
    render(
      <DebugPanel
        entries={[]}
        isOpen={false}
        onClear={() => {}}
        onCopy={() => {}}
        variant="dock"
      />,
    );

    expect(screen.queryByText("调试")).toBeNull();
  });

  it("renders shell but hides list when full variant is not open", () => {
    render(
      <DebugPanel
        entries={[]}
        isOpen={false}
        onClear={() => {}}
        onCopy={() => {}}
        variant="full"
      />,
    );

    expect(screen.getByText("调试").textContent).toBe("调试");
    expect(screen.queryByRole("tabpanel")).toBeNull();
  });

  it("shows resizer and triggers actions", () => {
    const onClear = vi.fn();
    const onCopy = vi.fn();
    const onResizeStart = vi.fn();

    render(
      <DebugPanel
        entries={[]}
        isOpen
        onClear={onClear}
        onCopy={onCopy}
        onResizeStart={onResizeStart}
      />,
    );

    fireEvent.mouseDown(screen.getByRole("separator"));
    fireEvent.click(screen.getByRole("button", { name: "复制" }));
    fireEvent.click(screen.getByRole("button", { name: "清空" }));

    expect(onResizeStart).toHaveBeenCalledTimes(1);
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("shows empty state and no-match state", () => {
    const entries = [
      createEntry({
        id: "e1",
        source: "client",
        label: "startup",
        payload: "ready",
      }),
    ];

    const { rerender } = render(
      <DebugPanel entries={[]} isOpen onClear={() => {}} onCopy={() => {}} />,
    );
    expect(screen.getByText("暂无调试事件。").textContent).toBe("暂无调试事件。");

    rerender(
      <DebugPanel entries={entries} isOpen onClear={() => {}} onCopy={() => {}} />,
    );
    fireEvent.change(screen.getByRole("searchbox", { name: "搜索日志" }), {
      target: { value: "no-hit-keyword" },
    });

    expect(screen.getByText("没有匹配的日志。").textContent).toBe("没有匹配的日志。");
  });

  it("filters by level tabs and toggles only-errors", () => {
    const entries = [
      createEntry({ id: "i1", source: "client", label: "normal info" }),
      createEntry({ id: "w1", source: "client", label: "warning raised" }),
      createEntry({ id: "e1", source: "client", label: "request failed" }),
    ];

    render(
      <DebugPanel entries={entries} isOpen onClear={() => {}} onCopy={() => {}} />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "错误" }));
    expect(screen.queryByText("request failed")).not.toBeNull();
    expect(screen.queryByText("normal info")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "全部" }));
    fireEvent.click(screen.getByLabelText("仅错误"));

    expect(screen.queryByText("request failed")).not.toBeNull();
    expect(screen.queryByText("warning raised")).toBeNull();
  });

  it("supports keyboard navigation for level filter tabs", () => {
    const entries = [createEntry({ id: "entry", label: "sample" })];
    render(
      <DebugPanel entries={entries} isOpen onClear={() => {}} onCopy={() => {}} />,
    );

    const tabAll = screen.getByRole("tab", { name: "全部" });
    const tabError = screen.getByRole("tab", { name: "错误" });
    const tabWarn = screen.getByRole("tab", { name: "警告" });
    const tabInfo = screen.getByRole("tab", { name: "信息" });

    fireEvent.keyDown(tabAll, { key: "ArrowRight" });
    expect(tabError.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(tabError, { key: "End" });
    expect(tabInfo.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(tabInfo, { key: "Home" });
    expect(tabAll.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(tabWarn, { key: "Enter" });
    expect(tabWarn.getAttribute("aria-selected")).toBe("true");
  });

  it("renders ansi payload styles and level badges", () => {
    const entries = [
      createEntry({
        id: "stderr",
        source: "stderr",
        label: "stderr line",
      }),
      createEntry({
        id: "warn",
        source: "client",
        label: "warn detected",
      }),
      createEntry({
        id: "ansi",
        source: "client",
        label: "ansi payload",
        payload: "\u001b[31mRED\u001b[0m",
      }),
      createEntry({
        id: "json",
        source: "event",
        label: "structured payload",
        payload: { ok: true, message: "hello" },
      }),
    ];

    const { container } = render(
      <DebugPanel entries={entries} isOpen onClear={() => {}} onCopy={() => {}} />,
    );

    expect(container.querySelector(".debug-level.error")).not.toBeNull();
    expect(container.querySelector(".debug-level.warn")).not.toBeNull();
    expect(container.querySelector(".debug-level.info")).not.toBeNull();
    expect(container.querySelector(".debug-ansi-fg-red")?.textContent).toBe("RED");
    expect(screen.getByText(/"message": "hello"/).textContent).toContain("hello");
  });

  it("auto-scrolls on updates and stops when disabled", () => {
    const firstEntries = [createEntry({ id: "first", label: "first" })];
    const secondEntries = [
      ...firstEntries,
      createEntry({ id: "second", label: "second", timestamp: Date.UTC(2026, 1, 27, 10, 1, 0) }),
    ];
    const thirdEntries = [
      ...secondEntries,
      createEntry({ id: "third", label: "third", timestamp: Date.UTC(2026, 1, 27, 10, 2, 0) }),
    ];

    const { container, rerender } = render(
      <DebugPanel
        entries={firstEntries}
        isOpen
        onClear={() => {}}
        onCopy={() => {}}
      />,
    );

    const list = container.querySelector(".debug-list") as HTMLDivElement;
    expect(list).not.toBeNull();

    Object.defineProperty(list, "scrollHeight", {
      configurable: true,
      value: 120,
    });
    list.scrollTop = 0;

    rerender(
      <DebugPanel
        entries={secondEntries}
        isOpen
        onClear={() => {}}
        onCopy={() => {}}
      />,
    );
    expect(list.scrollTop).toBe(120);

    fireEvent.click(screen.getByLabelText("自动滚动"));

    Object.defineProperty(list, "scrollHeight", {
      configurable: true,
      value: 360,
    });
    list.scrollTop = 33;

    rerender(
      <DebugPanel
        entries={thirdEntries}
        isOpen
        onClear={() => {}}
        onCopy={() => {}}
      />,
    );
    expect(list.scrollTop).toBe(33);
  });
});
