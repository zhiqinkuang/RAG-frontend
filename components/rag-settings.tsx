"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
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
  CheckCircle,
  AlertCircle,
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
  ErrorCodes,
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
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

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
    return () => {
      window.removeEventListener("rag-auth-changed", checkAuth);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // 组件加载时测试连接
  useEffect(() => {
    if (!isLoggedIn) return;
    
    // 测试后端连接
    const testConnection = async () => {
      try {
        const res = await listKnowledgeBases(1, 1);
        if (res.code === 10002 || res.message?.includes("token") || res.message?.includes("Token")) {
          // Token 无效，清除登录状态
          console.log("Token invalid, clearing auth");
          setIsLoggedIn(false);
        }
      } catch (e) {
        // 连接失败，但不影响 UI 显示
        console.error("Connection test failed:", e);
      }
    };
    
    testConnection();
  }, [isLoggedIn]);

  // 加载知识库列表
  const loadKnowledgeBases = useCallback(async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    try {
      const res = await listKnowledgeBases(1, 100);
      if (res.code === 0) {
        setKnowledgeBases(res.data.knowledge_bases || []);
      } else if (res.code === 10002 || res.message?.includes("token")) {
        // Token 无效或过期，清除登录状态
        toast.error("登录已过期，请重新登录");
        setIsLoggedIn(false);
      } else {
        toast.error(res.message || "加载知识库失败");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "网络错误";
      if (msg.includes("无法连接") || msg.includes("Failed to fetch")) {
        toast.error("无法连接到服务器，请检查后端是否启动 (http://127.0.0.1:8080)");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    loadKnowledgeBases();
  }, [loadKnowledgeBases]);

  // 加载文档列表
  const loadDocuments = useCallback(async (kbId: number, silent = false) => {
    if (!silent) setDocLoading(true);
    try {
      const res = await listDocuments(kbId, 1, 100);
      if (res.code === 0) {
        setDocuments(res.data.documents || []);
        setDocTotal(res.data.total || 0);
      }
    } catch (e) {
      console.error("加载文档失败:", e);
    } finally {
      if (!silent) setDocLoading(false);
    }
  }, []);

  // 轮询处理中的文档
  useEffect(() => {
    // 检查是否有处理中或待处理的文档
    // 注意：进度100%但状态仍为1时也需要继续轮询，直到后端状态更新为2
    const hasProcessing = documents.some(d => d.status === 0 || d.status === 1);
    
    if (hasProcessing && expandedKb) {
      // 每 2 秒轮询一次
      pollingRef.current = setInterval(() => {
        loadDocuments(expandedKb, true);
      }, 2000);
    }
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [documents, expandedKb, loadDocuments]);

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
        toast.success("知识库创建成功");
        setShowCreateKb(false);
        setNewKbName("");
        setNewKbDesc("");
        loadKnowledgeBases();
      } else {
        toast.error(res.message || "创建失败");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
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
        toast.success("知识库删除成功");
        loadKnowledgeBases();
        if (expandedKb === kbId) setExpandedKb(null);
        if (selectedKbId === kbId) onKnowledgeBaseChange?.(undefined);
      } else {
        toast.error(res.message || "删除失败");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
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
        const docs = res.data.documents || [];
        const successDocs = docs.filter(d => d.status !== "error");
        const failedDocs = docs.filter(d => d.status === "error");
        
        // 详细反馈每个文件的状态
        if (failedDocs.length === 0) {
          toast.success(`成功上传 ${successDocs.length} 个文件`);
        } else {
          // 显示失败原因
          const errorMessages = failedDocs.map(d => `${d.file_name}: ${d.error || "未知错误"}`).join("\n");
          if (successDocs.length > 0) {
            toast.warning(`上传完成：${successDocs.length} 个成功，${failedDocs.length} 个失败\n${errorMessages}`, { duration: 5000 });
          } else {
            toast.error(`上传失败：\n${errorMessages}`, { duration: 5000 });
          }
        }
        
        setUploadFiles([]);
        loadDocuments(expandedKb);
        loadKnowledgeBases(); // 刷新知识库列表以更新 doc_count
        // 通知侧边栏刷新
        window.dispatchEvent(new CustomEvent("settings-changed"));
      } else {
        // 根据错误码处理
        if (res.code === ErrorCodes.DOC_DUPLICATE) {
          toast.warning(res.message, { duration: 4000 });
        } else if (res.code === ErrorCodes.FILE_TOO_LARGE) {
          toast.error("文件大小超过限制（最大 50MB）");
        } else if (res.code === ErrorCodes.FILE_TYPE_INVALID) {
          toast.error("不支持的文件类型，仅支持 PDF、TXT、MD、DOCX");
        } else {
          toast.error(res.message || "上传失败");
        }
      }
    } catch (e) {
      console.error("上传失败:", e);
      toast.error(e instanceof Error ? e.message : "网络错误");
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
        toast.success("文档删除成功");
        loadDocuments(expandedKb);
        loadKnowledgeBases(); // 刷新知识库列表以更新 doc_count
        // 通知侧边栏刷新
        window.dispatchEvent(new CustomEvent("settings-changed"));
      } else {
        toast.error(res.message || "删除失败");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
    }
  };

  // 重新处理文档
  const handleReprocess = async (docId: number) => {
    if (!expandedKb) return;
    try {
      const res = await reprocessDocument(expandedKb, docId);
      if (res.code === 0) {
        toast.success("已开始重新处理文档");
        loadDocuments(expandedKb);
      } else {
        toast.error(res.message || "重新处理失败");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
    }
  };

  // 选择知识库
  const handleSelectKb = (kbId: number) => {
    onKnowledgeBaseChange?.(kbId);
    // 自动保存设置到 localStorage
    const raw = localStorage.getItem("chat-settings");
    let settings = {};
    try {
      settings = raw ? JSON.parse(raw) : {};
    } catch {
      settings = {};
    }
    localStorage.setItem("chat-settings", JSON.stringify({ ...settings, knowledgeBaseId: kbId }));
    // 触发事件通知其他组件
    window.dispatchEvent(new CustomEvent("settings-changed"));
    toast.success(`已选择知识库 (ID: ${kbId})`);
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
    <div className="space-y-3 sm:space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs sm:text-sm font-medium">知识库管理</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowCreateKb(true)}
          className="h-7 sm:h-8 px-2 sm:px-3"
        >
          <Plus className="mr-1 size-3.5 sm:size-4" />
          <span className="hidden xs:inline">新建</span>
        </Button>
      </div>

      {/* 创建知识库表单 */}
      {showCreateKb && (
        <div className="space-y-2.5 sm:space-y-3 rounded-lg border p-2.5 sm:p-3 md:p-4">
          <div className="space-y-1">
            <label className="text-xs font-medium">名称 *</label>
            <Input
              value={newKbName}
              onChange={(e) => setNewKbName(e.target.value)}
              placeholder="输入知识库名称"
              className="h-8 sm:h-9 text-xs sm:text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">描述</label>
            <Input
              value={newKbDesc}
              onChange={(e) => setNewKbDesc(e.target.value)}
              placeholder="可选描述"
              className="h-8 sm:h-9 text-xs sm:text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleCreateKb}
              disabled={creating || !newKbName.trim()}
              className="flex-1 h-8 sm:h-9 text-xs sm:text-sm"
            >
              {creating ? <Loader2 className="size-3.5 sm:size-4 animate-spin" /> : "创建"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowCreateKb(false);
                setNewKbName("");
                setNewKbDesc("");
              }}
              className="flex-1 h-8 sm:h-9 text-xs sm:text-sm"
            >
              取消
            </Button>
          </div>
        </div>
      )}

      {/* 知识库列表 */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-6 sm:py-8">
            <Loader2 className="size-5 sm:size-6 animate-spin text-muted-foreground" />
          </div>
        ) : knowledgeBases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 sm:py-8 text-center">
            <FolderOpen className="mb-2 size-6 sm:size-8 text-muted-foreground" />
            <p className="text-xs sm:text-sm text-muted-foreground">暂无知识库</p>
            <p className="text-xs text-muted-foreground">点击上方"新建"创建</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
            {knowledgeBases.map((kb) => (
              <div
                key={kb.ID}
                className="rounded-lg border overflow-hidden"
              >
                {/* 知识库头部 */}
                <div
                  className={`flex items-center gap-1.5 sm:gap-2 p-2 sm:p-2.5 md:p-3 cursor-pointer hover:bg-muted/50 ${
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
                      <ChevronDown className="size-3.5 sm:size-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-3.5 sm:size-4 text-muted-foreground" />
                    )}
                  </button>
                  <Database className="size-3.5 sm:size-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="truncate text-xs sm:text-sm font-medium">{kb.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {kb.doc_count} 文档
                      </span>
                    </div>
                    {kb.description && (
                      <p className="truncate text-xs text-muted-foreground hidden sm:block">
                        {kb.description}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-0.5 sm:gap-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectKb(kb.ID);
                      }}
                      title="选择此知识库"
                      className={`size-7 sm:size-8 ${selectedKbId === kb.ID ? "text-primary" : ""}`}
                    >
                      <CheckCircle className="size-3.5 sm:size-4" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteKb(kb.ID);
                      }}
                      className="size-7 sm:size-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-3.5 sm:size-4" />
                    </Button>
                  </div>
                </div>

                {/* 文档列表 */}
                {expandedKb === kb.ID && (
                  <div className="border-t bg-muted/30">
                    {/* 上传区域 */}
                    <div className="border-b p-2 sm:p-2.5 md:p-3">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-2">
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
                          className="h-7 sm:h-8 w-full sm:w-auto text-xs"
                        >
                          <Upload className="mr-1 size-3.5 sm:size-4" />
                          选择文件
                        </Button>
                        {uploadFiles.length > 0 && (
                          <Button
                            size="sm"
                            onClick={handleUpload}
                            disabled={uploading}
                            className="h-7 sm:h-8 w-full sm:w-auto text-xs"
                          >
                            {uploading ? (
                              <Loader2 className="size-3.5 sm:size-4 animate-spin" />
                            ) : (
                              `上传 ${uploadFiles.length} 个文件`
                            )}
                          </Button>
                        )}
                      </div>
                      {/* 待上传文件列表 */}
                      {uploadFiles.length > 0 && (
                        <div className="mt-1.5 sm:mt-2 space-y-1">
                          {uploadFiles.map((file, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-1.5 sm:gap-2 rounded bg-background p-1 sm:p-1.5 text-xs"
                            >
                              <FileText className="size-3 shrink-0" />
                              <span className="flex-1 truncate">{file.name}</span>
                              <span className="text-muted-foreground shrink-0 hidden sm:inline">
                                {formatFileSize(file.size)}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeFile(idx)}
                                className="text-muted-foreground hover:text-foreground shrink-0"
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
                    <div className="max-h-48 sm:max-h-60 overflow-y-auto">
                      {docLoading ? (
                        <div className="flex items-center justify-center py-3 sm:py-4">
                          <Loader2 className="size-4 sm:size-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : documents.length === 0 ? (
                        <div className="py-3 sm:py-4 text-center text-xs text-muted-foreground">
                          暂无文档，上传文件开始
                        </div>
                      ) : (
                        <div className="divide-y">
                          {documents.map((doc) => (
                            <div
                              key={doc.ID}
                              className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 text-xs"
                            >
                              <FileText className="size-3.5 sm:size-4 shrink-0 text-muted-foreground" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1 sm:gap-2">
                                  <span className="truncate font-medium text-xs sm:text-sm">
                                    {doc.file_name}
                                  </span>
                                  <span className={`shrink-0 text-xs ${getDocStatusColor(doc.status, doc.progress?.percent)}`}>
                                    {getDocStatusText(doc.status, doc.progress?.percent)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 sm:gap-2 text-muted-foreground text-xs">
                                  <span>{formatFileSize(doc.file_size)}</span>
                                  <span className="hidden sm:inline">•</span>
                                  <span className="hidden sm:inline">{doc.chunk_count} 分块</span>
                                </div>
                                {/* 进度条 - 仅在处理中(status=1)且进度未达100%时显示 */}
                                {doc.status === 1 && doc.progress && doc.progress.percent < 100 && (
                                  <div className="mt-1">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-0.5">
                                      <span>处理中</span>
                                      <span>{doc.progress.percent}%</span>
                                    </div>
                                    <div className="h-1 sm:h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                      <div 
                                        className="h-full bg-primary transition-all duration-300 rounded-full"
                                        style={{ width: `${Math.min(doc.progress.percent, 100)}%` }}
                                      />
                                    </div>
                                  </div>
                                )}
                                {doc.error_msg && (
                                  <p className="truncate text-red-500 text-xs">
                                    {doc.error_msg}
                                  </p>
                                )}
                              </div>
                              <div className="flex shrink-0 gap-0.5 sm:gap-1">
                                {doc.status !== 1 && (
                                  <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    onClick={() => handleReprocess(doc.ID)}
                                    title="重新处理"
                                    className="size-6 sm:size-7"
                                  >
                                    <RefreshCw className="size-3" />
                                  </Button>
                                )}
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteDoc(doc.ID)}
                                  className="size-6 sm:size-7 text-destructive hover:text-destructive"
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}