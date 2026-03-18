/**
 * RAG 知识库管理 API 客户端
 * 使用 config.ts 中的统一配置管理 RAG 后端地址
 */

import { getStoredRagToken } from "./rag-auth";
import { getRagBackendUrl } from "./config";

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

export type DocumentProgress = {
  total: number;
  completed: number;
  percent: number;
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
  status: number; // 0=待处理, 1=处理中, 2=成功, 3=失败
  error_msg: string;
  progress?: DocumentProgress; // 处理进度
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

// 错误码定义
export const ErrorCodes = {
  DOC_DUPLICATE: 30016, // 文档已存在
  FILE_TOO_LARGE: 30010, // 文件过大
  FILE_TYPE_INVALID: 30003, // 文件类型不支持
} as const;

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
  keyword = "",
): Promise<KbListResponse> {
  const url = new URL(`${getRagBackendUrl()}/api/v1/knowledge-bases`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", String(pageSize));
  if (keyword) url.searchParams.set("keyword", keyword);

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return res.json();
  } catch (e) {
    if (e instanceof TypeError && e.message === "Failed to fetch") {
      throw new Error(
        `无法连接到服务器，请检查后端是否启动 (${getRagBackendUrl()})`,
      );
    }
    throw e;
  }
}

// 创建知识库
export async function createKnowledgeBase(
  name: string,
  description = "",
  visibility = 0,
): Promise<KbCreateResponse> {
  try {
    const res = await fetch(`${getRagBackendUrl()}/api/v1/knowledge-bases`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, description, visibility }),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return res.json();
  } catch (e) {
    if (e instanceof TypeError && e.message === "Failed to fetch") {
      throw new Error(
        `无法连接到服务器，请检查后端是否启动 (${getRagBackendUrl()})`,
      );
    }
    throw e;
  }
}

// 更新知识库
export async function updateKnowledgeBase(
  id: number,
  data: { name?: string; description?: string; visibility?: number },
): Promise<{ code: number; message: string; data: KnowledgeBase }> {
  const res = await fetch(
    `${getRagBackendUrl()}/api/v1/knowledge-bases/${id}`,
    {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    },
  );
  return res.json();
}

// 删除知识库
export async function deleteKnowledgeBase(
  id: number,
): Promise<{ code: number; message: string }> {
  const res = await fetch(
    `${getRagBackendUrl()}/api/v1/knowledge-bases/${id}`,
    {
      method: "DELETE",
      headers: getAuthHeaders(),
    },
  );
  return res.json();
}

// 文档列表
export async function listDocuments(
  kbId: number,
  page = 1,
  pageSize = 20,
): Promise<DocListResponse> {
  const url = new URL(
    `${getRagBackendUrl()}/api/v1/knowledge-bases/${kbId}/documents`,
  );
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
  files: File[],
): Promise<UploadResponse> {
  const token = getStoredRagToken();
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("files", file);
  });

  const res = await fetch(
    `${getRagBackendUrl()}/api/v1/knowledge-bases/${kbId}/documents`,
    {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    },
  );
  return res.json();
}

// 删除文档
export async function deleteDocument(
  kbId: number,
  docId: number,
): Promise<{ code: number; message: string }> {
  const res = await fetch(
    `${getRagBackendUrl()}/api/v1/knowledge-bases/${kbId}/documents/${docId}`,
    {
      method: "DELETE",
      headers: getAuthHeaders(),
    },
  );
  return res.json();
}

// 重新处理文档
export async function reprocessDocument(
  kbId: number,
  docId: number,
): Promise<{ code: number; message: string }> {
  const res = await fetch(
    `${getRagBackendUrl()}/api/v1/knowledge-bases/${kbId}/documents/${docId}/reprocess`,
    {
      method: "POST",
      headers: getAuthHeaders(),
    },
  );
  return res.json();
}

// 格式化文件大小
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

// 文档状态文本
// 后端定义: 0=Pending, 1=Processing, 2=Completed, 3=Failed
// 进度100%时直接显示"已完成"，不显示"处理中"或"等待后端确认"
export function getDocStatusText(
  status: number,
  progressPercent?: number,
): string {
  // 进度100%直接显示"已完成"
  if (progressPercent && progressPercent >= 100) {
    return "已完成";
  }

  switch (status) {
    case 0:
      return "待处理";
    case 1:
      return "处理中";
    case 2:
      return "已完成";
    case 3:
      return "失败";
    default:
      return "未知";
  }
}

// 文档状态颜色
// 进度100%时直接显示绿色
export function getDocStatusColor(
  status: number,
  progressPercent?: number,
): string {
  // 进度100%直接显示绿色
  if (progressPercent && progressPercent >= 100) {
    return "text-green-600 dark:text-green-400";
  }

  switch (status) {
    case 0:
      return "text-gray-600 dark:text-gray-400";
    case 1:
      return "text-yellow-600 dark:text-yellow-400";
    case 2:
      return "text-green-600 dark:text-green-400";
    case 3:
      return "text-red-600 dark:text-red-400";
    default:
      return "text-gray-600 dark:text-gray-400";
  }
}

// 获取文档下载/预览 URL
export function getDocumentDownloadUrl(docId: number): string {
  const token = getStoredRagToken();
  return `${getRagBackendUrl()}/api/v1/documents/${docId}/download?token=${token}`;
}
