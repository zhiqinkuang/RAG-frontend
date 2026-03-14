/**
 * 论文下载状态管理 Hook
 * 支持单篇和批量并行下载
 */

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import {
  downloadPaperToKB,
  type Paper,
  type DownloadResult,
} from "@/lib/paper-search";

export type DownloadPhase = 
  | "idle"           // 空闲
  | "searching"      // 搜索中（查找论文）
  | "downloading"    // 下载中（下载 PDF）
  | "processing"     // 处理中（解析、分块、向量化）
  | "completed"      // 完成
  | "error";         // 错误

export type DownloadStatus = {
  phase: DownloadPhase;
  arxivId: string;
  paperTitle: string;
  error: string | null;
  documentId: number | null;
  startTime: number | null;
  progress: number; // 0-100
};

export type BatchDownloadProgress = {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
};

const PHASE_MESSAGES: Record<DownloadPhase, string> = {
  idle: "",
  searching: "正在查找论文...",
  downloading: "正在下载 PDF...",
  processing: "正在处理文档...",
  completed: "下载完成！",
  error: "下载失败",
};

// 预估各阶段时间（秒）
const PHASE_ESTIMATED_TIME: Record<DownloadPhase, number> = {
  idle: 0,
  searching: 2,
  downloading: 10,
  processing: 15,
  completed: 0,
  error: 0,
};

// 最大并发下载数
const MAX_CONCURRENT_DOWNLOADS = 3;

