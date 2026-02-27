// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  WorkspaceHomeRun,
  WorkspaceHomeRunInstance,
} from "../hooks/useWorkspaceHome";
import { WorkspaceHomeHistory } from "./WorkspaceHomeHistory";

const formatRelativeTimeMock = vi.fn((timestamp: number) => `time-${timestamp}`);

vi.mock("../../../utils/time", () => ({
  formatRelativeTime: (timestamp: number) => formatRelativeTimeMock(timestamp),
}));

afterEach(() => {
  cleanup();
  formatRelativeTimeMock.mockClear();
});

const buildInstance = (
  id: string,
  overrides: Partial<WorkspaceHomeRunInstance> = {},
): WorkspaceHomeRunInstance => ({
  id,
  workspaceId: "ws-1",
  threadId: `thread-${id}`,
  modelId: "model-1",
  modelLabel: "Model A",
  sequence: 1,
  ...overrides,
});

const buildRun = (id: string, overrides: Partial<WorkspaceHomeRun> = {}): WorkspaceHomeRun => ({
  id,
  workspaceId: "ws-1",
  title: `Run ${id}`,
  prompt: "prompt",
  createdAt: 1_700_000_000_000,
  mode: "local",
  instances: [buildInstance(`${id}-instance`)],
  status: "ready",
  error: null,
  instanceErrors: [],
  ...overrides,
});

const buildProps = () => ({
  runs: [] as WorkspaceHomeRun[],
  recentThreadInstances: [] as WorkspaceHomeRunInstance[],
  recentThreadsUpdatedAt: null as number | null,
  activeWorkspaceId: null as string | null,
  activeThreadId: null as string | null,
  threadStatusById: {} as Record<string, { isProcessing: boolean; isReviewing: boolean }>,
  onSelectInstance: vi.fn(),
});

describe("WorkspaceHomeHistory", () => {
  it("renders empty states for runs and recent conversations", () => {
    const props = buildProps();

    render(<WorkspaceHomeHistory {...props} />);

    expect(screen.getByText("发起一次运行，即可在此追踪实例状态。")).not.toBeNull();
    expect(screen.getByText("侧边栏中的对话将显示在这里。")).not.toBeNull();
  });

  it("renders run card branches and instance error overflow", () => {
    const props = buildProps();
    props.runs = [
      buildRun("failed-no-instance", {
        title: "Failed Run",
        mode: "worktree",
        instances: [],
        status: "failed",
        error: "top-level error",
        instanceErrors: [{ message: "err-1" }, { message: "err-2" }, { message: "err-3" }],
      }),
      buildRun("pending-no-instance", {
        title: "Pending Run",
        instances: [],
        status: "pending",
      }),
      buildRun("partial-with-instance", {
        title: "Partial Run",
        status: "partial",
        instances: [buildInstance("partial-1")],
      }),
    ];

    render(<WorkspaceHomeHistory {...props} />);

    const failedCard = screen.getByText("Failed Run").closest(".workspace-home-run-card");
    expect(failedCard).not.toBeNull();
    if (!failedCard) {
      throw new Error("Expected failed run card");
    }
    expect(within(failedCard).getByText(/工作树 · 0 个实例 · 失败/)).not.toBeNull();
    expect(within(failedCard).getByText("top-level error")).not.toBeNull();
    expect(within(failedCard).getByText("err-1")).not.toBeNull();
    expect(within(failedCard).getByText("err-2")).not.toBeNull();
    expect(within(failedCard).getByText("还有 1 条")).not.toBeNull();
    expect(within(failedCard).getByText("未启动任何实例。")).not.toBeNull();

    const pendingCard = screen.getByText("Pending Run").closest(".workspace-home-run-card");
    expect(pendingCard).not.toBeNull();
    if (!pendingCard) {
      throw new Error("Expected pending run card");
    }
    expect(within(pendingCard).getByText("实例准备中…")).not.toBeNull();
    expect(pendingCard.querySelector(".working-spinner")).not.toBeNull();

    const partialCard = screen.getByText("Partial Run").closest(".workspace-home-run-card");
    expect(partialCard).not.toBeNull();
    if (!partialCard) {
      throw new Error("Expected partial run card");
    }
    expect(within(partialCard).getByText(/本地 · 1 个实例 · 部分完成/)).not.toBeNull();
  });

  it("renders instance labels, status classes, active state, and select callback", () => {
    const props = buildProps();
    const processing = buildInstance("i1", {
      workspaceId: "ws-active",
      threadId: "thread-active",
      modelLabel: "Model A",
      sequence: 1,
    });
    const reviewing = buildInstance("i2", {
      workspaceId: "ws-review",
      threadId: "thread-review",
      modelLabel: "Model A",
      sequence: 2,
    });
    const idle = buildInstance("i3", {
      workspaceId: "ws-idle",
      threadId: "thread-idle",
      modelLabel: "Model B",
      sequence: 1,
    });

    props.runs = [
      buildRun("run-with-statuses", {
        instances: [processing, reviewing, idle],
      }),
    ];
    props.activeWorkspaceId = "ws-active";
    props.activeThreadId = "thread-active";
    props.threadStatusById = {
      "thread-active": { isProcessing: true, isReviewing: false },
      "thread-review": { isProcessing: false, isReviewing: true },
    };

    render(<WorkspaceHomeHistory {...props} />);

    const processingButton = screen.getByRole("button", { name: /Model A 1/ });
    const reviewingButton = screen.getByRole("button", { name: /Model A 2/ });
    const idleButton = screen.getByRole("button", { name: /Model B/ });

    expect(processingButton.className).toContain("is-running");
    expect(processingButton.className).toContain("is-active");
    expect(within(processingButton).getByText("运行中")).not.toBeNull();
    expect(processingButton.querySelector(".workspace-home-instance-status.is-running")).not.toBeNull();

    expect(reviewingButton.className).toContain("is-reviewing");
    expect(within(reviewingButton).getByText("审查中")).not.toBeNull();

    expect(idleButton.className).toContain("is-idle");
    expect(within(idleButton).getByText("空闲")).not.toBeNull();

    fireEvent.click(reviewingButton);
    expect(props.onSelectInstance).toHaveBeenCalledWith("ws-review", "thread-review");
  });

  it("renders recent conversations card and hides timestamp when updatedAt is null", () => {
    const props = buildProps();
    props.recentThreadInstances = [buildInstance("recent-1"), buildInstance("recent-2")];

    render(<WorkspaceHomeHistory {...props} />);

    const recentCard = screen.getByText("对话活动").closest(".workspace-home-run-card");
    expect(recentCard).not.toBeNull();
    if (!recentCard) {
      throw new Error("Expected recent conversation card");
    }
    expect(within(recentCard).getByText("2 个对话")).not.toBeNull();
    expect(within(recentCard).queryByText(/time-/)).toBeNull();
  });

  it("renders relative times for run and recent conversations when updatedAt exists", () => {
    const props = buildProps();
    props.runs = [
      buildRun("timed-run", {
        createdAt: 1_700_000_000_001,
      }),
    ];
    props.recentThreadInstances = [buildInstance("recent-with-time")];
    props.recentThreadsUpdatedAt = 1_700_000_000_999;

    render(<WorkspaceHomeHistory {...props} />);

    expect(screen.getByText("time-1700000000001")).not.toBeNull();
    expect(screen.getByText("time-1700000000999")).not.toBeNull();
    expect(formatRelativeTimeMock).toHaveBeenCalledWith(1_700_000_000_001);
    expect(formatRelativeTimeMock).toHaveBeenCalledWith(1_700_000_000_999);
  });
});
