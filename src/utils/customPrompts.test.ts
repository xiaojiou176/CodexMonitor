import { describe, expect, it } from "vitest";
import type { CustomPromptOption } from "../types";
import {
  buildPromptInsertText,
  expandCustomPromptText,
  findNextPromptArgCursor,
  findPromptArgRangeAtCursor,
  getPromptArgumentHint,
  parseSlashName,
  promptArgumentNames,
  promptHasNumericPlaceholders,
} from "./customPrompts";

function prompt(overrides: Partial<CustomPromptOption> = {}): CustomPromptOption {
  return {
    name: "greet",
    path: "~/.codex/prompts/greet.md",
    content: "Hello $NAME",
    ...overrides,
  };
}

describe("customPrompts utilities", () => {
  describe("promptArgumentNames", () => {
    it("extracts unique argument names and ignores escaped placeholders and $ARGUMENTS", () => {
      const content = "A $NAME B $NAME C $$SKIP D $ARGUMENTS E $TASK_1";
      expect(promptArgumentNames(content)).toEqual(["NAME", "TASK_1"]);
    });

    it("returns empty array when no valid placeholders are present", () => {
      expect(promptArgumentNames("hello $name $0 $$NOPE")).toEqual([]);
    });
  });

  describe("promptHasNumericPlaceholders", () => {
    it("detects $ARGUMENTS and $1 style placeholders", () => {
      expect(promptHasNumericPlaceholders("run $ARGUMENTS now")).toBe(true);
      expect(promptHasNumericPlaceholders("run $1 now")).toBe(true);
    });

    it("returns false when placeholders are absent or out of range", () => {
      expect(promptHasNumericPlaceholders("run $0 now")).toBe(false);
      expect(promptHasNumericPlaceholders("run now")).toBe(false);
    });
  });

  describe("getPromptArgumentHint", () => {
    it("prefers explicit argumentHint when non-empty after trim", () => {
      expect(
        getPromptArgumentHint(
          prompt({ argumentHint: "  NAME= TITLE=  ", content: "Hello $NAME" }),
        ),
      ).toBe("NAME= TITLE=");
    });

    it("builds hint from named placeholders", () => {
      expect(getPromptArgumentHint(prompt({ content: "Hello $NAME from $CITY" }))).toBe(
        "NAME= CITY=",
      );
    });

    it("falls back to [args] for positional placeholders", () => {
      expect(getPromptArgumentHint(prompt({ content: "Do $1 with $ARGUMENTS" }))).toBe(
        "[args]",
      );
    });

    it("returns undefined when no hints can be inferred", () => {
      expect(getPromptArgumentHint(prompt({ content: "plain text only" }))).toBeUndefined();
    });
  });

  describe("buildPromptInsertText", () => {
    it("builds prompt command and first cursor position for named args", () => {
      const result = buildPromptInsertText(prompt({ content: "Hello $NAME from $CITY" }));
      expect(result.text).toBe("prompts:greet NAME=\"\" CITY=\"\"");
      expect(result.cursorOffset).toBe("prompts:greet NAME=\"".length);
    });

    it("keeps cursorOffset undefined when prompt has no named placeholders", () => {
      const result = buildPromptInsertText(prompt({ content: "Hello there" }));
      expect(result).toEqual({ text: "prompts:greet", cursorOffset: undefined });
    });
  });

  describe("parseSlashName", () => {
    it("parses command name and trimmed rest", () => {
      expect(parseSlashName("/prompts:greet   NAME=\"Ada Lovelace\"  ")).toEqual({
        name: "prompts:greet",
        rest: "NAME=\"Ada Lovelace\"  ",
      });
    });

    it("returns null for invalid slash command lines", () => {
      expect(parseSlashName("prompts:greet")).toBeNull();
      expect(parseSlashName("/")).toBeNull();
    });
  });

  describe("prompt arg cursor helpers", () => {
    it("finds range at cursor only for prompts command first line", () => {
      const line = '/prompts:greet NAME="Ada" CITY="London"\nsecond line';
      expect(findPromptArgRangeAtCursor(line, 21)).toEqual({ start: 21, end: 24 });
      expect(findPromptArgRangeAtCursor(line, 32)).toEqual({ start: 32, end: 38 });
      expect(findPromptArgRangeAtCursor("/other:greet NAME=\"Ada\"", 18)).toBeNull();
      expect(findPromptArgRangeAtCursor(line, line.indexOf("\n") + 1)).toBeNull();
    });

    it("supports smart quotes and skips escaped quote endings", () => {
      const smart = "/prompts:greet NAME=“Ada”";
      expect(findPromptArgRangeAtCursor(smart, 21)).toEqual({ start: 21, end: 24 });

      const escaped = String.raw`/prompts:greet NOTE="a \"quoted\" value"`;
      const start = escaped.indexOf("\"") + 1;
      const end = escaped.lastIndexOf("\"");
      expect(findPromptArgRangeAtCursor(escaped, start + 2)).toEqual({ start, end });
    });

    it("returns null for malformed unclosed values", () => {
      expect(findPromptArgRangeAtCursor('/prompts:greet NAME="Ada', 20)).toBeNull();
      expect(findNextPromptArgCursor('/prompts:greet NAME="Ada', 0)).toBeNull();
    });

    it("finds next prompt arg cursor correctly", () => {
      const line = '/prompts:greet NAME="Ada" CITY="London"';
      expect(findNextPromptArgCursor(line, 0)).toBe(21);
      expect(findNextPromptArgCursor(line, 22)).toBe(32);
      expect(findNextPromptArgCursor(line, 35)).toBeNull();
      expect(findNextPromptArgCursor("/other:greet NAME=\"Ada\"", 0)).toBeNull();
    });
  });

  describe("expandCustomPromptText", () => {
    it("returns null for non-matching inputs", () => {
      const prompts = [prompt()];
      expect(expandCustomPromptText("hello", prompts)).toBeNull();
      expect(expandCustomPromptText("/other:greet", prompts)).toBeNull();
      expect(expandCustomPromptText("/prompts:", prompts)).toBeNull();
      expect(expandCustomPromptText("/prompts:missing", prompts)).toBeNull();
    });

    it("expands named placeholders with key=value inputs", () => {
      const prompts = [prompt({ content: "Hi $NAME from $CITY" })];
      expect(
        expandCustomPromptText('/prompts:greet NAME="Ada Lovelace" CITY=London', prompts),
      ).toEqual({ expanded: "Hi Ada Lovelace from London" });
    });

    it("keeps escaped named placeholders and replaces normal ones", () => {
      const prompts = [prompt({ content: "$$NAME and $NAME" })];
      expect(expandCustomPromptText('/prompts:greet NAME="Ada"', prompts)).toEqual({
        expanded: "$$NAME and Ada",
      });
    });

    it("returns parse error when token misses assignment", () => {
      const prompts = [prompt({ content: "Hi $NAME" })];
      const result = expandCustomPromptText('/prompts:greet NAME="Ada" EXTRA', prompts);
      expect(result).toEqual({
        error:
          "Could not parse /prompts:greet: expected key=value but found 'EXTRA'. Wrap values in double quotes if they contain spaces.",
      });
    });

    it("returns parse error when token misses key", () => {
      const prompts = [prompt({ content: "Hi $NAME" })];
      const result = expandCustomPromptText('/prompts:greet ="Ada"', prompts);
      expect(result).toEqual({
        error: "Could not parse /prompts:greet: expected a name before '=' in '=Ada'.",
      });
    });

    it("returns missing required args error", () => {
      const prompts = [prompt({ content: "Hi $NAME from $CITY" })];
      const result = expandCustomPromptText('/prompts:greet NAME="Ada"', prompts);
      expect(result).toEqual({
        error:
          "Missing required args for /prompts:greet: CITY. Provide as key=value (quote values with spaces).",
      });
    });

    it("expands positional placeholders including $ARGUMENTS and smart quotes", () => {
      const prompts = [
        prompt({
          content: "Run $1 then $2 all:$ARGUMENTS keep$$=$$ end$3",
        }),
      ];
      expect(
        expandCustomPromptText('/prompts:greet “alpha beta” gamma', prompts),
      ).toEqual({
        expanded: "Run alpha beta then gamma all:alpha beta gamma keep$$=$$ end",
      });
    });
  });
});
