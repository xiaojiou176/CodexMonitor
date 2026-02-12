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
    useFileLinkOpenerMock.mockClear();
    openFileLinkMock.mockReset();
    showFileLinkMenuMock.mockReset();
    readWorkspaceFileMock.mockReset();
    readWorkspaceFileMock.mockResolvedValue({
      content: "line-1\nline-2\nline-3\nline-4",
      truncated: false,
    });
  });

  it("renders image grid above message text and opens lightbox", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-1",
        kind: "message",
        role: "user",
        text: "Hello",
        images: ["data:image/png;base64,AAA"],
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

    const bubble = container.querySelector(".message-bubble");
    const grid = container.querySelector(".message-image-grid");
    const markdown = container.querySelector(".markdown");
    expect(bubble).toBeTruthy();
    expect(grid).toBeTruthy();
    expect(markdown).toBeTruthy();
    if (grid && markdown) {
      expect(bubble?.firstChild).toBe(grid);
    }
    const openButton = screen.getByRole("button", { name: "Open image 1" });
    fireEvent.click(openButton);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("preserves newlines when images are attached", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-2",
        kind: "message",
        role: "user",
        text: "Line 1\n\n- item 1\n- item 2",
        images: ["data:image/png;base64,AAA"],
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

    const markdown = container.querySelector(".markdown");
    expect(markdown).toBeTruthy();
    expect(markdown?.textContent ?? "").toContain("Line 1");
    expect(markdown?.textContent ?? "").toContain("item 1");
    expect(markdown?.textContent ?? "").toContain("item 2");
  });

  it("keeps literal [image] text when images are attached", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-3",
        kind: "message",
        role: "user",
        text: "Literal [image] token",
        images: ["data:image/png;base64,AAA"],
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

    const markdown = container.querySelector(".markdown");
    expect(markdown?.textContent ?? "").toContain("Literal [image] token");
  });

  it("collapses long user messages by default and toggles expand/collapse", () => {
    const longText = Array.from({ length: 220 }, (_, index) => `line-${index} content`)
      .join("\n")
      .trim();
    const items: ConversationItem[] = [
      {
        id: "msg-long-user",
        kind: "message",
        role: "user",
        text: longText,
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

    expect(container.querySelector(".message-user-preview")).toBeTruthy();
    expect(screen.getByRole("button", { name: "展开全文" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "收起" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "展开全文" }));

    expect(container.querySelector(".message-user-preview")).toBeNull();
    expect(screen.getByRole("button", { name: "收起" })).toBeTruthy();
    expect(container.querySelector(".markdown")?.textContent ?? "").toContain(
      "line-219 content",
    );

    fireEvent.click(screen.getByRole("button", { name: "收起" }));

    expect(container.querySelector(".message-user-preview")).toBeTruthy();
    expect(screen.getByRole("button", { name: "展开全文" })).toBeTruthy();
  });

  it("keeps very long unbroken user text inside long-message mode", () => {
    const longUnbrokenText = `prefix-${"x".repeat(1400)}-suffix`;
    const items: ConversationItem[] = [
      {
        id: "msg-long-unbroken",
        kind: "message",
        role: "user",
        text: longUnbrokenText,
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

    expect(container.querySelector(".message-bubble-long-user")).toBeTruthy();
    expect(container.querySelector(".message-user-preview")).toBeTruthy();
    expect(screen.getByRole("button", { name: "展开全文" })).toBeTruthy();
  });

  it("auto-collapses long assistant messages older than the latest five", () => {
    const makeLongAssistantText = (label: string) =>
      `${label} start\n${"x".repeat(1600)}\n${label}-TAIL`;

    const items: ConversationItem[] = Array.from({ length: 7 }, (_, index) => ({
      id: `msg-assistant-${index + 1}`,
      kind: "message" as const,
      role: "assistant" as const,
      text: makeLongAssistantText(`assistant-${index + 1}`),
    }));

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

    const expandButtons = screen.getAllByRole("button", { name: "展开全文" });
    expect(expandButtons).toHaveLength(2);
    expect(container.textContent ?? "").not.toContain("assistant-1-TAIL");
    expect(container.textContent ?? "").not.toContain("assistant-2-TAIL");
    expect(container.textContent ?? "").toContain("assistant-3-TAIL");

    fireEvent.click(expandButtons[0]);
    expect(container.textContent ?? "").toContain("assistant-1-TAIL");
  });

  it("opens linked review thread when clicking thread link", () => {
    const onOpenThreadLink = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "msg-thread-link",
        kind: "message",
        role: "assistant",
        text: "Detached review completed. [Open review thread](/thread/thread-review-1)",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-parent"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onOpenThreadLink={onOpenThreadLink}
      />,
    );

    fireEvent.click(screen.getByText("Open review thread"));
    expect(onOpenThreadLink).toHaveBeenCalledWith("thread-review-1");
  });

  it("does not render unknown markdown links as hyperlinks", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-unknown-link",
        kind: "message",
        role: "assistant",
        text: "⚠️ 需改进：[可读性](可读性)、[架构优雅性](架构优雅性)",
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

    expect(container.textContent ?? "").toContain("可读性");
    expect(container.textContent ?? "").toContain("架构优雅性");
    expect(container.querySelector('a[href="可读性"]')).toBeNull();
    expect(container.querySelector('a[href="架构优雅性"]')).toBeNull();
  });

  it("renders file references as compact links and opens them", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-file-link",
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
      />,
    );

    const fileLinkName = screen.getByText("DocumentListView.swift");
    const fileLink = container.querySelector(".message-file-link");
    expect(fileLinkName).toBeTruthy();
    expect(fileLink).toBeTruthy();
    expect(fileLink?.getAttribute("title")).toBe(
      "DocumentListView.swift · L111 · iosApp/src/views/DocumentsList",
    );

    fireEvent.click(fileLink as Element);
    expect(openFileLinkMock).toHaveBeenCalledWith(
      "iosApp/src/views/DocumentsList/DocumentListView.swift:111",
    );
  });

  it("stores full file path metadata on compact file links", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-file-link-copy",
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
    const fileLink = container.querySelector(".message-file-link");
    expect(fileLinkName?.textContent).toBe("Markdown.tsx");
    expect(fileLink).toBeTruthy();
    expect(fileLink?.getAttribute("data-copy-text")).toBe(
      "src/features/messages/components/Markdown.tsx:5",
    );
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
    expect(markdown).toBeTruthy();

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
    expect(textNode).toBeTruthy();

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
    expect(fileLink).toBeTruthy();
    fireEvent.mouseEnter(fileLink as Element);

    await waitFor(() => {
      expect(readWorkspaceFileMock).toHaveBeenCalledWith(
        "ws-1",
        "src/features/messages/components/Markdown.tsx",
      );
    });
    expect(screen.getByText("line-5 target")).toBeTruthy();
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
    const workspacePath = "/Users/dimillian/Documents/Dev/CodexMonitor";
    const absolutePath =
      "/Users/dimillian/Documents/Dev/CodexMonitor/src/features/messages/components/Markdown.tsx:244";
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

    expect(screen.getByText("Markdown.tsx")).toBeTruthy();
    expect(container.textContent ?? "").not.toContain("L244");
    expect(container.textContent ?? "").not.toContain("src/features/messages/components");

    const fileLink = container.querySelector(".message-file-link");
    expect(fileLink?.getAttribute("title")).toBe(
      "Markdown.tsx · L244 · src/features/messages/components",
    );
    expect(fileLink).toBeTruthy();
    fireEvent.click(fileLink as Element);
    expect(openFileLinkMock).toHaveBeenCalledWith(absolutePath);
  });

  it("renders absolute file references outside workspace using dotdot-relative paths", () => {
    const workspacePath = "/Users/dimillian/Documents/Dev/CodexMonitor";
    const absolutePath = "/Users/dimillian/Documents/Other/IceCubesApp/file.rs:123";
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

    expect(screen.getByText("file.rs")).toBeTruthy();
    expect(container.textContent ?? "").not.toContain("L123");
    expect(container.textContent ?? "").not.toContain("../../Other/IceCubesApp");

    const fileLink = container.querySelector(".message-file-link");
    expect(fileLink?.getAttribute("title")).toBe("file.rs · L123 · ../../Other/IceCubesApp");
    expect(fileLink).toBeTruthy();
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

  it("renders malformed relative markdown links as plain text", () => {
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

    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector(".message-file-link")).toBeNull();
    expect(container.textContent ?? "").toContain(".././././../..");
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

  it("renders reasoning rows when there is reasoning body content", () => {
    const items: ConversationItem[] = [
      {
        id: "reasoning-2",
        kind: "reasoning",
        summary: "Scanning repository\nLooking for entry points",
        content: "",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 2_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector(".reasoning-inline")).toBeTruthy();
    const reasoningDetail = container.querySelector(".reasoning-inline-detail");
    expect(reasoningDetail?.textContent ?? "").toContain("Looking for entry points");
    const workingText = container.querySelector(".working-text");
    expect(workingText?.textContent ?? "").toContain("Scanning repository");
  });

  it("uses content for the reasoning title when summary is empty", () => {
    const items: ConversationItem[] = [
      {
        id: "reasoning-content-title",
        kind: "reasoning",
        summary: "",
        content: "Plan from content\nMore detail here",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_500}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const workingText = container.querySelector(".working-text");
    expect(workingText?.textContent ?? "").toContain("Plan from content");
    const reasoningDetail = container.querySelector(".reasoning-inline-detail");
    expect(reasoningDetail?.textContent ?? "").toContain("More detail here");
    expect(reasoningDetail?.textContent ?? "").not.toContain("Plan from content");
  });

  it("does not show a stale reasoning label from a previous turn", () => {
    const items: ConversationItem[] = [
      {
        id: "reasoning-old",
        kind: "reasoning",
        summary: "Old reasoning title",
        content: "",
      },
      {
        id: "assistant-msg",
        kind: "message",
        role: "assistant",
        text: "Previous assistant response",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 800}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const workingText = container.querySelector(".working-text");
    // With the fixed phase logic, without isStreaming the indicator stays in
    // "start" phase ("等待 Agent 响应…") rather than falsely claiming output.
    expect(workingText?.textContent ?? "").toContain("等待 Agent 响应");
    expect(workingText?.textContent ?? "").not.toContain("Old reasoning title");
  });

  it("keeps the latest title-only reasoning label without rendering a reasoning row", () => {
    const items: ConversationItem[] = [
      {
        id: "reasoning-title-only",
        kind: "reasoning",
        summary: "Indexing workspace",
        content: "",
      },
      {
        id: "tool-after-reasoning",
        kind: "tool",
        title: "Command: rg --files",
        detail: "/tmp",
        toolType: "commandExecution",
        output: "",
        status: "running",
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
    expect(workingText?.textContent ?? "").toContain("Indexing workspace");
    expect(container.querySelector(".reasoning-inline")).toBeNull();
  });

  it("merges consecutive explore items under a single explored block", async () => {
    const items: ConversationItem[] = [
      {
        id: "explore-1",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "search", label: "Find routes" }],
      },
      {
        id: "explore-2",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "read", label: "routes.ts" }],
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

    await waitFor(() => {
      expect(container.querySelector(".explore-inline")).toBeTruthy();
    });
    const exploreItems = container.querySelectorAll(".explore-inline-item");
    expect(exploreItems.length).toBe(2);
    expect(screen.getByText("Search Find routes")).toBeTruthy();
    expect(screen.getByText("Read routes.ts")).toBeTruthy();
  });

  it("uses the latest explore status when merging a consecutive run", async () => {
    const items: ConversationItem[] = [
      {
        id: "explore-started",
        kind: "explore",
        status: "exploring",
        entries: [{ kind: "search", label: "starting" }],
      },
      {
        id: "explore-finished",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "read", label: "finished" }],
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

    await waitFor(() => {
      expect(container.querySelectorAll(".explore-inline").length).toBe(1);
    });
    expect(container.querySelector(".tool-inline-dot.completed")).toBeTruthy();
    expect(screen.getByText("Read finished")).toBeTruthy();
  });

  it("does not merge explore items across interleaved tools", async () => {
    const items: ConversationItem[] = [
      {
        id: "explore-a",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "search", label: "Find reducers" }],
      },
      {
        id: "tool-a",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: rg reducers",
        detail: "/repo",
        status: "completed",
        output: "",
      },
      {
        id: "explore-b",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "read", label: "useThreadsReducer.ts" }],
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

    await waitFor(() => {
      const exploreBlocks = container.querySelectorAll(".explore-inline");
      expect(exploreBlocks.length).toBe(2);
    });
    const exploreItems = container.querySelectorAll(".explore-inline-item");
    expect(exploreItems.length).toBe(2);
    expect(screen.getByText("Ran command")).toBeTruthy();
  });

  it("preserves chronology when reasoning with body appears between explore items", async () => {
    const items: ConversationItem[] = [
      {
        id: "explore-1",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "search", label: "first explore" }],
      },
      {
        id: "reasoning-body",
        kind: "reasoning",
        summary: "Reasoning title\nReasoning body",
        content: "",
      },
      {
        id: "explore-2",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "read", label: "second explore" }],
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

    await waitFor(() => {
      expect(container.querySelectorAll(".explore-inline").length).toBe(2);
    });
    const exploreBlocks = Array.from(container.querySelectorAll(".explore-inline"));
    const reasoningDetail = container.querySelector(".reasoning-inline-detail");
    expect(exploreBlocks.length).toBe(2);
    expect(reasoningDetail).toBeTruthy();
    const [firstExploreBlock, secondExploreBlock] = exploreBlocks;
    const firstBeforeReasoning =
      firstExploreBlock.compareDocumentPosition(reasoningDetail as Node) &
      Node.DOCUMENT_POSITION_FOLLOWING;
    const reasoningBeforeSecond =
      (reasoningDetail as Node).compareDocumentPosition(secondExploreBlock) &
      Node.DOCUMENT_POSITION_FOLLOWING;
    expect(firstBeforeReasoning).toBeTruthy();
    expect(reasoningBeforeSecond).toBeTruthy();
  });

  it("does not merge across message boundaries and does not drop messages", async () => {
    const items: ConversationItem[] = [
      {
        id: "explore-before",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "search", label: "before message" }],
      },
      {
        id: "assistant-msg",
        kind: "message",
        role: "assistant",
        text: "A message between explore blocks",
      },
      {
        id: "explore-after",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "read", label: "after message" }],
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

    await waitFor(() => {
      const exploreBlocks = container.querySelectorAll(".explore-inline");
      expect(exploreBlocks.length).toBe(2);
    });
    expect(screen.getByText("A message between explore blocks")).toBeTruthy();
  });

  it("renders explore steps inline without synthetic group summary", async () => {
    const items: ConversationItem[] = [
      {
        id: "tool-1",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: git status --porcelain=v1",
        detail: "/repo",
        status: "completed",
        output: "",
      },
      {
        id: "explore-steps-1",
        kind: "explore",
        status: "explored",
        entries: [
          { kind: "read", label: "Messages.tsx" },
          { kind: "search", label: "toolCount" },
        ],
      },
      {
        id: "explore-steps-2",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "read", label: "types.ts" }],
      },
      {
        id: "tool-2",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: git diff -- src/features/messages/components/Messages.tsx",
        detail: "/repo",
        status: "completed",
        output: "",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Read Messages.tsx")).toBeTruthy();
    });
    expect(screen.getByText("Search toolCount")).toBeTruthy();
    expect(screen.getAllByText("Ran command")).toHaveLength(2);
  });

  it("renders dense tool sequences without group header text", async () => {
    const items: ConversationItem[] = [
      {
        id: "tool-dense-1",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: rg -n foo src",
        detail: "/repo",
        status: "completed",
        output: "",
      },
      {
        id: "tool-dense-2",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: rg -n bar src",
        detail: "/repo",
        status: "completed",
        output: "",
      },
      {
        id: "tool-dense-3",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: rg -n baz src",
        detail: "/repo",
        status: "completed",
        output: "",
      },
      {
        id: "tool-dense-4",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: rg -n qux src",
        detail: "/repo",
        status: "completed",
        output: "",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByText("Ran command")).toHaveLength(4);
    });
    expect(screen.queryByText(/次执行/)).toBeNull();
  });

  it("re-pins to bottom on thread switch even when previous thread was scrolled up", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-shared",
        kind: "message",
        role: "assistant",
        text: "Shared tail",
      },
    ];

    const { container, rerender } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const messagesNode = container.querySelector(".messages.messages-full");
    expect(messagesNode).toBeTruthy();
    const scrollNode = messagesNode as HTMLDivElement;

    Object.defineProperty(scrollNode, "clientHeight", {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(scrollNode, "scrollHeight", {
      configurable: true,
      value: 600,
    });
    scrollNode.scrollTop = 100;
    fireEvent.scroll(scrollNode);

    Object.defineProperty(scrollNode, "scrollHeight", {
      configurable: true,
      value: 900,
    });

    rerender(
      <Messages
        items={items}
        threadId="thread-2"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(scrollNode.scrollTop).toBe(900);
  });

  it("keeps user scroll position when new items stream in the same thread", () => {
    const initialItems: ConversationItem[] = [
      {
        id: "msg-1",
        kind: "message",
        role: "assistant",
        text: "First reply",
      },
    ];

    const streamedItems: ConversationItem[] = [
      ...initialItems,
      {
        id: "msg-2",
        kind: "message",
        role: "assistant",
        text: "Second reply chunk",
      },
    ];

    const { container, rerender } = render(
      <Messages
        items={initialItems}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={true}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const messagesNode = container.querySelector(".messages.messages-full");
    expect(messagesNode).toBeTruthy();
    const scrollNode = messagesNode as HTMLDivElement;

    Object.defineProperty(scrollNode, "clientHeight", {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(scrollNode, "scrollHeight", {
      configurable: true,
      value: 1000,
    });

    scrollNode.scrollTop = 220;
    fireEvent.scroll(scrollNode);

    Object.defineProperty(scrollNode, "scrollHeight", {
      configurable: true,
      value: 1300,
    });

    rerender(
      <Messages
        items={streamedItems}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={true}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(scrollNode.scrollTop).toBe(220);
  });

  it("auto-triggers top-history callback once on scroll-to-top", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-top-1",
        kind: "message",
        role: "assistant",
        text: "Older content",
      },
      {
        id: "msg-top-2",
        kind: "message",
        role: "assistant",
        text: "Newer content",
      },
    ];

    const onReachTop = vi.fn(() => new Promise<void>(() => {}));

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onReachTop={onReachTop}
      />,
    );

    const messagesNode = container.querySelector(".messages.messages-full");
    expect(messagesNode).toBeTruthy();
    const scrollNode = messagesNode as HTMLDivElement;

    Object.defineProperty(scrollNode, "clientHeight", {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(scrollNode, "scrollHeight", {
      configurable: true,
      value: 800,
    });

    scrollNode.scrollTop = 0;
    fireEvent.scroll(scrollNode);
    fireEvent.scroll(scrollNode);

    expect(onReachTop).toHaveBeenCalledTimes(1);
  });

  it("does not render explicit load-older button at the top", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-explicit-1",
        kind: "message",
        role: "assistant",
        text: "Latest content",
      },
    ];

    const onReachTop = vi.fn();

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onReachTop={onReachTop}
      />,
    );

    expect(screen.queryByRole("button", { name: "加载更早消息" })).toBeNull();
    expect(onReachTop).toHaveBeenCalledTimes(0);
  });

  it("applies assistant divider class by logical order, not DOM adjacency", () => {
    const items: ConversationItem[] = [
      {
        id: "assistant-first",
        kind: "message",
        role: "assistant",
        text: "First assistant",
      },
      {
        id: "assistant-second",
        kind: "message",
        role: "assistant",
        text: "Second assistant",
      },
      {
        id: "user-third",
        kind: "message",
        role: "user",
        text: "User message",
      },
      {
        id: "assistant-fourth",
        kind: "message",
        role: "assistant",
        text: "Third assistant",
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

    const dividerRows = container.querySelectorAll(
      ".messages-virtual-row.item-message-assistant-divider",
    );
    expect(dividerRows.length).toBe(2);
  });

  it("shows a plan-ready follow-up prompt after a completed plan tool item", () => {
    const onPlanAccept = vi.fn();
    const onPlanSubmitChanges = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "plan-1",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "completed",
        status: "completed",
        output: "- Step 1",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onPlanAccept={onPlanAccept}
        onPlanSubmitChanges={onPlanSubmitChanges}
      />,
    );

    expect(screen.getByText("方案就绪")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "执行此方案" }),
    ).toBeTruthy();
  });

  it("hides the plan-ready follow-up once the user has replied after the plan", () => {
    const onPlanAccept = vi.fn();
    const onPlanSubmitChanges = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "plan-2",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "completed",
        status: "completed",
        output: "Plan text",
      },
      {
        id: "user-after-plan",
        kind: "message",
        role: "user",
        text: "OK",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onPlanAccept={onPlanAccept}
        onPlanSubmitChanges={onPlanSubmitChanges}
      />,
    );

    expect(screen.queryByText("方案就绪")).toBeNull();
  });

  it("hides the plan-ready follow-up when the plan tool item is still running", () => {
    const onPlanAccept = vi.fn();
    const onPlanSubmitChanges = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "plan-3",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "Generating plan...",
        status: "in_progress",
        output: "Partial plan",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={true}
        openTargets={[]}
        selectedOpenAppId=""
        onPlanAccept={onPlanAccept}
        onPlanSubmitChanges={onPlanSubmitChanges}
      />,
    );

    expect(screen.queryByText("方案就绪")).toBeNull();
  });

  it("shows the plan-ready follow-up once the turn stops thinking even if the plan status stays in_progress", () => {
    const onPlanAccept = vi.fn();
    const onPlanSubmitChanges = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "plan-stuck-in-progress",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "Generating plan...",
        status: "in_progress",
        output: "Plan text",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onPlanAccept={onPlanAccept}
        onPlanSubmitChanges={onPlanSubmitChanges}
      />,
    );

    expect(screen.getByText("方案就绪")).toBeTruthy();
  });

  it("calls the plan follow-up callbacks", () => {
    const onPlanAccept = vi.fn();
    const onPlanSubmitChanges = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "plan-4",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "completed",
        status: "completed",
        output: "Plan text",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onPlanAccept={onPlanAccept}
        onPlanSubmitChanges={onPlanSubmitChanges}
      />,
    );

    const sendChangesButton = screen.getByRole("button", { name: "发送修改" });
    expect((sendChangesButton as HTMLButtonElement).disabled).toBe(true);

    const textarea = screen.getByPlaceholderText(
      "描述你想修改的内容...",
    );
    fireEvent.change(textarea, { target: { value: "Add error handling" } });

    expect((sendChangesButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(sendChangesButton);
    expect(onPlanSubmitChanges).toHaveBeenCalledWith("Add error handling");
    expect(screen.queryByText("方案就绪")).toBeNull();
  });

  it("dismisses the plan-ready follow-up when the plan is accepted", () => {
    const onPlanAccept = vi.fn();
    const onPlanSubmitChanges = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "plan-accept",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "completed",
        status: "completed",
        output: "Plan text",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onPlanAccept={onPlanAccept}
        onPlanSubmitChanges={onPlanSubmitChanges}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "执行此方案" }),
    );
    expect(onPlanAccept).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("方案就绪")).toBeNull();
  });

  it("does not render plan-ready tagged internal user messages", () => {
    const onPlanAccept = vi.fn();
    const onPlanSubmitChanges = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "plan-6",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "completed",
        status: "completed",
        output: "Plan text",
      },
      {
        id: "internal-user",
        kind: "message",
        role: "user",
        text: "[[cm_plan_ready:accept]] Implement this plan.",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onPlanAccept={onPlanAccept}
        onPlanSubmitChanges={onPlanSubmitChanges}
      />,
    );

    expect(screen.queryByText(/cm_plan_ready/)).toBeNull();
    expect(screen.queryByText("方案就绪")).toBeNull();
  });

  it("hides the plan follow-up when an input-requested bubble is active", () => {
    const onPlanAccept = vi.fn();
    const onPlanSubmitChanges = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "plan-5",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "completed",
        status: "completed",
        output: "Plan text",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        userInputRequests={[
          {
            workspace_id: "ws-1",
            request_id: 1,
            params: {
              thread_id: "thread-1",
              turn_id: "turn-1",
              item_id: "item-1",
              questions: [],
            },
          },
        ]}
        onUserInputSubmit={vi.fn()}
        onPlanAccept={onPlanAccept}
        onPlanSubmitChanges={onPlanSubmitChanges}
      />,
    );

    expect(screen.getByText("需要你的输入")).toBeTruthy();
    expect(screen.queryByText("方案就绪")).toBeNull();
  });
});
