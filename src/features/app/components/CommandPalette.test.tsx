// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandPalette, useCommandPalette, type CommandItem } from "./CommandPalette";

const actionA = vi.fn();
const actionB = vi.fn();
const actionC = vi.fn();

const commands: CommandItem[] = [
  {
    id: "cmd-a",
    label: "Open Workspace",
    section: "Workspace",
    shortcut: "Cmd+O",
    action: actionA,
  },
  {
    id: "cmd-b",
    label: "Close Workspace",
    section: "Workspace",
    shortcut: "Cmd+W",
    action: actionB,
  },
  {
    id: "cmd-c",
    label: "Toggle Terminal",
    section: "View",
    action: actionC,
  },
];

describe("useCommandPalette", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("toggles open state via Ctrl/Cmd+K and supports close", () => {
    const { result } = renderHook(() => useCommandPalette(commands));

    expect(result.current.open).toBe(false);

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(result.current.open).toBe(true);

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(result.current.open).toBe(false);

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(result.current.open).toBe(true);

    act(() => {
      result.current.close();
    });
    expect(result.current.open).toBe(false);
  });
});

describe("CommandPalette", () => {
  const onClose = vi.fn();
  let rafSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    rafSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 1;
      });
    if (!HTMLElement.prototype.scrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        value: vi.fn(),
        writable: true,
      });
    }
  });

  afterEach(() => {
    cleanup();
    rafSpy.mockRestore();
  });

  it("does not render when closed and renders dialog when open", () => {
    const { rerender } = render(<CommandPalette commands={commands} open={false} onClose={onClose} />);

    expect(screen.queryByRole("dialog", { name: "命令菜单" })).toBeNull();

    rerender(<CommandPalette commands={commands} open onClose={onClose} />);

    expect(screen.getByRole("dialog", { name: "命令菜单" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "搜索命令" })).toBeTruthy();
  });

  it("filters commands by query and shows empty state when no command matches", () => {
    render(<CommandPalette commands={commands} open onClose={onClose} />);

    const searchInput = screen.getByRole("textbox", { name: "搜索命令" });

    fireEvent.change(searchInput, { target: { value: "toggle" } });
    expect(screen.getByRole("option", { name: /Toggle Terminal/i })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Open Workspace/i })).toBeNull();

    fireEvent.change(searchInput, { target: { value: "workspace" } });
    expect(screen.getByRole("option", { name: /Open Workspace/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Close Workspace/i })).toBeTruthy();

    fireEvent.change(searchInput, { target: { value: "does-not-exist" } });
    expect(screen.getByText("未找到匹配命令")).toBeTruthy();
  });

  it("closes on Escape and overlay click", () => {
    render(<CommandPalette commands={commands} open onClose={onClose} />);

    const searchInput = screen.getByRole("textbox", { name: "搜索命令" });
    fireEvent.keyDown(searchInput, { key: "Escape" });

    const overlay = document.querySelector(".command-palette-overlay");
    if (!overlay) {
      throw new Error("Missing command palette overlay");
    }
    fireEvent.mouseDown(overlay);

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("supports keyboard selection and triggers action via Enter", () => {
    render(<CommandPalette commands={commands} open onClose={onClose} />);

    const searchInput = screen.getByRole("textbox", { name: "搜索命令" });

    fireEvent.keyDown(searchInput, { key: "ArrowDown" });
    fireEvent.keyDown(searchInput, { key: "Enter" });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(actionA).not.toHaveBeenCalled();
    expect(actionB).toHaveBeenCalledTimes(1);
    expect(actionC).not.toHaveBeenCalled();
  });

  it("supports ArrowUp wrap selection and triggers the last item", () => {
    render(<CommandPalette commands={commands} open onClose={onClose} />);

    const searchInput = screen.getByRole("textbox", { name: "搜索命令" });

    fireEvent.keyDown(searchInput, { key: "ArrowUp" });
    fireEvent.keyDown(searchInput, { key: "Enter" });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(actionA).not.toHaveBeenCalled();
    expect(actionB).not.toHaveBeenCalled();
    expect(actionC).toHaveBeenCalledTimes(1);
  });

  it("triggers action when clicking command option", () => {
    render(<CommandPalette commands={commands} open onClose={onClose} />);

    fireEvent.click(screen.getByRole("option", { name: /Toggle Terminal/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(actionC).toHaveBeenCalledTimes(1);
  });
});
