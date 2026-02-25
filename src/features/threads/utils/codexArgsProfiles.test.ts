import { describe, expect, it } from "vitest";
import {
  buildCodexArgsBadgeLabel,
  buildCodexArgsOptionLabel,
  buildCodexArgsOptions,
  buildEffectiveCodexArgsBadgeLabel,
  getIgnoredCodexArgsFlagsMetadata,
  labelForCodexArgs,
  parseCodexArgsProfile,
  sanitizeRuntimeCodexArgs,
} from "./codexArgsProfiles";

describe("codexArgsProfiles", () => {
  it("parses recognized and ignored flags with values", () => {
    const parsed = parseCodexArgsProfile(
      '--config "prod config.toml" --search --model gpt-5 --full-auto plain',
    );

    expect(parsed.recognizedSegments).toEqual([
      {
        flag: "--config",
        canonicalFlag: "--config",
        value: "prod config.toml",
        label: "config:prod config.toml",
      },
      {
        flag: "--search",
        canonicalFlag: "--search",
        value: null,
        label: "search",
      },
    ]);
    expect(parsed.ignoredFlags).toEqual([
      { flag: "--model", canonicalFlag: "--model", value: "gpt-5" },
      { flag: "--full-auto", canonicalFlag: "--full-auto", value: null },
    ]);
    expect(parsed.effectiveArgs).toBe('--config "prod config.toml" --search plain');
  });

  it("keeps unknown flags and drops invalid recognized required values", () => {
    const parsed = parseCodexArgsProfile("--config --unknown x --auth-file=");

    expect(parsed.recognizedSegments).toEqual([]);
    expect(parsed.ignoredFlags).toEqual([]);
    expect(parsed.effectiveArgs).toBe("--unknown x");
  });

  it("supports inline values and preserves spaces by splitting token output", () => {
    const parsed = parseCodexArgsProfile("--cd=/a/b --add-dir=dir --enable='x y'");
    expect(parsed.recognizedSegments.map((segment) => segment.canonicalFlag)).toEqual([
      "--cd",
      "--add-dir",
      "--enable",
    ]);
    expect(parsed.effectiveArgs).toBe('--cd=/a/b --add-dir=dir --enable "x y"');
  });

  it("extracts ignored metadata from both raw args and parsed payload", () => {
    const fromRaw = getIgnoredCodexArgsFlagsMetadata("-m gpt-5 -m gpt-4 --sandbox workspace-write");
    expect(fromRaw.hasIgnoredFlags).toBe(true);
    expect(fromRaw.ignoredCanonicalFlags).toEqual(["--model", "--sandbox"]);

    const parsed = parseCodexArgsProfile("--model gpt-5 --config a.toml");
    const fromParsed = getIgnoredCodexArgsFlagsMetadata(parsed);
    expect(fromParsed.ignoredCanonicalFlags).toEqual(["--model"]);
  });

  it("builds labels and effective badge from sanitized runtime args", () => {
    expect(buildCodexArgsOptionLabel("--config /tmp/a.toml --enable web_search")).toBe(
      "config:tmp/a.toml • enable:web_search",
    );
    expect(buildCodexArgsBadgeLabel("https://example.com/some/very/long/path/value")).toBe(
      "https://example.com…",
    );
    expect(buildEffectiveCodexArgsBadgeLabel("--model gpt-5")).toBeNull();
    expect(buildEffectiveCodexArgsBadgeLabel("--config /tmp/prod.toml --model gpt-5")).toBe(
      "config:tmp/prod.toml",
    );
    expect(sanitizeRuntimeCodexArgs("--model gpt-5 --config /tmp/prod.toml")).toBe(
      "--config /tmp/prod.toml",
    );
  });

  it("builds options with default first, dedupe, and sorted labels", () => {
    const options = buildCodexArgsOptions({
      appCodexArgs: "--enable web_search",
      additionalCodexArgs: [
        "--enable web_search",
        "--cd /repo",
        "https://example.com/very/long/path/for/label/render",
      ],
    });

    expect(options[0]).toEqual({ value: "", codexArgs: null, label: "Default" });
    expect(options.slice(1).map((option) => option.value)).toEqual([
      "--cd /repo",
      "--enable web_search",
      "https://example.com/very/long/path/for/label/render",
    ]);
  });

  it("keeps invalid ignored mode values in metadata while filtering effective args", () => {
    const parsed = parseCodexArgsProfile(
      "--sandbox=definitely-invalid --ask-for-approval=??? --full-auto",
    );

    expect(parsed.ignoredFlags).toEqual([
      {
        flag: "--sandbox",
        canonicalFlag: "--sandbox",
        value: "definitely-invalid",
      },
      {
        flag: "--ask-for-approval",
        canonicalFlag: "--ask-for-approval",
        value: "???",
      },
      {
        flag: "--full-auto",
        canonicalFlag: "--full-auto",
        value: null,
      },
    ]);
    expect(parsed.effectiveArgs).toBeNull();
  });

  it("returns safe defaults for nullish codex args inputs", () => {
    expect(parseCodexArgsProfile(null)).toEqual({
      originalArgs: "",
      recognizedSegments: [],
      ignoredFlags: [],
      effectiveArgs: null,
    });
    expect(parseCodexArgsProfile(undefined).effectiveArgs).toBeNull();
    expect(sanitizeRuntimeCodexArgs("   ")).toBeNull();
    expect(buildEffectiveCodexArgsBadgeLabel(undefined)).toBeNull();
    expect(getIgnoredCodexArgsFlagsMetadata(null)).toEqual({
      hasIgnoredFlags: false,
      ignoredFlags: [],
      ignoredCanonicalFlags: [],
    });
  });

  it("uses fallback labels when no recognized flags are present", () => {
    expect(buildCodexArgsOptionLabel("   plain text args without flags   ")).toBe(
      "plain text args wit…",
    );
    expect(buildCodexArgsBadgeLabel("https://fallback.example.com/path/that/is/very/long")).toBe(
      "https://fallback.ex…",
    );
    expect(labelForCodexArgs("just fallback label path")).toBe("just fallback label…");
  });
});
