import { ChatContainer, } from "@/components/chat/chat-container"
import type { ChatMessageData } from "@/components/chat/chat-message"

const sampleMessages: ChatMessageData[] = [
  {
    id: "1",
    role: "user",
    content: "理解目前所处的Repo?",
  },
  {
    id: "2",
    role: "assistant",
    content: `我先快速扫一遍仓库结构、关键配置和当前 Git 状态，然后给你一个"现在在这个 Repo 是什么、怎么分层、现在到哪了"的精确快照。

我再补一层：看 \`README\` 、脚本和前后端目录分布，给你一个更完整的仓库心智图。`,
    thinking: [
      { label: "Planning modified file counts" },
      { label: "Planning file references with lines" },
      { label: "Summarizing current repo state" },
      { label: "Assessing repo size and status" },
      { label: "Planning concise repo snapshot" },
    ],
  },
  {
    id: "3",
    role: "assistant",
    content: `理解了，而且我已经做了当前仓库的"现场快照"。

## 当前 Repo 认知

- 这是 \`CodexMonitor\`：一个用 Tauri 做的桌面编排器，管理多个 Codex agent/workspace，会话与线程是核心能力（\`README.md:5\`）。
- 技术栈是前端 \`React + Vite\`、后端分为 Tauri App 进程 + Daemon 进程（\`AGENTS.md:6\`、\`AGENTS.md:8\`、\`AGENTS.md:9\`、\`AGENTS.md:10\`）。
- 后端遵循"共享核心 + 薄适配器"模式：领域逻辑在 \`src-tauri/src/shared/*\`，App/Daemon 只做环境接线（\`AGENTS.md:53\`、\`AGENTS.md:72\`）。
- 前端组合根是 \`App.tsx\`，Tauri 命令注册在 \`lib.rs\`，Daemon 入口在 \`codex_monitor_daemon.rs\`。

## 我看到的实时状态（live state）

- 当前分支：\`main\`，相对远端 ahead 2。
- 工作区未提交改动：31 个 modified，2 个 untracked（\`start-dev.sh\`、scripts）。
- 最近提交聚焦在 **daemon 进程拆分** 和 **共享核心抽取**，说明架构重构正在进行中。

## 关键目录结构

\`\`\`
CodexMonitor/
├── src/                  # React 前端
│   ├── App.tsx           # 组合根
│   ├── components/       # UI 组件
│   └── hooks/            # 自定义 hooks
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs        # Tauri App 命令注册
│   │   ├── shared/       # 共享核心逻辑
│   │   └── bin/
│   │       └── codex_monitor_daemon.rs
│   └── Cargo.toml
├── AGENTS.md             # AI 编排器指南
└── README.md
\`\`\`

## 建议下一步

1. 如果你想修改 **业务逻辑**，从 \`src-tauri/src/shared/\` 开始
2. 如果你想改 **UI**，从 \`src/components/\` 入手
3. 如果你想理解 **命令注册**，看 \`lib.rs\` 的 invoke handler`,
  },
]

export default function Page() {
  return (
    <main className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border/40 px-6 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted/40">
          <svg className="h-4 w-4 text-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>
        <div>
          <h1 className="text-sm font-semibold text-foreground">CodexMonitor</h1>
          <p className="text-xs text-muted-foreground">main branch</p>
        </div>
      </header>

      {/* Chat */}
      <ChatContainer messages={sampleMessages} className="flex-1 min-h-0" />
    </main>
  )
}
