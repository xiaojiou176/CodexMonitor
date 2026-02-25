import { describe, expect, it, vi } from "vitest";
import {
  buildThreadCodexSeedPatch,
  createPendingThreadSeed,
  NO_THREAD_SCOPE_SUFFIX,
  resolveThreadCodexState,
  resolveWorkspaceRuntimeCodexArgsBadgeLabel,
  resolveWorkspaceRuntimeCodexArgsOverride,
} from "./threadCodexParamsSeed";
import type { ThreadCodexParams } from "./threadStorage";

const noThreadStored: ThreadCodexParams = {
  modelId: null,
  effort: null,
  accessMode: null,
  collaborationModeId: null,
  codexArgsOverride: "--config /tmp/global.toml",
  updatedAt: 1,
};

describe("threadCodexParamsSeed", () => {
  it("resolves runtime args with thread override precedence and no-thread fallback", () => {
    const getThreadCodexParams = vi
      .fn()
      .mockImplementation((_ws: string, threadId: string) => {
        if (threadId === "thread-1") {
          return { codexArgsOverride: undefined };
        }
        if (threadId === NO_THREAD_SCOPE_SUFFIX) {
          return { codexArgsOverride: "--config /repo/.codex.toml --model gpt-5" };
        }
        return null;
      });

    expect(
      resolveWorkspaceRuntimeCodexArgsOverride({
        workspaceId: "ws-1",
        threadId: "thread-1",
        getThreadCodexParams,
      }),
    ).toBe("--config /repo/.codex.toml");

    expect(
      resolveWorkspaceRuntimeCodexArgsOverride({
        workspaceId: "ws-1",
        threadId: null,
        getThreadCodexParams,
      }),
    ).toBe("--config /repo/.codex.toml");

    expect(
      resolveWorkspaceRuntimeCodexArgsOverride({
        workspaceId: "ws-1",
        threadId: "unknown-thread",
        getThreadCodexParams,
      }),
    ).toBe("--config /repo/.codex.toml");
  });

  it("builds runtime args badge label from effective thread args", () => {
    const label = resolveWorkspaceRuntimeCodexArgsBadgeLabel({
      workspaceId: "ws-1",
      threadId: "thread-1",
      getThreadCodexParams: (_workspaceId, threadId) =>
        threadId === "thread-1"
          ? { modelId: null, effort: null, accessMode: null, collaborationModeId: null, codexArgsOverride: "--cd /repo/project --model gpt-5", updatedAt: 0 }
          : null,
    });
    expect(label).toBe("cd:repo/project");

    const emptyLabel = resolveWorkspaceRuntimeCodexArgsBadgeLabel({
      workspaceId: "ws-1",
      threadId: "thread-2",
      getThreadCodexParams: () => null,
    });
    expect(emptyLabel).toBeNull();
  });

  it("creates pending seed only for new thread in active workspace", () => {
    expect(
      createPendingThreadSeed({
        activeThreadId: "thread-1",
        activeWorkspaceId: "ws-1",
        selectedCollaborationModeId: "pair",
        accessMode: "current",
      }),
    ).toBeNull();

    expect(
      createPendingThreadSeed({
        activeThreadId: null,
        activeWorkspaceId: null,
        selectedCollaborationModeId: "pair",
        accessMode: "current",
      }),
    ).toBeNull();

    expect(
      createPendingThreadSeed({
        activeThreadId: null,
        activeWorkspaceId: "ws-1",
        selectedCollaborationModeId: "pair",
        accessMode: "current",
        codexArgsOverride: "--config /tmp/a.toml",
      }),
    ).toEqual({
      workspaceId: "ws-1",
      collaborationModeId: "pair",
      accessMode: "current",
      codexArgsOverride: "--config /tmp/a.toml",
    });
  });

  it("resolves thread codex state with pending seed and no-thread inheritance", () => {
    const noThreadState = resolveThreadCodexState({
      workspaceId: "ws-1",
      threadId: null,
      defaultAccessMode: "current",
      lastComposerModelId: "last-model",
      lastComposerReasoningEffort: "medium",
      stored: null,
      noThreadStored: null,
      pendingSeed: null,
    });
    expect(noThreadState.scopeKey).toBe(`ws-1:${NO_THREAD_SCOPE_SUFFIX}`);
    expect(noThreadState.preferredModelId).toBe("last-model");

    const threadState = resolveThreadCodexState({
      workspaceId: "ws-1",
      threadId: "thread-2",
      defaultAccessMode: "current",
      lastComposerModelId: null,
      lastComposerReasoningEffort: null,
      stored: { modelId: null, effort: null, accessMode: null, collaborationModeId: null, codexArgsOverride: undefined, updatedAt: 0 },
      noThreadStored,
      pendingSeed: {
        workspaceId: "ws-1",
        collaborationModeId: "review",
        accessMode: "current",
        codexArgsOverride: "--cd /repo",
      },
    });
    expect(threadState.preferredCollabModeId).toBe("review");
    expect(threadState.preferredCodexArgsOverride).toBe("--cd /repo");

    const explicitDefaultArgs = resolveThreadCodexState({
      workspaceId: "ws-1",
      threadId: "thread-3",
      defaultAccessMode: "current",
      lastComposerModelId: null,
      lastComposerReasoningEffort: null,
      stored: {
        modelId: null,
        effort: null,
        accessMode: null,
        collaborationModeId: null,
        codexArgsOverride: null,
        updatedAt: 1,
      },
      noThreadStored: {
        ...noThreadStored,
        codexArgsOverride: "--config /tmp/no-thread.toml",
      },
      pendingSeed: {
        workspaceId: "ws-1",
        collaborationModeId: "pair",
        accessMode: "current",
        codexArgsOverride: "--cd /repo/fallback",
      },
    });
    expect(explicitDefaultArgs.preferredCodexArgsOverride).toBeNull();

    const pendingWorkspaceMismatch = resolveThreadCodexState({
      workspaceId: "ws-1",
      threadId: "thread-4",
      defaultAccessMode: "current",
      lastComposerModelId: "model-x",
      lastComposerReasoningEffort: "low",
      stored: null,
      noThreadStored,
      pendingSeed: {
        workspaceId: "ws-2",
        collaborationModeId: "review",
        accessMode: "current",
        codexArgsOverride: "--cd /repo/other",
      },
    });
    expect(pendingWorkspaceMismatch.accessMode).toBe("current");
    expect(pendingWorkspaceMismatch.preferredCollabModeId).toBeNull();
    expect(pendingWorkspaceMismatch.preferredCodexArgsOverride).toBe(
      "--config /tmp/global.toml",
    );
  });

  it("prefers stored no-thread values and falls back to null codex args when no defaults exist", () => {
    const storedNoThread = resolveThreadCodexState({
      workspaceId: "ws-1",
      threadId: null,
      defaultAccessMode: "current",
      lastComposerModelId: null,
      lastComposerReasoningEffort: null,
      stored: {
        modelId: "gpt-5",
        effort: "low",
        accessMode: "current",
        collaborationModeId: "pair",
        codexArgsOverride: "--cd /repo/from-stored",
        updatedAt: 2,
      },
      noThreadStored: null,
      pendingSeed: null,
    });
    expect(storedNoThread.accessMode).toBe("current");
    expect(storedNoThread.preferredModelId).toBe("gpt-5");
    expect(storedNoThread.preferredEffort).toBe("low");
    expect(storedNoThread.preferredCollabModeId).toBe("pair");
    expect(storedNoThread.preferredCodexArgsOverride).toBe("--cd /repo/from-stored");

    const noFallbackArgs = resolveThreadCodexState({
      workspaceId: "ws-1",
      threadId: "thread-x",
      defaultAccessMode: "current",
      lastComposerModelId: null,
      lastComposerReasoningEffort: null,
      stored: {
        modelId: null,
        effort: null,
        accessMode: null,
        collaborationModeId: null,
        codexArgsOverride: undefined,
        updatedAt: 3,
      },
      noThreadStored: null,
      pendingSeed: null,
    });
    expect(noFallbackArgs.preferredCodexArgsOverride).toBeNull();
  });

  it("builds seed patch with pending seed override precedence", () => {
    expect(
      buildThreadCodexSeedPatch({
        workspaceId: "ws-1",
        selectedModelId: "gpt-5",
        resolvedEffort: "high",
        accessMode: "current",
        selectedCollaborationModeId: "manual",
        codexArgsOverride: "--config /repo/a.toml",
        pendingSeed: {
          workspaceId: "ws-1",
          collaborationModeId: "auto",
          accessMode: "current",
          codexArgsOverride: "--cd /repo",
        },
      }),
    ).toEqual({
      modelId: "gpt-5",
      effort: "high",
      accessMode: "current",
      collaborationModeId: "auto",
      codexArgsOverride: "--cd /repo",
    });

    expect(
      buildThreadCodexSeedPatch({
        workspaceId: "ws-1",
        selectedModelId: "gpt-5-mini",
        resolvedEffort: "medium",
        accessMode: "current",
        selectedCollaborationModeId: "manual",
        codexArgsOverride: "--config /repo/b.toml",
        pendingSeed: {
          workspaceId: "ws-2",
          collaborationModeId: "auto",
          accessMode: "current",
          codexArgsOverride: "--cd /repo/other",
        },
      }),
    ).toEqual({
      modelId: "gpt-5-mini",
      effort: "medium",
      accessMode: "current",
      collaborationModeId: "manual",
      codexArgsOverride: "--config /repo/b.toml",
    });
  });
});
