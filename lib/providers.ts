/** 支持的模型提供商 */
export type ProviderId =
  | "openai"
  | "doubao"
  | "deepseek"
  | "zhipu"
  | "qwen"
  | "moonshot"
  | "rag"
  | "custom"
  | "custom-api";

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  baseURL: string;
  defaultModel: string;
  placeholder: string;
}

export const PROVIDERS: ProviderConfig[] = [
  {
    id: "openai",
    name: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    placeholder: "GPT-4o-mini / GPT-4o",
  },
  {
    id: "doubao",
    name: "火山引擎豆包",
    baseURL: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "doubao-seed-2-0-lite-260215",
    placeholder: "doubao-seed-2-0-lite-260215",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseURL: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    placeholder: "deepseek-chat / deepseek-reasoner",
  },
  {
    id: "zhipu",
    name: "智谱 GLM",
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4-flash",
    placeholder: "glm-4-flash / glm-4",
  },
  {
    id: "qwen",
    name: "通义千问",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-turbo",
    placeholder: "qwen-turbo / qwen-plus",
  },
  {
    id: "moonshot",
    name: "Moonshot 月之暗面",
    baseURL: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k",
    placeholder: "moonshot-v1-8k / moonshot-v1-32k",
  },
  {
    id: "rag",
    name: "RAG 知识库",
    baseURL: "http://127.0.0.1:8080",
    defaultModel: "ep-20260303160518-fzrwg",
    placeholder: "http://127.0.0.1:8080",
  },
  {
    id: "custom",
    name: "自定义 (OpenAI 兼容)",
    baseURL: "",
    defaultModel: "",
    placeholder: "https://your-api.com/v1",
  },
  {
    id: "custom-api",
    name: "自定义 API 接口",
    baseURL: "",
    defaultModel: "",
    placeholder: "http://localhost:8000/api/chat",
  },
];

export function getProvider(id: ProviderId): ProviderConfig {
  const p = PROVIDERS.find((x) => x.id === id);
  return p ?? PROVIDERS[0];
}
