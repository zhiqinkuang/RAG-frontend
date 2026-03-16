"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Download, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDocumentDownloadUrl } from "@/lib/rag-kb";
import { useState } from "react";

function PreviewContent() {
  const searchParams = useSearchParams();
  const docId = searchParams.get("docId");
  const fileName = searchParams.get("name") || "文档预览";
  
  const [scale, setScale] = useState(100);

  if (!docId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">缺少文档参数</p>
      </div>
    );
  }

  const fileUrl = getDocumentDownloadUrl(parseInt(docId));

  const handleZoomIn = () => setScale((s) => Math.min(s + 10, 200));
  const handleZoomOut = () => setScale((s) => Math.max(s - 10, 50));

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* 顶部工具栏 */}
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
            <a href={fileUrl.replace("inline", "attachment")} download={fileName}>
              <Download className="h-4 w-4 mr-1" />
              下载
            </a>
          </Button>
        </div>
      </div>

      {/* PDF 预览区域 */}
      <div className="flex-1 overflow-auto p-4">
        <div className="flex justify-center">
          <iframe
            src={fileUrl}
            className="bg-white rounded-lg shadow-lg"
            style={{
              width: `${scale}%`,
              height: "calc(100vh - 120px)",
              minHeight: "600px",
            }}
            title={fileName}
          />
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