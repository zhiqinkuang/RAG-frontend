"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { FileText, Filter, X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { listDocuments, type Document } from "@/lib/rag-kb";
import { toast } from "sonner";

interface DocumentSidebarProps {
  knowledgeBaseId: number | undefined;
  selectedDocIds: number[];
  onSelectionChange: (docIds: number[]) => void;
  refreshKey?: number; // 用于触发刷新
}

export function DocumentSidebar({
  knowledgeBaseId,
  selectedDocIds,
  onSelectionChange,
  refreshKey,
}: DocumentSidebarProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // 加载文档列表
  useEffect(() => {
    if (!knowledgeBaseId) {
      setDocuments([]);
      return;
    }
    const fetchDocs = async () => {
      setLoading(true);
      try {
        const result = await listDocuments(knowledgeBaseId, 1, 100);
        setDocuments(result.data?.documents || []);
      } catch (error) {
        console.error("Failed to fetch documents:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDocs();
  }, [knowledgeBaseId, refreshKey]); // 添加 refreshKey 依赖

  const toggleDoc = (docId: number) => {
    if (selectedDocIds.includes(docId)) {
      onSelectionChange(selectedDocIds.filter((id) => id !== docId));
    } else {
      onSelectionChange([...selectedDocIds, docId]);
    }
  };

  const selectAll = () => {
    onSelectionChange(documents.map((d) => d.ID));
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  const handleToggleSidebar = () => {
    if (!knowledgeBaseId) {
      toast.info("请先在设置中选择知识库");
      return;
    }
    setIsOpen((o) => !o);
  };

  return (
    <>
      {/* 右侧边栏：仅展开时渲染，隐藏时不占位、无右白边 */}
      {isOpen && knowledgeBaseId && (
        <div className="w-72 sm:w-80 shrink-0 border-l flex flex-col bg-muted/30 overflow-hidden animate-in slide-in-from-right-2 duration-300">
          <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
            <span className="text-sm font-medium">文档筛选</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-1 px-2 py-1.5 border-b shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={selectAll}
            >
              全选
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={clearAll}
            >
              清空
            </Button>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">加载中...</div>
            ) : documents.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">暂无文档</div>
            ) : (
              <div className="p-1.5 space-y-0.5">
                {documents.map((doc) => (
                  <ContextMenu key={doc.ID}>
                    <ContextMenuTrigger asChild>
                      <div
                        className="flex items-center gap-2 px-2 py-2 rounded hover:bg-accent cursor-pointer"
                        onClick={() => toggleDoc(doc.ID)}
                      >
                        <Checkbox
                          checked={selectedDocIds.includes(doc.ID)}
                          onCheckedChange={() => toggleDoc(doc.ID)}
                          className="h-4 w-4 shrink-0"
                        />
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="text-sm min-w-0 flex-1 break-all line-clamp-2" title={doc.file_name}>{doc.file_name}</span>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem
                        onClick={() => {
                          window.open(`/preview?docId=${doc.ID}&name=${encodeURIComponent(doc.file_name)}`, '_blank');
                        }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        预览文档
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
              </div>
            )}
          </ScrollArea>
          <div className="px-3 py-2 border-t text-xs text-muted-foreground text-center bg-muted/50 shrink-0">
            {selectedDocIds.length > 0 ? (
              <span className="text-primary font-medium">已选 {selectedDocIds.length} / {documents.length} 个</span>
            ) : (
              <span>共 {documents.length} 个文档</span>
            )}
          </div>
        </div>
      )}

      {/* 悬浮按钮：隐藏时只显示此按钮，无右侧白边 */}
      {mounted &&
        typeof document !== "undefined" &&
        document.body &&
        createPortal(
          <Button
            variant="secondary"
            size="icon"
            className="fixed right-5 bottom-24 h-11 w-11 rounded-full bg-white dark:bg-card text-foreground border shadow-md z-[9999] hover:scale-105 hover:bg-white hover:text-foreground dark:hover:bg-card transition-transform duration-200"
            onClick={handleToggleSidebar}
            title={knowledgeBaseId ? (isOpen ? "隐藏文档筛选" : "显示文档筛选") : "请先在设置中选择知识库"}
          >
            {isOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <div className="relative">
                <Filter className="h-5 w-5" />
                {knowledgeBaseId && selectedDocIds.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-medium flex items-center justify-center px-1">
                    {selectedDocIds.length}
                  </span>
                )}
              </div>
            )}
          </Button>,
          document.body
        )}
    </>
  );
}
