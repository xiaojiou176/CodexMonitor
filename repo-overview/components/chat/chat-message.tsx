"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { MarkdownRenderer } from "./markdown-renderer"
import { Bot, User, Copy, Check } from "lucide-react"

// ──────────────────────────────────────────
// Types
// ──────────────────────────────────────────

export interface ThinkingStep {
  label: string
}

export interface ChatMessageData {
  id: string
  role: "user" | "assistant"
  content: string
  thinking?: ThinkingStep[]
  timestamp?: string
}

// ──────────────────────────────────────────
// Thinking indicator
// ──────────────────────────────────────────

function ThinkingIndicator({ steps }: { steps: ThinkingStep[] }) {
  const [expanded, setExpanded] = React.useState(false)

  return (
    <button
      type="button"
      onClick={() => setExpanded(!expanded)}
      className="my-2 w-full text-left"
    >
      <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/30 px-3 py-2 transition-colors hover:bg-muted/50">
        <div className="flex h-5 w-5 items-center justify-center">
          <svg
            className="h-4 w-4 text-muted-foreground"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </div>
        <span className="text-sm font-medium text-muted-foreground">
          Inspecting plan memory
        </span>
        <svg
          className={cn(
            "ml-auto h-4 w-4 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {expanded && (
        <div className="mt-1 space-y-1 pl-3">
          {steps.map((step, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 rounded px-2 py-1 text-sm text-muted-foreground"
            >
              <div className="h-1 w-1 rounded-full bg-muted-foreground/50" />
              {step.label}
            </div>
          ))}
        </div>
      )}
    </button>
  )
}

// ──────────────────────────────────────────
// Single chat message
// ──────────────────────────────────────────

export function ChatMessage({ message }: { message: ChatMessageData }) {
  const isUser = message.role === "user"
  const [copied, setCopied] = React.useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={cn(
        "group flex gap-3",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {/* Avatar - assistant only */}
      {!isUser && (
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/60">
          <Bot className="h-4 w-4 text-foreground/70" />
        </div>
      )}

      {/* Message bubble */}
      <div
        className={cn(
          "relative rounded-2xl px-4 py-3",
          isUser
            ? "max-w-[75%] bg-primary text-primary-foreground"
            : "max-w-[85%] bg-muted/40"
        )}
      >
        {/* Thinking steps */}
        {!isUser && message.thinking && message.thinking.length > 0 && (
          <ThinkingIndicator steps={message.thinking} />
        )}

        {/* Content */}
        {isUser ? (
          <p className="text-[15px] leading-relaxed">{message.content}</p>
        ) : (
          <MarkdownRenderer content={message.content} />
        )}

        {/* Actions */}
        {!isUser && (
          <div className="mt-2 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Copy message"
            >
              {copied ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>

      {/* Avatar - user only */}
      {isUser && (
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary">
          <User className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
    </div>
  )
}
