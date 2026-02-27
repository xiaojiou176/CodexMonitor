// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { WorkspaceHome } from "./WorkspaceHome";

const convertFileSrcMock = vi.fn((path: string) => `tauri://${path}`);
const workspaceHomeHistoryMock = vi.fn(() => <div data-testid="workspace-home-history" />);

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => convertFileSrcMock(path),
}));

vi.mock("./WorkspaceHomeHistory", () => ({
  WorkspaceHomeHistory: (props: unknown) => {
    workspaceHomeHistoryMock(props);
    return <div data-testid="workspace-home-history" />;
  },
}));

afterEach(() => {
  cleanup();
  convertFileSrcMock.mockClear();
  workspaceHomeHistoryMock.mockClear();
});

const buildWorkspace = (overrides: Partial<WorkspaceInfo> = {}): WorkspaceInfo => ({
  id: "ws-1",
  name: "Workspace One",
  path: "/tmp/workspace/",
  connected: true,
  settings: { sidebarCollapsed: false },
  ...overrides,
});

const buildProps = () => ({
  workspace: buildWorkspace(),
  runs: [],
  recentThreadInstances: [],
  recentThreadsUpdatedAt: null,
  activeWorkspaceId: null,
  activeThreadId: null,
  threadStatusById: {},
  onSelectInstance: vi.fn(),
  agentMdContent: "initial content",
  agentMdExists: true,
  agentMdTruncated: false,
  agentMdLoading: false,
  agentMdSaving: false,
  agentMdError: null,
  agentMdDirty: false,
  onAgentMdChange: vi.fn(),
  onAgentMdRefresh: vi.fn(),
  onAgentMdSave: vi.fn(),
});

describe("WorkspaceHome", () => {
  it("renders hero, truncated warning, loading meta and forwards history props", () => {
    const props = buildProps();
    props.agentMdTruncated = true;
    props.agentMdLoading = true;

    const { container } = render(<WorkspaceHome {...props} />);

    expect(screen.getByText("Workspace One")).not.toBeNull();
    expect(screen.getByText("/tmp/workspace/")).not.toBeNull();
    expect(screen.getByText("文件过大，仅显示前半部分。")).not.toBeNull();
    expect(screen.getByText("加载中… · 已截断")).not.toBeNull();
    expect(screen.getByTestId("workspace-home-history")).not.toBeNull();
    expect(convertFileSrcMock).toHaveBeenCalledWith("/tmp/workspace/icon.png");

    const refreshButton = screen.getByLabelText("Refresh AGENTS.md");
    const saveButton = screen.getByLabelText("保存 AGENTS.md");
    expect((refreshButton as HTMLButtonElement).disabled).toBe(true);
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);

    const icon = container.querySelector(".workspace-home-icon");
    expect(icon).not.toBeNull();
    expect(workspaceHomeHistoryMock).toHaveBeenCalledTimes(1);
    expect(workspaceHomeHistoryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        runs: props.runs,
        recentThreadInstances: props.recentThreadInstances,
      }),
    );
  });

  it("renders AGENTS empty state meta and create action when file is missing", () => {
    const props = buildProps();
    props.agentMdExists = false;
    props.agentMdContent = "";
    props.agentMdDirty = false;

    render(<WorkspaceHome {...props} />);

    expect(screen.getByText("未找到")).not.toBeNull();
    const createButton = screen.getByLabelText("创建 AGENTS.md");
    expect((createButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("renders saving meta while AGENTS.md is being saved", () => {
    const props = buildProps();
    props.agentMdSaving = true;
    props.agentMdDirty = true;

    render(<WorkspaceHome {...props} />);

    expect(screen.getByText("保存中…")).not.toBeNull();
    const refreshButton = screen.getByLabelText("Refresh AGENTS.md");
    const saveButton = screen.getByLabelText("保存 AGENTS.md");
    expect((refreshButton as HTMLButtonElement).disabled).toBe(true);
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("triggers editor callbacks and re-shows icon after workspace switch", () => {
    const props = buildProps();
    props.agentMdDirty = true;

    const { container, rerender } = render(<WorkspaceHome {...props} />);

    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();
    if (!textarea) {
      throw new Error("Expected textarea");
    }
    fireEvent.change(textarea, { target: { value: "updated content" } });
    expect(props.onAgentMdChange).toHaveBeenCalledWith("updated content");

    const refreshButton = screen.getByLabelText("Refresh AGENTS.md");
    const saveButton = screen.getByLabelText("保存 AGENTS.md");
    expect((saveButton as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(refreshButton);
    fireEvent.click(saveButton);
    expect(props.onAgentMdRefresh).toHaveBeenCalledTimes(1);
    expect(props.onAgentMdSave).toHaveBeenCalledTimes(1);

    const icon = container.querySelector(".workspace-home-icon");
    expect(icon).not.toBeNull();
    if (!icon) {
      throw new Error("Expected workspace icon");
    }
    fireEvent.error(icon);
    expect(container.querySelector(".workspace-home-icon")).toBeNull();

    rerender(
      <WorkspaceHome
        {...props}
        workspace={buildWorkspace({ id: "ws-2", path: "/tmp/next-workspace/" })}
      />,
    );
    expect(container.querySelector(".workspace-home-icon")).not.toBeNull();
  });
});
