// 禁用 Next.js 响应缓冲，确保流式传输
export const dynamic = 'force-dynamic';

import { frontendTools } from "@assistant-ui/react-ai-sdk";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { getProvider, type ProviderId } from "@/lib/providers";

const MOCK_CHAT = process.env.MOCK_CHAT === "true";

/** 根据最后一条用户消息生成 mock 回复文案，并拆成流式 chunk */
function buildMockStreamChunks(lastUserContent: string) {
  const reply =
    lastUserContent.trim().length > 0
      ? `这是演示回复。您刚才说：「${lastUserContent}」—— 我收到了，当前为 Mock 模式，仅用于演示基本功能。`
      : "你好，这是 Mock 演示模式。发送任意消息即可看到流式回复效果。";

  const id = "text-mock-1";
  const chunks: Array<
    | { type: "text-start"; id: string }
    | { type: "text-delta"; id: string; delta: string }
    | { type: "text-end"; id: string }
    | {
        type: "finish";
        finishReason: "stop";
        usage: {
          inputTokens: {
            total: number;
            noCache: number;
            cacheRead: number;
            cacheWrite: number;
          };
          outputTokens: {
            total: number;
            text: number;
            reasoning: number;
          };
          totalTokens: number;
        };
      }
  > = [{ type: "text-start", id }];

  for (const char of reply) {
    chunks.push({ type: "text-delta", id, delta: char });
  }

  chunks.push({ type: "text-end", id });
  chunks.push({
    type: "finish",
    finishReason: "stop",
    usage: {
      inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: reply.length, text: reply.length, reasoning: 0 },
      totalTokens: reply.length,
    },
  });

  return chunks;
}

type MessagePart = { type?: string; text?: string; image?: string; data?: string; url?: string; mimeType?: string; mediaType?: string; filename?: string };

/** 从单条 UIMessage 取 parts 或 content（兼容 AI SDK / assistant-ui） */
function getMessageParts(msg: UIMessage): MessagePart[] | undefined {
  const m = msg as { parts?: MessagePart[]; content?: string | MessagePart[] };
  if (Array.isArray(m.parts)) return m.parts;
  if (Array.isArray(m.content)) return m.content;
  if (typeof m.content === "string") return [{ type: "text", text: m.content }];
  return undefined;
}

/** 从单条 UIMessage 提取纯文本（无图片时用） */
function getMessageText(msg: UIMessage): string {
  const parts = getMessageParts(msg);
  if (!parts) return "";
  return parts
    .filter((p): p is { type: "text"; text: string } => p?.type === "text" && typeof p?.text === "string")
    .map((p) => p.text)
    .join("");
}

/** OpenAI 单条消息的 content：纯文本 或 多模态 content 数组（文本 + 图片） */
type OpenAIContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

/** 收集可作为“图片”发给视觉模型的部分：type=image、或 type=file 且 mime 为 image/*（支持 data 或 url 字段） */
function getImageUrlsFromParts(parts: MessagePart[]): string[] {
  const urls: string[] = [];
  for (const p of parts) {
    const mime = (p as { mimeType?: string; mediaType?: string }).mimeType ?? (p as { mediaType?: string }).mediaType ?? "";
    if (p?.type === "image" && typeof (p as { image?: string }).image === "string") {
      const img = (p as { image: string }).image;
      urls.push(img.startsWith("data:") ? img : `data:image/png;base64,${img}`);
    } else if (p?.type === "file" && mime.startsWith("image/")) {
      const raw = (p as { data?: string; url?: string }).data ?? (p as { url?: string }).url;
      if (typeof raw === "string") urls.push(raw);
    }
  }
  return urls;
}

type NonImageFile = { filename: string; mimeType: string };

function getNonImageFilesFromParts(parts: MessagePart[]): NonImageFile[] {
  const files: NonImageFile[] = [];
  for (const p of parts) {
    const mime =
      (p as { mimeType?: string }).mimeType ??
      (p as { mediaType?: string }).mediaType ??
      (p as { contentType?: string }).contentType ??
      "";
    if (p?.type === "file" && mime && !mime.startsWith("image/")) {
      const filename =
        (p as { filename?: string }).filename ??
        (p as { name?: string }).name ??
        "file";
      files.push({ filename, mimeType: mime });
    }
  }
  return files;
}

