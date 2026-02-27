/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImageDiffCard } from "./ImageDiffCard";

class MockImage {
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;
  decoding = "";
  naturalWidth = 0;
  naturalHeight = 0;

  set src(value: string) {
    if (value.includes("fail")) {
      this.onerror?.();
      return;
    }
    this.naturalWidth = 640;
    this.naturalHeight = 480;
    this.onload?.();
  }
}

describe("ImageDiffCard", () => {
  const originalImage = global.Image;

  beforeEach(() => {
    global.Image = MockImage as unknown as typeof Image;
  });

  afterEach(() => {
    cleanup();
    global.Image = originalImage;
  });

  it("renders modified mode with both images and computed metadata", async () => {
    render(
      <ImageDiffCard
        path="assets/icons/logo.png"
        status="M"
        oldImageData="ok-old"
        newImageData="ok-new"
        oldImageMime="image/webp"
        newImageMime="image/jpeg"
        isSelected
      />,
    );

    expect(screen.getByText("logo.png")).toBeTruthy();
    expect(screen.getByText("assets/icons/")).toBeTruthy();
    expect(screen.getByAltText("旧版本").getAttribute("src")).toContain("data:image/webp;base64,ok-old");
    expect(screen.getByAltText("当前版本").getAttribute("src")).toContain("data:image/jpeg;base64,ok-new");

    await waitFor(() => {
      expect(screen.getByAltText("旧版本").getAttribute("width")).toBe("640");
      expect(screen.getByAltText("旧版本").getAttribute("height")).toBe("480");
      expect(screen.getByAltText("当前版本").getAttribute("width")).toBe("640");
      expect(screen.getByAltText("当前版本").getAttribute("height")).toBe("480");
    });

    expect(screen.getAllByText("5 B").length).toBe(2);
  });

  it("renders placeholders when modified images are missing", () => {
    render(
      <ImageDiffCard path="assets/missing.png" status="M" isSelected={false} />,
    );

    expect(screen.getAllByText("图片预览不可用。").length).toBe(2);
    expect(screen.queryByAltText("旧版本")).toBeNull();
    expect(screen.queryByAltText("当前版本")).toBeNull();
  });

  it("renders added mode and falls back to default mime from path", () => {
    render(
      <ImageDiffCard
        path="assets/new.gif"
        status="A"
        newImageData="new-image"
        isSelected={false}
      />,
    );

    const addedImage = screen.getByAltText("新图片");
    expect(addedImage.getAttribute("src")).toContain("data:image/gif;base64,new-image");
    expect(screen.getByText("7 B")).toBeTruthy();
    expect(screen.queryByAltText("旧版本")).toBeNull();
  });

  it("renders deleted mode and placeholder when old image is missing", () => {
    render(
      <ImageDiffCard path="assets/old.png" status="D" isSelected={false} oldImageData={null} />,
    );

    expect(screen.getByText("图片预览不可用。")).toBeTruthy();
    expect(screen.queryByAltText("已删除图片")).toBeNull();
  });

  it("handles image dimension probe failure without width/height attrs", async () => {
    render(
      <ImageDiffCard
        path="assets/fail.png"
        status="A"
        newImageData="fail"
        isSelected={false}
      />,
    );

    const img = screen.getByAltText("新图片");
    await waitFor(() => {
      expect(img.getAttribute("width")).toBeNull();
      expect(img.getAttribute("height")).toBeNull();
    });
  });

  it("fires revert callback only when button is shown", () => {
    const onRequestRevert = vi.fn();
    const { rerender } = render(
      <ImageDiffCard
        path="assets/revert.png"
        status="M"
        oldImageData="old"
        newImageData="new"
        isSelected={false}
        showRevert
        onRequestRevert={onRequestRevert}
      />,
    );

    fireEvent.click(screen.getByLabelText("丢弃该文件更改"));
    expect(onRequestRevert).toHaveBeenCalledTimes(1);
    expect(onRequestRevert).toHaveBeenCalledWith("assets/revert.png");

    rerender(
      <ImageDiffCard
        path="assets/revert.png"
        status="M"
        oldImageData="old"
        newImageData="new"
        isSelected={false}
        showRevert={false}
        onRequestRevert={onRequestRevert}
      />,
    );

    expect(screen.queryByLabelText("丢弃该文件更改")).toBeNull();
    expect(onRequestRevert).toHaveBeenCalledTimes(1);
  });
});
