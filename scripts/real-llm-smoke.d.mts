export function parseKeyValueLines(content: string): Record<string, string>;
export function resolveEffectiveEnv(
  seedEnv?: Record<string, string | undefined>,
  options?: {
    cwd?: string;
    home?: string;
    readText?: (filePath: string) => string;
  },
): Record<string, string | undefined>;
export function resolveEffectiveEnvWithSources(
  seedEnv?: Record<string, string | undefined>,
  options?: object,
): Record<string, string | undefined>;
export function resolveConfig(env?: Record<string, string | undefined>): {
  shouldSkip: boolean;
  reason?: string;
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  model?: string;
};
export function extractModelIds(modelsPayload: unknown): string[];
export function selectModel(modelIds: string[], requestedModel: string): string;
export function extractGeneratedText(payload: unknown): string;
export function runLivePreflight(seedEnv?: Record<string, string | undefined>): Promise<void>;
export function runRealLlmSmoke(env?: Record<string, string | undefined>): Promise<void>;