function fileTypeLabel(mimeType: string): string {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.includes("word") || mimeType.includes("msword")) return "Word";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "Excel";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "PowerPoint";
  if (mimeType.startsWith("video/")) return "Video";
  if (mimeType.startsWith("audio/")) return "Audio";
  if (mimeType.startsWith("text/")) return "Text";
  return "File";
}

function toOpenAIContent(msg: UIMessage): OpenAIContent {
  const parts = getMessageParts(msg);
  if (!parts || parts.length === 0) return "";

  const textParts = parts.filter((p): p is { type: "text"; text: string } => p?.type === "text" && typeof p?.text === "string");
  const imageUrls = getImageUrlsFromParts(parts);
  const nonImageFiles = getNonImageFilesFromParts(parts);

  let text = textParts.map((p) => p.text).join("").trim();

  if (nonImageFiles.length > 0) {
    const notes = nonImageFiles
      .map((f) => `[附件: ${f.filename} (${fileTypeLabel(f.mimeType)})]`)
      .join("\n");
    text = text ? `${notes}\n\n${text}` : notes;
  }

  if (imageUrls.length === 0) return text || "";

  const content: OpenAIContent = [];
  if (text) content.push({ type: "text", text });
  for (const url of imageUrls) {
    content.push({ type: "image_url", image_url: { url } });
  }
  return content;
}

/** 转换为 RAG 自定义接口 /api/chat 所需的消息格式：id, role, content, parts */
function toRagMessages(messages: UIMessage[]): Array<{ id: string; role: string; content: string; parts: Array<{ type: string; text?: string }> }> {
  return messages.map((msg) => {
    const parts = getMessageParts(msg) ?? [];
    const textContent = getMessageText(msg);
    const role = (msg as { role?: string }).role === "human" ? "user" : String((msg as { role?: string }).role ?? "user");
    const id = String((msg as { id?: string }).id ?? `msg-${Math.random().toString(36).slice(2, 11)}`);
    if (role === "assistant") {
      return {
        id,
        role: "assistant",
        content: "",
        parts: textContent ? [{ type: "text", text: textContent }] : [],
      };
    }
    return {
      id,
      role: "user",
      content: textContent,
      parts: [],
    };
  });
}

/** 转换 UI 消息为 OpenAI 兼容格式（支持文本 + 图片） */
function toOpenAIMessages(messages: UIMessage[], system?: string): Array<{ role: string; content: OpenAIContent }> {
  const out: Array<{ role: string; content: OpenAIContent }> = [];
  if (system) out.push({ role: "system", content: system });

  for (const msg of messages) {
    const content = toOpenAIContent(msg);
    const rawRole: string = msg.role;
    const role = rawRole === "human" ? "user" : rawRole === "assistant" ? "assistant" : String(rawRole || "user");
    if (role !== "system") {
      out.push({ role, content });
    }
  }

  return out;
}

