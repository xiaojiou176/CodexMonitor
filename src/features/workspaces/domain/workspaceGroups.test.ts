import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceGroup, WorkspaceInfo } from "../../../types";
import {
  RESERVED_GROUP_NAME,
  buildGroupedWorkspaces,
  buildWorkspaceById,
  buildWorkspaceGroupById,
  createGroupId,
  getSortOrderValue,
  getWorkspaceGroupId,
  getWorkspaceGroupNameById,
  isDuplicateGroupName,
  isReservedGroupName,
  normalizeGroupName,
  sortWorkspaceGroups,
} from "./workspaceGroups";

function createWorkspace(overrides: Partial<WorkspaceInfo>): WorkspaceInfo {
  const baseSettings: WorkspaceInfo["settings"] = {
    sidebarCollapsed: false,
    groupId: null,
    sortOrder: null,
  };
  const base: WorkspaceInfo = {
    id: "ws-default",
    name: "Default",
    path: "/tmp/default",
    connected: true,
    kind: "main",
    settings: baseSettings,
  };

  return {
    ...base,
    ...overrides,
    settings: { ...baseSettings, ...overrides.settings },
  };
}

describe("workspaceGroups domain", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("normalizes names and identifies reserved/duplicate names", () => {
    const groups: WorkspaceGroup[] = [
      { id: "g-1", name: " Core Team ", sortOrder: 1 },
      { id: "g-2", name: "Infra", sortOrder: 2 },
    ];

    expect(normalizeGroupName("  Team A  ")).toBe("Team A");
    expect(isReservedGroupName(` ${RESERVED_GROUP_NAME.toLowerCase()} `)).toBe(true);
    expect(isDuplicateGroupName(" core team ", groups)).toBe(true);
    expect(isDuplicateGroupName("core team", groups, "g-1")).toBe(false);
  });

  it("resolves sort order and sorts groups by order then name", () => {
    const groups: WorkspaceGroup[] = [
      { id: "g-1", name: "Zulu", sortOrder: 2 },
      { id: "g-2", name: "Alpha", sortOrder: 2 },
      { id: "g-3", name: "NoOrder", sortOrder: null },
      { id: "g-4", name: "First", sortOrder: 1 },
    ];

    expect(getSortOrderValue(4)).toBe(4);
    expect(getSortOrderValue(undefined)).toBe(Number.MAX_SAFE_INTEGER);

    expect(sortWorkspaceGroups(groups).map((group) => group.id)).toEqual([
      "g-4",
      "g-2",
      "g-1",
      "g-3",
    ]);
  });

  it("creates group id from crypto.randomUUID when available", () => {
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "uuid-from-crypto"),
    });

    expect(createGroupId()).toBe("uuid-from-crypto");
  });

  it("falls back to timestamp-random format when crypto.randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {});
    vi.spyOn(Date, "now").mockReturnValue(1234567890);
    vi.spyOn(Math, "random").mockReturnValue(0.234567);

    expect(createGroupId()).toBe("1234567890-234567");
  });

  it("resolves workspace group ids and names for main/worktree/missing cases", () => {
    const parent = createWorkspace({
      id: "ws-parent",
      settings: { sidebarCollapsed: false, groupId: "group-1" },
    });
    const worktree = createWorkspace({
      id: "ws-worktree",
      kind: "worktree",
      parentId: "ws-parent",
      settings: { sidebarCollapsed: false, groupId: "wrong-group" },
    });
    const standalone = createWorkspace({
      id: "ws-standalone",
      settings: { sidebarCollapsed: false, groupId: null },
    });

    const workspaceById = buildWorkspaceById([parent, worktree, standalone]);
    const workspaceGroupById = buildWorkspaceGroupById([
      { id: "group-1", name: "Platform", sortOrder: 1 },
    ]);

    expect(getWorkspaceGroupId(worktree, workspaceById)).toBe("group-1");
    expect(getWorkspaceGroupId(parent, workspaceById)).toBe("group-1");
    expect(getWorkspaceGroupNameById("ws-parent", workspaceById, workspaceGroupById)).toBe(
      "Platform",
    );
    expect(getWorkspaceGroupNameById("ws-standalone", workspaceById, workspaceGroupById)).toBe(
      null,
    );
    expect(getWorkspaceGroupNameById("missing", workspaceById, workspaceGroupById)).toBe(null);
  });

  it("returns null for worktree group when parent workspace is missing", () => {
    const orphanWorktree = createWorkspace({
      id: "ws-orphan",
      kind: "worktree",
      parentId: "missing-parent",
      settings: { sidebarCollapsed: false, groupId: "ignored" },
    });

    const workspaceById = buildWorkspaceById([orphanWorktree]);
    expect(getWorkspaceGroupId(orphanWorktree, workspaceById)).toBeNull();
  });

  it("builds grouped sections, excludes worktrees, sorts workspace entries, and adds ungrouped", () => {
    const workspaceGroups: WorkspaceGroup[] = [
      { id: "group-a", name: "Group A", sortOrder: 1 },
      { id: "group-b", name: "Group B", sortOrder: 2 },
    ];

    const workspaces: WorkspaceInfo[] = [
      createWorkspace({
        id: "main-b",
        name: "Bravo",
        settings: { sidebarCollapsed: false, groupId: "group-a", sortOrder: 2 },
      }),
      createWorkspace({
        id: "main-a",
        name: "Alpha",
        settings: { sidebarCollapsed: false, groupId: "group-a", sortOrder: 1 },
      }),
      createWorkspace({
        id: "main-u",
        name: "Ungrouped",
        settings: { sidebarCollapsed: false, groupId: null, sortOrder: 1 },
      }),
      createWorkspace({
        id: "worktree-1",
        name: "Ignored Worktree",
        kind: "worktree",
        parentId: "main-a",
        settings: { sidebarCollapsed: false, groupId: "group-b", sortOrder: 1 },
      }),
      createWorkspace({
        id: "child-main",
        name: "Ignored Child Main",
        kind: "main",
        parentId: "main-a",
        settings: { sidebarCollapsed: false, groupId: "group-b", sortOrder: 1 },
      }),
    ];

    const sections = buildGroupedWorkspaces(workspaces, workspaceGroups);

    expect(sections).toHaveLength(2);
    expect(sections[0]?.id).toBe("group-a");
    expect(sections[0]?.workspaces.map((workspace) => workspace.id)).toEqual([
      "main-a",
      "main-b",
    ]);
    expect(sections[1]?.id).toBe(null);
    expect(sections[1]?.name).toBe(RESERVED_GROUP_NAME);
    expect(sections[1]?.workspaces.map((workspace) => workspace.id)).toEqual(["main-u"]);
  });

  it("drops empty sections and routes unknown group ids into ungrouped", () => {
    const workspaceGroups: WorkspaceGroup[] = [
      { id: "group-a", name: "Group A", sortOrder: 1 },
      { id: "group-b", name: "Group B", sortOrder: 2 },
    ];

    const workspaces: WorkspaceInfo[] = [
      createWorkspace({
        id: "main-z",
        name: "Zulu",
        settings: { sidebarCollapsed: false, groupId: "unknown-group", sortOrder: null },
      }),
      createWorkspace({
        id: "main-a",
        name: "Alpha",
        settings: { sidebarCollapsed: false, groupId: null, sortOrder: null },
      }),
      createWorkspace({
        id: "main-in-group",
        name: "Grouped",
        settings: { sidebarCollapsed: false, groupId: "group-a", sortOrder: null },
      }),
    ];

    const sections = buildGroupedWorkspaces(workspaces, workspaceGroups);
    expect(sections).toHaveLength(2);
    expect(sections[0]?.id).toBe("group-a");
    expect(sections[1]?.id).toBeNull();
    expect(sections[1]?.workspaces.map((workspace) => workspace.id)).toEqual([
      "main-a",
      "main-z",
    ]);
  });
});
