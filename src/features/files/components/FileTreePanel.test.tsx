/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileTreePanel } from "./FileTreePanel";

const readWorkspaceFileMock = vi.hoisted(() => vi.fn());
const revealItemInDirMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: `row-${index}`,
        start: index * 28,
      })),
    getTotalSize: () => count * 28,
    measureElement: vi.fn(),
  }),
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
}));

vi.mock("@tauri-apps/api/menu", () => ({
  Menu: { new: vi.fn(async () => ({ popup: vi.fn() })) },
  MenuItem: { new: vi.fn(async (options) => options) },
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({ scaleFactor: () => 1 })),
}));

vi.mock("@tauri-apps/api/dpi", () => ({
  LogicalPosition: class LogicalPosition {
    x: number;
    y: number;

    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
  },
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  revealItemInDir: (...args: unknown[]) => revealItemInDirMock(...args),
}));

vi.mock("../../../services/tauri", async () => {
  const actual = await vi.importActual<typeof import("../../../services/tauri")>(
    "../../../services/tauri",
  );
  return {
    ...actual,
    readWorkspaceFile: (...args: unknown[]) => readWorkspaceFileMock(...args),
  };
});

vi.mock("../../app/components/OpenAppMenu", () => ({
  OpenAppMenu: () => <div data-testid="open-app-menu" />,
}));

afterEach(() => {
  cleanup();
});

const defaultProps = {
  workspaceId: "ws-1",
  workspacePath: "/repo",
  files: [] as string[],
  modifiedFiles: [] as string[],
  isLoading: false,
  filePanelMode: "git" as const,
  onFilePanelModeChange: vi.fn(),
  onInsertText: vi.fn(),
  canInsertText: true,
  openTargets: [],
  openAppIconById: {},
  selectedOpenAppId: "",
  onSelectOpenAppId: vi.fn(),
};

describe("FileTreePanel", () => {
  beforeEach(() => {
    readWorkspaceFileMock.mockReset();
    revealItemInDirMock.mockReset();
    readWorkspaceFileMock.mockResolvedValue({ content: "line-1", truncated: false });
  });

  it("shows loading state and skeleton rows when files are still loading", () => {
    const { container } = render(
      <FileTreePanel
        {...defaultProps}
        isLoading
      />,
    );

    expect(screen.getByText("正在加载文件")).not.toBeNull();
    expect(container.querySelectorAll(".file-tree-skeleton-row")).toHaveLength(8);
  });

  it("shows empty messages for all-files mode and modified-only mode", () => {
    render(<FileTreePanel {...defaultProps} />);

    expect(screen.getByText("无文件")).not.toBeNull();
    expect(screen.getByText("暂无可用文件。")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "仅显示改动文件" }));

    expect(screen.getByText("无改动文件")).not.toBeNull();
    expect(screen.getByText("暂无改动文件。")).not.toBeNull();
  });

  it("supports folder expand/collapse and modified query empty state", async () => {
    render(
      <FileTreePanel
        {...defaultProps}
        files={["src/main.ts", "README.md"]}
        modifiedFiles={["src/main.ts"]}
      />,
    );

    const getMainRowButton = () =>
      screen.getByText("main.ts").closest("button.file-tree-row") as HTMLButtonElement;

    expect(getMainRowButton()).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /src/ }));

    expect(screen.queryByText("main.ts")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /src/ }));

    expect(getMainRowButton()).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "仅显示改动文件" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "筛选文件和文件夹" }), {
      target: { value: "zzz-not-found" },
    });

    await waitFor(() => {
      expect(screen.getByText("没有符合筛选条件的改动文件。")).not.toBeNull();
    });
  });

  it("toggles file filter mode between all and modified counts", () => {
    render(
      <FileTreePanel
        {...defaultProps}
        files={["src/main.ts", "README.md"]}
        modifiedFiles={["src/main.ts"]}
      />,
    );

    expect(screen.getByText("2 个文件")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "仅显示改动文件" }));
    expect(screen.getByText("1 modified")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "显示全部文件" }));
    expect(screen.getByText("2 个文件")).not.toBeNull();
  });

  it("shows all-files query empty state when no match is found", async () => {
    render(
      <FileTreePanel
        {...defaultProps}
        files={["src/main.ts", "README.md"]}
      />,
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "筛选文件和文件夹" }), {
      target: { value: "not-found-in-all-mode" },
    });

    await waitFor(() => {
      expect(screen.getByText("未找到匹配项。")).not.toBeNull();
    });
  });

  it("shows preview error when file content loading fails", async () => {
    readWorkspaceFileMock.mockRejectedValueOnce(new Error("read failed"));

    render(
      <FileTreePanel
        {...defaultProps}
        files={["src/main.ts"]}
      />,
    );

    const mainRowButton = screen
      .getByText("main.ts")
      .closest("button.file-tree-row") as HTMLButtonElement;

    fireEvent.click(mainRowButton);

    await waitFor(() => {
      expect(screen.getByText("read failed")).not.toBeNull();
    });
  });

  it("renders image preview without reading text content", async () => {
    readWorkspaceFileMock.mockClear();
    render(
      <FileTreePanel
        {...defaultProps}
        files={["assets/logo.png"]}
      />,
    );

    const imageRowButton = screen
      .getByText("logo.png")
      .closest("button.file-tree-row") as HTMLButtonElement;

    fireEvent.click(imageRowButton);

    expect(await screen.findByText("图片预览")).not.toBeNull();
    expect(await screen.findByAltText("assets/logo.png")).not.toBeNull();
    expect(readWorkspaceFileMock).not.toHaveBeenCalled();
  });

  it("supports shift multi-line selection in preview and inserts ranged snippet", async () => {
    const onInsertText = vi.fn();
    readWorkspaceFileMock.mockResolvedValueOnce({
      content: "line-1\nline-2\nline-3",
      truncated: false,
    });

    render(
      <FileTreePanel
        {...defaultProps}
        files={["src/main.ts"]}
        onInsertText={onInsertText}
      />,
    );

    const mainRowButton = screen
      .getByText("main.ts")
      .closest("button.file-tree-row") as HTMLButtonElement;
    fireEvent.click(mainRowButton);

    await waitFor(() => {
      expect(document.querySelectorAll(".file-preview-line").length).toBe(3);
    });

    const lineButtons = document.querySelectorAll(
      ".file-preview-line",
    ) as NodeListOf<HTMLButtonElement>;
    fireEvent.click(lineButtons[0]);
    fireEvent.click(lineButtons[2], { shiftKey: true });

    expect(screen.getByText("第 1-3 行")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "添加到对话" }));

    expect(onInsertText).toHaveBeenCalledTimes(1);
    expect(onInsertText).toHaveBeenCalledWith(
      expect.stringContaining("src/main.ts:L1-L3"),
    );
    expect(onInsertText).toHaveBeenCalledWith(
      expect.stringContaining("line-1\nline-2\nline-3"),
    );
  });

  it("disables mention action when insertion is blocked", () => {
    render(
      <FileTreePanel
        {...defaultProps}
        files={["src/main.ts"]}
        canInsertText={false}
      />,
    );

    const mentionButton = screen.getByRole("button", { name: "提及 main.ts" });
    expect(mentionButton.hasAttribute("disabled")).toBeTruthy();
  });
});
