import { describe, expect, it } from "vitest";
import {
  extractSubAgentParentThreadId,
  isSubAgentSource,
} from "./subAgentSource";

describe("subAgentSource", () => {
  it("extracts parent thread id from all supported source key shapes", () => {
    expect(
      extractSubAgentParentThreadId({
        subAgent: {
          thread_spawn: { parent_thread_id: "parent-a" },
        },
      }),
    ).toBe("parent-a");

    expect(
      extractSubAgentParentThreadId({
        sub_agent: {
          threadSpawn: { parentThreadId: "parent-b" },
        },
      }),
    ).toBe("parent-b");

    expect(
      extractSubAgentParentThreadId({
        subagent: {
          thread_spawn: { parentThreadId: "parent-c" },
        },
      }),
    ).toBe("parent-c");
  });

  it("returns null when source does not contain a valid parent thread id", () => {
    expect(extractSubAgentParentThreadId(null)).toBeNull();
    expect(extractSubAgentParentThreadId({})).toBeNull();
    expect(
      extractSubAgentParentThreadId({
        subAgent: {
          thread_spawn: {},
        },
      }),
    ).toBeNull();
  });

  it("detects subagent sources across supported key variants", () => {
    expect(
      isSubAgentSource({
        subAgent: {
          thread_spawn: { parent_thread_id: "parent-a" },
        },
      }),
    ).toBeTruthy();

    expect(
      isSubAgentSource({
        sub_agent: {
          threadSpawn: { parentThreadId: "parent-b" },
        },
      }),
    ).toBeTruthy();

    expect(
      isSubAgentSource({
        subagent: {
          thread_spawn: {},
        },
      }),
    ).toBeTruthy();

    expect(isSubAgentSource({ source: "vscode" })).toBe(false);
  });
});
