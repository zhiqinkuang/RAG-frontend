import { NextResponse } from "next/server";

/** 代理到 RAG 后端 POST /api/v1/auth/register */
export async function POST(req: Request) {
  try {
    const { baseURL, username, email, password } = (await req.json()) as {
      baseURL?: string;
      username?: string;
      email?: string;
      password?: string;
    };

    const base = baseURL?.replace(/\/$/, "");
    if (!base || !username || !email || !password) {
      return NextResponse.json(
        { error: "baseURL, username, email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const res = await fetch(`${base}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: (data as { message?: string }).message ?? "Register failed" },
        { status: res.status }
      );
    }

    const code = (data as { code?: number }).code;
    if (code !== 0) {
      return NextResponse.json(
        { error: (data as { message?: string }).message ?? "Register failed" },
        { status: 400 }
      );
    }

    return NextResponse.json((data as { data?: unknown }).data ?? {});
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
