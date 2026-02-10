import { useMemo } from "react";
import { useTauriEvent } from "../../app/hooks/useTauriEvent";
import {
  subscribeMenuCycleCollaborationMode,
  subscribeMenuCycleModel,
  subscribeMenuCycleReasoning,
} from "../../../services/events";

type ModelOption = { id: string; displayName: string; model: string };

type UseComposerMenuActionsOptions = {
  models: ModelOption[];
  selectedModelId: string | null;
  onSelectModel: (id: string) => void;
  collaborationModes: { id: string; label: string }[];
  selectedCollaborationModeId: string | null;
  onSelectCollaborationMode: (id: string | null) => void;
  reasoningOptions: string[];
  selectedEffort: string | null;
  onSelectEffort: (effort: string) => void;
  reasoningSupported: boolean;
  onFocusComposer?: () => void;
};

export function useComposerMenuActions({
  models,
  selectedModelId,
  onSelectModel,
  collaborationModes,
  selectedCollaborationModeId,
  onSelectCollaborationMode,
  reasoningOptions,
  selectedEffort,
  onSelectEffort,
  reasoningSupported,
  onFocusComposer,
}: UseComposerMenuActionsOptions) {
  const handlers = useMemo(
    () => ({
      cycleModel() {
        if (models.length === 0) {
          return;
        }
        const currentIndex = models.findIndex((model) => model.id === selectedModelId);
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % models.length : 0;
        const nextModel = models[nextIndex];
        if (nextModel) {
          onFocusComposer?.();
          onSelectModel(nextModel.id);
        }
      },
      cycleCollaborationMode() {
        if (collaborationModes.length === 0) {
          return;
        }
        const currentIndex = collaborationModes.findIndex(
          (mode) => mode.id === selectedCollaborationModeId,
        );
        const nextIndex =
          currentIndex >= 0
            ? (currentIndex + 1) % collaborationModes.length
            : 0;
        const nextMode = collaborationModes[nextIndex];
        if (nextMode) {
          onFocusComposer?.();
          onSelectCollaborationMode(nextMode.id);
        }
      },
      cycleReasoning() {
        if (!reasoningSupported || reasoningOptions.length === 0) {
          return;
        }
        const currentIndex = reasoningOptions.indexOf(selectedEffort ?? "");
        const nextIndex =
          currentIndex >= 0 ? (currentIndex + 1) % reasoningOptions.length : 0;
        const nextEffort = reasoningOptions[nextIndex];
        if (nextEffort) {
          onFocusComposer?.();
          onSelectEffort(nextEffort);
        }
      },
    }),
    [
      collaborationModes,
      models,
      onFocusComposer,
      onSelectCollaborationMode,
      onSelectEffort,
      onSelectModel,
      reasoningOptions,
      reasoningSupported,
      selectedCollaborationModeId,
      selectedEffort,
      selectedModelId,
    ],
  );

  useTauriEvent(subscribeMenuCycleModel, () => {
    handlers.cycleModel();
  });

  useTauriEvent(subscribeMenuCycleCollaborationMode, () => {
    handlers.cycleCollaborationMode();
  });

  useTauriEvent(subscribeMenuCycleReasoning, () => {
    handlers.cycleReasoning();
  });

  return handlers;
}
