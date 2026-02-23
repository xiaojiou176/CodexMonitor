import { asString } from "./threadNormalize";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

function extractSubAgentRecord(source: unknown): Record<string, unknown> | null {
  const sourceRecord = asRecord(source);
  if (!sourceRecord) {
    return null;
  }
  return asRecord(sourceRecord.subAgent ?? sourceRecord.sub_agent ?? sourceRecord.subagent);
}

function extractThreadSpawnRecord(subAgent: Record<string, unknown>) {
  return asRecord(subAgent.thread_spawn ?? subAgent.threadSpawn);
}

export function extractSubAgentParentThreadId(source: unknown): string | null {
  const subAgent = extractSubAgentRecord(source);
  if (!subAgent) {
    return null;
  }
  const threadSpawn = extractThreadSpawnRecord(subAgent);
  if (!threadSpawn) {
    return null;
  }
  const parentThreadId = asString(
    threadSpawn.parent_thread_id ?? threadSpawn.parentThreadId,
  ).trim();
  return parentThreadId || null;
}

export function isSubAgentSource(source: unknown): boolean {
  const subAgent = extractSubAgentRecord(source);
  if (!subAgent) {
    return false;
  }
  return extractThreadSpawnRecord(subAgent) !== null;
}
