// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Home } from "./Home";

const isMobilePlatformMock = vi.fn(() => false);

vi.mock("../../../utils/platformPaths", () => ({
  isMobilePlatform: () => isMobilePlatformMock(),
}));

vi.mock("../../../utils/time", () => ({
  formatRelativeTime: () => "刚刚",
}));

const baseProps = {
  onOpenProject: vi.fn(),
  onAddWorkspace: vi.fn(),
  onAddWorkspaceFromUrl: vi.fn(),
  latestAgentRuns: [],
  isLoadingLatestAgents: false,
  localUsageSnapshot: null,
  isLoadingLocalUsage: false,
  localUsageError: null,
  onRefreshLocalUsage: vi.fn(),
  usageMetric: "tokens" as const,
  onUsageMetricChange: vi.fn(),
  usageWorkspaceId: null,
  usageWorkspaceOptions: [],
  onUsageWorkspaceChange: vi.fn(),
  onSelectThread: vi.fn(),
};

const usageSnapshot = {
  updatedAt: Date.now(),
  days: [
    {
      day: "2026-01-20",
      inputTokens: 10,
      cachedInputTokens: 0,
      outputTokens: 5,
      totalTokens: 15,
      agentTimeMs: 120000,
      agentRuns: 2,
      failedRuns: 1,
      retriedRuns: 1,
      avgLatencyMs: 5500,
    },
  ],
  totals: {
    last7DaysTokens: 15,
    last30DaysTokens: 15,
    averageDailyTokens: 15,
    cacheHitRatePercent: 0,
    peakDay: "2026-01-20",
    peakDayTokens: 15,
    last7DaysFailureRatePercent: 50,
    last7DaysRetryRatePercent: 50,
    averageLatencyMs: 5500,
  },
  topModels: [],
};

