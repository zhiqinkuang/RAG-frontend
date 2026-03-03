# RAG Frontend — AI Chat WebApp

[中文](#中文) | [English](#english)

---

<a id="中文"></a>

## 中文

一个功能丰富的 AI 聊天前端，基于 Next.js 16 + [assistant-ui](https://github.com/Yonom/assistant-ui) 构建。支持多模型提供商、聊天历史持久化、消息队列、文件上传、代码高亮等特性，开箱即用。

### 特性

- **多模型提供商** — 内置支持 OpenAI、DeepSeek、智谱 GLM、通义千问、火山引擎豆包、Moonshot，以及任意 OpenAI 兼容 API
- **前端配置 API** — 无需修改环境变量，在设置面板中切换提供商、填写 API Key 和模型名
- **聊天历史持久化** — 线程列表和消息内容持久化到 localStorage，刷新页面不丢失
- **消息输入队列** — 模型推理期间可继续输入和发送消息，自动排队依次处理（类似 Cursor）
- **多文件类型上传** — 支持图片、PDF、Word、Excel、PowerPoint、视频、音频、文本文件，带文件类型图标
- **代码语法高亮** — 使用 [Shiki](https://shiki.style/) 渲染代码块，VS Code Dark+ 主题
- **中英文国际化** — 一键切换中文/英文界面
- **Markdown 渲染** — 支持 GFM 表格、代码块、行内代码等
- **推理过程展示** — 可折叠展示模型的推理/思考过程
- **响应式侧边栏** — 线程列表侧边栏，支持新建、归档、删除对话

### 技术栈

| 分类 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router, Turbopack) |
| UI 库 | assistant-ui, Radix UI, Tailwind CSS 4 |
| AI SDK | Vercel AI SDK v6, @ai-sdk/openai |
| 语法高亮 | Shiki |
| 动画 | Framer Motion |
| 代码规范 | Biome |
| 包管理 | pnpm |

### 快速开始

```bash
# 克隆项目
git clone https://github.com/zhiqinkuang/RAG-frontend.git
cd RAG-frontend

# 安装依赖
pnpm install

# 复制环境变量文件（可选，也可直接在前端面板配置）
cp .env.example .env.local

# 启动开发服务器
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)，在右上角设置面板中选择提供商并填入 API Key 即可开始对话。

### 项目结构

```
app/
├── api/chat/route.ts        # 聊天 API 路由（流式转发）
├── assistant.tsx             # 主运行时组件（线程管理、队列）
├── page.tsx                  # 入口页面
└── layout.tsx                # 根布局（I18n Provider）
components/assistant-ui/
├── thread.tsx                # 聊天线程 UI（消息列表、输入框、队列展示）
├── thread-list.tsx           # 侧边栏线程列表
├── attachment.tsx            # 文件附件预览与图标
├── syntax-highlighter.tsx    # Shiki 代码高亮组件
├── markdown-text.tsx         # Markdown 渲染
└── ...
lib/
├── providers.ts              # 模型提供商配置
├── i18n.tsx                  # 国际化
├── local-thread-list-adapter.ts  # 线程列表 localStorage 持久化
├── message-store.ts          # 消息 localStorage 持久化
├── attachment-adapter.ts     # 多文件类型上传适配器
└── queue-context.tsx         # 消息队列 Context
```

### 环境变量

| 变量 | 说明 |
|------|------|
| `ARK_API_KEY` | 火山引擎豆包 API Key（服务端备用） |
| `OPENAI_API_KEY` | OpenAI API Key（服务端备用） |
| `MOCK_CHAT` | 设为 `true` 启用 Mock 流式数据，无需 API Key |

> 大多数情况下无需配置环境变量，直接在前端设置面板中输入 API Key 即可。

### 许可证

MIT

---

<a id="english"></a>

## English

A feature-rich AI chat frontend built with Next.js 16 + [assistant-ui](https://github.com/Yonom/assistant-ui). Supports multiple model providers, chat history persistence, message queuing, file uploads, code highlighting, and more — ready to use out of the box.

### Features

- **Multiple Model Providers** — Built-in support for OpenAI, DeepSeek, Zhipu GLM, Qwen, Volcengine Doubao, Moonshot, and any OpenAI-compatible API
- **Frontend API Configuration** — Switch providers, enter API keys and model names in the settings panel without touching environment variables
- **Chat History Persistence** — Thread list and message content persist to localStorage, surviving page refreshes
- **Message Input Queue** — Continue typing and sending messages while the model is running; messages are automatically queued and processed in order (Cursor-style)
- **Multi-File Upload** — Support for images, PDF, Word, Excel, PowerPoint, video, audio, and text files with file-type icons
- **Code Syntax Highlighting** — Code blocks rendered with [Shiki](https://shiki.style/) using VS Code Dark+ theme
- **i18n (Chinese/English)** — Toggle between Chinese and English UI with one click
- **Markdown Rendering** — GFM tables, code blocks, inline code, and more
- **Reasoning Display** — Collapsible display of model reasoning/thinking process
- **Responsive Sidebar** — Thread list sidebar with create, archive, and delete actions

### Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI Library | assistant-ui, Radix UI, Tailwind CSS 4 |
| AI SDK | Vercel AI SDK v6, @ai-sdk/openai |
| Syntax Highlighting | Shiki |
| Animation | Framer Motion |
| Linting | Biome |
| Package Manager | pnpm |

### Getting Started

```bash
# Clone the repository
git clone https://github.com/zhiqinkuang/RAG-frontend.git
cd RAG-frontend

# Install dependencies
pnpm install

# Copy environment variables (optional — you can configure via the frontend panel)
cp .env.example .env.local

# Start the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), select a provider and enter your API key in the settings panel (top-right) to start chatting.

### Project Structure

```
app/
├── api/chat/route.ts        # Chat API route (streaming proxy)
├── assistant.tsx             # Main runtime component (thread management, queue)
├── page.tsx                  # Entry page
└── layout.tsx                # Root layout (I18n Provider)
components/assistant-ui/
├── thread.tsx                # Chat thread UI (messages, input, queue display)
├── thread-list.tsx           # Sidebar thread list
├── attachment.tsx            # File attachment previews and icons
├── syntax-highlighter.tsx    # Shiki code highlighter component
├── markdown-text.tsx         # Markdown rendering
└── ...
lib/
├── providers.ts              # Model provider configurations
├── i18n.tsx                  # Internationalization
├── local-thread-list-adapter.ts  # Thread list localStorage persistence
├── message-store.ts          # Message localStorage persistence
├── attachment-adapter.ts     # Multi-file-type upload adapter
└── queue-context.tsx         # Message queue Context
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `ARK_API_KEY` | Volcengine Doubao API key (server-side fallback) |
| `OPENAI_API_KEY` | OpenAI API key (server-side fallback) |
| `MOCK_CHAT` | Set to `true` to enable mock streaming data without an API key |

> In most cases, no environment variables are needed — just enter your API key in the frontend settings panel.

### License

MIT
