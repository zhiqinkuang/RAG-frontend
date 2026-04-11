/**
 * 统一配置管理 — RAG 后端基础 URL（不含 `/api/v1/...` 等路径）。
 *
 * **浏览器**
 * - `NEXT_PUBLIC_RAG_API_URL` 非空：使用该绝对地址。
 * - 否则：使用 `window.location.origin`，请求走同源 `/api/v1/*`（Next `rewrites` 或 nginx 反代）。
 *
 * **服务端**（Route Handler、RSC 等）
 * - `RAG_API_URL`：Docker/内网直连后端（仅服务器可读，不会打进浏览器包）。
 * - 否则 `NEXT_PUBLIC_RAG_API_URL`。
 * - 否则请求里传入的 `clientBaseURL`（登录/注册等 body里的 baseURL）。
 * - 否则本地开发默认 `http://127.0.0.1:8080`。
 */

function trimTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

/**
 * @param clientBaseURL 仅服务端生效：来自请求体的 baseURL（浏览器不会使用此参数）。
 */
export function getRagBackendUrl(clientBaseURL?: string): string {
  const pub = process.env.NEXT_PUBLIC_RAG_API_URL;
  const serverOnly = process.env.RAG_API_URL;

  if (typeof window !== "undefined") {
    if (pub !== undefined && pub !== "") {
      return trimTrailingSlash(pub);
    }
    return window.location.origin;
  }

  if (serverOnly !== undefined && serverOnly !== "") {
    return trimTrailingSlash(serverOnly);
  }
  if (pub !== undefined && pub !== "") {
    return trimTrailingSlash(pub);
  }
  if (clientBaseURL) {
    return trimTrailingSlash(clientBaseURL);
  }
  return "http://127.0.0.1:8080";
}

/**
 * 论文提取 API 端点
 */
export function getPaperExtractUrl(): string {
  return `${getRagBackendUrl()}/api/v1/papers/extract`;
}

/**
 * RAG 知识库对话转发到后端时使用的 `model` 字段（原样传给 RAG 后端的聊天接口）。
 *
 * 取值规则**取决于你的 RAG 后端对接的上游厂商**：可能是 OpenAI 兼容的模型名、
 * 某云平台的接入点 ID、deployment 名等，需与后端实现及该厂商文档一致。
 * 环境变量名 `ARK_DEFAULT_MODEL` 仅为历史兼容（例如豆包 Ark），并非要求使用 Ark。
 *
 * 优先级：请求体里的 `model` → `RAG_CHAT_MODEL` → `ARK_DEFAULT_MODEL`。
 */
export function resolveRagInferenceModel(
  requestModel?: string | null,
): string | undefined {
  const fromReq = typeof requestModel === "string" ? requestModel.trim() : "";
  if (fromReq) return fromReq;
  const fromEnv =
    process.env.RAG_CHAT_MODEL?.trim() || process.env.ARK_DEFAULT_MODEL?.trim();
  return fromEnv || undefined;
}
