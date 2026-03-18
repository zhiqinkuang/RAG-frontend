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
  refreshKey: _refreshKey,
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
  }, [knowledgeBaseId]);

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
        <div className="slide-in-from-right-2 flex w-72 shrink-0 animate-in flex-col overflow-hidden border-l bg-muted/30 duration-300 sm:w-80">
          <div className="flex shrink-0 items-center justify-between border-b px-3 py-2">
            <span className="font-medium text-sm">文档筛选</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex shrink-0 gap-1 border-b px-2 py-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 flex-1 text-xs"
              onClick={selectAll}
            >
              全选
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 flex-1 text-xs"
              onClick={clearAll}
            >
              清空
            </Button>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            {loading ? (
              <div className="py-6 text-center text-muted-foreground text-sm">
                加载中...
              </div>
            ) : documents.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm">
                暂无文档
              </div>
            ) : (
              <div className="space-y-0.5 p-1.5">
                {documents.map((doc) => (
                  <ContextMenu key={doc.ID}>
                    <ContextMenuTrigger asChild>
                      <div
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 hover:bg-accent"
                        onClick={() => toggleDoc(doc.ID)}
                      >
                        <Checkbox
                          checked={selectedDocIds.includes(doc.ID)}
                          onCheckedChange={() => toggleDoc(doc.ID)}
                          className="h-4 w-4 shrink-0"
                        />
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span
                          className="line-clamp-2 min-w-0 flex-1 break-all text-sm"
                          title={doc.file_name}
                        >
                          {doc.file_name}
                        </span>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem
                        onClick={() => {
                          window.open(
                            `/preview?docId=${doc.ID}&name=${encodeURIComponent(doc.file_name)}`,
                            "_blank",
                          );
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        预览文档
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
              </div>
            )}
          </ScrollArea>
          <div className="shrink-0 border-t bg-muted/50 px-3 py-2 text-center text-muted-foreground text-xs">
            {selectedDocIds.length > 0 ? (
              <span className="font-medium text-primary">
                已选 {selectedDocIds.length} / {documents.length} 个
              </span>
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
            className="fixed right-5 bottom-24 z-[9999] h-11 w-11 rounded-full border bg-white text-foreground shadow-md transition-transform duration-200 hover:scale-105 hover:bg-white hover:text-foreground dark:bg-card dark:hover:bg-card"
            onClick={handleToggleSidebar}
            title={
              knowledgeBaseId
                ? isOpen
                  ? "隐藏文档筛选"
                  : "显示文档筛选"
                : "请先在设置中选择知识库"
            }
          >
            {isOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <div className="relative">
                <Filter className="h-5 w-5" />
                {knowledgeBaseId && selectedDocIds.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 font-medium text-[10px] text-primary-foreground">
                    {selectedDocIds.length}
                  </span>
                )}
              </div>
            )}
          </Button>,
          document.body,
        )}
    </>
  );
}