export function usePaperDownload() {
  const router = useRouter();
  const { t } = useI18n();
  
  // 多个下载状态，按 arxiv_id 管理
  const [downloadMap, setDownloadMap] = useState<Map<string, DownloadStatus>>(new Map());
  
  // 批量下载进度
  const [batchProgress, setBatchProgress] = useState<BatchDownloadProgress | null>(null);
  
  // 取消下载的标记
  const cancelledRef = useRef<Set<string>>(new Set());

  // 更新单个下载状态
  const updateDownloadStatus = useCallback((arxivId: string, updates: Partial<DownloadStatus>) => {
    setDownloadMap(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(arxivId);
      if (existing) {
        newMap.set(arxivId, { ...existing, ...updates });
      }
      return newMap;
    });
  }, []);

  // 设置单个下载状态
  const setDownloadStatus = useCallback((arxivId: string, status: DownloadStatus) => {
    setDownloadMap(prev => {
      const newMap = new Map(prev);
      newMap.set(arxivId, status);
      return newMap;
    });
  }, []);

  // 删除单个下载状态
  const removeDownloadStatus = useCallback((arxivId: string) => {
    setDownloadMap(prev => {
      const newMap = new Map(prev);
      newMap.delete(arxivId);
      return newMap;
    });
  }, []);

  // 获取单个下载状态
  const getDownloadStatus = useCallback((arxivId: string): DownloadStatus | undefined => {
    return downloadMap.get(arxivId);
  }, [downloadMap]);

  // 检查是否正在下载
  const isDownloading = useCallback((arxivId?: string): boolean => {
    if (arxivId) {
      const status = downloadMap.get(arxivId);
      return status ? status.phase !== "idle" && status.phase !== "completed" && status.phase !== "error" : false;
    }
    // 检查是否有任何下载在进行
    for (const status of downloadMap.values()) {
      if (status.phase !== "idle" && status.phase !== "completed" && status.phase !== "error") {
        return true;
      }
    }
    return false;
  }, [downloadMap]);

  // 获取所有正在下载的论文
  const getActiveDownloads = useCallback((): DownloadStatus[] => {
    return Array.from(downloadMap.values()).filter(
      status => status.phase !== "idle" && status.phase !== "completed" && status.phase !== "error"
    );
  }, [downloadMap]);

  // 单篇下载
  const startDownload = useCallback(async (
    paper: Paper,
    kbId: number,
    options?: {
      onSuccess?: (result: DownloadResult) => void;
      autoNavigate?: boolean;
      silent?: boolean; // 是否静默模式（不显示 toast）
    }
  ) => {
    const { onSuccess, autoNavigate = true, silent = false } = options || {};
    const arxivId = paper.arxiv_id;
    
    // 检查是否已取消
    if (cancelledRef.current.has(arxivId)) {
      cancelledRef.current.delete(arxivId);
      return null;
    }

    // 初始化状态
    setDownloadStatus(arxivId, {
      phase: "searching",
      arxivId,
      paperTitle: paper.title,
      error: null,
      documentId: null,
      startTime: Date.now(),
      progress: 10,
    });

    try {
      // 阶段1：搜索中（短暂显示）
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 检查是否已取消
      if (cancelledRef.current.has(arxivId)) {
        removeDownloadStatus(arxivId);
        cancelledRef.current.delete(arxivId);
        return null;
      }
      
      // 阶段2：下载中
      updateDownloadStatus(arxivId, { phase: "downloading", progress: 30 });
      
      const result = await downloadPaperToKB(arxivId, kbId);
      
      // 检查是否已取消
      if (cancelledRef.current.has(arxivId)) {
        removeDownloadStatus(arxivId);
        cancelledRef.current.delete(arxivId);
        return null;
      }
      
      if (!result.success) {
        throw new Error(result.message || "下载失败");
      }

      // 阶段3：处理中
      updateDownloadStatus(arxivId, { 
        phase: "processing", 
        progress: 70,
        documentId: result.document_id || null,
      });

      // 模拟处理时间
      await new Promise(resolve => setTimeout(resolve, 800));

      // 检查是否已取消
      if (cancelledRef.current.has(arxivId)) {
        removeDownloadStatus(arxivId);
        cancelledRef.current.delete(arxivId);
        return null;
      }

      // 阶段4：完成
      updateDownloadStatus(arxivId, { phase: "completed", progress: 100 });
      
      if (!silent) {
        const message = result.local_backup_path
          ? `${t.downloadSuccess || "论文已下载到知识库"}\n\n本地备份: ${result.local_backup_path}`
          : t.downloadSuccess || "论文已下载到知识库";
        toast.success(message, { duration: 3000 });
      }

      // 调用成功回调
      onSuccess?.(result);

      // 自动跳转（单篇下载时）
      if (autoNavigate && result.document_id) {
        setTimeout(() => {
          router.push(`/paper-search?kb=${kbId}&highlight=${result.document_id}`);
        }, 1500);
      }

      return result;

    } catch (error) {
      updateDownloadStatus(arxivId, {
        phase: "error",
        error: error instanceof Error ? error.message : "下载失败",
        progress: 0,
      });
      
      if (!silent) {
        toast.error(error instanceof Error ? error.message : "下载失败");
      }
      
      return null;
    }
  }, [t, router, setDownloadStatus, updateDownloadStatus, removeDownloadStatus]);

  // 取消单个下载
  const cancelDownload = useCallback((arxivId: string) => {
    cancelledRef.current.add(arxivId);
    removeDownloadStatus(arxivId);
    toast.info(t.downloadCancelled || "下载已取消");
  }, [t, removeDownloadStatus]);

  // 批量并行下载（带并发限制）
  const startBatchDownload = useCallback(async (
    papers: Paper[],
    kbId: number,
    options?: {
      onComplete?: (results: { success: number; failed: number; results: Map<string, DownloadResult | null> }) => void;
      autoRefresh?: boolean;
    }
  ) => {
    const { onComplete, autoRefresh = true } = options || {};
    
    if (papers.length === 0) {
      toast.error(t.noPapersSelected || "未选择论文");
      return;
    }

    // 初始化批量进度
    const total = papers.length;
    let completed = 0;
    let failed = 0;
    const results = new Map<string, DownloadResult | null>();

    setBatchProgress({ total, completed: 0, failed: 0, inProgress: 0 });

    // 并发控制函数
    const downloadWithConcurrency = async () => {
      const queue = [...papers];
      const active: Promise<void>[] = [];

      const processNext = async (): Promise<void> => {
        const paper = queue.shift();
        if (!paper) return;

        // 检查是否已取消
        if (cancelledRef.current.has(paper.arxiv_id)) {
          cancelledRef.current.delete(paper.arxiv_id);
          completed++;
          setBatchProgress(prev => prev ? { ...prev, completed } : null);
          return processNext();
        }

        // 更新进行中数量
        setBatchProgress(prev => prev ? { ...prev, inProgress: prev.inProgress + 1 } : null);

        const result = await startDownload(paper, kbId, { 
          autoNavigate: false, 
          silent: true 
        });

        // 更新进度
        if (result?.success) {
          completed++;
          results.set(paper.arxiv_id, result);
        } else {
          failed++;
          results.set(paper.arxiv_id, result);
        }

        setBatchProgress(prev => prev ? { 
          ...prev, 
          completed, 
          failed,
          inProgress: prev.inProgress - 1 
        } : null);

        // 继续处理下一个
        return processNext();
      };

      // 启动初始并发任务
      const initialCount = Math.min(MAX_CONCURRENT_DOWNLOADS, queue.length);
      for (let i = 0; i < initialCount; i++) {
        active.push(processNext());
      }

      await Promise.all(active);
    };

    await downloadWithConcurrency();

    // 显示结果
    if (failed === 0) {
      toast.success(
        t.batchDownloadSuccess?.replace("{count}", String(completed)) || 
        `成功下载 ${completed} 篇论文`,
        { duration: 4000 }
      );
    } else if (completed === 0) {
      toast.error(
        t.batchDownloadFailed?.replace("{count}", String(failed)) || 
        `下载失败，共 ${failed} 篇`,
        { duration: 4000 }
      );
    } else {
      toast.warning(
        t.batchDownloadPartial?.replace("{success}", String(completed)).replace("{failed}", String(failed)) ||
        `下载完成：成功 ${completed} 篇，失败 ${failed} 篇`,
        { duration: 5000 }
      );
    }

    // 调用完成回调
    onComplete?.({ success: completed, failed, results });

    // 自动刷新文档列表
    if (autoRefresh && completed > 0) {
      setTimeout(() => {
        router.push(`/paper-search?kb=${kbId}`);
      }, 1500);
    }

    // 清理批量进度
    setTimeout(() => {
      setBatchProgress(null);
    }, 2000);

    return { completed, failed, results };
  }, [startDownload, t, router]);

  // 取消所有下载
  const cancelAllDownloads = useCallback(() => {
    downloadMap.forEach((status, arxivId) => {
      if (status.phase !== "completed" && status.phase !== "error") {
        cancelledRef.current.add(arxivId);
      }
    });
    setDownloadMap(new Map());
    setBatchProgress(null);
    toast.info(t.allDownloadsCancelled || "所有下载已取消");
  }, [downloadMap, t]);

  // 重置状态
  const resetStatus = useCallback((arxivId?: string) => {
    if (arxivId) {
      removeDownloadStatus(arxivId);
    } else {
      setDownloadMap(new Map());
      setBatchProgress(null);
    }
  }, [removeDownloadStatus]);

  // 获取当前阶段消息
  const getPhaseMessage = useCallback((phase: DownloadPhase): string => {
    return PHASE_MESSAGES[phase];
  }, []);

  // 获取进度百分比
  const getProgressPercent = useCallback((status?: DownloadStatus): number => {
    if (!status) return 0;
    return status.progress;
  }, []);

  // 获取所有下载状态列表
  const getAllDownloads = useCallback((): DownloadStatus[] => {
    return Array.from(downloadMap.values());
  }, [downloadMap]);

  return {
    // 状态
    downloadMap,
    batchProgress,
    
    // 单篇下载
    startDownload,
    getDownloadStatus,
    
    // 批量下载
    startBatchDownload,
    
    // 取消下载
    cancelDownload,
    cancelAllDownloads,
    
    // 状态查询
    isDownloading,
    getActiveDownloads,
    getAllDownloads,
    
    // 工具方法
    resetStatus,
    getPhaseMessage,
    getProgressPercent,
    
    // 兼容旧 API（返回第一个活跃下载的状态）
    status: Array.from(downloadMap.values()).find(
      s => s.phase !== "idle" && s.phase !== "completed" && s.phase !== "error"
    ) || {
      phase: "idle" as DownloadPhase,
      arxivId: null,
      paperTitle: null,
      error: null,
      documentId: null,
      startTime: null,
      progress: 0,
    },
  };
}