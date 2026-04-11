/** 支持的对话模式 */
export type ProviderId = "doubao" | "rag";

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  description: string;
  baseURL: string;
  defaultModel: string;
  placeholder: string;
}

export const PROVIDERS: ProviderConfig[] = [
  {
    id: "doubao",
    name: "豆包对话",
    description: "通用 AI 对话，由火山引擎豆包大模型驱动",
    baseURL: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "doubao-seed-2-0-lite-260215",
    placeholder: "通用 AI 对话",
  },
  {
    id: "rag",
    name: "RAG 知识库问答",
    description: "基于你上传的知识库文档进行智能问答",
    baseURL: "",
    defaultModel: "",
    placeholder: "基于知识库的智能问答",
  },
];

export function getProvider(id: ProviderId): ProviderConfig {
  const p = PROVIDERS.find((x) => x.id === id);
  return p ?? PROVIDERS[0];
}
