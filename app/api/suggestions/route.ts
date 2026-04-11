import { getRagBackendUrl, resolveRagInferenceModel } from "@/lib/config";
import { getProvider, type ProviderId } from "@/lib/providers";

function parseSuggestions(text: string): string[] {
  // Try JSON array first
  const jsonMatch = text.match(/\[[\s\S]*?\]/);
  if (jsonMatch) {
    try {
      const arr = JSON.parse(jsonMatch[0]);
      if (Array.isArray(arr)) {
        const results = arr
          .filter((s: unknown) => typeof s === "string" && s.trim())
          .map((s: string) => s.trim())
          .slice(0, 3);
        if (results.length > 0) return results;
      }
    } catch {
      // continue to fallback
    }
  }

  // Fallback: extract numbered lines like "1. xxx" or "- xxx"
  const lines = text
    .split("\n")
    .map((l) =>
      l
        .replace(/^\s*[\d]+[.)]\s*/, "")
        .replace(/^\s*[-*•]\s*/, "")
        .replace(/^["'`]+|["'`]+$/g, "")
        .trim(),
    )
    .filter(
      (l) =>
        l.length > 2 &&
        l.length < 100 &&
        !l.startsWith("{") &&
        !l.startsWith("["),
    );

  return lines.slice(0, 3);
}

export async function POST(req: Request) {
  try {
    const {
      messages,
      provider: providerId,
      apiKey,
      baseURL: requestBaseURL,
      model,
      knowledgeBaseId,
    }: {
      messages: Array<{ role: string; content: string }>;
      provider?: ProviderId;
      apiKey?: string;
      baseURL?: string;
      model?: string;
      knowledgeBaseId?: number;
    } = await req.json();

    const provider = (providerId ?? "doubao") as ProviderId;
    const prov = getProvider(provider);
    const effectiveApiKey =
      provider === "rag"
        ? (apiKey || "")
        : (process.env.ARK_API_KEY || process.env.OPENAI_API_KEY || "");
    const effectiveBaseURL = requestBaseURL || prov.baseURL;
    const effectiveModel =
      provider === "rag"
        ? (resolveRagInferenceModel(model) ?? "")
        : (process.env.DOUBAO_CHAT_MODEL || prov.defaultModel);

    if (!effectiveApiKey) {
      return Response.json({ suggestions: [] });
    }

    if (provider === "rag" && !effectiveModel) {
      return Response.json({ suggestions: [] });
    }

    const trimmed = messages.slice(-6).map((m) => ({
      role: m.role,
      content:
        typeof m.content === "string"
          ? m.content.slice(0, 500)
          : String(m.content).slice(0, 500),
    }));

    const systemPrompt =
      "根据对话内容，生成3个用户可能想继续问的简短问题。" +
      "只返回JSON数组，不要markdown，不要解释。" +
      '使用和用户相同的语言。格式：["问题1","问题2","问题3"]';

    // RAG provider 使用后端的 /v1/chat/completions 接口
    let url: string;
    if (provider === "rag") {
      const ragBase = effectiveBaseURL || getRagBackendUrl();
      url = `${ragBase.replace(/\/$/, "")}/v1/chat/completions`;
    } else {
      url = `${effectiveBaseURL.replace(/\/$/, "")}/chat/completions`;
    }

    const body: Record<string, unknown> = {
      model: effectiveModel,
      messages: [
        { role: "system", content: systemPrompt },
        ...trimmed,
        { role: "user", content: "请生成3个推荐问题，只返回JSON数组" },
      ],
      stream: false,
      max_tokens: 300,
      temperature: 0.8,
    };

    // RAG provider 添加 knowledge_base_id
    if (
      provider === "rag" &&
      typeof knowledgeBaseId === "number" &&
      knowledgeBaseId > 0
    ) {
      body.knowledge_base_id = knowledgeBaseId;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (effectiveApiKey) {
      headers["Authorization"] = `Bearer ${effectiveApiKey}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error("[suggestions] API error:", response.status);
      return Response.json({ suggestions: [] });
    }

    const data = await response.json();
    const text =
      data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text ?? "";

    if (process.env.NODE_ENV === "development") {
      console.log("[suggestions] raw response:", text.slice(0, 300));
    }

    const suggestions = parseSuggestions(text);

    if (process.env.NODE_ENV === "development") {
      console.log("[suggestions] parsed:", suggestions);
    }

    return Response.json({ suggestions });
  } catch (err) {
    console.error("[suggestions] error:", err);
    return Response.json({ suggestions: [] });
  }
}
