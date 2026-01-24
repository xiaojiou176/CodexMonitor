import { useMemo } from "react";
import type { CollaborationModeOption, ModelOption } from "../../../types";

type UseCollaborationComposerOverridesOptions = {
  selectedCollaborationMode: CollaborationModeOption | null;
  selectedCollaborationModeId: string | null;
  models: ModelOption[];
  selectedModelId: string | null;
  selectedEffort: string | null;
  reasoningOptions: string[];
};

export function useCollaborationComposerOverrides({
  selectedCollaborationMode,
  selectedCollaborationModeId,
  models,
  selectedModelId,
  selectedEffort,
  reasoningOptions,
}: UseCollaborationComposerOverridesOptions) {
  const collaborationModeModel = selectedCollaborationMode?.model ?? null;
  const collaborationModeEffort = selectedCollaborationMode?.reasoningEffort ?? null;

  const collaborationModeModelOption = useMemo(() => {
    if (!collaborationModeModel) {
      return null;
    }
    return (
      models.find((model) => model.model === collaborationModeModel) ??
      models.find((model) => model.id === collaborationModeModel) ??
      null
    );
  }, [collaborationModeModel, models]);

  const composerSelectedModelId = selectedCollaborationModeId
    ? collaborationModeModelOption?.id ?? selectedModelId
    : selectedModelId;
  const composerSelectedEffort = selectedCollaborationModeId
    ? collaborationModeEffort ?? selectedEffort
    : selectedEffort;

  const composerReasoningOptions = useMemo(() => {
    if (!selectedCollaborationModeId || !collaborationModeModelOption) {
      return reasoningOptions;
    }
    const options = collaborationModeModelOption.supportedReasoningEfforts.map(
      (effort) => effort.reasoningEffort,
    );
    if (collaborationModeEffort && !options.includes(collaborationModeEffort)) {
      return [...options, collaborationModeEffort];
    }
    return options;
  }, [
    collaborationModeEffort,
    collaborationModeModelOption,
    reasoningOptions,
    selectedCollaborationModeId,
  ]);

  return {
    composerReasoningOptions,
    composerSelectedEffort,
    composerSelectedModelId,
  };
}
