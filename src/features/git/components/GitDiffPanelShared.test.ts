import { describe, expect, it } from "vitest";
import { buildDiffTree, type DiffFile } from "./GitDiffPanelShared";

describe("buildDiffTree", () => {
  it("builds folder-first sorted output and aggregates stats", () => {
    const files: DiffFile[] = [
      { path: "README.md", status: "M", additions: 3, deletions: 1 },
      { path: "src/beta/z.ts", status: "M", additions: 4, deletions: 2 },
      { path: "src/alpha/a.ts", status: "A", additions: 10, deletions: 0 },
    ];

    const tree = buildDiffTree(files);
    expect(tree).toHaveLength(2);
    expect(tree[0]).toMatchObject({
      type: "folder",
      name: "src",
      path: "src",
      stats: { additions: 14, deletions: 2 },
    });
    expect(tree[1]).toMatchObject({
      type: "file",
      name: "README.md",
      path: "README.md",
      stats: { additions: 3, deletions: 1 },
    });

    const srcChildren = tree[0].children;
    expect(srcChildren).toHaveLength(2);
    expect(srcChildren[0]).toMatchObject({
      type: "folder",
      name: "alpha",
      path: "src/alpha",
      stats: { additions: 10, deletions: 0 },
    });
    expect(srcChildren[1]).toMatchObject({
      type: "folder",
      name: "beta",
      path: "src/beta",
      stats: { additions: 4, deletions: 2 },
    });
  });

  it("collapses single-child folder chains and keeps output shape compatible", () => {
    const files: DiffFile[] = [
      { path: "apps/web/src/main.ts", status: "M", additions: 6, deletions: 2 },
      { path: "apps/web/src/util.ts", status: "M", additions: 1, deletions: 1 },
    ];

    const tree = buildDiffTree(files);
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({
      type: "folder",
      name: "apps/web/src",
      path: "apps/web/src",
      stats: { additions: 7, deletions: 3 },
    });
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children.every((node) => node.type === "file")).toBeTruthy();
    expect("childFolders" in tree[0]).toBe(false);
  });
});