describe("Home", () => {
  beforeEach(() => {
    isMobilePlatformMock.mockReturnValue(false);
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows latest loading state and usage loading skeleton", () => {
    render(
      <Home
        {...baseProps}
        isLoadingLatestAgents
        isLoadingLocalUsage
        localUsageSnapshot={null}
      />,
    );

    expect(screen.getByLabelText("正在加载对话")).toBeTruthy();
    expect(screen.getByText("使用概览")).toBeTruthy();
    expect(screen.queryByText("暂无使用数据")).toBeNull();
  });

  it("shows empty states and error copy for usage", () => {
    render(
      <Home
        {...baseProps}
        localUsageSnapshot={null}
        isLoadingLocalUsage={false}
        localUsageError="读取失败，请稍后重试"
      />,
    );

    expect(screen.getByText("暂无对话记录")).toBeTruthy();
    expect(screen.getByText("暂无使用数据")).toBeTruthy();
    expect(screen.getByText("读取失败，请稍后重试")).toBeTruthy();
    expect(screen.getAllByText("暂无最近对话，先发起一次新会话。").length).toBeGreaterThan(0);
  });

  it("handles callback interactions for quick actions and usage controls", () => {
    const onOpenProject = vi.fn();
    const onAddWorkspace = vi.fn();
    const onAddWorkspaceFromUrl = vi.fn();
    const onRefreshLocalUsage = vi.fn();
    const onUsageMetricChange = vi.fn();
    const onUsageWorkspaceChange = vi.fn();

    render(
      <Home
        {...baseProps}
        onOpenProject={onOpenProject}
        onAddWorkspace={onAddWorkspace}
        onAddWorkspaceFromUrl={onAddWorkspaceFromUrl}
        onRefreshLocalUsage={onRefreshLocalUsage}
        onUsageMetricChange={onUsageMetricChange}
        onUsageWorkspaceChange={onUsageWorkspaceChange}
        usageWorkspaceOptions={[{ id: "ws-1", label: "Workspace 1" }]}
        localUsageSnapshot={usageSnapshot}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^打开项目$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^添加工作区$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^从 URL 添加工作区$/ }));
    fireEvent.click(screen.getByRole("button", { name: "刷新用量" }));
    fireEvent.click(screen.getByRole("button", { name: "时长" }));
    fireEvent.change(screen.getByLabelText("选择工作区"), {
      target: { value: "ws-1" },
    });

    expect(onOpenProject).toHaveBeenCalledTimes(1);
    expect(onAddWorkspace).toHaveBeenCalledTimes(1);
    expect(onAddWorkspaceFromUrl).toHaveBeenCalledTimes(1);
    expect(onRefreshLocalUsage).toHaveBeenCalledTimes(1);
    expect(onUsageMetricChange).toHaveBeenCalledWith("time");
    expect(onUsageWorkspaceChange).toHaveBeenCalledWith("ws-1");
  });

  it("renders latest run copy branches and allows resuming latest task", () => {
    const onSelectThread = vi.fn();

    render(
      <Home
        {...baseProps}
        latestAgentRuns={[
          {
            message: "   ",
            timestamp: Date.now(),
            projectName: "CodexMonitor",
            groupName: null,
            workspaceId: "workspace-1",
            threadId: "thread-1",
            isProcessing: true,
          },
        ]}
        onSelectThread={onSelectThread}
      />,
    );

    expect(screen.getByText("Agent 已回复。")).toBeTruthy();
    expect(screen.getByText("运行中")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /继续最近一次任务/ }));

    expect(onSelectThread).toHaveBeenCalledWith("workspace-1", "thread-1");
    expect(screen.getByText("继续 CodexMonitor 的最新对话，减少上下文切换。")).toBeTruthy();
  });

  it("switches hero copy for mobile shortcut branch", () => {
    isMobilePlatformMock.mockReturnValue(true);

    render(<Home {...baseProps} localUsageSnapshot={usageSnapshot} />);

    const shortcuts = screen.getAllByLabelText("快捷入口")[0];
    expect(within(shortcuts).queryByText("⌘K 命令菜单")).toBeNull();
    expect(within(shortcuts).getByText("/ Slash 命令")).toBeTruthy();
  });

  it("keeps resume button disabled when there is no latest run", () => {
    const onSelectThread = vi.fn();
    render(
      <Home
        {...baseProps}
        onSelectThread={onSelectThread}
        latestAgentRuns={[]}
        localUsageSnapshot={usageSnapshot}
      />,
    );

    const resume = screen.getByRole("button", { name: /继续最近一次任务/ });
    expect((resume as HTMLButtonElement).disabled).toBeTruthy();
    fireEvent.click(resume);
    expect(onSelectThread).not.toHaveBeenCalled();
  });

  it("renders time metric cards, chart copy, and provider chips", () => {
    const localUsageSnapshot = {
      ...usageSnapshot,
      days: [
        {
          day: "bad-day",
          inputTokens: 1_500_000_000,
          cachedInputTokens: 0,
          outputTokens: 0,
          totalTokens: 1_500_000_000,
          agentTimeMs: 3_720_000,
          agentRuns: 12,
          failedRuns: 2,
          retriedRuns: 1,
          avgLatencyMs: 60_000,
        },
      ],
      totals: {
        ...usageSnapshot.totals,
        averageLatencyMs: 60_000,
        peakDay: "not-a-date",
        peakDayTokens: 1_500_000_000,
      },
      topModels: [
        { model: "gpt-5", tokens: 1200, sharePercent: 40 },
        { model: "claude-sonnet", tokens: 900, sharePercent: 30 },
        { model: "gemini-2.5-pro", tokens: 600, sharePercent: 20 },
        { model: "custom-model", tokens: 300, sharePercent: 10 },
      ],
    };

    render(
      <Home
        {...baseProps}
        usageMetric="time"
        localUsageSnapshot={localUsageSnapshot}
      />,
    );

    expect(screen.getAllByText("Agent 时长").length).toBeGreaterThan(0);
    expect(screen.getAllByText("令牌").length).toBeGreaterThan(0);
    expect(screen.getByText(/🔵 gpt-5/)).toBeTruthy();
    expect(screen.getByText(/🟠 claude-sonnet/)).toBeTruthy();
    expect(screen.getByText(/🟢 gemini-2.5-pro/)).toBeTruthy();
    expect(screen.getByText(/custom-model/)).toBeTruthy();
    expect(screen.getByText("40.0%")).toBeTruthy();
  });

  it("scrolls to usage section when exploring more", () => {
    const usageSection = document.createElement("section");
    const scrollIntoView = vi.fn();
    Object.defineProperty(usageSection, "scrollIntoView", {
      value: scrollIntoView,
      configurable: true,
    });
    const matchMedia = vi.fn().mockReturnValue({ matches: false });
    const querySelectorSpy = vi
      .spyOn(document, "querySelector")
      .mockReturnValue(usageSection);
    vi.spyOn(window, "matchMedia").mockImplementation(matchMedia);

    render(<Home {...baseProps} localUsageSnapshot={usageSnapshot} />);

    fireEvent.click(screen.getByRole("button", { name: "探索更多" }));

    expect(querySelectorSpy).toHaveBeenCalledWith(".home-usage");
    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });
});
