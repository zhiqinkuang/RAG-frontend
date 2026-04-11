"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Download,
  ZoomIn,
  ZoomOut,
  AlertCircle,
  Loader2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStoredRagToken } from "@/lib/rag-auth";

const PREVIEWABLE_EXTENSIONS = new Set([
  ".pdf",
  ".txt",
  ".md",
  ".csv",
  ".html",
  ".htm",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
]);

function getExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

function PreviewContent() {
  const searchParams = useSearchParams();
  const docId = searchParams.get("docId");
  const fileName = searchParams.get("name") || "文档预览";

  const [scale, setScale] = useState(100);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);

  const ext = getExtension(fileName);
  const canPreviewByExt = PREVIEWABLE_EXTENSIONS.has(ext);

  useEffect(() => {
    if (!docId) {
      setError("缺少文档参数");
      return;
    }

    const token = getStoredRagToken();
    if (!token) {
      setError("未找到认证令牌，请重新登录");
      return;
    }

    if (!canPreviewByExt) {
      setUnsupported(true);
      setIsLoading(false);
      return;
    }

    const proxyUrl = `/api/preview?docId=${encodeURIComponent(docId)}&token=${encodeURIComponent(token)}`;
    setError(null);
    setIsLoading(true);
    setIframeSrc(proxyUrl);

    const timeout = setTimeout(() => {
      setIsLoading((prev) => {
        if (prev) setError("加载超时，请检查网络或稍后重试");
        return false;
      });
    }, 30000);
    return () => clearTimeout(timeout);
  }, [docId, canPreviewByExt]);

  if (!docId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">缺少文档参数</p>
      </div>
    );
  }

  const token = getStoredRagToken() || "";
  const downloadUrl = `/api/preview?docId=${encodeURIComponent(docId)}&token=${encodeURIComponent(token)}`;
  const handleZoomIn = () => setScale((s) => Math.min(s + 10, 200));
  const handleZoomOut = () => setScale((s) => Math.max(s - 10, 50));

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="font-medium text-lg">{error}</p>
        <p className="text-muted-foreground text-sm">文档 ID: {docId}</p>
        <Button variant="outline" onClick={() => window.close()}>
          关闭
        </Button>
      </div>
    );
  }

  if (unsupported) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <FileText className="h-16 w-16 text-muted-foreground" />
        <p className="font-medium text-lg">{fileName}</p>
        <p className="text-muted-foreground text-sm">
          该文件类型（{ext || "未知"}）不支持在线预览，请下载后查看
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => window.close()}>
            关闭
          </Button>
          <Button asChild>
            <a href={downloadUrl} download={fileName}>
              <Download className="mr-1 h-4 w-4" />
              下载文件
            </a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <div className="flex shrink-0 items-center justify-between border-b bg-background px-4 py-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => window.close()}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            关闭
          </Button>
          <span
            className="max-w-[300px] truncate font-medium text-sm"
            title={fileName}
          >
            {fileName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-12 text-center text-sm">{scale}%</span>
          <Button variant="outline" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={downloadUrl} download={fileName}>
              <Download className="mr-1 h-4 w-4" />
              下载
            </a>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="relative flex justify-center">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/50">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {iframeSrc && (
            <iframe
              key={iframeSrc}
              src={iframeSrc}
              className="rounded-lg bg-white shadow-lg"
              style={{
                width: `${scale}%`,
                height: "calc(100vh - 120px)",
                minHeight: "600px",
              }}
              title={fileName}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setError("文档加载失败");
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function PreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground">加载中...</p>
        </div>
      }
    >
      <PreviewContent />
    </Suspense>
  );
}
