import { NextResponse } from "next/server";

function getBaseAndAuth(req: Request): { base: string; auth: string } | null {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const url = new URL(req.url);
  const base = url.searchParams.get("baseURL")?.replace(/\/$/, "");
  if (!base) return null;
  return { base, auth };
}

/** 代理到 RAG 后端 GET /api/v1/user/profile */
export async function GET(req: Request) {
  try {
    const ctx = getBaseAndAuth(req);
    if (!ctx) {
      return NextResponse.json(
        { error: "baseURL (query) and Authorization header are required" },
        { status: 400 }
      );
    }

    const res = await fetch(`${ctx.base}/api/v1/user/profile`, {
      method: "GET",
      headers: { Authorization: ctx.auth },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: (data as { message?: string }).message ?? "Request failed" },
        { status: res.status }
      );
    }

    const code = (data as { code?: number }).code;
    const payload = (data as { data?: unknown }).data;
    if (code !== 0) {
      return NextResponse.json(
        { error: (data as { message?: string }).message ?? "Request failed" },
        { status: 400 }
      );
    }

    return NextResponse.json(payload ?? {});
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** 代理到 RAG 后端 PUT /api/v1/user/profile */
export async function PUT(req: Request) {
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authorization header is required" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { baseURL, ...profile } = body as {
      baseURL?: string;
      username?: string;
      avatar?: string;
    };
    const base = baseURL?.replace(/\/$/, "");
    if (!base) {
      return NextResponse.json(
        { error: "baseURL is required" },
        { status: 400 }
      );
    }

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
        { error: (data as { message?: string }).message ?? "Update failed" },
        { status: res.status }
      );
    }

    const code = (data as { code?: number }).code;
    const payload = (data as { data?: unknown }).data;
    if (code !== 0) {
      return NextResponse.json(
        { error: (data as { message?: string }).message ?? "Update failed" },
        { status: 400 }
      );
    }

    return NextResponse.json(payload ?? {});
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
