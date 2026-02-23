import { appendStructuredLog, type StructuredLogLevel } from "./tauri";

export type StructuredLogContext = Record<string, unknown> | null | undefined;

let writeQueue: Promise<void> = Promise.resolve();

function toSerializableContext(context: StructuredLogContext): Record<string, unknown> | null {
  if (!context) {
    return null;
  }
  try {
    return JSON.parse(JSON.stringify(context)) as Record<string, unknown>;
  } catch {
    return {
      serializationError: "Failed to serialize structured log context",
      originalType: typeof context,
    };
  }
}

export function logStructured(
  level: StructuredLogLevel,
  source: string,
  message: string,
  context?: StructuredLogContext,
): void {
  const serializedContext = toSerializableContext(context);
  writeQueue = writeQueue
    .then(async () => {
      await appendStructuredLog(level, source, message, serializedContext);
    })
    .catch(() => {});
}

export function logError(source: string, message: string, context?: StructuredLogContext): void {
  logStructured("ERROR", source, message, context);
}

export function logWarn(source: string, message: string, context?: StructuredLogContext): void {
  logStructured("WARN", source, message, context);
}
