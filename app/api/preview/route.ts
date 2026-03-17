import { NextRequest, NextResponse } from "next/server";

const RAG_BACKEND_URL = process.env.RAG_BACKEND_URL || "http://127.0.0.1:8080";

export async function GET(req: NextRequest) {
  const docId = req.nextUrl.searchParams.get("docId");
  const token = req.nextUrl.searchParams.get("token");

  if (!docId || !token) {
    return NextResponse.json({ error: "缺少 docId 或 token" }, { status: 400 });
  }

  const backendUrl = `${RAG_BACKEND_URL}/api/v1/documents/${docId}/download?token=${token}`;

  try {
    const res = await fetch(backendUrl);
    if (!res.ok) {
      return NextResponse.json(
        { error: `后端返回 ${res.status}` },
        { status: res.status },
      );
    }

    const contentType =
      res.headers.get("content-type") || "application/octet-stream";
    const body = res.body;
    if (!body) {
      return NextResponse.json({ error: "后端响应为空" }, { status: 502 });
    }

    return new NextResponse(body as ReadableStream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    console.error("Preview proxy error:", err);
    return NextResponse.json({ error: "无法连接后端" }, { status: 502 });
  }
}
