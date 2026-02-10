"use client"

import React from "react"
import { cn } from "@/lib/utils"

/**
 * A lightweight Markdown-to-JSX renderer optimized for chat message readability.
 *
 * Readability improvements over raw text:
 * 1. Generous line-height (1.75) for body text
 * 2. Clear visual hierarchy: headings, paragraphs, lists, code
 * 3. Inline code gets a distinct background + monospace font
 * 4. Code blocks get syntax-aware styling with copy affordance
 * 5. Lists use consistent indentation and spacing
 * 6. Paragraphs separated by comfortable vertical rhythm (spacing)
 * 7. Bold / italic text is visually distinct without being jarring
 * 8. File references are styled as interactive-looking chips
 */

interface MarkdownRendererProps {
  content: string
  className?: string
}

// ──────────────────────────────────────────
// Tokenizer — turns raw markdown string into
// a flat list of block-level tokens
// ──────────────────────────────────────────

type Token =
  | { type: "heading"; level: number; text: string }
  | { type: "code_block"; lang: string; code: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "paragraph"; text: string }
  | { type: "hr" }
  | { type: "blockquote"; text: string }

function tokenize(raw: string): Token[] {
  const lines = raw.split("\n")
  const tokens: Token[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // blank line – skip
    if (line.trim() === "") {
      i++
      continue
    }

    // fenced code block ```
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      tokens.push({ type: "code_block", lang, code: codeLines.join("\n") })
      continue
    }

    // heading # ## ### etc
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/)
    if (headingMatch) {
      tokens.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2],
      })
      i++
      continue
    }

    // hr ---
    if (/^[-*_]{3,}\s*$/.test(line.trim())) {
      tokens.push({ type: "hr" })
      i++
      continue
    }

    // blockquote >
    if (line.trimStart().startsWith("> ")) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trimStart().startsWith("> ")) {
        quoteLines.push(lines[i].trimStart().slice(2))
        i++
      }
      tokens.push({ type: "blockquote", text: quoteLines.join("\n") })
      continue
    }

    // unordered list - or *
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""))
        i++
      }
      tokens.push({ type: "list", ordered: false, items })
      continue
    }

    // ordered list 1. 2. etc
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""))
        i++
      }
      tokens.push({ type: "list", ordered: true, items })
      continue
    }

    // paragraph – gather continuous non-blank, non-special lines
    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].match(/^#{1,6}\s+/) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !lines[i].trimStart().startsWith("> ") &&
      !/^[-*_]{3,}\s*$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i])
      i++
    }
    if (paraLines.length > 0) {
      tokens.push({ type: "paragraph", text: paraLines.join("\n") })
    }
  }

  return tokens
}

// ──────────────────────────────────────────
// Inline renderer — handles bold, italic,
// inline code, links, and file references
// ──────────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  // Split on inline patterns and render them
  const parts: React.ReactNode[] = []
  // Pattern: `code`, **bold**, *italic*, [text](url), and file references like AGENTS.md:5
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\)|(?<!\w)[A-Za-z_][\w.-]*\.[a-z]{1,4}(?::\d+)?(?!\w))/g

  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    // push text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    const m = match[0]

    if (m.startsWith("`") && m.endsWith("`")) {
      // inline code
      const code = m.slice(1, -1)
      parts.push(
        <code
          key={match.index}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground/90"
        >
          {code}
        </code>
      )
    } else if (m.startsWith("**") && m.endsWith("**")) {
      // bold
      parts.push(
        <strong key={match.index} className="font-semibold text-foreground">
          {m.slice(2, -2)}
        </strong>
      )
    } else if (m.startsWith("*") && m.endsWith("*")) {
      // italic
      parts.push(
        <em key={match.index} className="italic">
          {m.slice(1, -1)}
        </em>
      )
    } else if (m.startsWith("[")) {
      // link [text](url)
      const linkMatch = m.match(/\[([^\]]+)\]\(([^)]+)\)/)
      if (linkMatch) {
        parts.push(
          <a
            key={match.index}
            href={linkMatch[2]}
            className="text-primary underline underline-offset-2 hover:text-primary/80"
            target="_blank"
            rel="noopener noreferrer"
          >
            {linkMatch[1]}
          </a>
        )
      }
    } else {
      // file reference like AGENTS.md:5 or App.tsx
      parts.push(
        <span
          key={match.index}
          className="inline-flex items-center gap-1 rounded border border-border/60 bg-muted/60 px-1.5 py-0.5 font-mono text-[0.82em] text-foreground/80"
        >
          {m}
        </span>
      )
    }

    lastIndex = match.index + m.length
  }

  // remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : [text]
}

