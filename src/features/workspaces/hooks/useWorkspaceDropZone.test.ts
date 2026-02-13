/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceDropZone } from "./useWorkspaceDropZone";

let mockOnDragDropEvent:
  | ((event: {
      payload: {
        type: "enter" | "over" | "leave" | "drop";
        position: { x: number; y: number };
        paths?: string[];
      };
    }) => void)
  | null = null;
let mockIsWorkspaceReorderDragging = false;

vi.mock("../../../services/dragDrop", () => ({
  subscribeWindowDragDrop: (handler: typeof mockOnDragDropEvent) => {
    mockOnDragDropEvent = handler;
    return () => {};
  },
  isWorkspaceReorderDragging: () => mockIsWorkspaceReorderDragging,
}));

type HookResult = ReturnType<typeof useWorkspaceDropZone>;

type RenderedHook = {
  result: HookResult;
  unmount: () => void;
};

function renderDropHook(options: {
  disabled?: boolean;
  onDropPaths: (paths: string[]) => void | Promise<void>;
}): RenderedHook {
  let result: HookResult | undefined;

  function Test() {
    result = useWorkspaceDropZone(options);
    return null;
  }

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(React.createElement(Test));
  });

  return {
    get result() {
      if (!result) {
        throw new Error("Hook not rendered");
      }
      return result;
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("useWorkspaceDropZone", () => {
  beforeEach(() => {
    mockOnDragDropEvent = null;
    mockIsWorkspaceReorderDragging = false;
  });

  it("tracks drag over state for file transfers", () => {
    const hook = renderDropHook({ onDropPaths: () => {} });
    const preventDefault = vi.fn();

    act(() => {
      hook.result.handleDragOver({
        dataTransfer: { types: ["Files"], items: [] },
        preventDefault,
      } as unknown as React.DragEvent<HTMLElement>);
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(hook.result.isDragOver).toBe(true);

    act(() => {
      hook.result.handleDragLeave({} as React.DragEvent<HTMLElement>);
    });

    expect(hook.result.isDragOver).toBe(false);

    hook.unmount();
  });

  it("emits file paths on drop when available", () => {
    const onDropPaths = vi.fn();
    const hook = renderDropHook({ onDropPaths });
    const file = new File(["data"], "project", { type: "application/octet-stream" });
    (file as File & { path?: string }).path = "/tmp/project";

    act(() => {
      hook.result.handleDrop({
        dataTransfer: { files: [file], items: [] },
        preventDefault: () => {},
      } as unknown as React.DragEvent<HTMLElement>);
    });

    expect(onDropPaths).toHaveBeenCalledWith(["/tmp/project"]);

    hook.unmount();
  });

  it("ignores DOM drag-over while internal workspace reorder is active", () => {
    mockIsWorkspaceReorderDragging = true;
    const hook = renderDropHook({ onDropPaths: () => {} });
    const preventDefault = vi.fn();

    act(() => {
      hook.result.handleDragOver({
        dataTransfer: { types: ["Files"], items: [] },
        preventDefault,
      } as unknown as React.DragEvent<HTMLElement>);
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(hook.result.isDragOver).toBe(false);

    hook.unmount();
  });

  it("ignores window drag events while internal workspace reorder is active", () => {
    const hook = renderDropHook({ onDropPaths: () => {} });
    const dropTarget = document.createElement("div");
    vi.spyOn(dropTarget, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 200,
      bottom: 200,
      width: 200,
      height: 200,
      toJSON: () => ({}),
    });

    act(() => {
      hook.result.dropTargetRef.current = dropTarget;
    });

    mockIsWorkspaceReorderDragging = true;
    act(() => {
      mockOnDragDropEvent?.({
        payload: {
          type: "over",
          position: { x: 50, y: 50 },
        },
      });
    });

    expect(hook.result.isDragOver).toBe(false);

    hook.unmount();
  });

  it("does not emit paths on drop while internal workspace reorder is active", () => {
    mockIsWorkspaceReorderDragging = true;
    const onDropPaths = vi.fn();
    const hook = renderDropHook({ onDropPaths });
    const file = new File(["data"], "project", { type: "application/octet-stream" });
    (file as File & { path?: string }).path = "/tmp/project";

    act(() => {
      hook.result.handleDrop({
        dataTransfer: { files: [file], items: [] },
        preventDefault: () => {},
      } as unknown as React.DragEvent<HTMLElement>);
    });

    expect(onDropPaths).not.toHaveBeenCalled();
    expect(hook.result.isDragOver).toBe(false);

    hook.unmount();
  });

  it("recovers external file drag once internal reorder flag clears", () => {
    const hook = renderDropHook({ onDropPaths: () => {} });
    const preventDefault = vi.fn();

    mockIsWorkspaceReorderDragging = true;
    act(() => {
      hook.result.handleDragOver({
        dataTransfer: { types: ["Files"], items: [] },
        preventDefault,
      } as unknown as React.DragEvent<HTMLElement>);
    });
    expect(hook.result.isDragOver).toBe(false);

    mockIsWorkspaceReorderDragging = false;
    act(() => {
      hook.result.handleDragOver({
        dataTransfer: { types: ["Files"], items: [] },
        preventDefault,
      } as unknown as React.DragEvent<HTMLElement>);
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(hook.result.isDragOver).toBe(true);

    hook.unmount();
  });
});
