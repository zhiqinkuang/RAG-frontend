import { NextResponse } from "next/server";
import { getRagBackendUrl } from "@/lib/config";

function getAuth(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth;
}

/** 代理到 RAG 后端 GET /api/v1/user/profile */
export async function GET(req: Request) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json(
        { error: "缺少 Authorization 请求头" },
        { status: 400 },
      );
    }

    const url = new URL(req.url);
    const clientBaseURL = url.searchParams.get("baseURL") ?? undefined;
    const base = getRagBackendUrl(clientBaseURL);

    const res = await fetch(`${base}/api/v1/user/profile`, {
      method: "GET",
      headers: { Authorization: auth },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: (data as { message?: string }).message ?? "请求失败" },
        { status: res.status },
      );
    }

    const code = (data as { code?: number }).code;
    const payload = (data as { data?: unknown }).data;
    if (code !== 0) {
      return NextResponse.json(
        { error: (data as { message?: string }).message ?? "请求失败" },
        { status: 400 },
      );
    }

    return NextResponse.json(payload ?? {});
  } catch (e) {
    const message = e instanceof Error ? e.message : "服务器错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** 代理到 RAG 后端 PUT /api/v1/user/profile */
export async function PUT(req: Request) {
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "缺少 Authorization 请求头" },
        { status: 400 },
      );
    }

    const body = await req.json();
    const { baseURL: clientBaseURL, ...profile } = body as {
      baseURL?: string;
      username?: string;
      avatar?: string;
    };
    const base = getRagBackendUrl(clientBaseURL);

    const res = await fetch(`${base}/api/v1/user/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
      },
      body: JSON.stringify(profile),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: (data as { message?: string }).message ?? "更新失败" },
        { status: res.status },
      );
    }

    const code = (data as { code?: number }).code;
    const payload = (data as { data?: unknown }).data;
    if (code !== 0) {
      return NextResponse.json(
        { error: (data as { message?: string }).message ?? "更新失败" },
        { status: 400 },
      );
    }

    return NextResponse.json(payload ?? {});
  } catch (e) {
    const message = e instanceof Error ? e.message : "服务器错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
