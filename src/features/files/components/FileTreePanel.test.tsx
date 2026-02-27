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
