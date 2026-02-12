import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type {
  ConversationItem,
  OpenAppTarget,
  RequestUserInputRequest,
  RequestUserInputResponse,
} from "../../../types";
import { isPlanReadyTaggedMessage } from "../../../utils/internalPlanReadyMessages";
import { PlanReadyFollowupMessage } from "../../app/components/PlanReadyFollowupMessage";
import { RequestUserInputMessage } from "../../app/components/RequestUserInputMessage";
import { useFileLinkOpener } from "../hooks/useFileLinkOpener";
import {
  SCROLL_THRESHOLD_PX,
  buildToolGroups,
  parseReasoning,
  scrollKeyForItems,
  toolStatusTone,
} from "../utils/messageRenderUtils";
import {
  DiffRow,
  ExploreRow,
  MessageRow,
  ReasoningRow,
  ReviewRow,
  ToolRow,
  WorkingIndicator,
} from "./MessageRows";

const ASSISTANT_AUTO_COLLAPSE_KEEP_RECENT_COUNT = 5;
const VIRTUAL_ROW_ESTIMATE_PX = 140;
const VIRTUAL_OVERSCAN_ROWS = 18;
const VIRTUAL_ENABLE_MIN_ROWS = 120;
const VIRTUAL_TOP_REACH_THRESHOLD_PX = 16;
const VIRTUAL_TOP_REACH_COOLDOWN_MS = 900;
const VIRTUAL_AUTO_TOP_REACH_ENABLED = true;
const AUTO_SCROLL_CAPTURE_THRESHOLD_PX = SCROLL_THRESHOLD_PX;
const AUTO_SCROLL_RELEASE_THRESHOLD_PX = SCROLL_THRESHOLD_PX * 3;

type MessagesProps = {
  items: ConversationItem[];
  threadId: string | null;
  workspaceId?: string | null;
  isThinking: boolean;
  isStreaming?: boolean;
  isLoadingMessages?: boolean;
  processingStartedAt?: number | null;
  lastDurationMs?: number | null;
  workspacePath?: string | null;
  openTargets: OpenAppTarget[];
  selectedOpenAppId: string;
  codeBlockCopyUseModifier?: boolean;
  showMessageFilePath?: boolean;
  userInputRequests?: RequestUserInputRequest[];
  onUserInputSubmit?: (
    request: RequestUserInputRequest,
    response: RequestUserInputResponse,
  ) => void;
  onPlanAccept?: () => void;
  onPlanSubmitChanges?: (changes: string) => void;
  onOpenThreadLink?: (threadId: string) => void;
  onReachTop?: () => boolean | void | Promise<boolean | void>;
};

type RenderableItemEntry = {
  key: string;
  item: ConversationItem;
  rowClassName: string;
};

function rowClassNameForItem(item: ConversationItem): string {
  if (item.kind === "message") {
    return item.role === "assistant"
      ? "item-message-assistant"
      : "item-message-user";
  }
  return `item-${item.kind}`;
}

