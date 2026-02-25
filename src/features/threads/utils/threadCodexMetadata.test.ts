import { describe, expect, it } from "vitest";
import { extractThreadCodexMetadata } from "./threadCodexMetadata";

describe("extractThreadCodexMetadata", () => {
  it("prefers latest turn/item metadata across supported key aliases", () => {
    const result = extractThreadCodexMetadata({
      turns: [
        {
          payload: { model: "old-model", reasoning_effort: "medium" },
        },
        {
          items: [
            {
              payload: {
                info: {
                  model_name: "gpt-5",
                  modelReasoningEffort: "HIGH",
                },
              },
            },
          ],
        },
      ],
    });

    expect(result).toEqual({
      modelId: "gpt-5",
      effort: "high",
    });
  });

  it("falls back to thread-level record when turns do not contain usable values", () => {
    const result = extractThreadCodexMetadata({
      model_id: "thread-model",
      reasoningEffort: "low",
      turns: [{ items: [null, { payload: { model: "   " } }] }],
    });
    expect(result).toEqual({
      modelId: "thread-model",
      effort: "low",
    });
  });

  it("normalizes unknown/default effort to null and returns nulls for invalid payloads", () => {
    expect(
      extractThreadCodexMetadata({
        turns: [
          {
            payload: {
              model: "gpt-5",
              effort: "unknown",
            },
          },
        ],
      }),
    ).toEqual({
      modelId: "gpt-5",
      effort: null,
    });

    expect(extractThreadCodexMetadata({ turns: [1, 2, 3] })).toEqual({
      modelId: null,
      effort: null,
    });
  });
});
