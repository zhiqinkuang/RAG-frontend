import { NextResponse } from "next/server";

/** 获取 RAG 后端 URL（优先服务端环境变量） */
function getRagBackendUrl(clientBaseURL?: string): string {
  // 优先使用服务端环境变量（生产部署）
  if (process.env.RAG_API_URL) {
    return process.env.RAG_API_URL.replace(/\/$/, "");
  }
  // 其次使用客户端传入的 baseURL（本地开发）
  if (clientBaseURL) {
    return clientBaseURL.replace(/\/$/, "");
  }
  // 默认本地开发地址
  return "http://127.0.0.1:8080";
}

/** 代理到 RAG 后端 POST /api/v1/auth/refresh，请求头带 Authorization */
export async function POST(req: Request) {
  try {
    const { baseURL: clientBaseURL } = (await req.json()) as { baseURL?: string };
    const auth = req.headers.get("Authorization");

    const base = getRagBackendUrl(clientBaseURL);
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "缺少必要参数" },
        { status: 400 }
      );
    }

    let res: Response;
    try {
      res = await fetch(`${base}/api/v1/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: auth,
        },
      });
    } catch (fetchError) {
      // 网络连接错误
      const errMsg = fetchError instanceof Error ? fetchError.message.toLowerCase() : "";
      if (errMsg.includes("econnrefused") || errMsg.includes("connection refused")) {
        return NextResponse.json({ error: "无法连接到服务器，请检查服务是否启动" }, { status: 503 });
      }
      if (errMsg.includes("enotfound") || errMsg.includes("dns")) {
        return NextResponse.json({ error: "无法解析服务器地址，请检查网络配置" }, { status: 503 });
      }
      if (errMsg.includes("timeout")) {
        return NextResponse.json({ error: "连接超时，请稍后重试" }, { status: 504 });
      }
      return NextResponse.json({ error: "网络连接失败，请检查网络设置" }, { status: 503 });
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) {
        return NextResponse.json({ error: "登录已过期，请重新登录" }, { status: 401 });
      }
      if (res.status >= 500) {
        return NextResponse.json({ error: "服务器错误，请稍后重试" }, { status: 500 });
      }
      return NextResponse.json({ error: "刷新令牌失败，请重新登录" }, { status: res.status });
    }

    const code = (data as { code?: number }).code;
    const payload = (data as { data?: unknown }).data;
    if (code !== 0 || !payload) {
      return NextResponse.json({ error: "刷新令牌失败，请重新登录" }, { status: 400 });
    }

    return NextResponse.json(payload);
  } catch (e) {
    console.error("Refresh error:", e instanceof Error ? e.message : "Unknown error");
    return NextResponse.json({ error: "服务器错误，请稍后重试" }, { status: 500 });
  }
}
