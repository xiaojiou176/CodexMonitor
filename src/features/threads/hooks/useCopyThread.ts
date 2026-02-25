import { useCallback } from "react";
import { buildThreadTranscript } from "../../../utils/threadText";
import type {
  ConversationItem,
  DebugEntry,
  ThreadTranscriptOptions,
} from "../../../types";

type CopyThreadOptions = {
  activeItems: ConversationItem[];
  onDebug: (entry: DebugEntry) => void;
};

export function useCopyThread({ activeItems, onDebug }: CopyThreadOptions) {
  const doCopy = useCallback(
    async (options?: ThreadTranscriptOptions) => {
      if (!activeItems.length) {
        return;
      }
      const transcript = buildThreadTranscript(activeItems, options);
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

  const handleCopyThreadWithOptions = useCallback(
    (options?: ThreadTranscriptOptions) => doCopy(options),
    [doCopy],
  );

  /** Copy with full tool/command output */
  const handleCopyThreadFull = useCallback(
    () => doCopy({ toolOutputMode: "detailed" }),
    [doCopy],
  );

  /** Copy without tool/command output (compact) */
  const handleCopyThreadCompact = useCallback(
    () => doCopy({ toolOutputMode: "compact" }),
    [doCopy],
  );

  /** Legacy: same as full for backward compat */
  const handleCopyThread = handleCopyThreadFull;

  return {
    handleCopyThread,
    handleCopyThreadWithOptions,
    handleCopyThreadFull,
    handleCopyThreadCompact,
  };
}
