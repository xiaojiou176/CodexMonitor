import { describe, expect, it } from "vitest";
import {
  extractGeneratedText,
  extractModelIds,
  parseKeyValueLines,
  resolveConfig,
  resolveEffectiveEnv,
  selectModel,
} from "../../scripts/real-llm-smoke.mjs";

describe("real-llm-smoke helpers", () => {
  it("returns skip config when required env is missing", () => {
    const result = resolveConfig({});
    expect(result).toEqual({
      shouldSkip: true,
      reason: "missing required env: REAL_LLM_BASE_URL, REAL_LLM_API_KEY",
    });
  });

  it("parses dotenv/zsh style key-value lines", () => {
    const parsed = parseKeyValueLines(`
      # comment
      REAL_LLM_BASE_URL="https://proxy.local"
      export REAL_LLM_API_KEY='sk-demo'
      OPENAI_MODEL=gpt-5-mini
    `);
    expect(parsed).toMatchObject({
      REAL_LLM_BASE_URL: "https://proxy.local",
      REAL_LLM_API_KEY: "sk-demo",
      OPENAI_MODEL: "gpt-5-mini",
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
    expect(effective.REAL_LLM_API_KEY).toBe("sk-from-dotenv");
  });

  it("maps OPENAI_API_KEY from zshrc and defaults base url", () => {
    const effective = resolveEffectiveEnv(
      {},
      {
        cwd: "/repo",
        home: "/home/user",
        readText: (filePath: string) => {
          if (filePath === "/home/user/.zshrc") {
            return "export OPENAI_API_KEY=sk-zsh";
          }
          throw new Error("missing");
        },
      },
    );
    expect(effective.REAL_LLM_API_KEY).toBe("sk-zsh");
    expect(effective.REAL_LLM_BASE_URL).toBe("https://api.openai.com");
  });

  it("normalizes required env and timeout", () => {
    const result = resolveConfig({
      REAL_LLM_BASE_URL: "https://example.com/",
      REAL_LLM_API_KEY: "sk-test",
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
      REAL_LLM_API_KEY: "sk-test",
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
