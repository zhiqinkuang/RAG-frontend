/**
 * RAG 知识库管理 API 客户端
 */

import { getStoredRagToken } from "./rag-auth";

export type KnowledgeBase = {
  ID: number;
  name: string;
  description: string;
  user_id: number;
  visibility: number;
  doc_count: number;
  status: number;
  CreatedAt: string;
  UpdatedAt: string;
};

export type Document = {
  ID: number;
  knowledge_base_id: number;
  user_id: number;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  chunk_count: number;
  status: number; // 0=处理中, 1=成功, 其他=失败
  error_msg: string;
  CreatedAt: string;
  UpdatedAt: string;
};

export type KbListResponse = {
  code: number;
  message: string;
  data: {
    total: number;
    knowledge_bases: KnowledgeBase[];
  };
};

export type KbCreateResponse = {
  code: number;
  message: string;
  data: { id: number };
};

export type DocListResponse = {
  code: number;
  message: string;
  data: {
    total: number;
    documents: Document[];
  };
};

export type UploadResponse = {
  code: number;
  message: string;
  data: {
    documents: Array<{
      id?: number;
      file_name: string;
      status: string;
      error?: string;
    }>;
  };
};

function getBaseUrl(): string {
  if (typeof window === "undefined") return "http://127.0.0.1:8080";
  const raw = localStorage.getItem("chat-settings");
  if (!raw) return "http://127.0.0.1:8080";
  try {
    const parsed = JSON.parse(raw) as { baseURL?: string };
    return parsed.baseURL?.trim() || "http://127.0.0.1:8080";
  } catch {
    return "http://127.0.0.1:8080";
  }
}

function getAuthHeaders(): Record<string, string> {
  const token = getStoredRagToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// 知识库列表
export async function listKnowledgeBases(
  page = 1,
  pageSize = 20,
  keyword = ""
): Promise<KbListResponse> {
  const baseURL = getBaseUrl();
  const url = new URL(`${baseURL}/api/v1/knowledge-bases`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", String(pageSize));
  if (keyword) url.searchParams.set("keyword", keyword);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return res.json();
}

// 创建知识库
export async function createKnowledgeBase(
  name: string,
  description = "",
  visibility = 0
): Promise<KbCreateResponse> {
  const baseURL = getBaseUrl();
  const res = await fetch(`${baseURL}/api/v1/knowledge-bases`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ name, description, visibility }),
  });
  return res.json();
}

// 更新知识库
export async function updateKnowledgeBase(
  id: number,
  data: { name?: string; description?: string; visibility?: number }
): Promise<{ code: number; message: string; data: KnowledgeBase }> {
  const baseURL = getBaseUrl();
  const res = await fetch(`${baseURL}/api/v1/knowledge-bases/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

// 删除知识库
export async function deleteKnowledgeBase(
  id: number
): Promise<{ code: number; message: string }> {
  const baseURL = getBaseUrl();
  const res = await fetch(`${baseURL}/api/v1/knowledge-bases/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return res.json();
}

// 文档列表
export async function listDocuments(
  kbId: number,
  page = 1,
  pageSize = 20
): Promise<DocListResponse> {
  const baseURL = getBaseUrl();
  const url = new URL(`${baseURL}/api/v1/knowledge-bases/${kbId}/documents`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", String(pageSize));

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return res.json();
}

// 上传文档
export async function uploadDocuments(
  kbId: number,
  files: File[]
): Promise<UploadResponse> {
  const baseURL = getBaseUrl();
  const token = getStoredRagToken();
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("files", file);
  });

  const res = await fetch(`${baseURL}/api/v1/knowledge-bases/${kbId}/documents`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  return res.json();
}

// 删除文档
export async function deleteDocument(
  kbId: number,
  docId: number
): Promise<{ code: number; message: string }> {
  const baseURL = getBaseUrl();
  const res = await fetch(
    `${baseURL}/api/v1/knowledge-bases/${kbId}/documents/${docId}`,
    {
      method: "DELETE",
      headers: getAuthHeaders(),
    }
  );
  return res.json();
}

// 重新处理文档
export async function reprocessDocument(
  kbId: number,
  docId: number
): Promise<{ code: number; message: string }> {
  const baseURL = getBaseUrl();
  const res = await fetch(
    `${baseURL}/api/v1/knowledge-bases/${kbId}/documents/${docId}/reprocess`,
    {
      method: "POST",
      headers: getAuthHeaders(),
    }
  );
  return res.json();
}

// 格式化文件大小
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// 文档状态文本
export function getDocStatusText(status: number): string {
  switch (status) {
    case 0:
      return "处理中";
    case 1:
      return "成功";
    default:
      return "失败";
  }
}

// 文档状态颜色
export function getDocStatusColor(status: number): string {
  switch (status) {
    case 0:
      return "text-yellow-600 dark:text-yellow-400";
    case 1:
      return "text-green-600 dark:text-green-400";
    default:
      return "text-red-600 dark:text-red-400";
  }
}