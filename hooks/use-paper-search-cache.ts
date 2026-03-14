/**
 * 论文搜索结果缓存 Hook
 * 使用内存缓存避免重复请求相同关键词
 */

import { useState, useCallback, useRef } from "react";
import type { Paper, SearchResult } from "@/lib/paper-search";

type CacheEntry = {
  papers: Paper[];
  total: number;
  hasMore: boolean;
  timestamp: number;
  query: string;
};

type CacheStore = {
  [query: string]: CacheEntry;
};

// 缓存有效期：5分钟
const CACHE_TTL = 5 * 60 * 1000;

// 全局缓存存储（跨组件共享）
const globalCache: CacheStore = {};

export function usePaperSearchCache() {
  const [isFromCache, setIsFromCache] = useState(false);

  // 获取缓存
  const getCachedResult = useCallback((query: string): SearchResult | null => {
    const normalizedQuery = query.trim().toLowerCase();
    const entry = globalCache[normalizedQuery];
    
    if (!entry) return null;
    
    // 检查是否过期
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      delete globalCache[normalizedQuery];
      return null;
    }
    
    return {
      papers: entry.papers,
      total: entry.total,
      hasMore: entry.hasMore,
      query: entry.query,
    };
  }, []);

  // 设置缓存
  const setCachedResult = useCallback((result: SearchResult) => {
    const normalizedQuery = result.query.trim().toLowerCase();
    globalCache[normalizedQuery] = {
      papers: result.papers,
      total: result.total,
      hasMore: result.hasMore ?? false,
      timestamp: Date.now(),
      query: result.query,
    };
  }, []);

  // 清除缓存
  const clearCache = useCallback((query?: string) => {
    if (query) {
      const normalizedQuery = query.trim().toLowerCase();
      delete globalCache[normalizedQuery];
    } else {
      // 清除所有缓存
      Object.keys(globalCache).forEach(key => delete globalCache[key]);
    }
  }, []);

  // 获取缓存信息
  const getCacheInfo = useCallback((query: string) => {
    const normalizedQuery = query.trim().toLowerCase();
    const entry = globalCache[normalizedQuery];
    
    if (!entry) return null;
    
    const age = Date.now() - entry.timestamp;
    const remainingTTL = Math.max(0, CACHE_TTL - age);
    
    return {
      exists: true,
      age: Math.floor(age / 1000),
      remainingTTL: Math.floor(remainingTTL / 1000),
      count: entry.papers.length,
    };
  }, []);

  return {
    getCachedResult,
    setCachedResult,
    clearCache,
    getCacheInfo,
    isFromCache,
    setIsFromCache,
  };
}

// 导出全局缓存清除函数（用于强制刷新）
export function clearAllPaperSearchCache() {
  Object.keys(globalCache).forEach(key => delete globalCache[key]);
}