/** 通用 OpenAI 兼容流式调用（支持多提供商） */
async function streamChat(
  baseURL: string,
  apiKey: string,
  model: string,
  messages: UIMessage[],
  system?: string
): Promise<Response> {
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "请先配置 API Key" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = baseURL.replace(/\/$/, "") + "/chat/completions";
  const openAIMessages = toOpenAIMessages(messages, system);
  const body = {
    model: model || "gpt-4o-mini",
    messages: openAIMessages,
    stream: true,
  };

  if (process.env.NODE_ENV === "development" && openAIMessages.length > 0) {
    const last = openAIMessages[openAIMessages.length - 1];
    console.log("[chat] url:", url, "model:", model || "(empty)", "messages:", openAIMessages.length, "last role:", last?.role);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Chat API error:", error);
    return new Response(JSON.stringify({ error: `API 错误: ${response.status} - ${error}` }), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return response;
}

/** 保证是合法的 ReadableStream，避免客户端 response.body.pipeThrough 报 undefined */
function ensureReadableStream(stream: ReadableStream<Uint8Array> | null | undefined): ReadableStream<Uint8Array> {
  if (stream != null && typeof (stream as ReadableStream).getReader === "function") {
    return stream as ReadableStream<Uint8Array>;
  }
  return new ReadableStream({
    start(controller) {
      controller.error(new Error("No response body"));
    },
  });
}

/** 将 OpenAI 兼容的 SSE 流转换为 AI SDK UI Message Stream 格式 (SSE)，支持 reasoning（如 DeepSeek reasoning_content） */
function transformToUIMessageStream(response: Response): ReadableStream<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) {
    return ensureReadableStream(null);
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const idSuffix = Math.random().toString(36).slice(2, 11);
  const textId = "text-" + idSuffix;
  const reasoningId = "reasoning-" + idSuffix;
  let buffer = "";
  let reasoningStarted = false;
  let textStarted = false;

  function sseLine(obj: unknown) {
    return "data: " + JSON.stringify(obj) + "\n\n";
  }

  return new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;

              try {
                const json = JSON.parse(data);
                const choice = json.choices?.[0];
                const delta = choice?.delta;
                // 思考过程：DeepSeek 等使用 delta.reasoning_content
                const reasoningChunk =
                  typeof (delta as { reasoning_content?: string } | undefined)?.reasoning_content === "string"
                    ? (delta as { reasoning_content: string }).reasoning_content
                    : "";
                // 正文：delta.content（OpenAI/豆包）或 delta.text
                const textChunk =
                  typeof delta?.content === "string"
                    ? delta.content
                    : typeof delta?.text === "string"
                      ? delta.text
                      : typeof choice?.message?.content === "string"
                        ? choice.message.content
                        : "";

                if (reasoningChunk) {
                  if (!reasoningStarted) {
                    controller.enqueue(encoder.encode(sseLine({ type: "reasoning-start", id: reasoningId })));
                    reasoningStarted = true;
                  }
                  controller.enqueue(encoder.encode(sseLine({ type: "reasoning-delta", id: reasoningId, delta: reasoningChunk })));
                }
                if (textChunk) {
                  if (reasoningStarted) {
                    controller.enqueue(encoder.encode(sseLine({ type: "reasoning-end", id: reasoningId })));
                    reasoningStarted = false;
                  }
                  if (!textStarted) {
                    controller.enqueue(encoder.encode(sseLine({ type: "text-start", id: textId })));
                    textStarted = true;
                  }
                  controller.enqueue(encoder.encode(sseLine({ type: "text-delta", id: textId, delta: textChunk })));
                }
              } catch {
                // 忽略解析错误
              }
            }
          }
        }

        if (reasoningStarted) {
          controller.enqueue(encoder.encode(sseLine({ type: "reasoning-end", id: reasoningId })));
        }
        if (textStarted) {
          controller.enqueue(encoder.encode(sseLine({ type: "text-end", id: textId })));
        } else {
          // 无正文时仍发送空 text 块，保证客户端结构一致
          controller.enqueue(encoder.encode(sseLine({ type: "text-start", id: textId })));
          controller.enqueue(encoder.encode(sseLine({ type: "text-end", id: textId })));
        }
        controller.enqueue(encoder.encode(sseLine({ type: "finish" })));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

function jsonErrorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  try {
    const {
      messages,
      system,
      tools,
      provider: providerId,
      apiKey,
      baseURL: requestBaseURL,
      model,
      knowledgeBaseId,
    }: {
      messages: UIMessage[];
      system?: string;
      tools?: Record<string, unknown>;
      provider?: ProviderId;
      apiKey?: string;
      baseURL?: string;
      model?: string;
      knowledgeBaseId?: number;
    } = await req.json();

    const provider = (providerId ?? "doubao") as ProviderId;
    const prov = getProvider(provider);
    const effectiveApiKey = apiKey ?? process.env.ARK_API_KEY ?? process.env.OPENAI_API_KEY;
    const effectiveBaseURL = requestBaseURL || prov.baseURL;
    const effectiveModel = model || prov.defaultModel;

    if (MOCK_CHAT) {
      const lastUser = [...messages].reverse().find((m) => m.role === "user") as
        | {
            role: string;
            content?: string | Array<{ type: string; text?: string }>;
          }
        | undefined;
      const lastContent =
        typeof lastUser?.content === "string"
          ? lastUser.content
          : Array.isArray(lastUser?.content)
            ? lastUser.content
                .map((p) => (p.type === "text" ? p.text : ""))
                .join("")
            : "";
      const chunks = buildMockStreamChunks(lastContent);

      const result = streamText({
        model: new MockLanguageModelV3({
          // @ts-expect-error Mock model types are complex
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks,
              chunkDelayInMs: 30,
            }),
          }),
        }),
        messages: await convertToModelMessages(messages),
        system,
      });

      return result.toUIMessageStreamResponse();
    }

    // RAG 知识库：调用后端 POST /api/chat（UI Message Stream 格式）
    if (provider === "rag") {
      const base = effectiveBaseURL?.replace(/\/$/, "") ?? "";
      if (!base) {
        return jsonErrorResponse("请填写 RAG 后端地址 (Base URL)", 400);
      }
      const apiURL = `${base}/api/chat`;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (effectiveApiKey) {
        headers["Authorization"] = `Bearer ${effectiveApiKey}`;
      }
      const body: Record<string, unknown> = {
        model: effectiveModel || "gpt-4o",
        messages: toRagMessages(messages),
      };
      if (system) body.system = system;
      if (typeof knowledgeBaseId === "number" && knowledgeBaseId > 0) {
        body.knowledge_base_id = knowledgeBaseId;
      }

      const apiResponse = await fetch(apiURL, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text().catch(() => "Unknown error");
        return new Response(
          JSON.stringify({ error: errorText || `RAG API error: ${apiResponse.status}` }),
          { status: apiResponse.status, headers: { "Content-Type": "application/json" } }
        );
      }

      // 使用 TransformStream 实时转发流数据，避免缓冲
      const stream = new ReadableStream({
        async start(controller) {
          const reader = apiResponse.body?.getReader();
          if (!reader) {
            controller.close();
            return;
          }
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                controller.close();
                return;
              }
              controller.enqueue(value);
            }
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "x-vercel-ai-ui-message-stream": "v1",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // 自定义 API 模式：直接转发，后端返回 UI Message Stream 格式
    if (provider === "custom-api") {
      const apiURL = effectiveBaseURL;
      if (!apiURL) {
        return jsonErrorResponse("请填写自定义 API 地址", 400);
      }
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (effectiveApiKey) {
        headers["Authorization"] = `Bearer ${effectiveApiKey}`;
      }
      const body: Record<string, unknown> = { messages };
      if (system) body.system = system;
      if (effectiveModel) body.model = effectiveModel;

      const apiResponse = await fetch(apiURL, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text().catch(() => "Unknown error");
        return new Response(
          JSON.stringify({ error: errorText || `Custom API error: ${apiResponse.status}` }),
          { status: apiResponse.status, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(ensureReadableStream(apiResponse.body), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "x-vercel-ai-ui-message-stream": "v1",
        },
      });
    }

    // OpenAI 兼容 API
    const chatResponse = await streamChat(
      effectiveBaseURL,
      effectiveApiKey || "",
      effectiveModel,
      messages,
      system
    );

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text().catch(() => "Unknown error");
      let message = errorText?.trim() || `Request failed: ${chatResponse.status}`;
      if (chatResponse.status === 404 && provider === "doubao") {
        message =
          "豆包接口 404：请确认 1) 模型填写的是火山引擎控制台中的「推理接入点 ID」（形如 ep-xxxxxxxx），不是模型名称；2) Base URL 为 https://ark.cn-beijing.volces.com/api/v3；3) API Key 有效且该 Key 有该接入点的调用权限。原始错误: " +
          message;
      }
      return new Response(JSON.stringify({ error: message }), {
        status: chatResponse.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const stream = transformToUIMessageStream(chatResponse);
    return new Response(ensureReadableStream(stream), {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "x-vercel-ai-ui-message-stream": "v1",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return jsonErrorResponse(message, 500);
  }
}