import { NextResponse } from "next/server";
import { validateEmail, validatePassword, validateUsername, validateURL, sanitizeInput } from "@/lib/validation";

/** 请求体大小限制（字节）- 1MB */
const MAX_BODY_SIZE = 1024 * 1024;

/** 统一错误响应格式 */
function errorResponse(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** 安全日志（不含敏感信息） */
function logRequest(action: string, info: { username?: string; email?: string; success: boolean }) {
  const timestamp = new Date().toISOString();
  const maskedEmail = info.email ? info.email.replace(/(.{2}).*(@.*)/, "$1***$2") : "unknown";
  const maskedUsername = info.username ? info.username.substring(0, 2) + "***" : "unknown";
  console.log(`[${timestamp}] ${action}: username=${maskedUsername}, email=${maskedEmail}, success=${info.success}`);
}

/** 代理到 RAG 后端 POST /api/v1/auth/register */
export async function POST(req: Request) {
  try {
    // 检查请求体大小
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return errorResponse("Request body too large", 413);
    }

    // 解析请求体
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    const { baseURL, username, email, password } = body as {
      baseURL?: string;
      username?: string;
      email?: string;
      password?: string;
    };

    // 验证必填字段
    if (!baseURL || !username || !email || !password) {
      return errorResponse("All fields are required", 400);
    }

    // 消毒输入
    const sanitizedBaseURL = sanitizeInput(baseURL);
    const sanitizedUsername = sanitizeInput(username);
    const sanitizedEmail = sanitizeInput(email);

    // 验证 Base URL
    const baseURLResult = validateURL(sanitizedBaseURL, { allowLocalhost: true });
    if (!baseURLResult.valid) {
      return errorResponse("Invalid base URL", 400);
    }

    // 验证用户名
    const usernameResult = validateUsername(sanitizedUsername);
    if (!usernameResult.valid) {
      return errorResponse(usernameResult.error || "Invalid username", 400);
    }

    // 验证邮箱格式
    const emailResult = validateEmail(sanitizedEmail);
    if (!emailResult.valid) {
      return errorResponse(emailResult.error || "Invalid email format", 400);
    }

    // 验证密码强度
    const passwordResult = validatePassword(password);
    if (!passwordResult.valid) {
      return errorResponse(passwordResult.errors[0] || "Password does not meet requirements", 400);
    }

    const base = sanitizedBaseURL.replace(/\/$/, "");

    // 调用后端 API
    const res = await fetch(`${base}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        username: sanitizedUsername, 
        email: sanitizedEmail.toLowerCase(), 
        password 
      }),
    });

    const data = await res.json().catch(() => ({}));
    
    if (!res.ok) {
      logRequest("REGISTER", { username: sanitizedUsername, email: sanitizedEmail, success: false });
      // 不暴露后端错误详情
      return errorResponse("Registration failed. Please try again.", res.status === 500 ? 400 : res.status);
    }

    const code = (data as { code?: number }).code;
    if (code !== 0) {
      logRequest("REGISTER", { username: sanitizedUsername, email: sanitizedEmail, success: false });
      return errorResponse("Registration failed. Please try again.", 400);
    }

    logRequest("REGISTER", { username: sanitizedUsername, email: sanitizedEmail, success: true });
    return NextResponse.json((data as { data?: unknown }).data ?? {});
  } catch (e) {
    // 不暴露内部错误详情
    console.error("Register error:", e instanceof Error ? e.message : "Unknown error");
    return errorResponse("An error occurred. Please try again later.", 500);
  }
}