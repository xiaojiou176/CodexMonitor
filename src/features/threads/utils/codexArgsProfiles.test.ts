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

  it("supports compat short flags and keeps ignored metadata canonicalized", () => {
    const parsed = parseCodexArgsProfile(
      '-c ./conf.toml -C /repo -i image.png -p dev -m gpt-5 -s workspace-write -a on-request',
    );

    expect(parsed.recognizedSegments.map((segment) => segment.canonicalFlag)).toEqual([
      "--config",
      "--cd",
      "--image",
      "--profile",
    ]);
    expect(parsed.ignoredFlags).toEqual([
      { flag: "-m", canonicalFlag: "--model", value: "gpt-5" },
      { flag: "-s", canonicalFlag: "--sandbox", value: "workspace-write" },
      { flag: "-a", canonicalFlag: "--ask-for-approval", value: "on-request" },
    ]);
    expect(parsed.effectiveArgs).toBe("-c ./conf.toml -C /repo -i image.png -p dev");
  });

  it("drops invalid required recognized values while preserving unknown tokens", () => {
    const parsed = parseCodexArgsProfile("--enable= --add-dir --unknown= --search");

    expect(parsed.recognizedSegments).toEqual([
      {
        flag: "--search",
        canonicalFlag: "--search",
        value: null,
        label: "search",
      },
    ]);
    expect(parsed.effectiveArgs).toBe("--unknown= --search");
  });

  it("keeps optional recognized flags when inline value is empty", () => {
    const parsed = parseCodexArgsProfile("--search= --enable web_search");

    expect(parsed.recognizedSegments).toEqual([
      {
        flag: "--search",
        canonicalFlag: "--search",
        value: null,
        label: "search",
      },
      {
        flag: "--enable",
        canonicalFlag: "--enable",
        value: "web_search",
        label: "enable:web_search",
      },
    ]);
    expect(parsed.effectiveArgs).toBe("--search --enable web_search");
    expect(buildCodexArgsBadgeLabel("--search=")).toBe("search");
  });

  it("falls back to original args labels when sanitized args become empty", () => {
    expect(buildCodexArgsOptionLabel("--model gpt-5 --sandbox workspace-write")).toBe(
      "--model gpt-5 --san…",
    );
    expect(buildCodexArgsBadgeLabel("--model gpt-5 --full-auto")).toBe("--model gpt-5 --ful…");
  });

  it("keeps options default-only for nullish/blank candidates", () => {
    expect(
      buildCodexArgsOptions({
        appCodexArgs: null,
        additionalCodexArgs: [undefined, null, "   "],
      }),
    ).toEqual([{ value: "", codexArgs: null, label: "Default" }]);
  });

  it("covers quote/escape tokenization and keeps parsed values stable", () => {
    const parsed = parseCodexArgsProfile(
      '--config "C:\\\\temp\\\\config.toml" --enable "say \\"hello\\"" --search',
    );

    expect(parsed.recognizedSegments).toEqual([
      {
        flag: "--config",
        canonicalFlag: "--config",
        value: "C:\\temp\\config.toml",
        label: "config:temp/config.toml",
      },
      {
        flag: "--enable",
        canonicalFlag: "--enable",
        value: 'say "hello"',
        label: 'enable:say "hello"',
      },
      {
        flag: "--search",
        canonicalFlag: "--search",
        value: null,
        label: "search",
      },
    ]);
    expect(parsed.effectiveArgs).toBe(
      '--config "C:\\\\temp\\\\config.toml" --enable "say \\"hello\\"" --search',
    );
    expect(parsed.ignoredFlags).toEqual([]);
    expect(
      sanitizeRuntimeCodexArgs(
        '--config "C:\\\\temp\\\\config.toml" --enable "say \\"hello\\"" --search',
      ),
    ).toBe('--config "C:\\\\temp\\\\config.toml" --enable "say \\"hello\\"" --search');
  });

  it("handles non-flag dash tokens and missing ignored required values", () => {
    const parsed = parseCodexArgsProfile("- --model --search");

    expect(parsed.recognizedSegments).toEqual([
      {
        flag: "--search",
        canonicalFlag: "--search",
        value: null,
        label: "search",
      },
    ]);
    expect(parsed.ignoredFlags).toEqual([
      {
        flag: "--model",
        canonicalFlag: "--model",
        value: null,
      },
    ]);
    expect(parsed.effectiveArgs).toBe("- --search");
    expect(buildCodexArgsBadgeLabel("- --model --search")).toBe("search");
  });

  it("adds +N suffix for option labels with more than two recognized segments", () => {
    expect(
      buildCodexArgsOptionLabel("--config a.toml --enable web_search --cd /repo --search"),
    ).toBe("config:a.toml • enable:web_search +2");
  });

  it("handles short URLs, empty quoted values, and root paths in labels", () => {
    expect(buildCodexArgsBadgeLabel("--config \"/\"")).toBe("config:/");
    expect(buildCodexArgsBadgeLabel("--config \"\"")).toBe('--config ""');
    expect(buildCodexArgsBadgeLabel("--config https://x.co")).toBe("config:https://x.co");
  });

  it("keeps non-flag tokens and handles flags with equals at index <= 1", () => {
    const parsed = parseCodexArgsProfile("-x -- -a= --search=");

    expect(parsed.recognizedSegments).toEqual([
      {
        flag: "--search",
        canonicalFlag: "--search",
        value: null,
        label: "search",
      },
    ]);
    expect(parsed.effectiveArgs).toBe("-x -- --search");
  });

  it("returns null effective badge label for whitespace-only sanitized output", () => {
    expect(buildEffectiveCodexArgsBadgeLabel("   --model gpt-5   --full-auto   ")).toBeNull();
  });

  it("supports single-quoted values and keeps additional args optional", () => {
    const parsed = parseCodexArgsProfile("--config '/tmp/single.toml' --enable 'x y'");
    expect(parsed.recognizedSegments).toEqual([
      {
        flag: "--config",
        canonicalFlag: "--config",
        value: "/tmp/single.toml",
        label: "config:tmp/single.toml",
      },
      {
        flag: "--enable",
        canonicalFlag: "--enable",
        value: "x y",
        label: "enable:x y",
      },
    ]);
    expect(
      buildCodexArgsOptions({
        appCodexArgs: "--config '/tmp/single.toml'",
      }),
    ).toHaveLength(2);
  });

  it("sorts by args value when labels collide", () => {
    const options = buildCodexArgsOptions({
      appCodexArgs: "https://example.com/path/that/is/very/very/long/for/label/aaa",
      additionalCodexArgs: [
        "https://example.com/path/that/is/very/very/long/for/label/bbb",
      ],
    });
    expect(options[1]?.label).toBe(options[2]?.label);
    expect((options[1]?.value ?? "") < (options[2]?.value ?? "")).toBe(true);
  });

  it("normalizes legacy smart quotes and dash-like flags before parsing", () => {
    const parsed = parseCodexArgsProfile(
      "\u201C\u2014config\u00A0./legacy.toml\u00A0\u2014search\u201D",
    );

    expect(parsed.recognizedSegments).toEqual([
      {
        flag: "--config",
        canonicalFlag: "--config",
        value: "./legacy.toml",
        label: "config:./legacy.toml",
      },
      {
        flag: "--search",
        canonicalFlag: "--search",
        value: null,
        label: "search",
      },
    ]);
    expect(parsed.ignoredFlags).toEqual([]);
    expect(parsed.effectiveArgs).toBe("--config ./legacy.toml --search");
  });

  it("normalizes wrapped quote values for labels and keeps short urls", () => {
    const parsed = parseCodexArgsProfile("--enable='beta' --config=http://a.co");

    expect(parsed.recognizedSegments).toEqual([
      {
        flag: "--enable",
        canonicalFlag: "--enable",
        value: "beta",
        label: "enable:beta",
      },
      {
        flag: "--config",
        canonicalFlag: "--config",
        value: "http://a.co",
        label: "config:http://a.co",
      },
    ]);
    expect(buildCodexArgsBadgeLabel("--enable='beta'")).toBe("enable:beta");
  });

  it("keeps non-escaped backslashes inside quoted values stable", () => {
    const parsed = parseCodexArgsProfile('--enable "value\\nwith\\qbackslash" --search');

    expect(parsed.recognizedSegments).toEqual([
      {
        flag: "--enable",
        canonicalFlag: "--enable",
        value: "value\\nwith\\qbackslash",
        label: "enable:nwith/qbackslash",
      },
      {
        flag: "--search",
        canonicalFlag: "--search",
        value: null,
        label: "search",
      },
    ]);
    expect(parsed.effectiveArgs).toBe('--enable "value\\\\nwith\\\\qbackslash" --search');
  });
});
