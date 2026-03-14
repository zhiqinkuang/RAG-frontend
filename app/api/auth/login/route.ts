import { NextResponse } from "next/server";
import { validateEmail, validatePassword, validateURL, sanitizeInput } from "@/lib/validation";

/** 请求体大小限制（字节）- 1MB */
const MAX_BODY_SIZE = 1024 * 1024;

/** 统一错误响应格式 */
function errorResponse(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** 安全日志（不含敏感信息） */
function logRequest(action: string, info: { email?: string; ip?: string; success: boolean }) {
  const timestamp = new Date().toISOString();
  const maskedEmail = info.email ? info.email.replace(/(.{2}).*(@.*)/, "$1***$2") : "unknown";
  console.log(`[${timestamp}] ${action}: email=${maskedEmail}, success=${info.success}`);
}

/** 代理到 RAG 后端 POST /api/v1/auth/login */
export async function POST(req: Request) {
  try {
    // 检查请求体大小
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return errorResponse("请求数据过大", 413);
    }

    // 解析请求体
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse("请求数据格式错误", 400);
    }

    const { baseURL, email, password } = body as {
      baseURL?: string;
      email?: string;
      password?: string;
    };

    // 验证必填字段
    if (!baseURL || !email || !password) {
      return errorResponse("请填写完整的登录信息", 400);
    }

    // 消毒输入
    const sanitizedBaseURL = sanitizeInput(baseURL);
    const sanitizedEmail = sanitizeInput(email);

    // 验证 Base URL
    const baseURLResult = validateURL(sanitizedBaseURL, { allowLocalhost: true });
    if (!baseURLResult.valid) {
      return errorResponse("服务器地址格式错误", 400);
    }

    // 验证邮箱格式
    const emailResult = validateEmail(sanitizedEmail);
    if (!emailResult.valid) {
      return errorResponse(emailResult.error || "邮箱格式错误", 400);
    }

    // 验证密码非空（不记录密码）
    if (typeof password !== "string" || password.length === 0) {
      return errorResponse("请输入密码", 400);
    }

    const base = sanitizedBaseURL.replace(/\/$/, "");

    // 调用后端 API
    let res: Response;
    try {
      res = await fetch(`${base}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: sanitizedEmail.toLowerCase(), password }),
      });
    } catch (fetchError) {
      logRequest("LOGIN", { email: sanitizedEmail, success: false });
      // 网络连接错误
      const errMsg = fetchError instanceof Error ? fetchError.message.toLowerCase() : "";
      if (errMsg.includes("econnrefused") || errMsg.includes("connection refused")) {
        return errorResponse("无法连接到服务器，请检查服务是否启动", 503);
      }
      if (errMsg.includes("enotfound") || errMsg.includes("dns")) {
        return errorResponse("无法解析服务器地址，请检查网络配置", 503);
      }
      if (errMsg.includes("timeout")) {
        return errorResponse("连接超时，请稍后重试", 504);
      }
      return errorResponse("网络连接失败，请检查网络设置", 503);
    }

    const data = await res.json().catch(() => ({}));
    
    if (!res.ok) {
      logRequest("LOGIN", { email: sanitizedEmail, success: false });
      // 根据状态码返回具体的中文错误
      if (res.status === 401) {
        return errorResponse("用户名或密码错误", 401);
      }
      if (res.status === 403) {
        return errorResponse("账号已被禁用", 403);
      }
      if (res.status === 429) {
        return errorResponse("登录尝试过于频繁，请稍后重试", 429);
      }
      if (res.status >= 500) {
        return errorResponse("服务器错误，请稍后重试", 500);
      }
      return errorResponse("用户名或密码错误", 400);
    }

    const code = (data as { code?: number }).code;
    const payload = (data as { data?: unknown }).data;
    if (code !== 0 || !payload) {
      logRequest("LOGIN", { email: sanitizedEmail, success: false });
      return errorResponse("用户名或密码错误", 400);
    }

    logRequest("LOGIN", { email: sanitizedEmail, success: true });
    return NextResponse.json(payload);
  } catch (e) {
    // 不暴露内部错误详情
    console.error("Login error:", e instanceof Error ? e.message : "Unknown error");
    return errorResponse("服务器错误，请稍后重试", 500);
  }
}