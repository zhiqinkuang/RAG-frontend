/**
 * RAG 后端鉴权：通过 Next.js 代理调用登录、注册、刷新、个人资料等接口。
 * 包含 Token 过期检查、自动刷新和安全错误处理。
 */

export type RagUser = {
  ID: number;
  username: string;
  email: string;
  role: number;
  avatar: string;
  status: number;
  CreatedAt?: string;
  UpdatedAt?: string;
};

export type LoginResponse = {
  token: string;
  expire: string;
  user: RagUser;
};

export type RegisterResponse = {
  user_id: number;
};

const RAG_USER_KEY = "rag-user";
const RAG_TOKEN_KEY = "rag-token";
const RAG_TOKEN_EXPIRE_KEY = "rag-token-expire";

/** Token 刷新提前时间（毫秒）- 提前 5 分钟刷新 */
const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000;

/** 最大重试次数 */
const MAX_REFRESH_RETRIES = 3;

/**
 * 检查 Token 是否过期
 * @param expireTime 过期时间字符串或时间戳
 * @param threshold 提前多少毫秒视为过期（默认 5 分钟）
 * @returns 是否过期
 */
export function isTokenExpired(
  expireTime: string | number | null,
  threshold: number = TOKEN_REFRESH_THRESHOLD
): boolean {
  if (!expireTime) return true;

  try {
    let expireTimestamp: number;

    if (typeof expireTime === "string") {
      // 尝试解析 ISO 字符串或时间戳字符串
      const parsed = Date.parse(expireTime);
      if (isNaN(parsed)) {
        // 可能是 Unix 时间戳字符串
        expireTimestamp = parseInt(expireTime, 10) * 1000;
      } else {
        expireTimestamp = parsed;
      }
    } else {
      expireTimestamp = expireTime;
    }

    if (isNaN(expireTimestamp)) return true;

    return Date.now() >= expireTimestamp - threshold;
  } catch {
    return true;
  }
}

/**
 * 获取存储的 Token
 */
export function getStoredRagToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(RAG_TOKEN_KEY);
}

/**
 * 获取存储的 Token 过期时间
 */
export function getStoredTokenExpire(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(RAG_TOKEN_EXPIRE_KEY);
}

/**
 * 获取存储的用户信息
 */
export function getStoredRagUser(): RagUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(RAG_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RagUser;
  } catch {
    return null;
  }
}

/**
 * 存储认证信息
 */
export function setStoredRagAuth(token: string, user: RagUser, expire?: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(RAG_TOKEN_KEY, token);
  localStorage.setItem(RAG_USER_KEY, JSON.stringify(user));
  if (expire) {
    localStorage.setItem(RAG_TOKEN_EXPIRE_KEY, expire);
  }
}

/**
 * 清除存储的认证信息
 */
export function clearStoredRagAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(RAG_TOKEN_KEY);
  localStorage.removeItem(RAG_USER_KEY);
  localStorage.removeItem(RAG_TOKEN_EXPIRE_KEY);
}

/**
 * 尝试刷新 Token
 * @param baseURL API 基础 URL
 * @param retries 重试次数
 * @returns 新的登录响应或 null
 */
