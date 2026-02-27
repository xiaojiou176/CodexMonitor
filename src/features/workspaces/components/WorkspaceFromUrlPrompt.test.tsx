// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceFromUrlPrompt } from "./WorkspaceFromUrlPrompt";

describe("WorkspaceFromUrlPrompt", () => {
  afterEach(() => {
    cleanup();
  });

  it("focuses the URL input on mount and wires action callbacks", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const onChooseDestinationPath = vi.fn();
    const onClearDestinationPath = vi.fn();
    const onUrlChange = vi.fn();
    const onTargetFolderNameChange = vi.fn();

    render(
      <WorkspaceFromUrlPrompt
        url="https://github.com/org/repo.git"
        destinationPath="/tmp/workspaces"
        targetFolderName="repo-copy"
        error={null}
        isBusy={false}
        canSubmit
        onUrlChange={onUrlChange}
        onTargetFolderNameChange={onTargetFolderNameChange}
        onChooseDestinationPath={onChooseDestinationPath}
        onClearDestinationPath={onClearDestinationPath}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    const urlInput = screen.getByLabelText("Remote Git URL");
    expect(document.activeElement).toBe(urlInput);

    fireEvent.change(urlInput, { target: { value: "https://github.com/org/new.git" } });
    fireEvent.change(screen.getByLabelText("Target folder name (optional)"), {
      target: { value: "new-folder" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Choose…" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.click(screen.getByRole("button", { name: "Clone and Add" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByLabelText("关闭弹窗"));

    expect(onUrlChange).toHaveBeenCalledWith("https://github.com/org/new.git");
    expect(onTargetFolderNameChange).toHaveBeenCalledWith("new-folder");
    expect(onChooseDestinationPath).toHaveBeenCalledTimes(1);
    expect(onClearDestinationPath).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("disables cancel/clear/confirm while busy and prevents backdrop cancel", () => {
    const onCancel = vi.fn();

    render(
      <WorkspaceFromUrlPrompt
        url="https://github.com/org/repo.git"
        destinationPath=""
        targetFolderName=""
        error="Clone failed"
        isBusy
        canSubmit={false}
        onUrlChange={vi.fn()}
        onTargetFolderNameChange={vi.fn()}
        onChooseDestinationPath={vi.fn()}
        onClearDestinationPath={vi.fn()}
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText("Clone failed")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cloning…" })).toBeDisabled();

    fireEvent.click(screen.getByLabelText("关闭弹窗"));
    expect(onCancel).not.toHaveBeenCalled();
  });
});
