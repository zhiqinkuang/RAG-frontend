/**
 * API 请求拦截器：处理 Token 过期自动跳转登录页
 * 
 * 当 API 返回 401 响应时，自动：
 * 1. 清除本地存储的 token
 * 2. 触发认证状态变化事件
 * 3. 跳转到登录页
 */

import { clearStoredRagAuth } from "./rag-auth";

/** 认证状态变化事件名称 */
export const AUTH_CHANGE_EVENT = "rag-auth-changed";
/** Token 过期事件名称 */
export const TOKEN_EXPIRED_EVENT = "rag-token-expired";

/**
 * 处理 Token 过期
 * 清除认证信息并触发跳转登录页
 */
export function handleTokenExpired(): void {
  if (typeof window === "undefined") return;

  // 清除本地存储的认证信息
  clearStoredRagAuth();

  // 触发 token 过期事件
  window.dispatchEvent(new CustomEvent(TOKEN_EXPIRED_EVENT));

  // 触发认证状态变化事件
  window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT));

  // 跳转到登录页
  // 使用 window.location.href 确保完全刷新页面状态
  const currentPath = window.location.pathname;
  const loginUrl = currentPath && currentPath !== "/" 
    ? `/login?redirect=${encodeURIComponent(currentPath)}`
    : "/login";
  
  window.location.href = loginUrl;
}

/**
 * 检查响应是否为 401 未授权
 */
export function isUnauthorizedResponse(response: Response): boolean {
  return response.status === 401;
}

/**
 * 检查错误信息是否包含认证失败
 */
export function isAuthError(error: unknown): boolean {
  if (!error) return false;
  
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();
  
  return (
    lowerMessage.includes("401") ||
    lowerMessage.includes("unauthorized") ||
    lowerMessage.includes("authentication failed") ||
    lowerMessage.includes("session expired") ||
    lowerMessage.includes("token expired") ||
    lowerMessage.includes("请重新登录") ||
    lowerMessage.includes("登录已过期")
  );
}

/**
 * 带认证检查的 fetch 包装器
 * 自动处理 401 响应
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init);

  // 检查是否为 401 响应
  if (isUnauthorizedResponse(response)) {
    handleTokenExpired();
    throw new Error("Session expired. Please log in again.");
  }

  return response;
}

/**
 * 带认证检查的 fetch 包装器（JSON 响应）
 */
export async function authFetchJson<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const response = await authFetch(input, init);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as { error?: string }).error || `Request failed: ${response.status}`
    );
  }
  
  return response.json() as Promise<T>;
}

/**
 * 全局 fetch 拦截器
 * 拦截所有 fetch 请求，处理 401 响应
 */
export function setupFetchInterceptor(): void {
  if (typeof window === "undefined") return;

  const originalFetch = window.fetch;
  
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await originalFetch(input, init);

    // 只拦截 API 请求的 401 响应
    const url = typeof input === "string" ? input : (input as Request).url;
    const isApiRequest = url.startsWith("/") || url.includes("/api/");
    
    if (isApiRequest && isUnauthorizedResponse(response)) {
      // 排除登录、注册、刷新 token 等接口
      const excludedPaths = ["/api/auth/login", "/api/auth/register", "/api/auth/refresh"];
      const isExcluded = excludedPaths.some(path => url.includes(path));
      
      if (!isExcluded) {
        handleTokenExpired();
      }
    }

    return response;
  };
}

/**
 * 移除 fetch 拦截器（恢复原始 fetch）
 */
export function removeFetchInterceptor(): void {
  if (typeof window === "undefined") return;
  // 注意：这个实现无法真正恢复原始 fetch，因为可能被多次覆盖
  // 在实际应用中，通常不需要移除拦截器
}