export async function tryRefreshToken(
  baseURL: string,
  retries: number = MAX_REFRESH_RETRIES
): Promise<LoginResponse | null> {
  const token = getStoredRagToken();
  if (!token) return null;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await ragRefresh(baseURL, token);
      setStoredRagAuth(res.token, res.user, res.expire);
      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("Refresh failed");
      
      // 如果是 401 错误，说明 Token 已完全失效，不需要重试
      if (lastError.message.includes("401") || lastError.message.includes("Unauthorized")) {
        clearStoredRagAuth();
        return null;
      }

      // 等待一段时间后重试
      if (attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  console.error("Token refresh failed after retries:", lastError?.message);
  return null;
}

/**
 * 检查并自动刷新 Token（如果需要）
 * @param baseURL API 基础 URL
 * @returns 是否成功（Token 有效或刷新成功）
 */
export async function ensureValidToken(baseURL: string): Promise<boolean> {
  const expire = getStoredTokenExpire();
  
  // 如果 Token 未过期，直接返回
  if (!isTokenExpired(expire)) {
    return true;
  }

  // 尝试刷新 Token
  const newAuth = await tryRefreshToken(baseURL);
  return newAuth !== null;
}

/**
 * 安全的错误处理 - 避免泄露敏感信息
 * @param error 原始错误
 * @returns 安全的错误消息
 */
function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // 不暴露内部错误详情
    const message = error.message.toLowerCase();
    
    // 网络错误
    if (message.includes("network") || message.includes("fetch")) {
      return "Network error. Please check your connection.";
    }
    
    // 超时错误
    if (message.includes("timeout")) {
      return "Request timed out. Please try again.";
    }
    
    // 认证错误
    if (message.includes("401") || message.includes("unauthorized")) {
      return "Authentication failed. Please log in again.";
    }
    
    // 权限错误
    if (message.includes("403") || message.includes("forbidden")) {
      return "You do not have permission to perform this action.";
    }
    
    // 服务器错误
    if (message.includes("500") || message.includes("server")) {
      return "Server error. Please try again later.";
    }
    
    // 其他错误返回通用消息
    return "An error occurred. Please try again.";
  }
  
  return "An unexpected error occurred.";
}

/**
 * 登录
 */
export async function ragLogin(
  baseURL: string,
  email: string,
  password: string
): Promise<LoginResponse> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseURL, email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error((data as { error?: string }).error ?? "Login failed");
    }
    return data as LoginResponse;
  } catch (error) {
    throw new Error(sanitizeErrorMessage(error));
  }
}

/**
 * 注册
 */
export async function ragRegister(
  baseURL: string,
  username: string,
  email: string,
  password: string
): Promise<RegisterResponse> {
  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseURL, username, email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error((data as { error?: string }).error ?? "Register failed");
    }
    return data as RegisterResponse;
  } catch (error) {
    throw new Error(sanitizeErrorMessage(error));
  }
}

/**
 * 刷新 Token
 */
export async function ragRefresh(baseURL: string, token: string): Promise<LoginResponse> {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ baseURL }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error((data as { error?: string }).error ?? "Refresh failed");
    }
    return data as LoginResponse;
  } catch (error) {
    throw new Error(sanitizeErrorMessage(error));
  }
}

/**
 * 获取用户资料（带自动刷新）
 */
export async function ragGetProfile(baseURL: string, token: string): Promise<{ user: RagUser }> {
  try {
    // 检查 Token 是否需要刷新
    const expire = getStoredTokenExpire();
    if (isTokenExpired(expire)) {
      const newAuth = await tryRefreshToken(baseURL);
      if (!newAuth) {
        throw new Error("Session expired. Please log in again.");
      }
    }

    const url = new URL("/api/user/profile", window.location.origin);
    url.searchParams.set("baseURL", baseURL);
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${getStoredRagToken() || token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error((data as { error?: string }).error ?? "Get profile failed");
    }
    return data as { user: RagUser };
  } catch (error) {
    throw new Error(sanitizeErrorMessage(error));
  }
}

/**
 * 更新用户资料（带自动刷新）
 */
export async function ragUpdateProfile(
  baseURL: string,
  token: string,
  patch: { username?: string; avatar?: string }
): Promise<{ user: RagUser }> {
  try {
    // 检查 Token 是否需要刷新
    const expire = getStoredTokenExpire();
    if (isTokenExpired(expire)) {
      const newAuth = await tryRefreshToken(baseURL);
      if (!newAuth) {
        throw new Error("Session expired. Please log in again.");
      }
    }

    const res = await fetch("/api/user/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getStoredRagToken() || token}`,
      },
      body: JSON.stringify({ baseURL, ...patch }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error((data as { error?: string }).error ?? "Update profile failed");
    }
    return data as { user: RagUser };
  } catch (error) {
    throw new Error(sanitizeErrorMessage(error));
  }
}

/**
 * 创建带认证的 fetch 请求（自动刷新 Token）
 */
export async function authFetch(
  baseURL: string,
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  // 检查 Token 是否需要刷新
  const expire = getStoredTokenExpire();
  if (isTokenExpired(expire)) {
    const newAuth = await tryRefreshToken(baseURL);
    if (!newAuth) {
      throw new Error("Session expired. Please log in again.");
    }
  }

  const token = getStoredRagToken();
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}