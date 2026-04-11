import { NextRequest, NextResponse } from "next/server";
import { getRagBackendUrl } from "@/lib/config";

const PREVIEWABLE_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/html",
  "text/markdown",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

function isPreviewable(contentType: string): boolean {
  const base = contentType.split(";")[0].trim().toLowerCase();
  return PREVIEWABLE_TYPES.has(base) || base.startsWith("text/");
}

export async function GET(req: NextRequest) {
  const docId = req.nextUrl.searchParams.get("docId");
  const token = req.nextUrl.searchParams.get("token");

  if (!docId || !token) {
    return NextResponse.json({ error: "缺少 docId 或 token" }, { status: 400 });
  }

  const backendUrl = `${getRagBackendUrl()}/api/v1/documents/${docId}/download`;

  try {
    const res = await fetch(backendUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `后端返回 ${res.status}` },
        { status: res.status },
      );
    }

    const contentType =
      res.headers.get("content-type") || "application/octet-stream";
    const baseType = contentType.split(";")[0].trim().toLowerCase();

    // 后端即使 HTTP 200 也可能返回 JSON 错误（如 { code: 30002 }）
    if (baseType === "application/json") {
      const text = await res.text();
      try {
        const json = JSON.parse(text) as { code?: number; message?: string };
        if (typeof json.code === "number" && json.code !== 0) {
          const status = json.code === 10002 ? 401 : 404;
          return NextResponse.json(
            { error: json.message || "文档获取失败" },
            { status },
          );
        }
      } catch {
        // 不是有效 JSON，当文件内容处理
      }
      return new NextResponse(text, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": "inline",
        },
      });
    }

    const body = res.body;
    if (!body) {
      return NextResponse.json({ error: "后端响应为空" }, { status: 502 });
    }

    const disposition = res.headers.get("content-disposition") || "inline";

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Disposition": disposition,
      "Cache-Control": "private, max-age=300",
    };

    if (!isPreviewable(contentType)) {
      headers["X-Preview-Unsupported"] = "true";
    }

    return new NextResponse(body as ReadableStream, { status: 200, headers });
  } catch (err) {
    console.error("Preview proxy error:", err);
    return NextResponse.json({ error: "无法连接后端" }, { status: 502 });
  }
}
