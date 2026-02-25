// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RenameThreadPrompt } from "./RenameThreadPrompt";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

describe("RenameThreadPrompt", () => {
  it("handles backdrop and keyboard actions", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const { container } = render(
      <RenameThreadPrompt
        currentName="Old name"
        name="New name"
        onChange={vi.fn()}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    const input = screen.getByLabelText("新名称");
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);

    const backdrop = container.querySelector(".ds-modal-backdrop");
    expect(backdrop).not.toBeNull();
    if (!backdrop) {
      throw new Error("Expected rename thread backdrop");
    }
    fireEvent.click(backdrop);
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("handles input changes and confirm button disabled branch", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const onChange = vi.fn();
    render(
      <RenameThreadPrompt
        currentName="Old name"
        name="   "
        onChange={onChange}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    const input = screen.getByLabelText("新名称");
    fireEvent.change(input, { target: { value: "Renamed thread" } });
    expect(onChange).toHaveBeenCalledWith("Renamed thread");

    fireEvent.keyDown(input, { key: "a", code: "KeyA" });
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    const renameButton = screen.getByRole("button", { name: "重命名" });
    expect((renameButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("prevents default and cancels when Escape is pressed", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <RenameThreadPrompt
        currentName="Current"
        name="Next"
        onChange={vi.fn()}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    const input = screen.getByLabelText("新名称");
    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    fireEvent(input, event);

    expect(event.defaultPrevented).toBe(true);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(0);
  });
});
