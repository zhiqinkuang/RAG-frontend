/**
 * 统一配置管理
 * 
 * RAG 后端地址优先级：
 * 1. NEXT_PUBLIC_RAG_API_URL 环境变量（用于生产部署）
 * 2. 默认本地开发地址 http://127.0.0.1:8080
 */

/**
 * 获取 RAG 后端 URL
 * 用于知识库管理、论文搜索等功能
 */
export function getRagBackendUrl(): string {
  // 优先使用环境变量（生产部署时设置）
  if (process.env.NEXT_PUBLIC_RAG_API_URL) {
    return process.env.NEXT_PUBLIC_RAG_API_URL;
  }
  
  // 默认本地开发地址
  return "http://127.0.0.1:8080";
}

/**
 * RAG 后端 URL（导出常量，用于非 React 环境）
 */
export const RAG_BACKEND_URL = getRagBackendUrl();

/**
 * 论文提取 API 端点
 */
export function getPaperExtractUrl(): string {
  return `${getRagBackendUrl()}/api/v1/papers/extract`;
}