import { useCallback } from "react";
import { buildThreadTranscript } from "@utils/threadText";
import type { ConversationItem, DebugEntry } from "@/types";

type CopyThreadOptions = {
  activeItems: ConversationItem[];
  onDebug: (entry: DebugEntry) => void;
};

export function useCopyThread({ activeItems, onDebug }: CopyThreadOptions) {
  const doCopy = useCallback(
    async (includeToolOutput: boolean) => {
      if (!activeItems.length) {
        return;
      }
      const transcript = buildThreadTranscript(activeItems, {
        includeToolOutput,
      });
      if (!transcript) {
        return;
      }
      try {
        await navigator.clipboard.writeText(transcript);
      } catch (error) {
        onDebug({
          id: `${Date.now()}-client-copy-thread-error`,
          timestamp: Date.now(),
          source: "error",
          label: "thread/copy error",
          payload: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [activeItems, onDebug],
  );

  /** Copy with full tool/command output */
  const handleCopyThreadFull = useCallback(
    () => doCopy(true),
    [doCopy],
  );

  /** Copy without tool/command output (compact) */
  const handleCopyThreadCompact = useCallback(
    () => doCopy(false),
    [doCopy],
  );

  /** Legacy: same as full for backward compat */
  const handleCopyThread = handleCopyThreadFull;

  return { handleCopyThread, handleCopyThreadFull, handleCopyThreadCompact };
}