export const Messages = memo(function Messages({
  items,
  threadId,
  workspaceId = null,
  isThinking,
  isStreaming = false,
  isLoadingMessages = false,
  processingStartedAt = null,
  lastDurationMs = null,
  workspacePath = null,
  openTargets,
  selectedOpenAppId,
  codeBlockCopyUseModifier = false,
  showMessageFilePath = true,
  userInputRequests = [],
  onUserInputSubmit,
  onPlanAccept,
  onPlanSubmitChanges,
  onOpenThreadLink,
  onReachTop,
}: MessagesProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef(true);

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const topReachInFlightRef = useRef(false);
  const topReachLastAtRef = useRef(0);
  const manuallyToggledExpandedRef = useRef<Set<string>>(new Set());
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const copiedMessageIdRef = useRef(copiedMessageId);
  copiedMessageIdRef.current = copiedMessageId;
  const copyTimeoutRef = useRef<number | null>(null);
  const activeUserInputRequestId =
    threadId && userInputRequests.length
      ? (userInputRequests.find(
          (request) =>
            request.params.thread_id === threadId &&
            (!workspaceId || request.workspace_id === workspaceId),
        )?.request_id ?? null)
      : null;
  const scrollKey = `${scrollKeyForItems(items)}-${activeUserInputRequestId ?? "no-input"}`;
  const { openFileLink, showFileLinkMenu } = useFileLinkOpener(
    workspacePath,
    openTargets,
    selectedOpenAppId,
  );

  const distanceFromBottom = useCallback(
    (node: HTMLDivElement) => node.scrollHeight - node.scrollTop - node.clientHeight,
    [],
  );

  const isNearBottom = useCallback(
    (node: HTMLDivElement) =>
      distanceFromBottom(node) <= AUTO_SCROLL_CAPTURE_THRESHOLD_PX,
    [distanceFromBottom],
  );

  const computeAutoScrollEnabled = useCallback(
    (node: HTMLDivElement, previousEnabled: boolean) => {
      const distance = distanceFromBottom(node);
      if (previousEnabled) {
        return distance <= AUTO_SCROLL_RELEASE_THRESHOLD_PX;
      }
      return distance <= AUTO_SCROLL_CAPTURE_THRESHOLD_PX;
    },
    [distanceFromBottom],
  );


  const triggerTopReach = useCallback(() => {
    if (!onReachTop) {
      return;
    }
    const now = Date.now();
    if (topReachInFlightRef.current) {
      return;
    }
    if (now - topReachLastAtRef.current < VIRTUAL_TOP_REACH_COOLDOWN_MS) {
      return;
    }
    topReachInFlightRef.current = true;
    topReachLastAtRef.current = now;
    Promise.resolve(onReachTop())
      .catch(() => {
        // Best-effort only; top history fetch failures are handled by caller.
      })
      .finally(() => {
        topReachInFlightRef.current = false;
      });
  }, [onReachTop]);

  // Keep auto-scroll state in sync immediately when user scrolls.
  // The virtual window state itself is batched into RAF to avoid jitter.
  const updateAutoScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const scrollTop = container.scrollTop;
    const nextAutoScrollEnabled = computeAutoScrollEnabled(
      container,
      autoScrollRef.current,
    );
    autoScrollRef.current = nextAutoScrollEnabled;

    if (
      VIRTUAL_AUTO_TOP_REACH_ENABLED &&
      onReachTop &&
      scrollTop <= VIRTUAL_TOP_REACH_THRESHOLD_PX
    ) {
      triggerTopReach();
    }
  }, [computeAutoScrollEnabled, onReachTop, triggerTopReach]);

  const requestAutoScroll = useCallback(() => {
    const container = containerRef.current;
    const shouldScroll =
      autoScrollRef.current || (container ? isNearBottom(container) : true);
    if (!shouldScroll) {
      return;
    }
    if (container) {
      container.scrollTop = container.scrollHeight;
      return;
    }
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [isNearBottom]);

  useLayoutEffect(() => {
    autoScrollRef.current = true;
    topReachInFlightRef.current = false;
    topReachLastAtRef.current = 0;

  }, [threadId]);


  const toggleExpanded = useCallback((id: string) => {
    manuallyToggledExpandedRef.current.add(id);
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Incrementally cache reasoning parse results — only re-parse items whose
  // object reference actually changed, which avoids redundant work during
  // streaming when only the last message delta changes.
  const reasoningCacheRef = useRef(
    new Map<string, { item: ConversationItem; parsed: ReturnType<typeof parseReasoning> }>(),
  );
  const reasoningMetaById = useMemo(() => {
    const cache = reasoningCacheRef.current;
    const meta = new Map<string, ReturnType<typeof parseReasoning>>();
    const nextCache = new Map<string, { item: ConversationItem; parsed: ReturnType<typeof parseReasoning> }>();
    items.forEach((item) => {
      if (item.kind === "reasoning") {
        const cached = cache.get(item.id);
        if (cached && cached.item === item) {
          meta.set(item.id, cached.parsed);
          nextCache.set(item.id, cached);
        } else {
          const parsed = parseReasoning(item);
          meta.set(item.id, parsed);
          nextCache.set(item.id, { item, parsed });
        }
      }
    });
    reasoningCacheRef.current = nextCache;
    return meta;
  }, [items]);

  // Keep refs in sync so renderItem callback stays stable across renders
  const expandedItemsRef = useRef(expandedItems);
  expandedItemsRef.current = expandedItems;
  const reasoningMetaByIdRef = useRef(reasoningMetaById);
  reasoningMetaByIdRef.current = reasoningMetaById;

  const latestReasoningLabel = useMemo(() => {
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index];
      if (item.kind === "message") {
        break;
      }
      if (item.kind !== "reasoning") {
        continue;
      }
      const parsed = reasoningMetaById.get(item.id);
      if (parsed?.workingLabel) {
        return parsed.workingLabel;
      }
    }
    return null;
  }, [items, reasoningMetaById]);

  const visibleItems = useMemo(
    () =>
      items.filter((item) => {
        if (
          item.kind === "message" &&
          item.role === "user" &&
          isPlanReadyTaggedMessage(item.text)
        ) {
          return false;
        }
        if (item.kind !== "reasoning") {
          return true;
        }
        return reasoningMetaById.get(item.id)?.hasBody ?? false;
      }),
    [items, reasoningMetaById],
  );

  useEffect(() => {
    for (let index = visibleItems.length - 1; index >= 0; index -= 1) {
      const item = visibleItems[index];
      if (
        item.kind === "tool" &&
        item.toolType === "plan" &&
        (item.output ?? "").trim().length > 0
      ) {
        if (manuallyToggledExpandedRef.current.has(item.id)) {
          return;
        }
        setExpandedItems((prev) => {
          if (prev.has(item.id)) {
            return prev;
          }
          const next = new Set(prev);
          next.add(item.id);
          return next;
        });
        return;
      }
    }
  }, [visibleItems]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopyMessage = useCallback(
    async (item: Extract<ConversationItem, { kind: "message" }>) => {
      try {
        await navigator.clipboard.writeText(item.text);
        setCopiedMessageId(item.id);
        if (copyTimeoutRef.current) {
          window.clearTimeout(copyTimeoutRef.current);
        }
        copyTimeoutRef.current = window.setTimeout(() => {
          setCopiedMessageId(null);
        }, 1200);
      } catch {
        // No-op: clipboard errors can occur in restricted contexts.
      }
    },
    [],
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    const shouldScroll =
      autoScrollRef.current ||
      (container ? isNearBottom(container) : true);
    if (!shouldScroll) {
      return;
    }
    if (container) {
      container.scrollTop = container.scrollHeight;
      return;
    }
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [isNearBottom, isThinking, scrollKey, threadId]);

  const assistantAutoCollapsedIds = useMemo(() => {
    const ids = new Set<string>();
    let recentAssistantCount = 0;
    for (let index = visibleItems.length - 1; index >= 0; index -= 1) {
      const item = visibleItems[index];
      if (item.kind !== "message" || item.role !== "assistant") {
        continue;
      }
      if (recentAssistantCount >= ASSISTANT_AUTO_COLLAPSE_KEEP_RECENT_COUNT) {
        ids.add(item.id);
      }
      recentAssistantCount += 1;
    }
    return ids;
  }, [visibleItems]);

  const groupedItems = useMemo(() => buildToolGroups(visibleItems), [visibleItems]);

  const renderableEntries = useMemo<RenderableItemEntry[]>(() => {
    const flattened = groupedItems.flatMap((entry) => {
      if (entry.kind === "toolGroup") {
        return entry.group.items.map((item) => ({
          key: item.id,
          item,
          rowClassName: rowClassNameForItem(item),
        }));
      }
      return [
        {
          key: entry.item.id,
          item: entry.item,
          rowClassName: rowClassNameForItem(entry.item),
        },
      ];
    });

    return flattened.map((entry, index) => {
      const needsAssistantDivider =
        entry.item.kind === "message" &&
        entry.item.role === "assistant" &&
        index > 0;
      if (!needsAssistantDivider) {
        return entry;
      }
      return {
        ...entry,
        rowClassName: `${entry.rowClassName} item-message-assistant-divider`,
      };
    });
  }, [groupedItems]);

  const shouldVirtualize = renderableEntries.length >= VIRTUAL_ENABLE_MIN_ROWS;

  const rowVirtualizer = useVirtualizer({
    count: renderableEntries.length,
    getItemKey: (index) => renderableEntries[index]?.key ?? index,
    getScrollElement: () => containerRef.current,
    estimateSize: () => VIRTUAL_ROW_ESTIMATE_PX,
    overscan: VIRTUAL_OVERSCAN_ROWS,
    enabled: shouldVirtualize,
  });
  const virtualRows = shouldVirtualize ? rowVirtualizer.getVirtualItems() : [];

  const hasActiveUserInputRequest = activeUserInputRequestId !== null;
  const hasVisibleUserInputRequest = hasActiveUserInputRequest && Boolean(onUserInputSubmit);
  const userInputNode =
    hasActiveUserInputRequest && onUserInputSubmit ? (
      <RequestUserInputMessage
        requests={userInputRequests}
        activeThreadId={threadId}
        activeWorkspaceId={workspaceId}
        onSubmit={onUserInputSubmit}
      />
    ) : null;

  const [dismissedPlanFollowupByThread, setDismissedPlanFollowupByThread] =
    useState<Record<string, string>>({});

  const planFollowup = useMemo(() => {
    if (!threadId) {
      return { shouldShow: false, planItemId: null as string | null };
    }
    if (!onPlanAccept || !onPlanSubmitChanges) {
      return { shouldShow: false, planItemId: null as string | null };
    }
    if (hasVisibleUserInputRequest) {
      return { shouldShow: false, planItemId: null as string | null };
    }
    let planIndex = -1;
    let planItem: Extract<ConversationItem, { kind: "tool" }> | null = null;
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index];
      if (item.kind === "tool" && item.toolType === "plan") {
        planIndex = index;
        planItem = item;
        break;
      }
    }
    if (!planItem) {
      return { shouldShow: false, planItemId: null as string | null };
    }
    const planItemId = planItem.id;
    if (dismissedPlanFollowupByThread[threadId] === planItemId) {
      return { shouldShow: false, planItemId };
    }
    if (!(planItem.output ?? "").trim()) {
      return { shouldShow: false, planItemId };
    }
    const planTone = toolStatusTone(planItem, false);
    if (planTone === "failed") {
      return { shouldShow: false, planItemId };
    }
    // Some backends stream plan output deltas without a final status update. As
    // soon as the turn stops thinking, treat the latest plan output as ready.
    if (isThinking && planTone !== "completed") {
      return { shouldShow: false, planItemId };
    }
    for (let index = planIndex + 1; index < items.length; index += 1) {
      const item = items[index];
      if (item.kind === "message" && item.role === "user") {
        return { shouldShow: false, planItemId };
      }
    }
    return { shouldShow: true, planItemId };
  }, [
    dismissedPlanFollowupByThread,
    hasVisibleUserInputRequest,
    isThinking,
    items,
    onPlanAccept,
    onPlanSubmitChanges,
    threadId,
  ]);

  const planFollowupNode =
    planFollowup.shouldShow && onPlanAccept && onPlanSubmitChanges ? (
      <PlanReadyFollowupMessage
        onAccept={() => {
          if (threadId && planFollowup.planItemId) {
            setDismissedPlanFollowupByThread((prev) => ({
              ...prev,
              [threadId]: planFollowup.planItemId!,
            }));
          }
          onPlanAccept();
        }}
        onSubmitChanges={(changes) => {
          if (threadId && planFollowup.planItemId) {
            setDismissedPlanFollowupByThread((prev) => ({
              ...prev,
              [threadId]: planFollowup.planItemId!,
            }));
          }
          onPlanSubmitChanges(changes);
        }}
      />
    ) : null;

  // renderItem uses refs for high-frequency state (copiedMessageId, expandedItems,
  // reasoningMetaById) so the callback identity stays stable across streaming
  // updates. The child Row components are memo'd, so stable callback + stable item
  // references = zero wasted re-renders for unchanged rows.
  const renderItem = useCallback(
    (item: ConversationItem) => {
      if (item.kind === "message") {
        const isCopied = copiedMessageIdRef.current === item.id;
        return (
          <MessageRow
            key={item.id}
            item={item}
            isCopied={isCopied}
            onCopy={handleCopyMessage}
            codeBlockCopyUseModifier={codeBlockCopyUseModifier}
            showMessageFilePath={showMessageFilePath}
            workspaceId={workspaceId}
            workspacePath={workspacePath}
            onOpenFileLink={openFileLink}
            onOpenFileLinkMenu={showFileLinkMenu}
            onOpenThreadLink={onOpenThreadLink}
            shouldAutoCollapseLongAssistantMessage={assistantAutoCollapsedIds.has(item.id)}
          />
        );
      }
      if (item.kind === "reasoning") {
        const isExpanded = expandedItemsRef.current.has(item.id);
        const parsed =
          reasoningMetaByIdRef.current.get(item.id) ?? parseReasoning(item);
        return (
          <ReasoningRow
            key={item.id}
            item={item}
            parsed={parsed}
            isExpanded={isExpanded}
            onToggle={toggleExpanded}
            showMessageFilePath={showMessageFilePath}
            workspaceId={workspaceId}
            workspacePath={workspacePath}
            onOpenFileLink={openFileLink}
            onOpenFileLinkMenu={showFileLinkMenu}
            onOpenThreadLink={onOpenThreadLink}
          />
        );
      }
      if (item.kind === "review") {
        return (
          <ReviewRow
            key={item.id}
            item={item}
            showMessageFilePath={showMessageFilePath}
            workspaceId={workspaceId}
            workspacePath={workspacePath}
            onOpenFileLink={openFileLink}
            onOpenFileLinkMenu={showFileLinkMenu}
            onOpenThreadLink={onOpenThreadLink}
          />
        );
      }
      if (item.kind === "diff") {
        return <DiffRow key={item.id} item={item} />;
      }
      if (item.kind === "tool") {
        const isExpanded = expandedItemsRef.current.has(item.id);
        return (
          <ToolRow
            key={item.id}
            item={item}
            isExpanded={isExpanded}
            onToggle={toggleExpanded}
            showMessageFilePath={showMessageFilePath}
            workspaceId={workspaceId}
            workspacePath={workspacePath}
            onOpenFileLink={openFileLink}
            onOpenFileLinkMenu={showFileLinkMenu}
            onOpenThreadLink={onOpenThreadLink}
            onRequestAutoScroll={requestAutoScroll}
          />
        );
      }
      if (item.kind === "explore") {
        return <ExploreRow key={item.id} item={item} />;
      }
      return null;
    },
    [
      handleCopyMessage,
      codeBlockCopyUseModifier,
      showMessageFilePath,
      workspaceId,
      workspacePath,
      openFileLink,
      showFileLinkMenu,
      onOpenThreadLink,
      toggleExpanded,
      requestAutoScroll,
      assistantAutoCollapsedIds,
    ],
  );

  return (
    <div
      className="messages messages-full"
      ref={containerRef}
      onScroll={updateAutoScroll}
    >
      {/* Top manual "load older" control removed.
          Upward scroll-to-top still triggers onReachTop for history loading. */}
      {renderableEntries.length > 0 && shouldVirtualize && (
        <div
          className="messages-virtual-content"
          style={{ height: rowVirtualizer.getTotalSize() }}
        >
          {virtualRows.map((virtualRow) => {
            const entry = renderableEntries[virtualRow.index];
            if (!entry) {
              return null;
            }
            return (
              <div
                key={entry.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className={`messages-virtual-row ${entry.rowClassName}`}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translate3d(0, ${virtualRow.start}px, 0)`,
                }}
              >
                {renderItem(entry.item)}
              </div>
            );
          })}
        </div>
      )}
      {renderableEntries.length > 0 && !shouldVirtualize && (
        <div className="messages-virtual-content">
          {renderableEntries.map((entry) => (
            <div key={entry.key} className={`messages-virtual-row ${entry.rowClassName}`}>
              {renderItem(entry.item)}
            </div>
          ))}
        </div>
      )}
      {planFollowupNode}
      {userInputNode}
      <WorkingIndicator
        isThinking={isThinking}
        isStreaming={isStreaming}
        processingStartedAt={processingStartedAt}
        lastDurationMs={lastDurationMs}
        hasItems={items.length > 0}
        reasoningLabel={latestReasoningLabel}
      />
      {!items.length && !userInputNode && !isThinking && !isLoadingMessages && (
        <div className="empty messages-empty">
          {threadId ? "发送消息开始对话。" : "发送消息开始新对话。"}
        </div>
      )}
      {!items.length && !userInputNode && !isThinking && isLoadingMessages && (
        <div className="empty messages-empty">
          <div className="messages-loading-indicator" role="status" aria-live="polite">
            <span className="working-spinner" aria-hidden />
            <span className="messages-loading-label">正在加载对话记录…</span>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
});
