"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import {
  Database,
  Upload,
  FileText,
  Trash2,
  RefreshCw,
  Plus,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listKnowledgeBases,
  createKnowledgeBase,
  deleteKnowledgeBase,
  listDocuments,
  uploadDocuments,
  deleteDocument,
  reprocessDocument,
  type KnowledgeBase,
  type Document,
  formatFileSize,
  getDocStatusText,
  getDocStatusColor,
} from "@/lib/rag-kb";
import { getStoredRagToken, getStoredRagUser } from "@/lib/rag-auth";
import { useI18n } from "@/lib/i18n";

interface RagSettingsProps {
  onKnowledgeBaseChange?: (kbId: number | undefined) => void;
  selectedKbId?: number;
}

export function RagSettings({ onKnowledgeBaseChange, selectedKbId }: RagSettingsProps) {
  const { t } = useI18n();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 创建知识库
  const [showCreateKb, setShowCreateKb] = useState(false);
  const [newKbName, setNewKbName] = useState("");
  const [newKbDesc, setNewKbDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // 展开的知识库
  const [expandedKb, setExpandedKb] = useState<number | null>(null);

  // 文档列表
  const [documents, setDocuments] = useState<Document[]>([]);
  const [docLoading, setDocLoading] = useState(false);
  const [docTotal, setDocTotal] = useState(0);

  // 上传
  const [uploading, setUploading] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // 检查登录状态
  useEffect(() => {
    const checkAuth = () => {
      const token = getStoredRagToken();
      const user = getStoredRagUser();
      setIsLoggedIn(!!token && !!user);
    };
    checkAuth();
    window.addEventListener("rag-auth-changed", checkAuth);
    return () => window.removeEventListener("rag-auth-changed", checkAuth);
  }, []);

  // 加载知识库列表
  const loadKnowledgeBases = useCallback(async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listKnowledgeBases(1, 100);
      if (res.code === 0) {
        setKnowledgeBases(res.data.knowledge_bases || []);
      } else {
        setError(res.message || "加载失败");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络错误");
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    loadKnowledgeBases();
  }, [loadKnowledgeBases]);

  // 加载文档列表
  const loadDocuments = useCallback(async (kbId: number) => {
    setDocLoading(true);
    try {
      const res = await listDocuments(kbId, 1, 100);
      if (res.code === 0) {
        setDocuments(res.data.documents || []);
        setDocTotal(res.data.total || 0);
      }
    } catch (e) {
      console.error("加载文档失败:", e);
    } finally {
      setDocLoading(false);
    }
  }, []);

  // 展开/收起知识库
  const toggleKb = (kbId: number) => {
    if (expandedKb === kbId) {
      setExpandedKb(null);
    } else {
      setExpandedKb(kbId);
      loadDocuments(kbId);
    }
  };

  // 创建知识库
  const handleCreateKb = async () => {
    if (!newKbName.trim()) return;
    setCreating(true);
    try {
      const res = await createKnowledgeBase(newKbName.trim(), newKbDesc.trim());
      if (res.code === 0) {
        setShowCreateKb(false);
        setNewKbName("");
        setNewKbDesc("");
        loadKnowledgeBases();
      } else {
        setError(res.message || "创建失败");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络错误");
    } finally {
      setCreating(false);
    }
  };

  // 删除知识库
  const handleDeleteKb = async (kbId: number) => {
    if (!confirm("确定要删除此知识库吗？所有文档将被删除。")) return;
    try {
      const res = await deleteKnowledgeBase(kbId);
      if (res.code === 0) {
        loadKnowledgeBases();
        if (expandedKb === kbId) setExpandedKb(null);
        if (selectedKbId === kbId) onKnowledgeBaseChange?.(undefined);
      } else {
        setError(res.message || "删除失败");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络错误");
    }
  };

  // 选择文件
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadFiles((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // 移除文件
  const removeFile = (index: number) => {
    setUploadFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // 上传文件
  const handleUpload = async () => {
    if (uploadFiles.length === 0 || !expandedKb) return;
    setUploading(true);
    try {
      const res = await uploadDocuments(expandedKb, uploadFiles);
      if (res.code === 0) {
        setUploadFiles([]);
        loadDocuments(expandedKb);
      } else {
        setError(res.message || "上传失败");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络错误");
    } finally {
      setUploading(false);
    }
  };

  // 删除文档
  const handleDeleteDoc = async (docId: number) => {
    if (!expandedKb) return;
    if (!confirm("确定要删除此文档吗？")) return;
    try {
      const res = await deleteDocument(expandedKb, docId);
      if (res.code === 0) {
        loadDocuments(expandedKb);
      } else {
        setError(res.message || "删除失败");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络错误");
    }
  };

  // 重新处理文档
  const handleReprocess = async (docId: number) => {
    if (!expandedKb) return;
    try {
      const res = await reprocessDocument(expandedKb, docId);
      if (res.code === 0) {
        loadDocuments(expandedKb);
      } else {
        setError(res.message || "重新处理失败");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络错误");
    }
  };

  // 选择知识库
  const handleSelectKb = (kbId: number) => {
    onKnowledgeBaseChange?.(kbId);
  };

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <AlertCircle className="mb-2 size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          请先在 API 设置中登录 RAG 账号
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          <AlertCircle className="size-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="shrink-0 hover:text-red-800 dark:hover:text-red-200"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">知识库管理</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowCreateKb(true)}
          className="h-8"
        >
          <Plus className="mr-1 size-4" />
          新建
        </Button>
      </div>

      {/* 创建知识库表单 */}
      {showCreateKb && (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">名称 *</label>
            <Input
              value={newKbName}
              onChange={(e) => setNewKbName(e.target.value)}
              placeholder="输入知识库名称"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">描述</label>
            <Input
              value={newKbDesc}
              onChange={(e) => setNewKbDesc(e.target.value)}
              placeholder="可选描述"
              className="h-9"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleCreateKb}
              disabled={creating || !newKbName.trim()}
              className="flex-1"
            >
              {creating ? <Loader2 className="size-4 animate-spin" /> : "创建"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowCreateKb(false);
                setNewKbName("");
                setNewKbDesc("");
              }}
              className="flex-1"
            >
              取消
            </Button>
          </div>
        </div>
      )}

      {/* 知识库列表 */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : knowledgeBases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FolderOpen className="mb-2 size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">暂无知识库</p>
            <p className="text-xs text-muted-foreground">点击上方"新建"创建</p>
          </div>
        ) : (
          knowledgeBases.map((kb) => (
            <div
              key={kb.ID}
              className="rounded-lg border overflow-hidden"
            >
              {/* 知识库头部 */}
              <div
                className={`flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/50 ${
                  selectedKbId === kb.ID ? "bg-primary/5" : ""
                }`}
                onClick={() => toggleKb(kb.ID)}
              >
                <button
                  type="button"
                  className="shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleKb(kb.ID);
                  }}
                >
                  {expandedKb === kb.ID ? (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  )}
                </button>
                <Database className="size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{kb.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {kb.doc_count} 文档
                    </span>
                  </div>
                  {kb.description && (
                    <p className="truncate text-xs text-muted-foreground">
                      {kb.description}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectKb(kb.ID);
                    }}
                    title="选择此知识库"
                    className={selectedKbId === kb.ID ? "text-primary" : ""}
                  >
                    <CheckCircle className="size-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteKb(kb.ID);
                    }}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              {/* 文档列表 */}
              {expandedKb === kb.ID && (
                <div className="border-t bg-muted/30">
                  {/* 上传区域 */}
                  <div className="border-b p-3">
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".pdf,.txt,.md,.docx"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-8"
                      >
                        <Upload className="mr-1 size-4" />
                        选择文件
                      </Button>
                      {uploadFiles.length > 0 && (
                        <Button
                          size="sm"
                          onClick={handleUpload}
                          disabled={uploading}
                          className="h-8"
                        >
                          {uploading ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            `上传 ${uploadFiles.length} 个文件`
                          )}
                        </Button>
                      )}
                    </div>
                    {/* 待上传文件列表 */}
                    {uploadFiles.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {uploadFiles.map((file, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 rounded bg-background p-1.5 text-xs"
                          >
                            <FileText className="size-3 shrink-0" />
                            <span className="flex-1 truncate">{file.name}</span>
                            <span className="text-muted-foreground">
                              {formatFileSize(file.size)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeFile(idx)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X className="size-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      支持 PDF、TXT、MD、DOCX 格式
                    </p>
                  </div>

                  {/* 文档列表 */}
                  <div className="max-h-60 overflow-y-auto">
                    {docLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="size-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : documents.length === 0 ? (
                      <div className="py-4 text-center text-xs text-muted-foreground">
                        暂无文档，上传文件开始
                      </div>
                    ) : (
                      <div className="divide-y">
                        {documents.map((doc) => (
                          <div
                            key={doc.ID}
                            className="flex items-center gap-2 p-2 text-xs"
                          >
                            <FileText className="size-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate font-medium">
                                  {doc.file_name}
                                </span>
                                <span className={getDocStatusColor(doc.status)}>
                                  {getDocStatusText(doc.status)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <span>{formatFileSize(doc.file_size)}</span>
                                <span>•</span>
                                <span>{doc.chunk_count} 分块</span>
                              </div>
                              {doc.error_msg && (
                                <p className="truncate text-red-500">
                                  {doc.error_msg}
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 gap-1">
                              {doc.status !== 1 && (
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  onClick={() => handleReprocess(doc.ID)}
                                  title="重新处理"
                                >
                                  <RefreshCw className="size-3" />
                                </Button>
                              )}
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => handleDeleteDoc(doc.ID)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}