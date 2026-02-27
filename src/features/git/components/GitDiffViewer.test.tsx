/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GitHubPullRequest, GitHubPullRequestComment } from "../../../types";
import { GitDiffViewer } from "./GitDiffViewer";

const askMock = vi.hoisted(() => vi.fn());
const scrollToIndexMock = vi.hoisted(() => vi.fn());
const useVirtualizerMock = vi.hoisted(() => vi.fn());
const parsePatchFilesMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: (...args: unknown[]) => askMock(...args),
}));

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: (...args: unknown[]) => useVirtualizerMock(...args),
}));

vi.mock("@pierre/diffs/react", () => ({
  WorkerPoolContextProvider: ({ children }: { children: unknown }) => (
    <>{children}</>
  ),
  FileDiff: ({ fileDiff }: { fileDiff: { name: string } }) => (
    <div data-testid="file-diff">{fileDiff.name}</div>
  ),
}));

vi.mock("@pierre/diffs", async () => {
  const actual = await vi.importActual<typeof import("@pierre/diffs")>("@pierre/diffs");
  return {
    ...actual,
    parsePatchFiles: (...args: unknown[]) => parsePatchFilesMock(...args),
  };
});

vi.mock("../../messages/components/Markdown", () => ({
  Markdown: ({ value }: { value: string }) => <div>{value}</div>,
}));

vi.mock("../../../utils/time", () => ({
  formatRelativeTime: () => "just now",
}));

vi.mock("./ImageDiffCard", () => ({
  ImageDiffCard: ({ path }: { path: string }) => (
    <div data-testid="image-diff-card">{path}</div>
  ),
}));

type DiffItem = {
  path: string;
  status: string;
  diff: string;
  isImage?: boolean;
};

const pr: GitHubPullRequest = {
  number: 42,
  title: "Improve diff viewer",
  url: "https://example.test/pr/42",
  updatedAt: "2026-01-01T00:00:00.000Z",
  createdAt: "2025-12-30T00:00:00.000Z",
  body: "PR body markdown",
  headRefName: "feature/diff",
  baseRefName: "main",
  isDraft: false,
  author: { login: "alice" },
};

const comments: GitHubPullRequestComment[] = [
  {
    id: 1,
    body: "oldest",
    createdAt: "2026-01-01T00:00:00.000Z",
    url: "https://example.test/1",
    author: { login: "u1" },
  },
  {
    id: 2,
    body: "second",
    createdAt: "2026-01-02T00:00:00.000Z",
    url: "https://example.test/2",
    author: { login: "u2" },
  },
  {
    id: 3,
    body: "third",
    createdAt: "2026-01-03T00:00:00.000Z",
    url: "https://example.test/3",
    author: { login: "u3" },
  },
  {
    id: 4,
    body: "latest",
    createdAt: "2026-01-04T00:00:00.000Z",
    url: "https://example.test/4",
    author: { login: "u4" },
  },
];

const baseDiff: DiffItem = {
  path: "src/example.ts",
  status: "M",
  diff: "diff --git a/src/example.ts b/src/example.ts\n--- a/src/example.ts\n+++ b/src/example.ts\n@@ -1 +1 @@\n-old\n+new\n",
};

function setupVirtualizer(itemCount: number) {
  const items = Array.from({ length: itemCount }, (_, index) => ({
    index,
    start: index * 120,
  }));
  useVirtualizerMock.mockReturnValue({
    getVirtualItems: () => items,
    getTotalSize: () => Math.max(1, itemCount) * 120,
    scrollToIndex: scrollToIndexMock,
    measureElement: vi.fn(),
  });
}

