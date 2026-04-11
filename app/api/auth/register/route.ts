import { NextResponse, type NextRequest } from "next/server";
import { getRagBackendUrl } from "@/lib/config";
import {
  validateEmail,
  validatePassword,
  validateUsername,
  sanitizeInput,
} from "@/lib/validation";

/** 请求体大小限制（字节）- 1MB */
const MAX_BODY_SIZE = 1024 * 1024;

/** 统一错误响应格式 */
function errorResponse(
  message: string,
  status: number = 400,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    { error: message, ...(extra ?? {}) },
    { status },
  );
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
function logRequest(
  action: string,
  info: { username?: string; email?: string; ip?: string; success: boolean },
) {
  const timestamp = new Date().toISOString();
  const maskedEmail = info.email
    ? info.email.replace(/(.{2}).*(@.*)/, "$1***$2")
    : "unknown";
  const maskedUsername = info.username
    ? `${info.username.substring(0, 2)}***`
    : "unknown";
  // 支持 IPv4 和 IPv6 地址脱敏
  const maskedIP = info.ip
    ? info.ip.includes(":")
      ? `${info.ip.split(":").slice(0, 2).join(":")}:...`
      : info.ip.replace(/(\d+\.\d+)\.\d+\.\d+/, "$1.***.***")
    : "unknown";
  console.log(
    `[${timestamp}] ${action}: username=${maskedUsername}, email=${maskedEmail}, ip=${maskedIP}, success=${info.success}`,
  );
}

/** 从后端 JSON 中提取可展示的错误文案（不含敏感信息） */
function readBackendErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  for (const key of ["message", "msg", "error", "detail"]) {
    const v = o[key];
    if (typeof v === "string" && v.length > 0 && v.length < 200 && !/[<>]/.test(v)) {
      return v;
    }
  }
  return null;
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

    const {
      baseURL: clientBaseURL,
      username,
      email,
      password,
    } = body as {
      baseURL?: string;
      username?: string;
      email?: string;
      password?: string;
    };

    // 验证必填字段
    if (!username || !email || !password) {
      return errorResponse("请填写完整的注册信息", 400);
    }

    // 获取后端 URL（优先服务端环境变量）
    const base = getRagBackendUrl(clientBaseURL);

    // 消毒输入
    const sanitizedUsername = sanitizeInput(username);
    const sanitizedEmail = sanitizeInput(email);

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

    const registerUrl = `${base}/api/v1/auth/register`;

    // 调用后端 API
    let res: Response;
    try {
      res = await fetch(registerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: sanitizedUsername,
          email: sanitizedEmail.toLowerCase(),
          password,
        }),
      });
    } catch (fetchError) {
      logRequest("REGISTER", {
        username: sanitizedUsername,
        email: sanitizedEmail,
        ip: clientIP,
        success: false,
      });
      // 网络连接错误
      const errMsg =
        fetchError instanceof Error ? fetchError.message.toLowerCase() : "";
      if (
        errMsg.includes("econnrefused") ||
        errMsg.includes("connection refused")
      ) {
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
      const backendHint = readBackendErrorMessage(data);
      const baseSource = process.env.RAG_API_URL
        ? "RAG_API_URL"
        : process.env.NEXT_PUBLIC_RAG_API_URL
          ? "NEXT_PUBLIC_RAG_API_URL"
          : "body.baseURL|default";
      console.log(
        `[REGISTER] backend HTTP ${res.status} base=${baseSource} → ${registerUrl}${backendHint ? ` — ${backendHint}` : ""}`,
      );
      logRequest("REGISTER", {
        username: sanitizedUsername,
        email: sanitizedEmail,
        ip: clientIP,
        success: false,
      });
      if (res.status === 409) {
        return errorResponse("用户名或邮箱已被注册", 409);
      }
      if (res.status === 429) {
        return errorResponse("注册请求过于频繁，请稍后重试", 429);
      }
      if (res.status === 404) {
        return errorResponse(
          "后端对该地址返回 404（无注册路由）。请核对：1) 下方 attemptedUrl 是否与你用 curl 测试的地址一致；2) 若部署时设置了 RAG_API_URL，它优先于页面里的 Base URL，需指向已实现 POST /api/v1/auth/register 的实例。",
          502,
          { attemptedUrl: registerUrl },
        );
      }
      if (res.status >= 500) {
        return errorResponse("服务器错误，请稍后重试", 500);
      }
      if (backendHint) {
        return errorResponse(backendHint, 400);
      }
      return errorResponse(
        `注册失败（后端返回 ${res.status}），请检查邮箱/用户名是否已存在或联系管理员`,
        400,
      );
    }

    const raw = data as {
      code?: number;
      data?: unknown;
      [key: string]: unknown;
    };
    // 仅当后端显式返回 code 时才校验；缺省 code 时视为成功（兼容仅 HTTP 状态 + 裸 JSON 的 API）
    if (typeof raw.code === "number" && raw.code !== 0) {
      logRequest("REGISTER", {
        username: sanitizedUsername,
        email: sanitizedEmail,
        ip: clientIP,
        success: false,
      });
      return errorResponse("注册失败，请稍后重试", 400);
    }

    logRequest("REGISTER", {
      username: sanitizedUsername,
      email: sanitizedEmail,
      ip: clientIP,
      success: true,
    });
    // 优先 data；否则若带 code 信封则去掉 code 后返回其余字段（如 { code:0, user_id }）
    let payload: object;
    if (raw.data !== undefined && raw.data !== null) {
      payload = raw.data as object;
    } else if (typeof raw.code === "number") {
      const { code: _c, ...rest } = raw;
      payload = rest as object;
    } else {
      payload = (data ?? {}) as object;
    }
    return NextResponse.json(payload);
  } catch (e) {
    // 不暴露内部错误详情
    console.error(
      "Register error:",
      e instanceof Error ? e.message : "Unknown error",
    );
    return errorResponse("服务器错误，请稍后重试", 500);
  }
}
