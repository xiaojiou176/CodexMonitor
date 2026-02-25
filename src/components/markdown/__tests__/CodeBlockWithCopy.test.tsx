// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Markdown } from "../../../features/messages/components/Markdown";

const clipboardWriteText = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

vi.mock("../../../services/tauri", () => ({
  readWorkspaceFile: vi.fn(),
}));

const BLOCK_MARKDOWN = "```ts\nconst value = 42;\nconsole.log(value);\n```";
const EXPECTED_FENCED_TEXT = "```ts\nconst value = 42;\nconsole.log(value);\n```";

describe("CodeBlockWithCopy", () => {
  beforeEach(() => {
    clipboardWriteText.mockClear();
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: {
        writeText: clipboardWriteText,
      },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("renders an accessible copy button for code blocks", () => {
    render(<Markdown value={BLOCK_MARKDOWN} codeBlockStyle="message" />);

    const copyButton = screen.getByRole("button", { name: "复制代码块" });
    expect(copyButton).not.toBeNull();
    (copyButton as HTMLButtonElement).focus();
    expect(document.activeElement).toBe(copyButton);
  });

  it("writes code to clipboard when copy is clicked", async () => {
    render(<Markdown value={BLOCK_MARKDOWN} codeBlockStyle="message" />);

    const copyButton = screen.getByRole("button", { name: "复制代码块" });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledTimes(1);
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(EXPECTED_FENCED_TEXT);
  });

  it("falls back to execCommand when Clipboard API is unavailable", async () => {
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });

    const originalExecCommand = Object.getOwnPropertyDescriptor(document, "execCommand");
    const execCommandMock = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      value: execCommandMock,
      configurable: true,
      writable: true,
    });

    try {
      render(<Markdown value={BLOCK_MARKDOWN} codeBlockStyle="message" />);

      const copyButton = screen.getByRole("button", { name: "复制代码块" });
      await act(async () => {
        fireEvent.click(copyButton);
      });

      expect(execCommandMock).toHaveBeenCalledTimes(1);
      expect(execCommandMock).toHaveBeenCalledWith("copy");
      expect(copyButton.textContent).toBe("已复制");
      expect(clipboardWriteText).not.toHaveBeenCalled();
    } finally {
      if (originalExecCommand) {
        Object.defineProperty(document, "execCommand", originalExecCommand);
      } else {
        Reflect.deleteProperty(document, "execCommand");
      }
    }
  });

  it("shows copied state and recovers after timeout", async () => {
    vi.useFakeTimers();
    render(<Markdown value={BLOCK_MARKDOWN} codeBlockStyle="message" />);

    const copyButton = screen.getByRole("button", { name: "复制代码块" });
    expect(copyButton.textContent).toBe("复制");

    await act(async () => {
      fireEvent.click(copyButton);
    });
    expect(copyButton.textContent).toBe("已复制");

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(copyButton.textContent).toBe("复制");
  });
});
