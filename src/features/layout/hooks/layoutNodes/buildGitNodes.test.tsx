// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildGitNodes } from "./buildGitNodes";

describe("buildGitNodes", () => {
  it("inserts canonical $skill token without whitespace gap", () => {
    const onInsertComposerText = vi.fn();
    const { gitDiffPanelNode } = buildGitNodes({
      centerMode: "chat",
      selectedDiffPath: null,
      filePanelMode: "skills",
      activeWorkspace: {
        id: "ws-1",
        name: "workspace",
        path: "/tmp/repo",
        connected: true,
        settings: { sidebarCollapsed: false },
      },
      skills: [{ name: "深度调试模式", path: "/tmp/skills/deep-debug.md" }],
      onInsertComposerText,
      onFilePanelModeChange: () => {},
    } as any);

    render(<>{gitDiffPanelNode}</>);
    fireEvent.click(screen.getByRole("listitem"));

    expect(onInsertComposerText).toHaveBeenCalledWith("$深度调试模式 ");
  });
});
