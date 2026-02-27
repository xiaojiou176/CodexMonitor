// @vitest-environment jsdom
import { useCallback, useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";
import { Messages } from "./Messages";

const useFileLinkOpenerMock = vi.fn(
  (_workspacePath: string | null, _openTargets: unknown[], _selectedOpenAppId: string) => ({
    openFileLink: openFileLinkMock,
    showFileLinkMenu: showFileLinkMenuMock,
  }),
);
const openFileLinkMock = vi.fn();
const showFileLinkMenuMock = vi.fn();
const readWorkspaceFileMock = vi.hoisted(() => vi.fn());
const openUrlMock = vi.hoisted(() => vi.fn());

vi.mock("../../../services/tauri", async () => {
  const actual = await vi.importActual<typeof import("../../../services/tauri")>(
    "../../../services/tauri",
  );
  return {
    ...actual,
    readWorkspaceFile: (workspaceId: string, path: string) =>
      readWorkspaceFileMock(workspaceId, path),
  };
});

vi.mock("../hooks/useFileLinkOpener", () => ({
  useFileLinkOpener: (
    workspacePath: string | null,
    openTargets: unknown[],
    selectedOpenAppId: string,
  ) => useFileLinkOpenerMock(workspacePath, openTargets, selectedOpenAppId),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: (url: string) => openUrlMock(url),
}));

describe("Messages", () => {
  beforeAll(() => {
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = vi.fn();
    }
  });

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    window.localStorage.clear();
    useFileLinkOpenerMock.mockClear();
    openFileLinkMock.mockReset();
    showFileLinkMenuMock.mockReset();
    readWorkspaceFileMock.mockReset();
    openUrlMock.mockReset();
    readWorkspaceFileMock.mockResolvedValue({
      content: "line-1\nline-2\nline-3\nline-4",
      truncated: false,
    });
  });

  it("rewrites full-link selection copy text to full file path", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-file-link-copy-full",
        kind: "message",
        role: "assistant",
        text: "Ref: `src/features/messages/components/Markdown.tsx:5`",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const markdown = container.querySelector(".markdown") as HTMLElement | null;
    expect(markdown).not.toBeNull();

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(markdown as HTMLElement);
    selection?.removeAllRanges();
    selection?.addRange(range);

    const setData = vi.fn();
    fireEvent.copy(markdown as HTMLElement, {
      clipboardData: {
        setData,
      },
    });

    expect(setData).toHaveBeenCalledTimes(1);
    expect(setData).toHaveBeenCalledWith(
      "text/plain",
      "Ref: src/features/messages/components/Markdown.tsx:5",
    );

    selection?.removeAllRanges();
  });

  it("keeps native copy behavior for partial selection inside file links", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-file-link-copy-partial",
        kind: "message",
        role: "assistant",
        text: "Ref: `src/features/messages/components/Markdown.tsx:5`",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const fileLinkName = container.querySelector(".message-file-link-name");
    const textNode = fileLinkName?.firstChild;
    expect(textNode).not.toBeNull();

    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(textNode as Node, 0);
    range.setEnd(textNode as Node, 4);
    selection?.removeAllRanges();
    selection?.addRange(range);

    const setData = vi.fn();
    fireEvent.copy(container.querySelector(".markdown") as Element, {
      clipboardData: {
        setData,
      },
    });

    expect(setData).not.toHaveBeenCalled();

    selection?.removeAllRanges();
  });

  it("shows hover preview for workspace file references", async () => {
    readWorkspaceFileMock.mockResolvedValue({
      content: [
        "line-1",
        "line-2",
        "line-3",
        "line-4",
        "line-5 target",
        "line-6",
        "line-7",
        "line-8",
      ].join("\n"),
      truncated: false,
    });

    const items: ConversationItem[] = [
      {
        id: "msg-file-link-preview",
        kind: "message",
        role: "assistant",
        text: "Check `src/features/messages/components/Markdown.tsx:5`",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        workspacePath="/tmp/repo"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const fileLink = container.querySelector(".message-file-link");
    expect(fileLink).not.toBeNull();
    fireEvent.mouseEnter(fileLink as Element);

    await waitFor(() => {
      expect(readWorkspaceFileMock).toHaveBeenCalledWith(
        "ws-1",
        "src/features/messages/components/Markdown.tsx",
      );
    });
    await waitFor(() => {
      expect(screen.getByText("line-5 target")).not.toBeNull();
    });
  });

  it("clamps preview line lookup when requested line exceeds file length", async () => {
    readWorkspaceFileMock.mockResolvedValue({
      content: ["line-1", "line-2", "line-3 final"].join("\n"),
      truncated: false,
    });

    const items: ConversationItem[] = [
      {
        id: "msg-file-link-preview-overflow",
        kind: "message",
        role: "assistant",
        text: "Check `src/features/messages/components/Markdown.tsx:999`",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-preview-overflow"
        workspacePath="/tmp/repo"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const fileLink = container.querySelector(".message-file-link");
    expect(fileLink).not.toBeNull();
    fireEvent.mouseEnter(fileLink as Element);

    await waitFor(() => {
      expect(screen.getByText("line-3 final")).not.toBeNull();
    });
    expect(screen.queryByText("文件为空。")).toBeNull();
  });

  it("reuses cached hover preview payload for identical workspace files", async () => {
    readWorkspaceFileMock.mockResolvedValue({
      content: [
        "line-1",
        "line-2",
        "line-3",
        "line-4",
        "line-5 target",
        "line-6 target",
        "line-7",
      ].join("\n"),
      truncated: false,
    });

    const items: ConversationItem[] = [
      {
        id: "msg-file-link-preview-cache",
        kind: "message",
        role: "assistant",
        text:
          "Compare `src/features/messages/components/MessageRows.tsx:5` and `src/features/messages/components/MessageRows.tsx:6`",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        workspacePath="/tmp/repo"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const fileLinks = container.querySelectorAll(".message-file-link");
    expect(fileLinks.length).toBe(2);

    fireEvent.mouseEnter(fileLinks[0] as Element);
    await waitFor(() => {
      expect(readWorkspaceFileMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.mouseEnter(fileLinks[1] as Element);
    await waitFor(() => {
      expect(readWorkspaceFileMock).toHaveBeenCalledTimes(1);
    });
  });

  it("hides file parent paths when message file path display is disabled", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-file-link-hidden-path",
        kind: "message",
        role: "assistant",
        text: "Refactor candidate: `iosApp/src/views/DocumentsList/DocumentListView.swift:111`",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        showMessageFilePath={false}
      />,
    );

    const fileName = container.querySelector(".message-file-link-name");
    const fileLink = container.querySelector(".message-file-link");
    expect(fileName?.textContent).toBe("DocumentListView.swift");
    expect(container.textContent ?? "").not.toContain("L111");
    expect(container.textContent ?? "").not.toContain("iosApp/src/views/DocumentsList");
    expect(fileLink?.getAttribute("title")).toBe("DocumentListView.swift · L111");
  });

  it("renders absolute file references as workspace-relative paths", () => {
    const workspacePath = "/tmp/CodexMonitorWorkspace";
    const absolutePath =
      "/tmp/CodexMonitorWorkspace/src/features/messages/components/Markdown.tsx:244";
    const items: ConversationItem[] = [
      {
        id: "msg-file-link-absolute-inside",
        kind: "message",
        role: "assistant",
        text: `Reference: \`${absolutePath}\``,
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        workspacePath={workspacePath}
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(screen.getByText("Markdown.tsx")).not.toBeNull();
    expect(container.textContent ?? "").not.toContain("L244");
    expect(container.textContent ?? "").not.toContain("src/features/messages/components");

    const fileLink = container.querySelector(".message-file-link");
    expect(fileLink?.getAttribute("title")).toBe(
      "Markdown.tsx · L244 · src/features/messages/components",
    );
    expect(fileLink).not.toBeNull();
    fireEvent.click(fileLink as Element);
    expect(openFileLinkMock).toHaveBeenCalledWith(absolutePath);
  });

  it("renders absolute file references outside workspace using dotdot-relative paths", () => {
    const workspacePath = "/tmp/CodexMonitorWorkspace";
    const absolutePath = "/tmp/Other/IceCubesApp/file.rs:123";
    const items: ConversationItem[] = [
      {
        id: "msg-file-link-absolute-outside",
        kind: "message",
        role: "assistant",
        text: `Reference: \`${absolutePath}\``,
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        workspacePath={workspacePath}
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(screen.getByText("file.rs")).not.toBeNull();
    expect(container.textContent ?? "").not.toContain("L123");
    expect(container.textContent ?? "").not.toContain("../../Other/IceCubesApp");

    const fileLink = container.querySelector(".message-file-link");
    expect(fileLink?.getAttribute("title")).toBe("file.rs · L123 · ../Other/IceCubesApp");
    expect(fileLink).not.toBeNull();
    fireEvent.click(fileLink as Element);
    expect(openFileLinkMock).toHaveBeenCalledWith(absolutePath);
  });

  it("does not render dot-slash noise as clickable links", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-dot-slash-noise",
        kind: "message",
        role: "assistant",
        text: "我现在会先改 MessageRows.tsx：加入长用户消息默认折叠，并避免折叠态去渲染完整 .././././../.. Markdown。",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector(".message-file-link")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
  });

  it("keeps malformed relative markdown links as normal anchors, not file links", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-bad-relative-link",
        kind: "message",
        role: "assistant",
        text: "坏链接 [.././././../..](.././././../..) 不应渲染为可点击",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector('a[href=".././././../.."]')).not.toBeNull();
    expect(container.querySelector(".message-file-link")).toBeNull();
    expect(container.textContent ?? "").toContain(".././././../..");
  });

  it("does not convert plain slash words like 影响/成本 into file links", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-slash-plain-text",
        kind: "message",
        role: "assistant",
        text: "影响/成本: 低中，适合“非当前主战项目”。",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector(".message-file-link")).toBeNull();
  });

  it("renders tool output containing fences as plain code text", () => {
    const items: ConversationItem[] = [
      {
        id: "tool-fence-output",
        kind: "tool",
        toolType: "search",
        title: "Search: render output",
        detail: "/repo",
        status: "completed",
        output: ["before", "```bash", "echo hi", "```", "after"].join("\n"),
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "切换工具详情" }));
    expect(container.textContent ?? "").toContain("```bash");
    expect(container.textContent ?? "").toContain("echo hi");
    expect(container.textContent ?? "").toContain("after");
  });

  it("renders assistant meta when text is blank and formats context window tokens", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-assistant-meta-only",
        kind: "message",
        role: "assistant",
        text: "   ",
        model: " gemini-3.1-pro-preview ",
        contextWindow: 1530,
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.textContent ?? "").toContain("模型: gemini-3.1-pro-preview");
    expect(container.textContent ?? "").toContain("上下文窗口: 1.5K");
    expect(container.querySelector(".markdown")).toBeNull();
  });

  it("shows preview loading and failure boundary text", async () => {
    let rejectRead: ((reason?: unknown) => void) | undefined;
    readWorkspaceFileMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectRead = reject;
        }),
    );
    const items: ConversationItem[] = [
      {
        id: "msg-file-link-preview-failure",
        kind: "message",
        role: "assistant",
        text: "Check `src/features/messages/components/Markdown.tsx:5`",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-preview-loading"
        workspacePath="/tmp/repo"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const fileLink = container.querySelector(".message-file-link");
    expect(fileLink).not.toBeNull();
    fireEvent.mouseEnter(fileLink as Element);

    await waitFor(() => {
      expect(screen.getByText("正在读取文件...")).not.toBeNull();
    });

    rejectRead?.(new Error("disk offline"));
    await waitFor(() => {
      expect(screen.getByText("预览失败：disk offline")).not.toBeNull();
    });
  });

  it("shows truncated badge in file preview when backend marks payload truncated", async () => {
    readWorkspaceFileMock.mockResolvedValue({
      content: ["line-1", "line-2", "line-3"].join("\n"),
      truncated: true,
    });
    const items: ConversationItem[] = [
      {
        id: "msg-file-link-preview-truncated",
        kind: "message",
        role: "assistant",
        text: "Check `src/features/messages/components/Markdown.tsx:2`",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-preview-truncated"
        workspacePath="/tmp/repo"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const fileLink = container.querySelector(".message-file-link");
    expect(fileLink).not.toBeNull();
    fireEvent.mouseEnter(fileLink as Element);

    await waitFor(() => {
      expect(screen.getByText("已截断")).not.toBeNull();
    });
  });

  it("renders url-only fenced blocks as link groups and opens links", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-linkblock",
        kind: "message",
        role: "assistant",
        text: [
          "```text",
          "https://example.com/docs",
          "https://example.com/changelog",
          "```",
        ].join("\n"),
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector(".markdown-linkblock")).not.toBeNull();
    fireEvent.click(screen.getByText("https://example.com/docs"));
    fireEvent.click(screen.getByText("https://example.com/changelog"));

    expect(openUrlMock).toHaveBeenNthCalledWith(1, "https://example.com/docs");
    expect(openUrlMock).toHaveBeenNthCalledWith(2, "https://example.com/changelog");
  });

  it("keeps one-line fences as plain code and uses modifier for multi-line copy", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    const items: ConversationItem[] = [
      {
        id: "msg-single-line-fence",
        kind: "message",
        role: "assistant",
        text: ["```ts", "const one = 1;", "```"].join("\n"),
      },
      {
        id: "msg-multi-line-fence",
        kind: "message",
        role: "assistant",
        text: ["```ts", "const one = 1;", "const two = 2;", "```"].join("\n"),
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        codeBlockCopyUseModifier
      />,
    );

    expect(container.querySelectorAll(".markdown-codeblock-single").length).toBeGreaterThan(0);

    const copyButton = screen.getByRole("button", { name: "复制代码块" });
    fireEvent.click(copyButton);
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("const one = 1;\nconst two = 2;");
    });

    fireEvent.click(copyButton, { altKey: true });
    await waitFor(() => {
      expect(writeText).toHaveBeenLastCalledWith(
        "```ts\nconst one = 1;\nconst two = 2;\n```",
      );
    });
  });

  it("keeps long-running command output collapsed by default and supports re-collapse", () => {
    const items: ConversationItem[] = [
      {
        id: "tool-long-command-collapse",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: rg foo src",
        detail: "/repo",
        status: "completed",
        durationMs: 3200,
        output: ["line-1", "line-2", "line-3"].join("\n"),
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector(".tool-inline-terminal")).toBeNull();
    expect(container.textContent ?? "").not.toContain("line-1");

    const toggleButton = screen.getByRole("button", { name: "切换工具详情" });
    fireEvent.click(toggleButton);

    expect(container.querySelector(".tool-inline-terminal")).not.toBeNull();
    expect(container.textContent ?? "").toContain("line-1");

    fireEvent.click(toggleButton);

    expect(container.querySelector(".tool-inline-terminal")).toBeNull();
    expect(container.textContent ?? "").not.toContain("line-1");
  });

  it("keeps running command output collapsed until explicit expand", () => {
    const items: ConversationItem[] = [
      {
        id: "tool-running-command-collapse",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: npm run dev",
        detail: "/repo",
        status: "running",
        output: ["booting...", "ready"].join("\n"),
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={true}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector(".tool-inline-terminal")).toBeNull();
    expect(container.textContent ?? "").not.toContain("booting...");

    const toggleButton = screen.getByRole("button", { name: "切换工具详情" });
    fireEvent.click(toggleButton);
    expect(container.querySelector(".tool-inline-terminal")).not.toBeNull();
    expect(container.textContent ?? "").toContain("booting...");

    fireEvent.click(toggleButton);
    expect(container.querySelector(".tool-inline-terminal")).toBeNull();
  });

  it("toggles long user message collapse state between preview and full markdown", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-user-collapse-toggle",
        kind: "message",
        role: "user",
        text: Array.from({ length: 16 }, (_, index) => `line-${index + 1}`).join("\n"),
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-collapse-user"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const collapsedToggle = screen.getByRole("button", { name: "展开全文" });
    expect(collapsedToggle.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector(".message-user-collapsed")).not.toBeNull();
    expect(container.querySelector(".markdown")).toBeNull();

    fireEvent.click(collapsedToggle);
    const collapseButton = screen.getByRole("button", { name: "收起" });
    expect(collapseButton.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector(".markdown")).not.toBeNull();

    fireEvent.click(collapseButton);
    expect(screen.getByRole("button", { name: "展开全文" })).not.toBeNull();
    expect(container.querySelector(".message-user-collapsed")).not.toBeNull();
  });

  it("auto-collapses older long assistant messages and allows expand/collapse", () => {
    const shortUser: ConversationItem = {
      id: "msg-user-anchor",
      kind: "message",
      role: "user",
      text: "anchor",
    };
    const longAssistantText = Array.from(
      { length: 18 },
      (_, index) => `assistant-line-${index + 1}`,
    ).join("\n");
    const assistantItems: ConversationItem[] = Array.from({ length: 6 }, (_, index) => ({
      id: `msg-assistant-${index + 1}`,
      kind: "message",
      role: "assistant",
      text: longAssistantText,
    }));

    render(
      <Messages
        items={[shortUser, ...assistantItems]}
        threadId="thread-collapse-assistant"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const expandButtons = screen.getAllByRole("button", { name: "展开全文" });
    expect(expandButtons.length).toBe(1);

    fireEvent.click(expandButtons[0]);
    const collapseButtons = screen.getAllByRole("button", { name: "收起" });
    expect(collapseButtons.length).toBeGreaterThan(0);
  });

  it("renders file-change detail markdown fallback when no changed files are provided", () => {
    const items: ConversationItem[] = [
      {
        id: "tool-filechange-fallback-detail",
        kind: "tool",
        toolType: "fileChange",
        title: "Edit files",
        detail: "fallback detail body",
        status: "completed",
        changes: [],
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-tool-fallback"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "切换工具详情" }));
    expect(container.textContent ?? "").toContain("fallback detail body");
  });

  it("renders a blank preview line when backend returns empty file content", async () => {
    readWorkspaceFileMock.mockResolvedValue({
      content: "",
      truncated: false,
    });

    const items: ConversationItem[] = [
      {
        id: "msg-file-link-preview-empty",
        kind: "message",
        role: "assistant",
        text: "Check `src/features/messages/components/Markdown.tsx:10`",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-preview-empty"
        workspaceId="ws-preview-empty"
        workspacePath="/tmp/repo"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const fileLink = container.querySelector(".message-file-link");
    expect(fileLink).not.toBeNull();
    fireEvent.mouseEnter(fileLink as Element);

    await waitFor(() => {
      const previewLines = container.ownerDocument.querySelectorAll(
        ".message-file-link-preview-line",
      );
      expect(previewLines.length).toBe(1);
      expect(
        container.ownerDocument.querySelector(".message-file-link-preview-line-text")
          ?.textContent,
      ).toBe(" ");
    });
  });

  it("keeps hash anchors native, renders unsupported links as text, and opens external urls", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-link-fallback-branches",
        kind: "message",
        role: "assistant",
        text: [
          "[hash](#section)",
          "[unsupported](ftp://intranet.local/resource)",
          "[external](https://example.com/help)",
        ].join(" "),
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-link-fallback"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector('a[href="#section"]')).not.toBeNull();
    expect(container.querySelector('a[href="ftp://intranet.local/resource"]')).toBeNull();
    expect(container.textContent ?? "").toContain("unsupported");

    fireEvent.click(screen.getByText("external"));
    expect(openUrlMock).toHaveBeenCalledWith("https://example.com/help");
  });

  it("uses execCommand fallback when clipboard API is unavailable for code block copy", () => {
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    const originalExecCommand = (document as Document & { execCommand?: typeof document.execCommand })
      .execCommand;
    const execCommandMock = vi.fn(() => true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommandMock,
    });

    const items: ConversationItem[] = [
      {
        id: "msg-copy-fallback-exec-command",
        kind: "message",
        role: "assistant",
        text: ["```ts", "const fallback = true;", "const done = false;", "```"].join("\n"),
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-copy-fallback"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "复制代码块" }));
    expect(execCommandMock).toHaveBeenCalledWith("copy");

    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: originalExecCommand,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: originalClipboard,
    });
  });

  it("renders empty-state and loading-state placeholders for no-item threads", () => {
    const { rerender, container } = render(
      <Messages
        items={[]}
        threadId={null}
        workspaceId="ws-1"
        isThinking={false}
        isLoadingMessages={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.textContent ?? "").toContain("发送消息开始新对话。");

    rerender(
      <Messages
        items={[]}
        threadId="thread-empty-loading"
        workspaceId="ws-1"
        isThinking={false}
        isLoadingMessages
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(screen.getByText("正在加载对话记录…")).not.toBeNull();
  });

  it("does not re-render messages while typing when message props stay stable", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-stable-1",
        kind: "message",
        role: "assistant",
        text: "Stable content",
      },
    ];
    const openTargets: [] = [];
    function Harness() {
      const [draft, setDraft] = useState("");
      const handleOpenThreadLink = useCallback(() => {}, []);

      return (
        <div>
          <input
            aria-label="Draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Messages
            items={items}
            threadId="thread-stable"
            workspaceId="ws-1"
            isThinking={false}
            openTargets={openTargets}
            selectedOpenAppId=""
            onOpenThreadLink={handleOpenThreadLink}
          />
        </div>
      );
    }

    render(<Harness />);
    expect(useFileLinkOpenerMock).toHaveBeenCalledTimes(1);
    const input = screen.getByLabelText("Draft");
    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.change(input, { target: { value: "ab" } });
    fireEvent.change(input, { target: { value: "abc" } });

    expect(useFileLinkOpenerMock).toHaveBeenCalledTimes(1);
  });

  it("uses reasoning title for the working indicator and hides title-only reasoning rows", () => {
    const items: ConversationItem[] = [
      {
        id: "reasoning-1",
        kind: "reasoning",
        summary: "Scanning repository",
        content: "",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const workingText = container.querySelector(".working-text");
    expect(workingText?.textContent ?? "").toContain("Scanning repository");
    expect(container.querySelector(".reasoning-inline")).toBeNull();
  });

  it("keeps native copy behavior when selection contains no file-link nodes", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-copy-no-file-links",
        kind: "message",
        role: "assistant",
        text: "Plain text without path links should keep native copy.",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-copy-no-file-links"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const markdown = container.querySelector(".markdown") as HTMLElement | null;
    expect(markdown).not.toBeNull();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(markdown as HTMLElement);
    selection?.removeAllRanges();
    selection?.addRange(range);

    const setData = vi.fn();
    fireEvent.copy(markdown as HTMLElement, {
      clipboardData: {
        setData,
      },
    });
    expect(setData).not.toHaveBeenCalled();
    selection?.removeAllRanges();
  });

  it("opens file preview from keyboard focus and closes via Escape", async () => {
    readWorkspaceFileMock.mockResolvedValue({
      content: "line-1\nline-2 target\nline-3",
      truncated: false,
    });
    const items: ConversationItem[] = [
      {
        id: "msg-file-link-focus-escape",
        kind: "message",
        role: "assistant",
        text: "Focus `src/features/messages/components/Markdown.tsx:2`",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-focus-preview"
        workspaceId="ws-focus"
        workspacePath="/tmp/repo"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const link = container.querySelector(".message-file-link") as HTMLElement | null;
    expect(link).not.toBeNull();
    fireEvent.focus(link as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText("line-2 target")).not.toBeNull();
    });
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByText("line-2 target")).toBeNull();
    });
  });

  it("clicks preview open button to open full file path", async () => {
    readWorkspaceFileMock.mockResolvedValue({
      content: "line-1\nline-2 target\nline-3",
      truncated: false,
    });
    const items: ConversationItem[] = [
      {
        id: "msg-file-link-preview-open-button",
        kind: "message",
        role: "assistant",
        text: "Open `src/features/messages/components/Markdown.tsx:2`",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-preview-open-button"
        workspaceId="ws-open-btn"
        workspacePath="/tmp/repo"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const link = container.querySelector(".message-file-link") as HTMLElement | null;
    expect(link).not.toBeNull();
    fireEvent.mouseEnter(link as HTMLElement);
    await waitFor(() => {
      expect(screen.getByText("line-2 target")).not.toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "打开完整文件" }));
    expect(openFileLinkMock).toHaveBeenCalledWith(
      "src/features/messages/components/Markdown.tsx:2",
    );
  });

});
