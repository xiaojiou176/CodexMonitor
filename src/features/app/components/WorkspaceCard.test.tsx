/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspaceCard } from "./WorkspaceCard";

const workspace = {
  id: "ws-1",
  name: "Workspace",
  path: "/tmp/workspace",
  connected: true,
  settings: { sidebarCollapsed: false },
};

describe("WorkspaceCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("opens workspace menu from keyboard menu shortcuts", () => {
    const onShowWorkspaceMenu = vi.fn();

    render(
      <WorkspaceCard
        workspace={workspace}
        workspaceName="Workspace"
        isActive={false}
        isCollapsed={false}
        addMenuOpen={false}
        addMenuWidth={200}
        onSelectWorkspace={vi.fn()}
        onShowWorkspaceMenu={onShowWorkspaceMenu}
        onToggleWorkspaceCollapse={vi.fn()}
        onConnectWorkspace={vi.fn()}
        onToggleAddMenu={vi.fn()}
      />,
    );

    const mainButton = screen.getByRole("button", {
      name: "切换到工作区 Workspace",
    });
    fireEvent.keyDown(mainButton, { key: "ContextMenu" });
    fireEvent.keyDown(mainButton, { key: "F10", shiftKey: true });

    expect(onShowWorkspaceMenu).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      "ws-1",
    );
    expect(onShowWorkspaceMenu).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      "ws-1",
    );
  });

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
