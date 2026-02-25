// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApprovalRequest } from "../../../types";
import { respondToServerRequest } from "../../../services/tauri";
import {
  getApprovalCommandInfo,
  matchesCommandPrefix,
} from "../../../utils/approvalRules";
import { useThreadApprovalEvents } from "./useThreadApprovalEvents";

vi.mock("../../../services/tauri", () => ({
  respondToServerRequest: vi.fn(),
}));

vi.mock("../../../utils/approvalRules", () => ({
  getApprovalCommandInfo: vi.fn(),
  matchesCommandPrefix: vi.fn(),
}));

describe("useThreadApprovalEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("auto-accepts allowlisted approvals", () => {
    const dispatch = vi.fn();
    const setThreadPhase = vi.fn();
    const setThreadWaitReason = vi.fn();
    const approvalAllowlistRef = {
      current: { "ws-1": [["git", "status"]] },
    };
    const approval: ApprovalRequest = {
      workspace_id: "ws-1",
      request_id: 42,
      method: "approval/request",
      params: { argv: ["git", "status"] },
    };

    vi.mocked(getApprovalCommandInfo).mockReturnValue({
      tokens: ["git", "status"],
      preview: "git status",
    });
    vi.mocked(matchesCommandPrefix).mockReturnValue(true);

    const { result } = renderHook(() =>
      useThreadApprovalEvents({
        dispatch,
        approvalAllowlistRef,
        setThreadPhase,
        setThreadWaitReason,
      }),
    );

    act(() => {
      result.current(approval);
    });

    expect(respondToServerRequest).toHaveBeenCalledWith("ws-1", 42, "accept");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("dispatches approvals that do not match the allowlist", () => {
    const dispatch = vi.fn();
    const setThreadPhase = vi.fn();
    const setThreadWaitReason = vi.fn();
    const approvalAllowlistRef = {
      current: { "ws-1": [["git", "status"]] },
    };
    const approval: ApprovalRequest = {
      workspace_id: "ws-1",
      request_id: 7,
      method: "approval/request",
      params: { argv: ["git", "pull"] },
    };

    vi.mocked(getApprovalCommandInfo).mockReturnValue({
      tokens: ["git", "pull"],
      preview: "git pull",
    });
    vi.mocked(matchesCommandPrefix).mockReturnValue(false);

    const { result } = renderHook(() =>
      useThreadApprovalEvents({
        dispatch,
        approvalAllowlistRef,
        setThreadPhase,
        setThreadWaitReason,
      }),
    );

    act(() => {
      result.current(approval);
    });

    expect(respondToServerRequest).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({ type: "addApproval", approval });
  });

  it("resolves thread_id, updates waiting state, and auto-accepts when allowlist matches", () => {
    const dispatch = vi.fn();
    const setThreadPhase = vi.fn();
    const setThreadWaitReason = vi.fn();
    const approvalAllowlistRef = {
      current: { "ws-2": [["git", "diff"]] },
    };
    const approval: ApprovalRequest = {
      workspace_id: "ws-2",
      request_id: 9,
      method: "approval/request",
      params: {
        thread_id: "  thread-from-snake-case  ",
        argv: ["git", "diff", "--cached"],
      },
    };

    vi.mocked(getApprovalCommandInfo).mockReturnValue({
      tokens: ["git", "diff", "--cached"],
      preview: "git diff --cached",
    });
    vi.mocked(matchesCommandPrefix).mockReturnValue(true);

    const { result } = renderHook(() =>
      useThreadApprovalEvents({
        dispatch,
        approvalAllowlistRef,
        setThreadPhase,
        setThreadWaitReason,
      }),
    );

    act(() => {
      result.current(approval);
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-2",
      threadId: "thread-from-snake-case",
    });
    expect(setThreadPhase).toHaveBeenCalledWith("thread-from-snake-case", "waiting_user");
    expect(setThreadWaitReason).toHaveBeenCalledWith("thread-from-snake-case", "approval");
    expect(respondToServerRequest).toHaveBeenCalledWith("ws-2", 9, "accept");
    expect(dispatch).not.toHaveBeenCalledWith({ type: "addApproval", approval });
  });

  it("skips thread state updates when thread id is blank and queues approval", () => {
    const dispatch = vi.fn();
    const setThreadPhase = vi.fn();
    const setThreadWaitReason = vi.fn();
    const approvalAllowlistRef = {
      current: {},
    };
    const approval: ApprovalRequest = {
      workspace_id: "ws-3",
      request_id: 11,
      method: "approval/request",
      params: {
        threadId: "   ",
        argv: ["git", "fetch"],
      },
    };

    vi.mocked(getApprovalCommandInfo).mockReturnValue({
      tokens: ["git", "fetch"],
      preview: "git fetch",
    });
    vi.mocked(matchesCommandPrefix).mockReturnValue(false);

    const { result } = renderHook(() =>
      useThreadApprovalEvents({
        dispatch,
        approvalAllowlistRef,
        setThreadPhase,
        setThreadWaitReason,
      }),
    );

    act(() => {
      result.current(approval);
    });

    expect(setThreadPhase).not.toHaveBeenCalled();
    expect(setThreadWaitReason).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "ensureThread" }),
    );
    expect(dispatch).toHaveBeenCalledWith({ type: "addApproval", approval });
    expect(respondToServerRequest).not.toHaveBeenCalled();
  });

  it("queues approval when command info cannot be extracted", () => {
    const dispatch = vi.fn();
    const setThreadPhase = vi.fn();
    const setThreadWaitReason = vi.fn();
    const approvalAllowlistRef = {
      current: { "ws-4": [["pnpm", "test"]] },
    };
    const approval: ApprovalRequest = {
      workspace_id: "ws-4",
      request_id: 13,
      method: "approval/request",
      params: {
        threadId: "thread-13",
      },
    };

    vi.mocked(getApprovalCommandInfo).mockReturnValue(null);

    const { result } = renderHook(() =>
      useThreadApprovalEvents({
        dispatch,
        approvalAllowlistRef,
        setThreadPhase,
        setThreadWaitReason,
      }),
    );

    act(() => {
      result.current(approval);
    });

    expect(matchesCommandPrefix).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-4",
      threadId: "thread-13",
    });
    expect(dispatch).toHaveBeenCalledWith({ type: "addApproval", approval });
    expect(respondToServerRequest).not.toHaveBeenCalled();
  });
});
