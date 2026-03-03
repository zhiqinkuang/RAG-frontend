/** 支持的模型提供商 */
export type ProviderId =
  | "openai"
  | "doubao"
  | "deepseek"
  | "zhipu"
  | "qwen"
  | "moonshot"
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
    placeholder: "gpt-4o-mini / gpt-4o",
  },
  {
    id: "doubao",
    name: "火山引擎豆包",
    baseURL: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "ep-20241101xxxxx",
    placeholder: "推理接入点 ID，如 ep-20241101xxxxx",
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