// ──────────────────────────────────────────
// Block renderers
// ──────────────────────────────────────────

function HeadingBlock({ level, text }: { level: number; text: string }) {
  const cls = {
    1: "text-xl font-bold tracking-tight mt-6 mb-3",
    2: "text-lg font-semibold tracking-tight mt-5 mb-2.5",
    3: "text-base font-semibold mt-4 mb-2",
    4: "text-sm font-semibold mt-3 mb-1.5 uppercase tracking-wide text-muted-foreground",
    5: "text-sm font-medium mt-2 mb-1",
    6: "text-xs font-medium mt-2 mb-1 text-muted-foreground",
  }[level] ?? "text-base font-semibold"

  const Tag = `h${level}` as keyof React.JSX.IntrinsicElements
  return <Tag className={cls}>{renderInline(text)}</Tag>
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group relative my-3 overflow-hidden rounded-lg border border-border/50 bg-muted/40">
      {lang && (
        <div className="flex items-center justify-between border-b border-border/50 bg-muted/60 px-4 py-1.5">
          <span className="font-mono text-xs text-muted-foreground">{lang}</span>
          <button
            onClick={handleCopy}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Copy code"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
      <pre className="overflow-x-auto px-4 py-3">
        <code className="font-mono text-[0.85em] leading-relaxed text-foreground/90">
          {code}
        </code>
      </pre>
      {!lang && (
        <button
          onClick={handleCopy}
          className="absolute right-2 top-2 rounded px-2 py-1 text-xs text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          aria-label="Copy code"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      )}
    </div>
  )
}

function ListBlock({
  ordered,
  items,
}: {
  ordered: boolean
  items: string[]
}) {
  const Tag = ordered ? "ol" : "ul"
  return (
    <Tag
      className={cn(
        "my-2 space-y-1.5 pl-5",
        ordered ? "list-decimal" : "list-disc",
        "[&>li]:leading-relaxed [&>li]:pl-1"
      )}
    >
      {items.map((item, idx) => (
        <li key={idx} className="text-foreground/90">
          {renderInline(item)}
        </li>
      ))}
    </Tag>
  )
}

function BlockquoteBlock({ text }: { text: string }) {
  return (
    <blockquote className="my-3 border-l-[3px] border-primary/30 pl-4 text-foreground/70 italic">
      {renderInline(text)}
    </blockquote>
  )
}

// ──────────────────────────────────────────
// Main renderer
// ──────────────────────────────────────────

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const tokens = React.useMemo(() => tokenize(content), [content])

  return (
    <div
      className={cn(
        // Base typography: generous line-height + comfortable reading measure
        "text-[15px] leading-7 text-foreground/90",
        // Vertical rhythm between direct children
        "[&>*+*]:mt-3",
        className
      )}
    >
      {tokens.map((token, idx) => {
        switch (token.type) {
          case "heading":
            return (
              <HeadingBlock
                key={idx}
                level={token.level}
                text={token.text}
              />
            )
          case "code_block":
            return (
              <CodeBlock key={idx} lang={token.lang} code={token.code} />
            )
          case "list":
            return (
              <ListBlock
                key={idx}
                ordered={token.ordered}
                items={token.items}
              />
            )
          case "paragraph":
            return (
              <p key={idx} className="leading-7">
                {renderInline(token.text)}
              </p>
            )
          case "hr":
            return (
              <hr key={idx} className="my-4 border-t border-border/50" />
            )
          case "blockquote":
            return <BlockquoteBlock key={idx} text={token.text} />
          default:
            return null
        }
      })}
    </div>
  )
}
