import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DebugEntry, SkillOption, WorkspaceInfo } from "../../../types";
import { getSkillsList } from "../../../services/tauri";
import { subscribeAppServerEvents } from "../../../services/events";
import { isSkillsUpdateAvailableEvent } from "../../../utils/appServerEvents";

type UseSkillsOptions = {
  activeWorkspace: WorkspaceInfo | null;
  onDebug?: (entry: DebugEntry) => void;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeErrorStrings(value: unknown): string[] {
  if (!value) {
    return [];
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => normalizeErrorStrings(entry));
  }
  const record = asRecord(value);
  if (!record) {
    return [];
  }
  const fromKnownFields = [
    asNonEmptyString(record.message),
    asNonEmptyString(record.error),
    asNonEmptyString(record.detail),
    asNonEmptyString(record.reason),
  ].filter((item): item is string => Boolean(item));
  if (fromKnownFields.length > 0) {
    return fromKnownFields;
  }
  const serialized = JSON.stringify(record);
  return serialized ? [serialized] : [];
}

function mergeSkillOption(previous: SkillOption, next: SkillOption): SkillOption {
  return {
    ...previous,
    description: previous.description ?? next.description,
    scope: previous.scope ?? next.scope,
    enabled: previous.enabled ?? next.enabled,
    interface: previous.interface ?? next.interface,
    dependencies: previous.dependencies ?? next.dependencies,
    errors:
      previous.errors && previous.errors.length > 0
        ? previous.errors
        : next.errors && next.errors.length > 0
          ? next.errors
          : undefined,
    cwd: previous.cwd ?? next.cwd,
  };
}

function parseSkillEntry(
  value: unknown,
  bucketMeta?: { cwd?: string; errors?: string[] },
): SkillOption | null {
  const skill = asRecord(value);
  if (!skill) {
    return null;
  }
  const name = asNonEmptyString(skill.name);
  if (!name) {
    return null;
  }
  const path = typeof skill.path === "string" ? skill.path.trim() : "";
  const errors = [
    ...normalizeErrorStrings(skill.errors),
    ...(bucketMeta?.errors ?? []),
  ];
  return {
    name,
    path,
    description: asNonEmptyString(skill.description),
    scope: asNonEmptyString(skill.scope),
    enabled:
      typeof skill.enabled === "boolean"
        ? skill.enabled
        : typeof skill.isEnabled === "boolean"
          ? skill.isEnabled
          : undefined,
    interface: skill.interface ?? skill.skillInterface,
    dependencies: skill.dependencies,
    errors: errors.length > 0 ? errors : undefined,
    cwd: asNonEmptyString(skill.cwd) ?? bucketMeta?.cwd,
  };
}

function parseSkillsListResponse(response: Record<string, unknown>): SkillOption[] {
  const nextSkills: SkillOption[] = [];
  const result = asRecord(response.result) ?? {};
  const responseData = Array.isArray(response.data) ? response.data : [];
  const resultData = Array.isArray(result.data) ? result.data : [];
  const buckets = resultData.length > 0 ? resultData : responseData;

  if (buckets.length > 0) {
    buckets.forEach((bucketRaw) => {
      const bucket = asRecord(bucketRaw);
      if (!bucket) {
        return;
      }
      const bucketSkills = Array.isArray(bucket.skills) ? bucket.skills : [];
      const bucketMeta = {
        cwd: asNonEmptyString(bucket.cwd),
        errors: normalizeErrorStrings(bucket.errors),
      };
      bucketSkills.forEach((entry) => {
        const normalized = parseSkillEntry(entry, bucketMeta);
        if (normalized) {
          nextSkills.push(normalized);
        }
      });
    });
  }

  const topLevelSkills = [
    ...(Array.isArray(result.skills) ? result.skills : []),
    ...(Array.isArray(response.skills) ? response.skills : []),
  ];
  topLevelSkills.forEach((entry) => {
    const normalized = parseSkillEntry(entry);
    if (normalized) {
      nextSkills.push(normalized);
    }
  });

  const deduped = new Map<string, SkillOption>();
  nextSkills.forEach((skill) => {
    const key = skill.path ? `path:${skill.path}` : `name:${skill.name.toLowerCase()}`;
    const existing = deduped.get(key);
    deduped.set(key, existing ? mergeSkillOption(existing, skill) : skill);
  });
  return Array.from(deduped.values());
}

export function useSkills({ activeWorkspace, onDebug }: UseSkillsOptions) {
  const [skills, setSkills] = useState<SkillOption[]>([]);
  const lastFetchedWorkspaceId = useRef<string | null>(null);
  const inFlight = useRef(false);

  const workspaceId = activeWorkspace?.id ?? null;
  const isConnected = Boolean(activeWorkspace?.connected);

  const refreshSkills = useCallback(async () => {
    if (!workspaceId || !isConnected) {
      return;
    }
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    onDebug?.({
      id: `${Date.now()}-client-skills-list`,
      timestamp: Date.now(),
      source: "client",
      label: "skills/list",
      payload: { workspaceId },
    });
    try {
      const response = await getSkillsList(workspaceId);
      onDebug?.({
        id: `${Date.now()}-server-skills-list`,
        timestamp: Date.now(),
        source: "server",
        label: "skills/list response",
        payload: response,
      });
      setSkills(parseSkillsListResponse(response as Record<string, unknown>));
      lastFetchedWorkspaceId.current = workspaceId;
    } catch (error) {
      onDebug?.({
        id: `${Date.now()}-client-skills-list-error`,
        timestamp: Date.now(),
        source: "error",
        label: "skills/list error",
        payload: error instanceof Error ? error.message : String(error),
      });
    } finally {
      inFlight.current = false;
    }
  }, [isConnected, onDebug, workspaceId]);

  useEffect(() => {
    if (!workspaceId || !isConnected) {
      return;
    }
    if (lastFetchedWorkspaceId.current === workspaceId && skills.length > 0) {
      return;
    }
    refreshSkills();
  }, [isConnected, refreshSkills, skills.length, workspaceId]);

  useEffect(() => {
    if (!workspaceId || !isConnected) {
      return;
    }

    return subscribeAppServerEvents((event) => {
      if (event.workspace_id !== workspaceId) {
        return;
      }
      if (!isSkillsUpdateAvailableEvent(event)) {
        return;
      }

      onDebug?.({
        id: `${Date.now()}-server-skills-update-available`,
        timestamp: Date.now(),
        source: "server",
        label: "skills/update available",
        payload: event,
      });
      void refreshSkills();
    });
  }, [isConnected, onDebug, refreshSkills, workspaceId]);

  const skillOptions = useMemo(
    () => skills.filter((skill) => skill.name),
    [skills],
  );

  return {
    skills: skillOptions,
    refreshSkills,
  };
}
