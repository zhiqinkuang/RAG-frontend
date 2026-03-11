import { NextResponse } from "next/server";

/** 代理到 RAG 后端 POST /api/v1/auth/refresh，请求头带 Authorization */
export async function POST(req: Request) {
  try {
    const { baseURL } = (await req.json()) as { baseURL?: string };
    const auth = req.headers.get("Authorization");

    const base = baseURL?.replace(/\/$/, "");
    if (!base || !auth?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "baseURL and Authorization header are required" },
        { status: 400 }
      );
    }

    const res = await fetch(`${base}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: (data as { message?: string }).message ?? "Refresh failed" },
        { status: res.status }
      );
    }

    const code = (data as { code?: number }).code;
    const payload = (data as { data?: unknown }).data;
    if (code !== 0 || !payload) {
      return NextResponse.json(
        { error: (data as { message?: string }).message ?? "Refresh failed" },
        { status: 400 }
      );
    }

    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
