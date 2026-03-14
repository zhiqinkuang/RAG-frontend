# 自定义后端 API 接口文档 / Custom Backend API Specification

[中文](#中文) | [English](#english)

---

<a id="中文"></a>

## 中文

本前端支持三种方式对接自定义后端：

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| **OpenAI 兼容模式** | 后端实现 `/chat/completions` 接口，遵循 OpenAI SSE 格式 | 已有 OpenAI 兼容 API 或使用 LLM 框架 |
| **RAG 知识库模式** | 后端实现 RAG 知识库 API（如 `POST /api/chat`），支持 Token 鉴权与知识库 ID | 对接 RAG 知识库后端（见下方文档） |
| **自定义 API 模式** | 后端实现任意路径接口，直接返回 UI Message Stream 格式 | 自研后端、Agent 等 |

---

### 模式一：OpenAI 兼容模式

在设置面板中选择「自定义」提供商，填写 Base URL（如 `http://localhost:8000/v1`），前端将自动拼接 `/chat/completions`。

#### 请求

```
POST {baseURL}/chat/completions
Content-Type: application/json
Authorization: Bearer {apiKey}
```

**请求体：**

```json
{
  "model": "your-model-name",
  "messages": [
    { "role": "system", "content": "你是一个有用的助手" },
    { "role": "user", "content": "你好" },
    { "role": "assistant", "content": "你好！有什么可以帮你？" },
    { "role": "user", "content": "介绍一下 RAG" }
  ],
  "stream": true
}
```

**messages 格式说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `role` | `"system" \| "user" \| "assistant"` | 消息角色 |
| `content` | `string \| array` | 纯文本为字符串；带图片时为数组（见下方多模态格式） |

**多模态 content 数组格式（带图片时）：**

```json
{
  "role": "user",
  "content": [
    { "type": "text", "text": "这张图片是什么？" },
    { "type": "image_url", "image_url": { "url": "data:image/png;base64,iVBOR..." } }
  ]
}
```

**带非图片附件时（PDF、Word 等，附件以文本注解形式传递）：**

```json
{
  "role": "user",
  "content": "[附件: report.pdf (PDF)]\n\n请总结这份报告的要点"
}
```

#### 响应

标准 OpenAI SSE 流：

```
Content-Type: text/event-stream

data: {"choices":[{"delta":{"content":"你"},"index":0}]}

data: {"choices":[{"delta":{"content":"好"},"index":0}]}

data: {"choices":[{"delta":{"content":"！"},"index":0}]}

data: [DONE]
```

**支持的 delta 字段：**

| 字段 | 说明 |
|------|------|
| `delta.content` | 正文文本增量 |
| `delta.reasoning_content` | 推理/思考过程增量（DeepSeek 风格，可选） |

#### Python 后端示例（FastAPI）

```python
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
import json, asyncio

app = FastAPI()

@app.post("/v1/chat/completions")
async def chat_completions(request: Request):
    body = await request.json()
    messages = body.get("messages", [])
    model = body.get("model", "default")

    async def generate():
        # 这里替换为你的模型推理逻辑
        reply = "你好！这是来自自定义后端的回复。"
        for char in reply:
            chunk = {
                "choices": [{
                    "delta": {"content": char},
                    "index": 0
                }]
            }
            yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
            await asyncio.sleep(0.03)
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"}
    )
```

#### Go 后端示例

```go
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

func chatHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	flusher, _ := w.(http.Flusher)

	reply := "你好！这是来自自定义后端的回复。"
	for _, ch := range reply {
		chunk := map[string]interface{}{
			"choices": []map[string]interface{}{
				{"delta": map[string]string{"content": string(ch)}, "index": 0},
			},
		}
		data, _ := json.Marshal(chunk)
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()
		time.Sleep(30 * time.Millisecond)
	}
	fmt.Fprintf(w, "data: [DONE]\n\n")
	flusher.Flush()
}

func main() {
	http.HandleFunc("/v1/chat/completions", chatHandler)
	http.ListenAndServe(":8000", nil)
}
```

---

### 模式二：自定义 API 模式（直接返回 UI Message Stream）

在设置面板中选择「自定义 API 接口」提供商，填写完整的 API 地址（如 `http://localhost:8000/api/chat`）。前端将直接 POST 到该地址，不拼接 `/chat/completions`。

此模式适合自研的 RAG 系统、Agent 平台等，后端可以直接返回 UI Message Stream 格式，无需兼容 OpenAI 格式。

#### 请求

```
POST {你的完整 API 地址}
Content-Type: application/json
Authorization: Bearer {apiKey}（如果填了 API Key）
```

**请求体：**

```json
{
  "messages": [
    {
      "id": "msg-abc123",
      "role": "user",
      "content": "介绍一下 RAG",
      "parts": [
        { "type": "text", "text": "介绍一下 RAG" }
      ]
    },
    {
      "id": "msg-def456",
      "role": "assistant",
      "content": "RAG 是...",
      "parts": [
        { "type": "text", "text": "RAG 是..." }
      ]
    },
    {
      "id": "msg-ghi789",
      "role": "user",
      "content": "详细说说检索部分",
      "parts": [
        { "type": "text", "text": "详细说说检索部分" }
      ]
    }
  ],
  "model": "your-model-name",
  "system": "你是一个有用的助手"
}
```

**messages 字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 消息唯一 ID |
| `role` | `"user" \| "assistant"` | 消息角色 |
| `content` | `string` | 消息纯文本内容 |
| `parts` | `array` | 消息的结构化部分（见下方） |

**parts 数组中可能的类型：**

| type | 说明 | 关键字段 |
|------|------|----------|
| `text` | 文本 | `text: string` |
| `file` | 文件附件 | `data: string`（base64 data URL）, `mimeType: string`, `filename: string` |
| `reasoning` | 推理过程 | `text: string` |

#### 响应

返回 **UI Message Stream** 格式的 SSE（Server-Sent Events）流：

```
Content-Type: text/event-stream
x-vercel-ai-ui-message-stream: v1
```

**SSE 事件序列：**

```
data: {"type":"text-start","id":"text-1"}

data: {"type":"text-delta","id":"text-1","delta":"RAG"}

data: {"type":"text-delta","id":"text-1","delta":"（检索增强生成）"}

data: {"type":"text-delta","id":"text-1","delta":"是一种..."}

data: {"type":"text-end","id":"text-1"}

data: {"type":"finish"}

data: [DONE]
```

**支持的事件类型：**

| type | 说明 | 字段 |
|------|------|------|
| `text-start` | 文本块开始 | `id: string` |
| `text-delta` | 文本增量 | `id: string`, `delta: string` |
| `text-end` | 文本块结束 | `id: string` |
| `reasoning-start` | 推理过程开始（可选） | `id: string` |
| `reasoning-delta` | 推理增量（可选） | `id: string`, `delta: string` |
| `reasoning-end` | 推理过程结束（可选） | `id: string` |
| `finish` | 响应完成 | — |

**带推理过程的完整示例：**

```
data: {"type":"reasoning-start","id":"reasoning-1"}

data: {"type":"reasoning-delta","id":"reasoning-1","delta":"让我思考一下这个问题..."}

data: {"type":"reasoning-delta","id":"reasoning-1","delta":"RAG 包含检索和生成两个阶段..."}

data: {"type":"reasoning-end","id":"reasoning-1"}

data: {"type":"text-start","id":"text-1"}

data: {"type":"text-delta","id":"text-1","delta":"RAG（检索增强生成）是..."}

data: {"type":"text-end","id":"text-1"}

data: {"type":"finish"}

data: [DONE]
```

#### Python 后端示例（FastAPI — UI Message Stream 模式）

```python
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
import json, asyncio

app = FastAPI()

@app.post("/api/chat")
async def chat(request: Request):
    body = await request.json()
    messages = body.get("messages", [])
    system = body.get("system", "")

    # 提取最后一条用户消息的文本
    last_user = ""
    for msg in reversed(messages):
        if msg.get("role") == "user":
            parts = msg.get("parts", [])
            for part in parts:
                if part.get("type") == "text":
                    last_user = part.get("text", "")
                    break
            if not last_user:
                last_user = msg.get("content", "")
            break

    async def generate():
        text_id = "text-1"

        # 可选：输出推理过程
        reasoning_id = "reasoning-1"
        reasoning = "让我思考一下..."
        yield f"data: {json.dumps({'type': 'reasoning-start', 'id': reasoning_id})}\n\n"
        yield f"data: {json.dumps({'type': 'reasoning-delta', 'id': reasoning_id, 'delta': reasoning})}\n\n"
        yield f"data: {json.dumps({'type': 'reasoning-end', 'id': reasoning_id})}\n\n"

        # 输出正文
        yield f"data: {json.dumps({'type': 'text-start', 'id': text_id})}\n\n"

        # ===== 替换为你的模型推理 / RAG 逻辑 =====
        reply = f"你好！你刚才说了「{last_user}」，这是自定义 API 的回复。"
        for char in reply:
            yield f"data: {json.dumps({'type': 'text-delta', 'id': text_id, 'delta': char}, ensure_ascii=False)}\n\n"
            await asyncio.sleep(0.03)

        yield f"data: {json.dumps({'type': 'text-end', 'id': text_id})}\n\n"
        yield f"data: {json.dumps({'type': 'finish'})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "x-vercel-ai-ui-message-stream": "v1",
        }
    )
```

#### Go 后端示例（UI Message Stream 模式）

```go
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type Event struct {
	Type  string `json:"type"`
	ID    string `json:"id,omitempty"`
	Delta string `json:"delta,omitempty"`
}

func chatHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("x-vercel-ai-ui-message-stream", "v1")
	flusher, _ := w.(http.Flusher)

	writeEvent := func(e Event) {
		data, _ := json.Marshal(e)
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()
	}

	// 正文
	writeEvent(Event{Type: "text-start", ID: "text-1"})
	reply := "你好！这是来自自定义 API 的流式回复。"
	for _, ch := range reply {
		writeEvent(Event{Type: "text-delta", ID: "text-1", Delta: string(ch)})
		time.Sleep(30 * time.Millisecond)
	}
	writeEvent(Event{Type: "text-end", ID: "text-1"})
	writeEvent(Event{Type: "finish"})
	fmt.Fprintf(w, "data: [DONE]\n\n")
	flusher.Flush()
}

func main() {
	http.HandleFunc("/api/chat", chatHandler)
	fmt.Println("Server running on :8000")
	http.ListenAndServe(":8000", nil)
}
```

---

### 模式三：RAG 知识库后端

在设置面板中选择「**RAG 知识库**」提供商，用于对接实现 RAG 知识库 API 的后端（默认 `http://127.0.0.1:8080`）。

**配置项：**

| 配置项 | 说明 |
|--------|------|
| **Base URL** | RAG 后端地址，如 `http://127.0.0.1:8080` |
| **API Key** | 登录后获得的 JWT Token（`POST /api/v1/auth/login` 返回的 `data.token`） |
| **知识库 ID** | 可选，指定绑定的知识库 ID；留空则由后端决定 |

前端会将请求转发到 Next.js 的 `/api/chat`，再由服务端代理到 `{Base URL}/api/chat`。请求体格式与后端文档「9.2 自定义流式接口（UI 消息流）」一致：

- **Method**: `POST`
- **Path**: `{Base URL}/api/chat`
- **Headers**: `Authorization: Bearer <token>`（若已配置 API Key）
- **Body**: `{ model, system?, knowledge_base_id?, messages }`  
  - `messages` 为 `{ id, role, content, parts }[]` 格式

响应为 SSE 流（`text-start` / `text-delta` / `text-end` / `finish`），与模式二相同，便于前端流式展示。

**用户登录 / 注册（鉴权代理）**

前端通过 Next.js 代理调用 RAG 后端鉴权接口，避免跨域。在设置 → 用户 中，当提供商为「RAG 知识库」且已填写 Base URL 时，可进行登录、注册与退出。

| 前端请求 | 代理目标 | 说明 |
|----------|----------|------|
| `POST /api/auth/login` | `POST {BaseURL}/api/v1/auth/login` | Body: `{ baseURL, email, password }`，返回 `{ token, expire, user }` |
| `POST /api/auth/register` | `POST {BaseURL}/api/v1/auth/register` | Body: `{ baseURL, username, email, password }` |
| `POST /api/auth/refresh` | `POST {BaseURL}/api/v1/auth/refresh` | Header: `Authorization: Bearer <token>`，Body: `{ baseURL }` |
| `GET /api/user/profile?baseURL=xxx` | `GET {BaseURL}/api/v1/user/profile` | Header: `Authorization: Bearer <token>` |
| `PUT /api/user/profile` | `PUT {BaseURL}/api/v1/user/profile` | Header: `Authorization`，Body: `{ baseURL, username?, avatar? }` |

登录成功后，前端会将返回的 `token` 写入 API 设置中的 API Key，后续对话请求会自动携带该 Token。

---

### CORS 配置

如果后端和前端不在同一域名下，需要配置 CORS：

```python
# FastAPI
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)
```

### 错误处理

后端应返回 JSON 格式的错误响应：

```json
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "错误描述信息"
}
```

---

<a id="english"></a>

## English

This frontend supports three modes for connecting to a custom backend:

| Mode | Description | Use Case |
|------|-------------|----------|
| **OpenAI-Compatible** | Backend implements `/chat/completions` in standard OpenAI SSE format | Existing OpenAI-compatible APIs or LLM frameworks |
| **RAG Knowledge Base** | Backend implements RAG API (e.g. `POST /api/chat`) with token auth and optional knowledge_base_id | RAG backends (see RAG API doc) |
| **Custom API** | Backend implements any endpoint, returns UI Message Stream format directly | Agent platforms, etc. |

---

### Mode 1: OpenAI-Compatible

Select "Custom" provider in settings, enter the Base URL (e.g., `http://localhost:8000/v1`). The frontend automatically appends `/chat/completions`.

#### Request

```
POST {baseURL}/chat/completions
Content-Type: application/json
Authorization: Bearer {apiKey}
```

**Request Body:**

```json
{
  "model": "your-model-name",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant" },
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hello! How can I help?" },
    { "role": "user", "content": "Tell me about RAG" }
  ],
  "stream": true
}
```

**messages format:**

| Field | Type | Description |
|-------|------|-------------|
| `role` | `"system" \| "user" \| "assistant"` | Message role |
| `content` | `string \| array` | Plain text as string; multimodal content as array (see below) |

**Multimodal content array (with images):**

```json
{
  "role": "user",
  "content": [
    { "type": "text", "text": "What's in this image?" },
    { "type": "image_url", "image_url": { "url": "data:image/png;base64,iVBOR..." } }
  ]
}
```

#### Response

Standard OpenAI SSE stream:

```
Content-Type: text/event-stream

data: {"choices":[{"delta":{"content":"Hello"},"index":0}]}

data: {"choices":[{"delta":{"content":"!"},"index":0}]}

data: [DONE]
```

**Supported delta fields:**

| Field | Description |
|-------|-------------|
| `delta.content` | Text content delta |
| `delta.reasoning_content` | Reasoning/thinking delta (DeepSeek-style, optional) |

---

### Mode 2: Custom API (Direct UI Message Stream)

Select "Custom API Endpoint" provider in settings, enter the full API URL (e.g., `http://localhost:8000/api/chat`). The frontend POSTs directly to this URL without appending `/chat/completions`.

#### Request

```
POST {your full API URL}
Content-Type: application/json
Authorization: Bearer {apiKey} (if API Key is provided)
```

**Request Body:**

```json
{
  "messages": [
    {
      "id": "msg-abc123",
      "role": "user",
      "content": "Tell me about RAG",
      "parts": [
        { "type": "text", "text": "Tell me about RAG" }
      ]
    }
  ],
  "model": "your-model-name",
  "system": "You are a helpful assistant"
}
```

**messages fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique message ID |
| `role` | `"user" \| "assistant"` | Message role |
| `content` | `string` | Plain text content |
| `parts` | `array` | Structured message parts |

**Possible part types:**

| type | Description | Key fields |
|------|-------------|------------|
| `text` | Text | `text: string` |
| `file` | File attachment | `data: string` (base64 data URL), `mimeType: string`, `filename: string` |
| `reasoning` | Reasoning process | `text: string` |

#### Response

Return a **UI Message Stream** SSE stream:

```
Content-Type: text/event-stream
x-vercel-ai-ui-message-stream: v1
```

**SSE event sequence:**

```
data: {"type":"text-start","id":"text-1"}

data: {"type":"text-delta","id":"text-1","delta":"RAG"}

data: {"type":"text-delta","id":"text-1","delta":" (Retrieval-Augmented Generation)"}

data: {"type":"text-delta","id":"text-1","delta":" is a technique..."}

data: {"type":"text-end","id":"text-1"}

data: {"type":"finish"}

data: [DONE]
```

**Supported event types:**

| type | Description | Fields |
|------|-------------|--------|
| `text-start` | Text block start | `id: string` |
| `text-delta` | Text delta | `id: string`, `delta: string` |
| `text-end` | Text block end | `id: string` |
| `reasoning-start` | Reasoning start (optional) | `id: string` |
| `reasoning-delta` | Reasoning delta (optional) | `id: string`, `delta: string` |
| `reasoning-end` | Reasoning end (optional) | `id: string` |
| `finish` | Response complete | — |

See the [中文](#中文) section above for complete Python (FastAPI) and Go backend examples.

---

### CORS Configuration

If the backend and frontend are on different origins, configure CORS:

```python
# FastAPI
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)
```

### Error Handling

Backends should return JSON-formatted error responses:

```json
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "Error description"
}
```
