// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";
import { MessageRow } from "./MessageRows";

describe("MessageRow a11y", () => {
  it("provides accessible dialog semantics for image lightbox", () => {
    const item: Extract<ConversationItem, { kind: "message" }> = {
      id: "msg-1",
      kind: "message",
      role: "assistant",
      text: "",
      images: ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Zx7kAAAAASUVORK5CYII="],
    };

    render(
      <MessageRow
        item={item}
        isCopied={false}
        onCopy={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "打开图片 1" }));

    const dialog = screen.getByRole("dialog", { name: "图片预览 1/1" });
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "图片预览 1/1" })).toBeNull();
  });
});
