/**
 * 论文下载状态管理 Hook
 * 管理下载进度状态：搜索中 → 下载中 → 处理中 → 完成
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
  arxivId: string | null;
  paperTitle: string | null;
  error: string | null;
  documentId: number | null;
  startTime: number | null;
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

export function usePaperDownload() {
  const router = useRouter();
  const { t } = useI18n();
  
  const [status, setStatus] = useState<DownloadStatus>({
    phase: "idle",
    arxivId: null,
    paperTitle: null,
    error: null,
    documentId: null,
    startTime: null,
  });

  // 下载进度模拟（因为后端没有实时进度 API）
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 清理进度定时器
  const clearProgressInterval = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  // 开始下载
  const startDownload = useCallback(async (
    paper: Paper,
    kbId: number,
    options?: {
      onSuccess?: (result: DownloadResult) => void;
      autoNavigate?: boolean;
    }
  ) => {
    const { onSuccess, autoNavigate = true } = options || {};
    
    clearProgressInterval();
    
    setStatus({
      phase: "searching",
      arxivId: paper.arxiv_id,
      paperTitle: paper.title,
      error: null,
      documentId: null,
      startTime: Date.now(),
    });

    try {
      // 阶段1：搜索中（短暂显示）
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 阶段2：下载中
      setStatus(prev => ({ ...prev, phase: "downloading" }));
      
      const result = await downloadPaperToKB(paper.arxiv_id, kbId);
      
      if (!result.success) {
        throw new Error(result.message || "下载失败");
      }

      // 阶段3：处理中
      setStatus(prev => ({ 
        ...prev, 
        phase: "processing",
        documentId: result.document_id || null,
      }));

      // 模拟处理时间（实际后端可能已经处理完成）
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 阶段4：完成
      setStatus(prev => ({ ...prev, phase: "completed" }));
      
      const message = result.local_backup_path
        ? `${t.downloadSuccess || "论文已下载到知识库"}\n\n本地备份: ${result.local_backup_path}`
        : t.downloadSuccess || "论文已下载到知识库";
      
      toast.success(message, { duration: 3000 });

      // 调用成功回调
      onSuccess?.(result);

      // 自动跳转到知识库文档列表
      if (autoNavigate && result.document_id) {
        // 延迟跳转，让用户看到完成状态
        setTimeout(() => {
          router.push(`/paper?kb=${kbId}&highlight=${result.document_id}`);
        }, 1500);
      }

      return result;

    } catch (error) {
      setStatus(prev => ({
        ...prev,
        phase: "error",
        error: error instanceof Error ? error.message : "下载失败",
      }));
      
      toast.error(error instanceof Error ? error.message : "下载失败");
      
      return null;
    }
  }, [t, router, clearProgressInterval]);

  // 重置状态
  const resetStatus = useCallback(() => {
    clearProgressInterval();
    setStatus({
      phase: "idle",
      arxivId: null,
      paperTitle: null,
      error: null,
      documentId: null,
      startTime: null,
    });
  }, [clearProgressInterval]);

  // 获取当前阶段消息
  const getPhaseMessage = useCallback((phase: DownloadPhase): string => {
    return PHASE_MESSAGES[phase];
  }, []);

  // 获取预估剩余时间
  const getEstimatedTimeRemaining = useCallback((): number => {
    if (!status.startTime || status.phase === "idle" || status.phase === "completed" || status.phase === "error") {
      return 0;
    }

    const elapsed = (Date.now() - status.startTime) / 1000;
    const totalEstimated = PHASE_ESTIMATED_TIME[status.phase];
    const remaining = Math.max(0, totalEstimated - elapsed);
    
    return Math.ceil(remaining);
  }, [status]);

  // 获取进度百分比（基于阶段）
  const getProgressPercent = useCallback((): number => {
    switch (status.phase) {
      case "idle":
        return 0;
      case "searching":
        return 10;
      case "downloading":
        return 40;
      case "processing":
        return 80;
      case "completed":
        return 100;
      case "error":
        return 0;
      default:
        return 0;
    }
  }, [status.phase]);

  return {
    status,
    startDownload,
    resetStatus,
    getPhaseMessage,
    getEstimatedTimeRemaining,
    getProgressPercent,
    isDownloading: status.phase !== "idle" && status.phase !== "completed" && status.phase !== "error",
  };
}