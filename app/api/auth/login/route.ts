import { NextResponse } from "next/server";

/** 代理到 RAG 后端 POST /api/v1/auth/login */
export async function POST(req: Request) {
  try {
    const { baseURL, email, password } = (await req.json()) as {
      baseURL?: string;
      email?: string;
      password?: string;
    };

    const base = baseURL?.replace(/\/$/, "");
    if (!base || !email || !password) {
      return NextResponse.json(
        { error: "baseURL, email and password are required" },
        { status: 400 }
      );
    }

    const res = await fetch(`${base}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: (data as { message?: string }).message ?? "Login failed" },
        { status: res.status }
      );
    }

    const code = (data as { code?: number }).code;
    const payload = (data as { data?: unknown }).data;
    if (code !== 0 || !payload) {
      return NextResponse.json(
        { error: (data as { message?: string }).message ?? "Login failed" },
        { status: 400 }
      );
    }

    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