describe("GitDiffViewer", () => {
  beforeEach(() => {
    askMock.mockReset();
    scrollToIndexMock.mockReset();
    useVirtualizerMock.mockReset();
    parsePatchFilesMock.mockReset();
    parsePatchFilesMock.mockReturnValue([
      {
        files: [
          {
            name: "a/src/example.ts",
            prevName: "b/src/example.ts",
          },
        ],
      },
    ]);
    setupVirtualizer(1);
    if (!("scrollTo" in HTMLElement.prototype)) {
      Object.defineProperty(HTMLElement.prototype, "scrollTo", {
        value: vi.fn(),
        configurable: true,
      });
    } else {
      vi.spyOn(HTMLElement.prototype, "scrollTo").mockImplementation(() => {});
    }
  });

  it("renders whitespace-only placeholder and sticky header path split", () => {
    render(
      <GitDiffViewer
        diffs={[{ ...baseDiff, diff: "" }]}
        selectedPath="src/example.ts"
        isLoading={false}
        error={null}
        ignoreWhitespaceChanges
      />,
    );

    expect(screen.getByText("无非空白字符改动。")).toBeTruthy();
    expect(screen.getAllByText("example.ts").length).toBeGreaterThan(0);
    expect(screen.getAllByText("src/").length).toBeGreaterThan(0);
  });

  it("computes PR stats and supports timeline expand/collapse", () => {
    render(
      <GitDiffViewer
        diffs={[
          baseDiff,
          {
            path: "src/extra.ts",
            status: "M",
            diff: "diff --git a/src/extra.ts b/src/extra.ts\n--- a/src/extra.ts\n+++ b/src/extra.ts\n@@ -1,2 +1,2 @@\n-a\n-b\n+c\n+d\n",
          },
        ]}
        selectedPath="src/example.ts"
        isLoading={false}
        error={null}
        pullRequest={pr}
        pullRequestComments={comments}
        pullRequestCommentsLoading={false}
        pullRequestCommentsError={null}
      />,
    );

    expect(screen.getByRole("button", { name: "跳转到首个文件" }).textContent).toContain(
      "+3/-3",
    );
    expect(screen.getByText("1 条更早评论")).toBeTruthy();
    expect(screen.queryByText("oldest")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "显示全部" }));
    expect(screen.getByText("oldest")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "收起" }));
    expect(screen.queryByText("oldest")).toBeNull();
  });

  it("confirms before revert and skips revert when cancelled", async () => {
    const onRevertFile = vi.fn(async () => {});
    askMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    render(
      <GitDiffViewer
        diffs={[baseDiff]}
        selectedPath="src/example.ts"
        isLoading={false}
        error={null}
        canRevert
        onRevertFile={onRevertFile}
      />,
    );

    const revertButtons = screen.getAllByLabelText("丢弃该文件更改");
    fireEvent.click(revertButtons[0]);
    await waitFor(() => expect(onRevertFile).toHaveBeenCalledTimes(1));
    expect(onRevertFile).toHaveBeenCalledWith("src/example.ts");

    fireEvent.click(revertButtons[1]);
    await waitFor(() => expect(askMock).toHaveBeenCalledTimes(2));
    expect(onRevertFile).toHaveBeenCalledTimes(1);
  });

  it("handles loading, error and image diff branches", () => {
    setupVirtualizer(1);
    const { rerender } = render(
      <GitDiffViewer
        diffs={[baseDiff]}
        selectedPath="src/example.ts"
        isLoading
        error={null}
      />,
    );
    expect(screen.getByText("正在刷新 diff...")).toBeTruthy();

    setupVirtualizer(1);
    rerender(
      <GitDiffViewer
        diffs={[{ path: "assets/logo.png", status: "A", diff: "", isImage: true }]}
        selectedPath="assets/logo.png"
        isLoading={false}
        error={null}
      />,
    );
    expect(screen.getByTestId("image-diff-card").textContent).toContain("assets/logo.png");

    setupVirtualizer(0);
    rerender(
      <GitDiffViewer diffs={[]} selectedPath={null} isLoading={false} error="加载失败" />,
    );
    expect(screen.getByText("加载失败")).toBeTruthy();
  });

  it("syncs active path when scrolled to the bottom", async () => {
    vi.useFakeTimers();
    setupVirtualizer(2);
    const onActivePathChange = vi.fn();
    const { container } = render(
      <GitDiffViewer
        diffs={[baseDiff, { ...baseDiff, path: "src/second.ts" }]}
        selectedPath="src/example.ts"
        isLoading={false}
        error={null}
        onActivePathChange={onActivePathChange}
      />,
    );

    const scroller = container.querySelector(".diff-viewer");
    expect(scroller).not.toBeNull();
    Object.defineProperty(scroller as Element, "scrollHeight", {
      value: 400,
      configurable: true,
    });
    Object.defineProperty(scroller as Element, "clientHeight", {
      value: 200,
      configurable: true,
    });
    Object.defineProperty(scroller as Element, "scrollTop", {
      value: 200,
      configurable: true,
    });

    fireEvent.scroll(scroller as Element);
    vi.runAllTimers();
    expect(onActivePathChange).toHaveBeenCalledWith("src/second.ts");
    vi.useRealTimers();
  });
});
