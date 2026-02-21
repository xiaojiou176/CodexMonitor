import { useCallback, useRef } from "react";
import type { Dispatch } from "react";
import type { ThreadAction } from "./useThreadsReducer";
import { asString, normalizeStringList } from "../utils/threadNormalize";
import { isSubAgentSource } from "../utils/subAgentSource";

type UseThreadLinkingOptions = {
  dispatch: Dispatch<ThreadAction>;
  threadParentById: Record<string, string>;
  onCollabLinkedThread?: (threadId: string) => void;
};

type UpdateThreadParentOptions = {
  source?: unknown;
  allowReparent?: boolean;
};

export function useThreadLinking({
  dispatch,
  threadParentById,
  onCollabLinkedThread,
}: UseThreadLinkingOptions) {
  const reparentedThreadIdsRef = useRef<Record<string, true>>({});

  const wouldCreateThreadCycle = useCallback(
    (parentId: string, childId: string) => {
      const visited = new Set([childId]);
      let current: string | undefined = parentId;
      while (current) {
        if (visited.has(current)) {
          return true;
        }
        visited.add(current);
        current = threadParentById[current];
      }
      return false;
    },
    [threadParentById],
  );

  const updateThreadParent = useCallback(
    (
      parentId: string,
      childIds: string[],
      options?: UpdateThreadParentOptions,
    ) => {
      if (!parentId || childIds.length === 0) {
        return;
      }
      const allowReparent =
        options?.allowReparent ?? isSubAgentSource(options?.source);
      childIds.forEach((childId) => {
        if (!childId || childId === parentId) {
          return;
        }
        const existingParent = threadParentById[childId];
        if (existingParent === parentId) {
          return;
        }
        if (existingParent) {
          if (!allowReparent || reparentedThreadIdsRef.current[childId]) {
            return;
          }
        }
        if (wouldCreateThreadCycle(parentId, childId)) {
          return;
        }
        if (existingParent && existingParent !== parentId) {
          reparentedThreadIdsRef.current[childId] = true;
        }
        dispatch({ type: "setThreadParent", threadId: childId, parentId });
      });
    },
    [dispatch, threadParentById, wouldCreateThreadCycle],
  );

  const applyCollabThreadLinks = useCallback(
    (fallbackThreadId: string, item: Record<string, unknown>) => {
      const itemType = asString(item?.type ?? "");
      if (itemType !== "collabToolCall" && itemType !== "collabAgentToolCall") {
        return;
      }
      const sender = asString(item.senderThreadId ?? item.sender_thread_id ?? "");
      const parentId = sender || fallbackThreadId;
      if (!parentId) {
        return;
      }
      const receivers = [
        ...normalizeStringList(item.receiverThreadId ?? item.receiver_thread_id),
        ...normalizeStringList(item.receiverThreadIds ?? item.receiver_thread_ids),
        ...normalizeStringList(item.newThreadId ?? item.new_thread_id),
      ];
      receivers.forEach((childId) => {
        onCollabLinkedThread?.(childId);
      });
      updateThreadParent(parentId, receivers);
    },
    [onCollabLinkedThread, updateThreadParent],
  );

  const applyCollabThreadLinksFromThread = useCallback(
    (fallbackThreadId: string, thread: Record<string, unknown>) => {
      const turns = Array.isArray(thread.turns) ? thread.turns : [];
      turns.forEach((turn) => {
        const turnRecord = turn as Record<string, unknown>;
        const turnItems = Array.isArray(turnRecord.items)
          ? (turnRecord.items as Record<string, unknown>[])
          : [];
        turnItems.forEach((item) => {
          applyCollabThreadLinks(fallbackThreadId, item);
        });
      });
    },
    [applyCollabThreadLinks],
  );

  return {
    applyCollabThreadLinks,
    applyCollabThreadLinksFromThread,
    updateThreadParent,
  };
}
