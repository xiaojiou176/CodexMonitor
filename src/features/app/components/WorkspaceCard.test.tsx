/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceCard } from "./WorkspaceCard";

const workspace = {
  id: "ws-1",
  name: "Workspace",
  path: "/tmp/workspace",
  connected: true,
  settings: { sidebarCollapsed: false },
};

describe("WorkspaceCard", () => {
  it("opens inline alias editing from workspace name double-click", () => {
    const onStartAliasEdit = vi.fn();

    render(
      <WorkspaceCard
        workspace={workspace}
        workspaceName="Workspace"
        isActive={false}
        isCollapsed={false}
        addMenuOpen={false}
        addMenuWidth={200}
        onSelectWorkspace={vi.fn()}
        onShowWorkspaceMenu={vi.fn()}
        onToggleWorkspaceCollapse={vi.fn()}
        onConnectWorkspace={vi.fn()}
        onToggleAddMenu={vi.fn()}
        onStartAliasEdit={onStartAliasEdit}
      />,
    );

    fireEvent.doubleClick(screen.getByText("Workspace"));
    expect(onStartAliasEdit).toHaveBeenCalledWith("ws-1");
  });

  it("renders alias input and handles submit/cancel", () => {
    const onAliasDraftChange = vi.fn();
    const onAliasSubmit = vi.fn();
    const onAliasCancel = vi.fn();

    render(
      <WorkspaceCard
        workspace={workspace}
        workspaceName="Workspace"
        isActive={false}
        isCollapsed={false}
        addMenuOpen={false}
        addMenuWidth={200}
        onSelectWorkspace={vi.fn()}
        onShowWorkspaceMenu={vi.fn()}
        onToggleWorkspaceCollapse={vi.fn()}
        onConnectWorkspace={vi.fn()}
        onToggleAddMenu={vi.fn()}
        isAliasEditing={true}
        aliasDraft="My Alias"
        onAliasDraftChange={onAliasDraftChange}
        onAliasSubmit={onAliasSubmit}
        onAliasCancel={onAliasCancel}
      />,
    );

    const input = screen.getByLabelText("工作区自定义名称");
    fireEvent.change(input, { target: { value: "New Alias" } });
    expect(onAliasDraftChange).toHaveBeenCalledWith("New Alias");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAliasSubmit).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(input, { key: "Escape" });
    expect(onAliasCancel).toHaveBeenCalledTimes(1);
  });
});
