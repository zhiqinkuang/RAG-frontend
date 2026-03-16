"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Download, ZoomIn, ZoomOut, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStoredRagToken } from "@/lib/rag-auth";

function PreviewContent() {
  const searchParams = useSearchParams();
  const docId = searchParams.get("docId");
  const fileName = searchParams.get("name") || "文档预览";

  const [scale, setScale] = useState(100);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);

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

    const proxyUrl = `/api/preview?docId=${encodeURIComponent(docId)}&token=${encodeURIComponent(token)}`;

    setError(null);
    setIsLoading(true);
    fetch(proxyUrl, { method: "HEAD" })
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) setError("文档不存在或已被删除");
          else if (res.status === 401) setError("认证已过期，请重新登录");
          else setError(`加载失败: ${res.status}`);
        } else {
          setIframeSrc(proxyUrl);
        }
      })
      .catch(() => {
        setError("网络错误，请检查连接");
      });
  }, [docId]);

  if (!docId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-lg font-medium">{error}</p>
        <p className="text-sm text-muted-foreground">文档 ID: {docId}</p>
        <Button variant="outline" onClick={() => window.close()}>
          关闭
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 bg-background border-b shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => window.close()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            关闭
          </Button>
          <span className="text-sm font-medium truncate max-w-[300px]" title={fileName}>
            {fileName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm w-12 text-center">{scale}%</span>
          <Button variant="outline" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={downloadUrl} download={fileName}>
              <Download className="h-4 w-4 mr-1" />
              下载
            </a>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="flex justify-center relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {iframeSrc && (
            <iframe
              key={iframeSrc}
              src={iframeSrc}
              className="bg-white rounded-lg shadow-lg"
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
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    }>
      <PreviewContent />
    </Suspense>
  );
}