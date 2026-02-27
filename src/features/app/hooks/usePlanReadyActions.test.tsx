// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CollaborationModeOption, WorkspaceInfo } from "../../../types";
import {
  makePlanReadyAcceptMessage,
  makePlanReadyChangesMessage,
} from "../../../utils/internalPlanReadyMessages";
import { usePlanReadyActions } from "./usePlanReadyActions";

function makeWorkspace(connected: boolean): WorkspaceInfo {
  return {
    id: "ws-1",
    name: "Workspace 1",
    path: "/tmp/ws-1",
    connected,
    settings: { sidebarCollapsed: false },
  };
}

function makeMode(
  overrides: Partial<CollaborationModeOption> = {},
): CollaborationModeOption {
  return {
    id: "default",
    label: "Default",
    mode: "default",
    model: "ignored-by-hook",
    reasoningEffort: null,
    developerInstructions: "default instructions",
    value: {},
    ...overrides,
  };
}

function buildHookProps(
  overrides: Partial<Parameters<typeof usePlanReadyActions>[0]> = {},
): Parameters<typeof usePlanReadyActions>[0] {
  return {
    activeWorkspace: makeWorkspace(true),
    activeThreadId: "thread-1",
    collaborationModes: [makeMode()],
    resolvedModel: "gemini-3.1-pro-preview",
    resolvedEffort: "high",
    connectWorkspace: vi.fn().mockResolvedValue(undefined),
    sendUserMessageToThread: vi.fn().mockResolvedValue(undefined),
    setSelectedCollaborationModeId: vi.fn(),
    ...overrides,
  };
}

describe("usePlanReadyActions", () => {
  it("sends accept action, connects when needed, and prefers exact default id match among duplicates", async () => {
    const props = buildHookProps({
      activeWorkspace: makeWorkspace(false),
      collaborationModes: [
        makeMode({
          id: " Default ",
          mode: "code",
          developerInstructions: "exact default id match",
        }),
        makeMode({
          id: "plan-like",
          mode: " default ",
          developerInstructions: "fallback-by-mode",
        }),
      ],
    });

    const { result } = renderHook(() => usePlanReadyActions(props));
    await result.current.handlePlanAccept();

    expect(props.connectWorkspace).toHaveBeenCalledTimes(1);
    expect(props.connectWorkspace).toHaveBeenCalledWith(props.activeWorkspace);
    expect(props.setSelectedCollaborationModeId).toHaveBeenCalledTimes(1);
    expect(props.setSelectedCollaborationModeId).toHaveBeenCalledWith(" Default ");
    expect(props.sendUserMessageToThread).toHaveBeenCalledTimes(1);
    expect(props.sendUserMessageToThread).toHaveBeenCalledWith(
      props.activeWorkspace,
      "thread-1",
      makePlanReadyAcceptMessage(),
      [],
      {
        collaborationMode: {
          mode: "code",
          settings: {
            developer_instructions: "exact default id match",
            model: "gemini-3.1-pro-preview",
            reasoning_effort: "high",
          },
        },
      },
    );
  });

  it("falls back to code mode and omits collaboration payload fields when model and effort are null", async () => {
    const props = buildHookProps({
      resolvedModel: null,
      resolvedEffort: null,
      collaborationModes: [
        makeMode({ id: "planner", mode: "plan" }),
        makeMode({ id: "code-id", mode: " code ", developerInstructions: null }),
      ],
    });

    const { result } = renderHook(() => usePlanReadyActions(props));
    await result.current.handlePlanAccept();

    expect(props.setSelectedCollaborationModeId).toHaveBeenCalledWith("code-id");
    expect(props.sendUserMessageToThread).toHaveBeenCalledWith(
      props.activeWorkspace,
      "thread-1",
      makePlanReadyAcceptMessage(),
      [],
      {
        collaborationMode: {
          mode: " code ",
          settings: {
            developer_instructions: null,
          },
        },
      },
    );
  });

  it("submits plan changes with trimmed input and plan mode payload", async () => {
    const props = buildHookProps({
      collaborationModes: [
        makeMode({ id: "plan-id", mode: " plan ", developerInstructions: "plan mode" }),
      ],
    });
    const { result } = renderHook(() => usePlanReadyActions(props));

    await result.current.handlePlanSubmitChanges("  adjust milestones and scope  ");

    expect(props.setSelectedCollaborationModeId).toHaveBeenCalledWith("plan-id");
    expect(props.sendUserMessageToThread).toHaveBeenCalledWith(
      props.activeWorkspace,
      "thread-1",
      makePlanReadyChangesMessage("adjust milestones and scope"),
      [],
      {
        collaborationMode: {
          mode: " plan ",
          settings: {
            developer_instructions: "plan mode",
            model: "gemini-3.1-pro-preview",
            reasoning_effort: "high",
          },
        },
      },
    );
  });

  it("short-circuits on missing workspace/thread or empty changes", async () => {
    const noWorkspace = buildHookProps({ activeWorkspace: null });
    const noThread = buildHookProps({ activeThreadId: null });
    const emptyChanges = buildHookProps();

    const noWorkspaceHook = renderHook(() => usePlanReadyActions(noWorkspace));
    const noThreadHook = renderHook(() => usePlanReadyActions(noThread));
    const emptyHook = renderHook(() => usePlanReadyActions(emptyChanges));

    await noWorkspaceHook.result.current.handlePlanAccept();
    await noWorkspaceHook.result.current.handlePlanSubmitChanges("change");
    await noThreadHook.result.current.handlePlanAccept();
    await noThreadHook.result.current.handlePlanSubmitChanges("change");
    await emptyHook.result.current.handlePlanSubmitChanges("   ");

    expect(noWorkspace.connectWorkspace).not.toHaveBeenCalled();
    expect(noWorkspace.sendUserMessageToThread).not.toHaveBeenCalled();
    expect(noThread.connectWorkspace).not.toHaveBeenCalled();
    expect(noThread.sendUserMessageToThread).not.toHaveBeenCalled();
    expect(emptyChanges.sendUserMessageToThread).not.toHaveBeenCalled();
  });

  it("propagates failures from connect and send paths", async () => {
    const connectError = new Error("connect failed");
    const sendError = new Error("send failed");
    const connectFailProps = buildHookProps({
      activeWorkspace: makeWorkspace(false),
      connectWorkspace: vi.fn().mockRejectedValue(connectError),
    });
    const sendFailProps = buildHookProps({
      collaborationModes: [makeMode({ id: "plan-id", mode: "plan" })],
      sendUserMessageToThread: vi.fn().mockRejectedValue(sendError),
    });

    const connectFailHook = renderHook(() => usePlanReadyActions(connectFailProps));
    const sendFailHook = renderHook(() => usePlanReadyActions(sendFailProps));

    await expect(connectFailHook.result.current.handlePlanAccept()).rejects.toThrow(
      "connect failed",
    );
    expect(connectFailProps.sendUserMessageToThread).not.toHaveBeenCalled();

    await expect(sendFailHook.result.current.handlePlanSubmitChanges("do this")).rejects.toThrow(
      "send failed",
    );
    expect(sendFailProps.setSelectedCollaborationModeId).toHaveBeenCalledWith("plan-id");
  });
});
