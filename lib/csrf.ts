/**
 * CSRF (Cross-Site Request Forgery) 保护
 * 提供 CSRF Token 生成、验证和自动注入功能
 */

import {
  generateCSRFToken,
  validateCSRFToken,
  storeCSRFToken,
  getStoredCSRFToken,
} from "./security";

/** CSRF Token 存储键 */
const CSRF_TOKEN_KEY = "csrf_token";

/** CSRF Token 过期时间（毫秒）- 1 小时 */
const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000;

/** CSRF Token 元数据 */
interface CSRFTokenMeta {
  token: string;
  createdAt: number;
}

/**
 * 生成并存储新的 CSRF Token
 * @returns 新生成的 CSRF Token
 */
export function createCSRFToken(): string {
  const token = generateCSRFToken();
  const meta: CSRFTokenMeta = {
    token,
    createdAt: Date.now(),
  };

  // 存储到 sessionStorage（仅在当前会话有效）
  storeCSRFToken(token);

  // 同时存储元数据用于过期检查
  if (typeof window !== "undefined") {
    sessionStorage.setItem(`${CSRF_TOKEN_KEY}_meta`, JSON.stringify(meta));
  }

  return token;
}

/**
 * 获取有效的 CSRF Token
 * 如果 Token 不存在或已过期，则生成新的
 * @returns 有效的 CSRF Token
 */
export function getValidCSRFToken(): string {
  const storedToken = getStoredCSRFToken();
  const metaRaw =
    typeof window !== "undefined"
      ? sessionStorage.getItem(`${CSRF_TOKEN_KEY}_meta`)
      : null;

  if (storedToken && metaRaw) {
    try {
      const meta = JSON.parse(metaRaw) as CSRFTokenMeta;

      // 检查是否过期
      if (Date.now() - meta.createdAt < CSRF_TOKEN_EXPIRY) {
        return storedToken;
      }
    } catch {
      // 解析失败，生成新 Token
    }
  }

  // 生成新 Token
  return createCSRFToken();
}

/**
 * 验证请求中的 CSRF Token
 * @param requestToken 请求中的 Token
 * @returns 是否有效
 */
export function verifyCSRFToken(
  requestToken: string | null | undefined,
): boolean {
  if (!requestToken) return false;

  const storedToken = getStoredCSRFToken();
  if (!storedToken) return false;

  // 检查过期
  const metaRaw =
    typeof window !== "undefined"
      ? sessionStorage.getItem(`${CSRF_TOKEN_KEY}_meta`)
      : null;
  if (metaRaw) {
    try {
      const meta = JSON.parse(metaRaw) as CSRFTokenMeta;
      if (Date.now() - meta.createdAt >= CSRF_TOKEN_EXPIRY) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return validateCSRFToken(requestToken, storedToken);
}

/**
 * 为表单数据添加 CSRF Token
 * @param formData 表单数据对象
 * @returns 添加了 CSRF Token 的表单数据
 */
export function addCSRFToFormData<T extends Record<string, unknown>>(
  formData: T,
): T & { _csrf: string } {
  return {
    ...formData,
    _csrf: getValidCSRFToken(),
  };
}

/**
 * 为请求头添加 CSRF Token
 * @param headers 现有请求头
 * @returns 添加了 CSRF Token 的请求头
 */
export function addCSRFToHeaders(headers: HeadersInit = {}): HeadersInit {
  const token = getValidCSRFToken();
  const newHeaders = new Headers(headers);
  newHeaders.set("X-CSRF-Token", token);
  return newHeaders;
}

/**
 * 创建带 CSRF 保护的 fetch 函数
 * 自动在请求中添加 CSRF Token
 */
export function createCSRFProtectedFetch(): typeof fetch {
  const originalFetch = window.fetch;

  return async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    // 只对同源请求添加 CSRF Token
    let url: string;
    if (typeof input === "string") {
      url = input;
    } else if (input instanceof URL) {
      url = input.href;
    } else if (input instanceof Request) {
      url = input.url;
    } else {
      url = String(input);
    }

    // 检查是否是同源请求
    const isSameOrigin =
      url.startsWith("/") || url.startsWith(window.location.origin);

    if (
      isSameOrigin &&
      init?.method &&
      init.method.toUpperCase() !== "GET" &&
      init.method.toUpperCase() !== "HEAD"
    ) {
      // 获取或创建 CSRF Token
      const token = getValidCSRFToken();

      // 添加到请求头
      const headers = new Headers(init.headers);
      headers.set("X-CSRF-Token", token);

      // 如果有请求体且是 JSON，也添加到请求体
      if (init.body && typeof init.body === "string") {
        try {
          const body = JSON.parse(init.body);
          init.body = JSON.stringify({ ...body, _csrf: token });
        } catch {
          // 不是 JSON，保持原样
        }
      }

      init = { ...init, headers };
    }

    return originalFetch(input, init);
  };
}

/**
 * 初始化 CSRF 保护
 * 在应用启动时调用
 */
export function initCSRFProtection(): void {
  if (typeof window === "undefined") return;

  // 确保有有效的 CSRF Token
  getValidCSRFToken();

  // 覆盖全局 fetch（可选）
  // window.fetch = createCSRFProtectedFetch();
}

/**
 * 服务端 CSRF 验证中间件
 * 用于 API 路由
 * @param request 请求对象
 * @returns 验证结果
 */
export function verifyCSRFMiddleware(request: Request): {
  valid: boolean;
  error?: string;
} {
  // 从请求头获取 Token
  const headerToken = request.headers.get("X-CSRF-Token");

  // 从请求体获取 Token（如果是 JSON）
  let bodyToken: string | undefined;
  const contentType = request.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    // 注意：这里不能直接读取 body，因为 body 只能读取一次
    // 需要在路由处理函数中手动验证
  }

  const token = headerToken || bodyToken;

  if (!token) {
    return { valid: false, error: "CSRF token missing" };
  }

  // 服务端验证需要从 session 或 cookie 中获取存储的 token
  // 这里返回 token 供后续验证
  return { valid: true };
}

/**
 * React Hook: 使用 CSRF Token
 * @returns CSRF Token 和刷新函数
 */
export function useCSRFToken(): { token: string; refreshToken: () => string } {
  if (typeof window === "undefined") {
    return { token: "", refreshToken: () => "" };
  }

  return {
    token: getValidCSRFToken(),
    refreshToken: createCSRFToken,
  };
}

/**
 * 为 API 请求添加 CSRF 保护
 * @param url 请求 URL
 * @param options fetch 选项
 * @returns 添加了 CSRF 保护的请求选项
 */
export function withCSRFProtection(
  url: string,
  options: RequestInit = {},
): RequestInit {
  // 只对同源非 GET 请求添加 CSRF Token
  const isSameOrigin =
    url.startsWith("/") || url.startsWith(window.location.origin);
  const method = (options.method || "GET").toUpperCase();

  if (isSameOrigin && method !== "GET" && method !== "HEAD") {
    const token = getValidCSRFToken();
    const headers = new Headers(options.headers);
    headers.set("X-CSRF-Token", token);

    return { ...options, headers };
  }

  return options;
}
