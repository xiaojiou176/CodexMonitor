// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanReadyFollowupMessage } from "./PlanReadyFollowupMessage";

describe("PlanReadyFollowupMessage", () => {
  afterEach(() => {
    cleanup();
  });

  it("disables change submit for blank input and enables for trimmed content", () => {
    const onAccept = vi.fn();
    const onSubmitChanges = vi.fn();

    render(<PlanReadyFollowupMessage onAccept={onAccept} onSubmitChanges={onSubmitChanges} />);

    const sendButton = screen.getByRole("button", { name: "发送修改" }) as HTMLButtonElement;
    const textarea = screen.getByRole("textbox", { name: "" }) as HTMLTextAreaElement;

    expect(sendButton.disabled).toBe(true);

    fireEvent.change(textarea, { target: { value: "   adjust order logic   " } });
    expect(sendButton.disabled).toBe(false);

    fireEvent.click(sendButton);

    expect(onSubmitChanges).toHaveBeenCalledWith("adjust order logic");
    expect(textarea.value).toBe("");
    expect(sendButton.disabled).toBe(true);
  });

  it("calls accept handler when clicking execute-plan button", () => {
    const onAccept = vi.fn();
    const onSubmitChanges = vi.fn();

    render(<PlanReadyFollowupMessage onAccept={onAccept} onSubmitChanges={onSubmitChanges} />);

    fireEvent.click(screen.getByRole("button", { name: "执行此方案" }));

    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onSubmitChanges).not.toHaveBeenCalled();
  });
});
