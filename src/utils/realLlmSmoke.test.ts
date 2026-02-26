import { describe, expect, it } from "vitest";
import {
  extractGeneratedText,
  extractModelIds,
  parseKeyValueLines,
  resolveConfig,
  resolveEffectiveEnv,
  resolveEffectiveEnvWithSources,
  selectModel,
} from "../../scripts/real-llm-smoke.mjs";

describe("real-llm-smoke helpers", () => {
  it("returns skip config when required env is missing", () => {
    const result = resolveConfig({});
    expect(result).toEqual({
      shouldSkip: true,
      reason: "missing required env: REAL_LLM_BASE_URL, GEMINI_API_KEY",
    });
  });

  it("parses dotenv/zsh style key-value lines", () => {
    const parsed = parseKeyValueLines(`
      # comment
      REAL_LLM_BASE_URL="https://proxy.local"
      export REAL_LLM_API_KEY='sk-demo'
    `);
    expect(parsed).toMatchObject({
      REAL_LLM_BASE_URL: "https://proxy.local",
      REAL_LLM_API_KEY: "sk-demo",
    });
  });

  it("loads fallback env from .env when process env is missing", () => {
    const effective = resolveEffectiveEnv(
      {},
      {
        cwd: "/repo",
        home: "/home/user",
        readText: (filePath: string) => {
          if (filePath === "/repo/.env") {
            return "REAL_LLM_BASE_URL=https://example.com\nREAL_LLM_API_KEY=sk-from-dotenv";
          }
          throw new Error("missing");
        },
      },
    );
    expect(effective.REAL_LLM_BASE_URL).toBe("https://example.com");
    expect(effective.GEMINI_API_KEY).toBe("sk-from-dotenv");
  });

  it("maps GEMINI_API_KEY from process env and defaults Gemini base url", () => {
    const effective = resolveEffectiveEnv(
      {
        GEMINI_API_KEY: "gemini-process-key",
      },
      {
        cwd: "/repo",
        readText: () => {
          throw new Error("missing");
        },
      },
    );
    expect(effective.GEMINI_API_KEY).toBe("gemini-process-key");
    expect(effective.REAL_LLM_BASE_URL).toBe(
      "https://generativelanguage.googleapis.com/v1beta/openai",
    );
  });

  it("tracks alias source without leaking raw key in source metadata", () => {
    const { sources } = resolveEffectiveEnvWithSources(
      {
        GEMINI_API_KEY: "gemini-process-key",
      },
      {
        cwd: "/repo",
        readText: () => {
          throw new Error("missing");
        },
      },
    ) as unknown as {
      sources: Record<string, string>;
    };
    const apiKeySource = sources.GEMINI_API_KEY;
    expect(apiKeySource).toBe("process env");
    expect(apiKeySource).not.toContain("gemini-process-key");
  });

  it("normalizes required env and timeout", () => {
    const result = resolveConfig({
      REAL_LLM_BASE_URL: "https://example.com/",
      GEMINI_API_KEY: "sk-test",
      REAL_LLM_TIMEOUT_MS: "5000",
    });
    expect(result).toMatchObject({
      shouldSkip: false,
      baseUrl: "https://example.com",
      apiKey: "sk-test",
      timeoutMs: 5000,
    });
  });

  it("falls back to default timeout for invalid timeout env", () => {
    const result = resolveConfig({
      REAL_LLM_BASE_URL: "https://example.com/",
      GEMINI_API_KEY: "sk-test",
      REAL_LLM_TIMEOUT_MS: "invalid",
    });
    expect(result).toMatchObject({
      shouldSkip: false,
      timeoutMs: 20000,
    });
  });

  it("extracts model ids from /v1/models payload", () => {
    const ids = extractModelIds({
      data: [{ id: "gpt-4o-mini" }, { id: "gpt-4.1" }, { notId: "x" }],
    });
    expect(ids).toEqual(["gpt-4o-mini", "gpt-4.1"]);
  });

  it("selects requested model or first discovered model", () => {
    expect(selectModel(["model-a", "model-b"], "custom-model")).toBe("custom-model");
    expect(selectModel(["model-a", "model-b"], "")).toBe("model-a");
  });

  it("extracts output text from /v1/responses and /v1/chat/completions formats", () => {
    expect(extractGeneratedText({ output_text: " pong " })).toBe("pong");
    expect(
      extractGeneratedText({
        output: [
          {
            content: [{ type: "output_text", text: "ok" }],
          },
        ],
      }),
    ).toBe("ok");
    expect(
      extractGeneratedText({
        choices: [
          {
            message: {
              content: "done",
            },
          },
        ],
      }),
    ).toBe("done");
    expect(
      extractGeneratedText({
        choices: [
          {
            message: {
              content: [{ type: "output_text", text: "structured" }],
            },
          },
        ],
      }),
    ).toBe("structured");
  });
});
