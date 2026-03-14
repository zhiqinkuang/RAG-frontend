import { NextResponse, type NextRequest } from "next/server";
import { validateEmail, validatePassword, validateUsername, validateURL, sanitizeInput } from "@/lib/validation";

/** 请求体大小限制（字节）- 1MB */
const MAX_BODY_SIZE = 1024 * 1024;

/** 统一错误响应格式 */
function errorResponse(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * 从请求中提取客户端 IP 地址
 * 优先使用 x-forwarded-for 头（代理场景），其次使用 x-real-ip
 */
function getClientIP(req: NextRequest): string {
  // x-forwarded-for 可能包含多个 IP，取第一个（原始客户端 IP）
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  
  // 备选：x-real-ip 头
  const realIP = req.headers.get("x-real-ip");
  if (realIP) {
    return realIP.trim();
  }
  
  // Next.js 提供的 ip 属性（需要配置 trustHostHeader）
  const ip = (req as NextRequest & { ip?: string }).ip;
  if (ip) {
    return ip;
  }
  
  return "unknown";
}

/** 安全日志（不含敏感信息） */
function logRequest(action: string, info: { username?: string; email?: string; ip?: string; success: boolean }) {
  const timestamp = new Date().toISOString();
  const maskedEmail = info.email ? info.email.replace(/(.{2}).*(@.*)/, "$1***$2") : "unknown";
  const maskedUsername = info.username ? info.username.substring(0, 2) + "***" : "unknown";
  const maskedIP = info.ip ? info.ip.replace(/(\d+\.\d+)\.\d+\.\d+/, "$1.***.***") : "unknown";
  console.log(`[${timestamp}] ${action}: username=${maskedUsername}, email=${maskedEmail}, ip=${maskedIP}, success=${info.success}`);
}

/** 代理到 RAG 后端 POST /api/v1/auth/register */
export async function POST(req: NextRequest) {
  // 获取客户端 IP
  const clientIP = getClientIP(req);
  
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

    const { baseURL, username, email, password } = body as {
      baseURL?: string;
      username?: string;
      email?: string;
      password?: string;
    };

    // 验证必填字段
    if (!baseURL || !username || !email || !password) {
      return errorResponse("请填写完整的注册信息", 400);
    }

    // 消毒输入
    const sanitizedBaseURL = sanitizeInput(baseURL);
    const sanitizedUsername = sanitizeInput(username);
    const sanitizedEmail = sanitizeInput(email);

    // 验证 Base URL
    const baseURLResult = validateURL(sanitizedBaseURL, { allowLocalhost: true });
    if (!baseURLResult.valid) {
      return errorResponse("服务器地址格式错误", 400);
    }

    // 验证用户名
    const usernameResult = validateUsername(sanitizedUsername);
    if (!usernameResult.valid) {
      return errorResponse(usernameResult.error || "用户名格式错误", 400);
    }

    // 验证邮箱格式
    const emailResult = validateEmail(sanitizedEmail);
    if (!emailResult.valid) {
      return errorResponse(emailResult.error || "邮箱格式错误", 400);
    }

    // 验证密码强度
    const passwordResult = validatePassword(password);
    if (!passwordResult.valid) {
      return errorResponse(passwordResult.errors[0] || "密码不符合要求", 400);
    }

    const base = sanitizedBaseURL.replace(/\/$/, "");

    // 调用后端 API
    let res: Response;
    try {
      res = await fetch(`${base}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          username: sanitizedUsername, 
          email: sanitizedEmail.toLowerCase(), 
          password 
        }),
      });
    } catch (fetchError) {
      logRequest("REGISTER", { username: sanitizedUsername, email: sanitizedEmail, ip: clientIP, success: false });
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
      logRequest("REGISTER", { username: sanitizedUsername, email: sanitizedEmail, ip: clientIP, success: false });
      // 根据状态码返回具体的中文错误
      if (res.status === 409) {
        return errorResponse("用户名或邮箱已被注册", 409);
      }
      if (res.status === 429) {
        return errorResponse("注册请求过于频繁，请稍后重试", 429);
      }
      if (res.status >= 500) {
        return errorResponse("服务器错误，请稍后重试", 500);
      }
      return errorResponse("注册失败，请检查信息后重试", 400);
    }

    const code = (data as { code?: number }).code;
    if (code !== 0) {
      logRequest("REGISTER", { username: sanitizedUsername, email: sanitizedEmail, ip: clientIP, success: false });
      return errorResponse("注册失败，请稍后重试", 400);
    }

    logRequest("REGISTER", { username: sanitizedUsername, email: sanitizedEmail, ip: clientIP, success: true });
    return NextResponse.json((data as { data?: unknown }).data ?? {});
  } catch (e) {
    // 不暴露内部错误详情
    console.error("Register error:", e instanceof Error ? e.message : "Unknown error");
    return errorResponse("服务器错误，请稍后重试", 500);
  }
}