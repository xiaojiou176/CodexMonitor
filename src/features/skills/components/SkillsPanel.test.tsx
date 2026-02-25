// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SkillOption } from "../../../types";
import { SkillsPanel } from "./SkillsPanel";

const skills: SkillOption[] = [
  {
    name: "深度调试模式",
    path: "/Users/me/.codex/skills/_深度模式/深度调试模式/SKILL.md",
    description: "用于修复复杂 Bug。",
    enabled: false,
    scope: "workspace",
    interface: { kind: "input" },
    dependencies: ["dep-a", "dep-b"],
    errors: ["missing dependency: dep-a", "missing dependency: dep-b"],
    cwd: "/tmp/repo",
  },
];

describe("SkillsPanel", () => {
  it("renders skill metadata and error summary", () => {
    render(
      <SkillsPanel
        skills={skills}
        filePanelMode="skills"
        onFilePanelModeChange={() => {}}
      />,
    );

    expect(screen.getByText("深度调试模式").textContent).toBe("深度调试模式");
    expect(screen.getByText("Disabled").textContent).toBe("Disabled");
    expect(screen.getByText("workspace").textContent).toBe("workspace");
    expect(screen.getByText("依赖 2").textContent).toBe("依赖 2");
    expect(screen.getByText("接口").textContent).toBe("接口");
    expect(screen.getByText("missing dependency: dep-a").textContent).toBe(
      "missing dependency: dep-a",
    );
  });

  it("invokes callback with selected skill", () => {
    const onInvokeSkill = vi.fn();
    render(
      <SkillsPanel
        skills={skills}
        onInvokeSkill={onInvokeSkill}
        filePanelMode="skills"
        onFilePanelModeChange={() => {}}
      />,
    );

    screen.getAllByRole("listitem").forEach((node) => fireEvent.click(node));
    expect(onInvokeSkill).toHaveBeenCalledWith(skills[0]);
  });
});
