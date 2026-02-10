"use client"

import React from "react"
import { ChatMessage, type ChatMessageData } from "./chat-message"
import { cn } from "@/lib/utils"
import { Send } from "lucide-react"

interface ChatContainerProps {
  messages: ChatMessageData[]
  className?: string
}

export function ChatContainer({ messages, className }: ChatContainerProps) {
  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-border/40 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-end gap-3 px-4 py-4">
          <div className="relative flex-1">
            <textarea
              rows={1}
              placeholder="Ask a question..."
              className="w-full resize-none rounded-xl border border-border bg-muted/30 px-4 py-3 pr-12 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = "auto"
                target.style.height = `${Math.min(target.scrollHeight, 200)}px`
              }}
            />
            <button
              className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
