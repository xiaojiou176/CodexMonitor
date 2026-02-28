// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspaceGroup } from "./WorkspaceGroup";

describe("WorkspaceGroup", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a single toggle button when group is collapsible", () => {
    const onToggleCollapse = vi.fn();
    render(
      <WorkspaceGroup
        toggleId="group-1"
        name="Group A"
        showHeader
        isCollapsed={false}
        onToggleCollapse={onToggleCollapse}
      >
        <div>child</div>
      </WorkspaceGroup>,
    );

    const toggle = screen.getByRole("button", { name: "折叠分组" });
    expect(toggle).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(toggle);
    expect(onToggleCollapse).toHaveBeenCalledWith("group-1");
  });

  it("renders static header when group is not collapsible", () => {
    render(
      <WorkspaceGroup
        toggleId={null}
        name="Ungrouped"
        showHeader
        isCollapsed={false}
        onToggleCollapse={vi.fn()}
      >
        <div>child</div>
      </WorkspaceGroup>,
    );

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Ungrouped")).toBeTruthy();
  });
});
