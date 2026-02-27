// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RequestUserInputRequest } from "../../../types";
import { RequestUserInputMessage } from "./RequestUserInputMessage";

function createRequest(overrides: Partial<RequestUserInputRequest>): RequestUserInputRequest {
  const base: RequestUserInputRequest = {
    workspace_id: "ws-1",
    request_id: "req-1",
    params: {
      thread_id: "thread-1",
      turn_id: "turn-1",
      item_id: "item-1",
      questions: [
        {
          id: "q-choice",
          header: "Priority",
          question: "Which option should we pick?",
          options: [
            { label: "Option A", description: "First" },
            { label: "Option B", description: "Second" },
          ],
        },
        {
          id: "q-note",
          header: "Notes",
          question: "Any additional context?",
          isOther: true,
        },
      ],
    },
  };

  return {
    ...base,
    ...overrides,
    params: { ...base.params, ...overrides.params },
  };
}

describe("RequestUserInputMessage", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders nothing when there is no active request for current thread/workspace", () => {
    const onSubmit = vi.fn();

    const { container } = render(
      <RequestUserInputMessage
        requests={[
          createRequest({
            params: {
              thread_id: "thread-x",
              turn_id: "turn-1",
              item_id: "item-1",
              questions: [],
            },
          }),
        ]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={onSubmit}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("shows queue count for matching requests and only renders first matching request", () => {
    const onSubmit = vi.fn();
    const first = createRequest({ request_id: "req-first" });
    const second = createRequest({ request_id: "req-second" });
    const differentWorkspace = createRequest({ request_id: "req-third", workspace_id: "ws-2" });

    render(
      <RequestUserInputMessage
        requests={[first, second, differentWorkspace]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByText("请求 1 / 2")).toBeTruthy();
    expect(screen.getByText("Which option should we pick?")).toBeTruthy();
    expect(screen.queryByText("未提供可回答的问题。")).toBeNull();
  });

  it("submits selected option and notes, including plain-note question and skipping empty id", () => {
    const onSubmit = vi.fn();
    const request = createRequest({
      params: {
        thread_id: "thread-1",
        turn_id: "turn-1",
        item_id: "item-1",
        questions: [
          {
            id: "q-choice",
            header: "Priority",
            question: "Pick one",
            options: [
              { label: "Recommended", description: "Best default" },
              { label: "Fallback", description: "Secondary" },
            ],
          },
          {
            id: "q-free",
            header: "Reason",
            question: "Explain why",
            options: [],
          },
          {
            id: "",
            header: "Invalid",
            question: "Should be ignored in answers",
          },
        ],
      },
    });

    render(
      <RequestUserInputMessage
        requests={[request]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Fallback Secondary" }));

    const textareas = screen.getAllByRole("textbox");
    fireEvent.change(textareas[0]!, { target: { value: "  keep current risk profile " } });
    fireEvent.change(textareas[1]!, { target: { value: "  because release is near  " } });

    fireEvent.click(screen.getByRole("button", { name: "提交" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [, response] = onSubmit.mock.calls[0];
    expect(response).toEqual({
      answers: {
        "q-choice": {
          answers: ["Fallback", "用户备注: keep current risk profile"],
        },
        "q-free": {
          answers: ["because release is near"],
        },
      },
    });
  });

  it("renders empty-state when no questions and submits empty answers", () => {
    const onSubmit = vi.fn();
    const request = createRequest({
      params: {
        thread_id: "thread-1",
        turn_id: "turn-1",
        item_id: "item-1",
        questions: [],
      },
    });

    render(
      <RequestUserInputMessage
        requests={[request]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByText("未提供可回答的问题。")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "提交" }));

    expect(onSubmit).toHaveBeenCalledWith(request, { answers: {} });
  });
});
