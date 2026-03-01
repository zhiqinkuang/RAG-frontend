import { openai } from "@ai-sdk/openai";
import { frontendTools } from "@assistant-ui/react-ai-sdk";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";

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
      outputTokens: { total: reply.length },
      totalTokens: reply.length,
    },
  });

  return chunks;
}

export async function POST(req: Request) {
  const {
    messages,
    system,
    tools,
  }: {
    messages: UIMessage[];
    system?: string;
    tools?: Record<string, unknown>;
  } = await req.json();

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

  const result = streamText({
    model: openai.responses("gpt-5-nano"),
    messages: await convertToModelMessages(messages),
    system,
    tools: {
      ...frontendTools(tools ?? {}),
    },
    providerOptions: {
      openai: {
        reasoningEffort: "low",
        reasoningSummary: "auto",
      },
    },
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
  });
}
