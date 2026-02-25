import { describe, expect, it } from "vitest";
import { getSubagentDescendantThreadIds } from "./subagentTree";

describe("getSubagentDescendantThreadIds", () => {
  it("returns empty list when root id is missing", () => {
    expect(
      getSubagentDescendantThreadIds({
        rootThreadId: "",
        threadParentById: {},
        isSubagentThread: () => true,
      }),
    ).toEqual([]);
  });

  it("walks descendants, filters non-subagent ids, and ignores malformed edges", () => {
    const threadParentById = {
      childA: "root",
      childB: "root",
      grandA: "childA",
      self: "self",
      noParent: "",
      "": "root",
    };

    expect(
      getSubagentDescendantThreadIds({
        rootThreadId: "root",
        threadParentById,
        isSubagentThread: (threadId) => threadId === "childA" || threadId === "grandA",
      }),
    ).toEqual(["childA", "grandA"]);
  });

  it("guards against cycles and repeated visits", () => {
    const threadParentById = {
      child1: "root",
      child2: "child1",
      child1Again: "child2",
      child2Again: "child1Again",
      root: "child2Again",
    };

    const result = getSubagentDescendantThreadIds({
      rootThreadId: "root",
      threadParentById,
      isSubagentThread: () => true,
    });
    expect(result).toEqual(["child1", "child2", "child1Again", "child2Again"]);
  });

  it("returns empty when root has no descendants", () => {
    expect(
      getSubagentDescendantThreadIds({
        rootThreadId: "root",
        threadParentById: {
          childA: "other",
          childB: "another",
        },
        isSubagentThread: () => true,
      }),
    ).toEqual([]);
  });
});
