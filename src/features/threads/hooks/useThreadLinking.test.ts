// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useThreadLinking } from "./useThreadLinking";

describe("useThreadLinking", () => {
  it("allows one re-parent correction for subagent source and blocks subsequent re-parent", () => {
    const dispatch = vi.fn();

    const { result, rerender } = renderHook(
      ({ threadParentById }) =>
        useThreadLinking({
          dispatch,
          threadParentById,
        }),
      {
        initialProps: {
          threadParentById: {
            "thread-child": "thread-parent-a",
          } as Record<string, string>,
        },
      },
    );

    act(() => {
      result.current.updateThreadParent(
        "thread-parent-b",
        ["thread-child"],
        {
          source: {
            subAgent: {
              thread_spawn: {
                parent_thread_id: "thread-parent-b",
              },
            },
          },
        },
      );
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadParent",
      threadId: "thread-child",
      parentId: "thread-parent-b",
    });

    rerender({
      threadParentById: {
        "thread-child": "thread-parent-b",
      },
    });

    dispatch.mockClear();

    act(() => {
      result.current.updateThreadParent(
        "thread-parent-c",
        ["thread-child"],
        {
          source: {
            subAgent: {
              thread_spawn: {
                parent_thread_id: "thread-parent-c",
              },
            },
          },
        },
      );
    });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("blocks re-parent that would create a parent cycle", () => {
    const dispatch = vi.fn();

    const { result } = renderHook(() =>
      useThreadLinking({
        dispatch,
        threadParentById: {
          "thread-parent": "thread-child",
        },
      }),
    );

    act(() => {
      result.current.updateThreadParent("thread-parent", ["thread-child"]);
    });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("notifies linked collab receivers for fast subagent marking", () => {
    const dispatch = vi.fn();
    const onCollabLinkedThread = vi.fn();

    const { result } = renderHook(() =>
      useThreadLinking({
        dispatch,
        threadParentById: {},
        onCollabLinkedThread,
      }),
    );

    act(() => {
      result.current.applyCollabThreadLinks("thread-parent", {
        type: "collabToolCall",
        receiverThreadId: ["thread-child-a", "thread-child-b"],
      });
    });

    expect(onCollabLinkedThread).toHaveBeenNthCalledWith(1, "thread-child-a");
    expect(onCollabLinkedThread).toHaveBeenNthCalledWith(2, "thread-child-b");
  });

  it("forwards available ordering timestamp to setThreadParent", () => {
    const dispatch = vi.fn();

    const { result } = renderHook(() =>
      useThreadLinking({
        dispatch,
        threadParentById: {},
      }),
    );

    act(() => {
      result.current.updateThreadParent("thread-parent", ["thread-child"], {
        source: {
          updated_at: 1234,
        },
      });
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadParent",
      threadId: "thread-child",
      parentId: "thread-parent",
      ordering: { timestamp: 1234 },
    });
  });
});
