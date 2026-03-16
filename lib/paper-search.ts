/**
 * 论文搜索 API 客户端
 */

import { getStoredRagToken } from "./rag-auth";
import { RAG_BACKEND_URL, getRagBackendUrl } from "./config";

export type PaperSource = "arXiv";

export type Paper = {
  arxiv_id: string;
  title: string;
  authors: string[];
  abstract: string;
  published: string;
  pdf_url: string;
  abs_url: string;
  categories: string[];
  source?: PaperSource;
};

export type SearchResult = {
  papers: Paper[];
  total: number;
  query: string;
  hasMore?: boolean;
};

export type DownloadResult = {
  success: boolean;
  message: string;
  document_id?: number;
  local_backup_path?: string;
};

function getAuthHeaders(): Record<string, string> {
  const token = getStoredRagToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * 搜索论文
 * @param query 搜索关键词或自然语言查询
 * @param options 搜索选项
 */
export async function searchPapers(
  query: string,
  options?: {
    maxResults?: number;
    naturalLanguage?: boolean;
    offset?: number;
  }
): Promise<SearchResult> {
  const { maxResults = 10, naturalLanguage = false, offset = 0 } = options || {};
  
  const url = new URL(`${RAG_BACKEND_URL}/api/v1/papers/search`);
  url.searchParams.set("query", query);
  url.searchParams.set("max_results", String(maxResults));
  url.searchParams.set("natural_language", String(naturalLanguage));
  if (offset > 0) {
    url.searchParams.set("offset", String(offset));
  }

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(
        errorData.message || `HTTP ${res.status}: ${res.statusText}`
      );
    }

    const data = await res.json();

    // 处理后端返回格式
    if (data.code === 0 && data.data) {
      return {
        papers: data.data.papers || [],
        total: data.data.total || 0,
        query: data.data.query || query,
        hasMore: data.data.has_more ?? (data.data.papers?.length >= maxResults),
      };
    }

    // 如果后端直接返回数据
    return {
      papers: data.papers || [],
      total: data.total || 0,
      query: data.query || query,
      hasMore: data.has_more ?? (data.papers?.length >= maxResults),
    };
  } catch (e) {
    if (e instanceof TypeError && e.message === "Failed to fetch") {
      throw new Error("无法连接到服务器，请检查后端是否启动 (http://127.0.0.1:8080)");
    }
    throw e;
  }
}

/**
 * 智能搜索提取结果
 */
export type ExtractedInfo = {
  keywords?: string[];
  detected_title?: string;
  suggested_query?: string;
  confidence?: number;
};

/**
 * 智能搜索结果
 */
export type SmartSearchResult = SearchResult & {
  detected_type?: "keyword" | "natural" | "smart";
  extracted_info?: ExtractedInfo;
  original_query?: string;
};

/**
 * 智能搜索论文 - 统一API
 * 自动检测输入类型并选择最优处理方式
 * @param query 搜索关键词、自然语言描述或长文本
 * @param options 搜索选项
 */
export async function smartSearchPapers(
  query: string,
  options?: {
    maxResults?: number;
    offset?: number;
  }
): Promise<SmartSearchResult> {
  const { maxResults = 10, offset = 0 } = options || {};

  try {
    const res = await fetch(`${getRagBackendUrl()}/api/v1/papers/smart-search`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        query,
        max_results: maxResults,
        offset,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(
        errorData.message || `HTTP ${res.status}: ${res.statusText}`
      );
    }

    const data = await res.json();

    // 处理后端返回格式
    if (data.code === 0 && data.data) {
      return {
        papers: data.data.papers || [],
        total: data.data.total || 0,
        query: data.data.query || query,
        hasMore: data.data.has_more ?? (data.data.papers?.length >= maxResults),
        detected_type: data.data.detected_type,
        extracted_info: data.data.extracted_info,
        original_query: data.data.original_query,
      };
    }

    // 如果后端直接返回数据
    return {
      papers: data.papers || [],
      total: data.total || 0,
      query: data.query || query,
      hasMore: data.has_more ?? (data.papers?.length >= maxResults),
      detected_type: data.detected_type,
      extracted_info: data.extracted_info,
      original_query: data.original_query,
    };
  } catch (e) {
    if (e instanceof TypeError && e.message === "Failed to fetch") {
      throw new Error("无法连接到服务器，请检查后端是否启动 (http://127.0.0.1:8080)");
    }
    throw e;
  }
}

/**
 * 下载论文到知识库
 * @param arxivId arXiv 论文 ID
 * @param kbId 知识库 ID
 */
export async function downloadPaperToKB(
  arxivId: string,
  kbId: number
): Promise<DownloadResult> {
  try {
    const res = await fetch(`${RAG_BACKEND_URL}/api/v1/papers/download`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        arxiv_id: arxivId,
        kb_id: kbId,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        message: data.message || `下载失败: HTTP ${res.status}`,
      };
    }

    // 处理后端返回格式
    if (data.code === 0) {
      return {
        success: true,
        message: data.message || "下载成功",
        document_id: data.data?.document_id,
        local_backup_path: data.data?.local_backup_path,
      };
    }

    return {
      success: false,
      message: data.message || "下载失败",
    };
  } catch (e) {
    if (e instanceof TypeError && e.message === "Failed to fetch") {
      return {
        success: false,
        message: "无法连接到服务器，请检查后端是否启动",
      };
    }
    return {
      success: false,
      message: e instanceof Error ? e.message : "下载失败",
    };
  }
}

/**
 * 格式化作者列表
 * @param authors 作者数组
 * @param maxCount 最大显示数量
 */
export function formatAuthors(authors: string[], maxCount = 3): string {
  if (!authors || authors.length === 0) return "";
  if (authors.length <= maxCount) {
    return authors.join(", ");
  }
  return `${authors.slice(0, maxCount).join(", ")}, ...`;
}

/**
 * 格式化发表日期
 * @param dateStr ISO 日期字符串
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

/**
 * 格式化分类标签
 * @param categories 分类数组
 */
export function formatCategories(categories: string[]): string {
  if (!categories || categories.length === 0) return "";
  return categories.slice(0, 3).join(", ");
}