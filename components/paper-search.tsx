"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, Download, ExternalLink, FileText, Loader2, 
  ChevronDown, ChevronUp, Check, Clock, 
  RefreshCw, Database, ArrowRight, ArrowLeft, Sparkles, Hash, 
  Flame, History, X, Plus, Tag, MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import {
  searchPapers,
  smartSearchPapers,
  formatAuthors,
  formatDate,
  formatCategories,
  type Paper,
  type PaperSource,
  type ExtractedInfo,
} from "@/lib/paper-search";
import { listKnowledgeBases, type KnowledgeBase } from "@/lib/rag-kb";
import { usePaperSearchCache } from "@/hooks/use-paper-search-cache";
import { usePaperDownload, type DownloadPhase } from "@/hooks/use-paper-download";

// 搜索模式类型 - 简化为两种模式
type SearchMode = "keyword" | "smart";

// 输入分类类型
interface InputClassification {
  type: "keyword" | "natural" | "smart";
  confidence: number;
  reason: string;
}

// 分类输入文本
function classifyInput(text: string): InputClassification | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  
  const charCount = trimmed.length;
  const wordCount = trimmed.split(/\s+/).filter(w => w.length > 0).length;
  const lineCount = trimmed.split('\n').length;
  
  // 1. 短关键词：单个词或很短
  if (wordCount <= 2 && charCount < 20) {
    return { type: "keyword", confidence: 0.95, reason: "short_keyword" };
  }
  
  // 2. 多行文本（论文列表、摘要等）
  if (lineCount > 2) {
    return { type: "smart", confidence: 0.9, reason: "multiline_text" };
  }
  
  // 3. 长文本（> 100 字符）
  if (charCount > 100) {
    return { type: "smart", confidence: 0.85, reason: "long_text" };
  }
  
  // 4. 中等长度自然语言
  if (wordCount > 2 && charCount >= 20) {
    return { type: "natural", confidence: 0.8, reason: "natural_language" };
  }
  
  // 默认：关键词搜索
  return { type: "keyword", confidence: 0.7, reason: "default" };
}

// 获取模式标签
function getModeLabel(type: "keyword" | "natural" | "smart", lang: string): string {
  const labels = {
    keyword: lang === "zh" ? "关键词搜索" : "Keyword Search",
    natural: lang === "zh" ? "自然语言" : "Natural Language",
    smart: lang === "zh" ? "智能识别" : "Smart Detection",
  };
  return labels[type];
}

// 排序类型
type SortOrder = "default" | "newest" | "oldest";

// 搜索历史存储键
const SEARCH_HISTORY_KEY = "paper-search-history";
const MAX_HISTORY_ITEMS = 10;

// 热门搜索词
const HOT_SEARCHES_ZH = [
  "深度学习",
  "Transformer",
  "大语言模型",
  "图神经网络",
  "强化学习",
  "计算机视觉",
  "自然语言处理",
  "推荐系统",
];

const HOT_SEARCHES_EN = [
  "Deep Learning",
  "Transformer",
  "Large Language Models",
  "Graph Neural Networks",
  "Reinforcement Learning",
  "Computer Vision",
  "NLP",
  "Recommendation Systems",
];

// 示例自然语言查询
const EXAMPLE_QUERIES_ZH = [
  "帮我找关于深度学习图像分类的最新论文",
  "Transformer 在自然语言处理中的应用研究",
  "大语言模型推理加速和优化方法",
  "图神经网络在推荐系统中的应用",
];

const EXAMPLE_QUERIES_EN = [
  "Find recent papers on deep learning for image classification",
  "Transformer applications in natural language processing",
  "Large language model inference acceleration methods",
  "Graph neural networks for recommendation systems",
];

// 下载阶段对应的图标和颜色
const PHASE_CONFIG: Record<DownloadPhase, { icon: React.ReactNode; color: string }> = {
  idle: { icon: <Download className="h-4 w-4" />, color: "" },
  searching: { icon: <Search className="h-4 w-4 animate-pulse" />, color: "text-blue-500" },
  downloading: { icon: <Download className="h-4 w-4 animate-bounce" />, color: "text-yellow-500" },
  processing: { icon: <RefreshCw className="h-4 w-4 animate-spin" />, color: "text-orange-500" },
  completed: { icon: <Check className="h-4 w-4" />, color: "text-green-500" },
  error: { icon: <FileText className="h-4 w-4" />, color: "text-red-500" },
};

// 下载阶段文本映射
const PHASE_TEXT: Record<DownloadPhase, { zh: string; en: string }> = {
  idle: { zh: "", en: "" },
  searching: { zh: "正在查找论文...", en: "Finding paper..." },
  downloading: { zh: "正在下载 PDF...", en: "Downloading PDF..." },
  processing: { zh: "正在处理文档...", en: "Processing document..." },
  completed: { zh: "下载完成！", en: "Download complete!" },
  error: { zh: "下载失败", en: "Download failed" },
};

// 搜索历史管理
function getSearchHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addToSearchHistory(query: string): void {
  if (!query.trim()) return;
  const history = getSearchHistory();
  const filtered = history.filter(item => item !== query.trim());
  const newHistory = [query.trim(), ...filtered].slice(0, MAX_HISTORY_ITEMS);
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
}

function clearSearchHistory(): void {
  localStorage.removeItem(SEARCH_HISTORY_KEY);
}

// 获取论文来源标签样式
function getSourceStyle(source?: PaperSource): { bg: string; text: string; label: string } {
  // 目前只支持 arXiv
  return { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300", label: "arXiv" };
}

// 高亮关键词
function highlightText(text: string, keywords: string[]): React.ReactNode {
  if (!keywords.length || !text) return text;
  
  // 过滤空关键词并按长度降序排序（优先匹配长词）
  const validKeywords = keywords.filter(k => k.trim()).sort((a, b) => b.length - a.length);
  if (!validKeywords.length) return text;
  
  // 构建正则表达式，匹配任意关键词（不区分大小写）
  const regex = new RegExp(`(${validKeywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  
  const parts = text.split(regex);
  
  return parts.map((part, index) => {
    // 检查是否匹配关键词（不区分大小写）
    const isMatch = validKeywords.some(k => k.toLowerCase() === part.toLowerCase());
    if (isMatch) {
      return (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800/50 text-inherit rounded px-0.5">
          {part}
        </mark>
      );
    }
    return part;
  });
}

// 从搜索词提取关键词
function extractKeywords(searchQuery: string, extractedInfo?: ExtractedInfo | null): string[] {
  const keywords: string[] = [];
  
  // 添加智能搜索提取的关键词
  if (extractedInfo?.keywords?.length) {
    keywords.push(...extractedInfo.keywords);
  }
  
  // 添加搜索词中的关键词
  if (searchQuery.trim()) {
    // 分词：按空格、逗号、顿号分割
    const words = searchQuery.trim().split(/[\s,，、]+/).filter(w => w.length > 1);
    keywords.push(...words);
  }
  
  // 去重
  return [...new Set(keywords.map(k => k.trim()).filter(k => k.length > 1))];
}

export function PaperSearch() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("smart"); // 默认智能搜索
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchTime, setSearchTime] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKB, setSelectedKB] = useState<string>("");
  const [expandedAbstracts, setExpandedAbstracts] = useState<Set<string>>(new Set());
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>("default");
  
  // 智能搜索状态
  const [inputType, setInputType] = useState<InputClassification | null>(null);
  const [extractedInfo, setExtractedInfo] = useState<ExtractedInfo | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showSmartArea, setShowSmartArea] = useState(false); // 是否展开智能识别区域
  
  // 使用缓存 Hook
  const { 
    getCachedResult, 
    setCachedResult, 
    getCacheInfo, 
    isFromCache, 
    setIsFromCache 
  } = usePaperSearchCache();
  
  // 使用下载状态 Hook
  const { 
    status: downloadStatus, 
    startDownload, 
    isDownloading,
    getProgressPercent,
  } = usePaperDownload();

  // 防抖定时器
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // 实际执行搜索的函数
  const performSearch = useCallback(async (searchQuery: string, forceRefresh = false, appendResults = false) => {
    if (!searchQuery.trim()) {
      toast.error(t.enterKeyword || "请输入搜索关键词");
      return;
    }

    // 如果不是追加结果，重置排序
    if (!appendResults) {
      setSortOrder("default");
    }

    // 如果不是追加结果，检查缓存
    if (!forceRefresh && !appendResults) {
      const cached = getCachedResult(searchQuery.trim());
      if (cached) {
        setPapers(cached.papers);
        setTotalResults(cached.total);
        setHasMore(cached.hasMore ?? false);
        setIsFromCache(true);
        if (cached.papers.length === 0) {
          toast.info(t.noResults || "未找到相关论文");
        }
        return;
      }
    }

    if (!appendResults) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setSearchTime(null);
    setIsFromCache(false);
    
    const startTime = Date.now();
    const offset = appendResults ? papers.length : 0;
    
    try {
      // 根据搜索模式选择API
      if (searchMode === "smart") {
        // 智能搜索模式：调用统一API
        const result = await smartSearchPapers(searchQuery.trim(), {
          maxResults: 10,
          offset,
        });
        
        if (appendResults) {
          setPapers(prev => [...prev, ...result.papers]);
        } else {
          setPapers(result.papers);
        }
        setTotalResults(result.total);
        setHasMore(result.hasMore ?? false);
        
        // 显示提取信息
        if (result.extracted_info) {
          setExtractedInfo(result.extracted_info);
        }
        
        // 缓存结果（仅首次搜索）
        if (!appendResults) {
          setCachedResult(result);
          addToSearchHistory(searchQuery.trim());
          setSearchHistory(getSearchHistory());
        }
        
        setSearchTime(Date.now() - startTime);
        
        if (result.papers.length === 0 && !appendResults) {
          toast.info(t.noResults || "未找到相关论文");
        }
      } else {
        // 关键词模式：使用原有API
        const result = await searchPapers(searchQuery.trim(), {
          maxResults: 10,
          offset,
        });
        
        if (appendResults) {
          setPapers(prev => [...prev, ...result.papers]);
        } else {
          setPapers(result.papers);
        }
        setTotalResults(result.total);
        setHasMore(result.hasMore ?? false);
        
        // 缓存结果（仅首次搜索）
        if (!appendResults) {
          setCachedResult(result);
          addToSearchHistory(searchQuery.trim());
          setSearchHistory(getSearchHistory());
        }
        
        setSearchTime(Date.now() - startTime);
        
        if (result.papers.length === 0 && !appendResults) {
          toast.info(t.noResults || "未找到相关论文");
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "搜索失败");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [searchMode, papers.length, getCachedResult, setCachedResult, setIsFromCache, t]);

  // 防抖搜索函数
  const debouncedSearch = useCallback((searchQuery: string, forceRefresh = false) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      performSearch(searchQuery, forceRefresh, false);
    }, 500);
  }, [performSearch]);

  // 热门搜索词
  const hotSearches = lang === "zh" ? HOT_SEARCHES_ZH : HOT_SEARCHES_EN;
  const exampleQueries = lang === "zh" ? EXAMPLE_QUERIES_ZH : EXAMPLE_QUERIES_EN;

  // 加载知识库列表并自动选择用户的知识库
  const loadKnowledgeBases = useCallback(async () => {
    try {
      const response = await listKnowledgeBases(1, 100);
      const kbs = response.data?.knowledge_bases || [];
      setKnowledgeBases(kbs);
      
      // 自动选择第一个知识库
      if (kbs.length > 0) {
        setSelectedKB(String(kbs[0].ID));
      }
    } catch (error) {
      console.error("Failed to load knowledge bases:", error);
      toast.error("加载知识库失败，请检查后端服务是否启动");
    }
  }, []);

  // 搜索论文（带防抖）
  const handleSearch = (forceRefresh = false, appendResults = false) => {
    // 加载更多不使用防抖
    if (appendResults) {
      performSearch(query, forceRefresh, true);
      return;
    }
    // 正常搜索使用防抖
    debouncedSearch(query, forceRefresh);
  };

  // 加载更多
  const handleLoadMore = () => {
    handleSearch(false, true);
  };

  // 下载论文到知识库
  const handleDownload = async (paper: Paper) => {
    if (!selectedKB) {
      toast.error(t.noKB || "请先创建知识库");
      return;
    }

    await startDownload(paper, Number(selectedKB), {
      autoNavigate: true,
    });
  };

  // 切换摘要展开状态
  const toggleAbstract = (arxivId: string) => {
    setExpandedAbstracts((prev) => {
      const next = new Set(prev);
      if (next.has(arxivId)) {
        next.delete(arxivId);
      } else {
        next.add(arxivId);
      }
      return next;
    });
  };

  // 点击历史记录项
  const handleHistoryClick = (historyQuery: string) => {
    setQuery(historyQuery);
    setShowHistory(false);
  };

  // 清空历史
  const handleClearHistory = () => {
    clearSearchHistory();
    setSearchHistory([]);
    setShowHistory(false);
    toast.success(lang === "zh" ? "历史已清空" : "History cleared");
  };

  // 点击示例查询
  const handleExampleClick = (exampleQuery: string) => {
    setQuery(exampleQuery);
  };

  // 点击热门搜索
  const handleHotSearchClick = (hotQuery: string) => {
    setQuery(hotQuery);
  };

  // 初始化
  useEffect(() => {
    loadKnowledgeBases();
    setSearchHistory(getSearchHistory());
  }, []);

  // 清理防抖定时器
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // 获取当前选中的知识库名称
  const selectedKBName = knowledgeBases.find(kb => String(kb.ID) === selectedKB)?.name;

  // 获取缓存信息
  const cacheInfo = query.trim() ? getCacheInfo(query.trim()) : null;

  // 格式化搜索时间
  const formatSearchTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // 获取阶段文本
  const getPhaseText = (phase: DownloadPhase): string => {
    return lang === "zh" ? PHASE_TEXT[phase].zh : PHASE_TEXT[phase].en;
  };

  // 去重函数：根据 arxiv_id 去重
  const deduplicatePapers = useCallback((paperList: Paper[]): Paper[] => {
    const seen = new Set<string>();
    return paperList.filter(paper => {
      if (seen.has(paper.arxiv_id)) {
        return false;
      }
      seen.add(paper.arxiv_id);
      return true;
    });
  }, []);

  // 排序论文列表
  const getSortedPapers = useCallback((paperList: Paper[]): Paper[] => {
    if (sortOrder === "default") return paperList;
    
    return [...paperList].sort((a, b) => {
      const dateA = new Date(a.published).getTime();
      const dateB = new Date(b.published).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });
  }, [sortOrder]);

  // 获取排序后的论文（先去重再排序）
  const sortedPapers = getSortedPapers(deduplicatePapers(papers));
  
  // 提取关键词用于高亮
  const highlightKeywords = extractKeywords(query, extractedInfo);

  // 搜索模式切换
  const handleModeChange = (mode: SearchMode) => {
    setSearchMode(mode);
    setQuery("");
    setInputType(null);
    setExtractedInfo(null);
    setPapers([]);
    setTotalResults(0);
    setHasMore(false);
    setShowSmartArea(false);
  };

  // 输入变化处理（带自动检测）
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setQuery(value);
    
    // 实时检测输入类型
    if (value.trim()) {
      const classification = classifyInput(value);
      setInputType(classification);
      
      // 长文本自动展开智能识别区域
      if (classification?.type === "smart" && !showSmartArea) {
        setShowSmartArea(true);
      }
    } else {
      setInputType(null);
    }
  };

  // 统一搜索入口
  const handleUnifiedSearch = async () => {
    if (!query.trim()) {
      toast.error(t.enterKeyword || "请输入搜索内容");
      return;
    }
    
    // 隐藏历史记录
    setShowHistory(false);
    
    // 清空之前的提取结果
    setExtractedInfo(null);
    
    // 执行搜索
    await performSearch(query, false, false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* 两行头部布局 */}
      <div className="shrink-0 border-b relative">
        {/* 第一行：返回按钮 + 标题 + 知识库名称 */}
        <div className="h-12 sm:h-14 flex items-center justify-between px-2 sm:px-4 border-b">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
            {/* 返回按钮 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/")}
              title={t.backToChat || "返回聊天"}
              className="h-8 w-8 sm:h-9 sm:w-9 shrink-0"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            {/* 标题 */}
            <h1 className="text-sm sm:text-base md:text-lg font-semibold truncate">
              {t.paperSearch || "论文搜索"}
            </h1>
          </div>
          {/* 右侧知识库名称 - 平板及以上显示 */}
          {selectedKBName && (
            <div className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
              <Database className="h-4 w-4" />
              <span className="truncate max-w-32 lg:max-w-48">{selectedKBName}</span>
            </div>
          )}
        </div>

        {/* 第二行：搜索模式 + 搜索框 + 知识库选择 */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 sm:py-2.5 lg:py-0 lg:h-14">
          {/* 搜索模式切换 - 简化为两种模式 */}
          <div className="flex gap-1 shrink-0 p-1 bg-muted/50 rounded-lg border">
            <Button
              variant={searchMode === "smart" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleModeChange("smart")}
              className={`h-7 px-2 sm:px-2.5 ${searchMode === "smart" ? "shadow-sm" : "hover:bg-background/80"}`}
              title={t.smartSearch || "智能搜索"}
            >
              <Sparkles className="h-3.5 w-3.5 sm:mr-1" />
              <span className="text-xs hidden md:inline">{lang === "zh" ? "智能搜索" : "Smart"}</span>
            </Button>
            <Button
              variant={searchMode === "keyword" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleModeChange("keyword")}
              className={`h-7 px-2 sm:px-2.5 ${searchMode === "keyword" ? "shadow-sm" : "hover:bg-background/80"}`}
              title={t.keywordSearch || "关键词搜索"}
            >
              <Hash className="h-3.5 w-3.5 sm:mr-1" />
              <span className="text-xs hidden md:inline">{lang === "zh" ? "关键词" : "Keyword"}</span>
            </Button>
          </div>

          {/* 分隔线 - 桌面端显示 */}
          <div className="hidden lg:block w-px h-8 bg-border shrink-0" />

          {/* 搜索输入框 - 智能模式使用统一输入框 */}
          <div className="relative flex-1 min-w-0">
            {searchMode === "smart" && showSmartArea ? (
              // 长文本自动展开 textarea
              <textarea
                placeholder={lang === "zh" ? "粘贴论文摘要、描述或引用文字..." : "Paste paper abstract, description or citation..."}
                value={query}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleUnifiedSearch();
                  }
                }}
                onFocus={() => setShowHistory(true)}
                onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                className="w-full h-[50px] sm:h-[60px] md:h-[80px] px-3 py-2 text-sm border-2 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-background"
                disabled={loading}
              />
            ) : (
              <Input
                placeholder={searchMode === "smart"
                  ? (lang === "zh" ? "输入关键词、描述或粘贴论文摘要..." : "Enter keywords, description or paste paper abstract...")
                  : (t.paperSearchPlaceholder || "输入关键词搜索 arXiv 论文...")
                }
                value={query}
                onChange={handleInputChange}
                onKeyDown={(e) => e.key === "Enter" && handleUnifiedSearch()}
                onFocus={() => setShowHistory(true)}
                onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                className="w-full h-9 sm:h-10 border-2 focus:border-primary"
                disabled={loading}
              />
            )}
            
            {/* 智能模式指示器 */}
            {searchMode === "smart" && inputType && !loading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground">
                {inputType.type === "keyword" && <Hash className="h-3 w-3" />}
                {inputType.type === "natural" && <MessageSquare className="h-3 w-3" />}
                {inputType.type === "smart" && <Sparkles className="h-3 w-3" />}
                <span className="hidden lg:inline">{getModeLabel(inputType.type, lang)}</span>
              </div>
            )}
            
            {/* 缓存指示器（关键词模式） */}
            {searchMode === "keyword" && cacheInfo && !loading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{cacheInfo.remainingTTL}s</span>
              </div>
            )}
          </div>

          {/* 按钮组 */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* 搜索按钮 */}
            <Button onClick={handleUnifiedSearch} disabled={loading} className="h-9 px-3 sm:px-4 flex-1 sm:flex-none">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="sm:hidden ml-2">{lang === "zh" ? "搜索" : "Search"}</span>
            </Button>
            
            {/* 强制刷新按钮 - 桌面端显示 */}
            {papers.length > 0 && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => performSearch(query, true, false)}
                disabled={loading}
                title={lang === "zh" ? "强制刷新（忽略缓存）" : "Force refresh (ignore cache)"}
                className="hidden md:flex h-9 w-9 shrink-0"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            )}

            {/* 分隔线 - 桌面端显示 */}
            <div className="hidden lg:block w-px h-8 bg-border shrink-0" />

            {/* 知识库选择 - 使用独特的卡片样式，桌面端显示 */}
            {knowledgeBases.length > 0 && (
              <div className="hidden md:flex items-center gap-2 shrink-0 px-2 sm:px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <select
                  className="h-7 bg-transparent text-sm font-medium text-blue-700 dark:text-blue-300 focus:outline-none cursor-pointer max-w-24 lg:max-w-none"
                  value={selectedKB}
                  onChange={(e) => setSelectedKB(e.target.value)}
                >
                  {knowledgeBases.map((kb) => (
                    <option key={kb.ID} value={String(kb.ID)} className="bg-background text-foreground text-sm">
                      {kb.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* 移动端知识库选择 - 显示在第三行 */}
        {knowledgeBases.length > 0 && (
          <div className="md:hidden px-2 pb-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <Database className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <select
                className="flex-1 h-8 bg-transparent text-base font-medium text-blue-700 dark:text-blue-300 focus:outline-none cursor-pointer"
                value={selectedKB}
                onChange={(e) => setSelectedKB(e.target.value)}
              >
                {knowledgeBases.map((kb) => (
                  <option key={kb.ID} value={String(kb.ID)} className="bg-background text-foreground text-base">
                    {kb.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* 搜索历史下拉 - 输入框获得焦点时显示 */}
        {showHistory && searchHistory.length > 0 && (
          <div className="absolute z-10 mt-1 w-full max-w-md bg-popover border rounded-md shadow-lg left-[200px]">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <span className="text-sm font-medium flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" />
                {t.recentSearches}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto py-1 px-2 text-xs text-muted-foreground"
                onClick={handleClearHistory}
              >
                {t.clearHistory}
              </Button>
            </div>
            <div className="max-h-48 overflow-auto py-1">
              {searchHistory.map((item, index) => (
                <button
                  key={index}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
                  onClick={() => handleHistoryClick(item)}
                >
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate">{item}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 智能识别结果展示区域 */}
      {searchMode === "smart" && extractedInfo && (
        <div className="p-4 border-b bg-muted/30">
          <div className="p-3 border rounded-md bg-background space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              {t.extractedInfo || lang === "zh" ? "识别结果" : "Extracted Info"}
            </h4>
            {extractedInfo.detected_title && (
              <div className="text-sm">
                <span className="text-muted-foreground">{t.extractedTitle || (lang === "zh" ? "识别标题" : "Detected Title")}: </span>
                <span className="font-medium">{extractedInfo.detected_title}</span>
              </div>
            )}
            {extractedInfo.keywords && extractedInfo.keywords.length > 0 && (
              <div className="text-sm">
                <span className="text-muted-foreground">{t.extractedKeywords || (lang === "zh" ? "关键词" : "Keywords")}: </span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {extractedInfo.keywords.map((keyword, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary"
                    >
                      <Tag className="h-3 w-3 mr-1" />
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {extractedInfo.suggested_query && (
              <div className="text-sm">
                <span className="text-muted-foreground">{lang === "zh" ? "搜索词" : "Search Query"}: </span>
                <span className="font-medium text-primary">{extractedInfo.suggested_query}</span>
              </div>
            )}
            {extractedInfo.confidence && (
              <div className="text-xs text-muted-foreground">
                {lang === "zh" ? "置信度" : "Confidence"}: {Math.round(extractedInfo.confidence * 100)}%
              </div>
            )}
          </div>
        </div>
      )}

      {/* 热门搜索/示例查询（仅在无结果时显示） */}
      {papers.length === 0 && !loading && (
        <div className="px-2 sm:px-4 py-2 sm:py-3 border-b bg-muted/20">
          {searchMode === "keyword" ? (
            <div className="flex items-start gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0 pt-0.5">
                <Flame className="h-3.5 w-3.5 text-orange-500" />
                <span className="hidden xs:inline">{t.hotSearches || (lang === "zh" ? "热门搜索" : "Hot Searches")}:</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {hotSearches.slice(0, 4).map((hot, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 px-2"
                    onClick={() => handleHotSearchClick(hot)}
                  >
                    {hot}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {/* 热门搜索 */}
              <div className="flex items-start gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0 pt-0.5">
                  <Flame className="h-3.5 w-3.5 text-orange-500" />
                  <span className="hidden xs:inline">{t.hotSearches || (lang === "zh" ? "热门搜索" : "Hot Searches")}:</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {hotSearches.slice(0, 3).map((hot, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => handleHotSearchClick(hot)}
                    >
                      {hot}
                    </Button>
                  ))}
                </div>
              </div>
              {/* 示例查询 - 平板及以上显示 */}
              <div className="hidden md:flex items-start gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1 pt-0.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  {t.exampleQueries || (lang === "zh" ? "示例查询" : "Examples")}:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {exampleQueries.slice(0, 2).map((example, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => handleExampleClick(example)}
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      {example.length > 30 ? example.slice(0, 30) + "..." : example}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 下载进度条 */}
      {downloadStatus.phase !== "idle" && (
        <div className="px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className={PHASE_CONFIG[downloadStatus.phase].color}>
              {PHASE_CONFIG[downloadStatus.phase].icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">
                  {getPhaseText(downloadStatus.phase)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {getProgressPercent()}%
                </span>
              </div>
              <Progress value={getProgressPercent()} className="h-1.5" />
              {downloadStatus.paperTitle && (
                <p className="text-xs text-muted-foreground mt-1 truncate max-w-md">
                  {downloadStatus.paperTitle}
                </p>
              )}
            </div>
            {downloadStatus.phase === "completed" && (
              <Button
                size="sm"
                variant="ghost"
                className="text-green-600 hover:text-green-700"
                onClick={() => router.push(`/paper-search?kb=${selectedKB}`)}
              >
                {lang === "zh" ? "查看文档" : "View Docs"}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 搜索结果 */}
      <div className="flex-1 overflow-auto p-2 sm:p-4">
        {papers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <FileText className="h-12 w-12 mb-4" />
            {loading && (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">{t.searching || "搜索中..."}</p>
                <p className="text-xs text-muted-foreground">
                  {lang === "zh" ? "预计需要 2-5 秒" : "Estimated 2-5 seconds"}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* 排序和来源统计 */}
            <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
              {/* 来源统计 */}
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded">
                  arXiv: {papers.length}
                </span>
              </div>
              {/* 排序选择器 */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground hidden sm:inline">
                  {lang === "zh" ? "排序" : "Sort"}:
                </label>
                <select
                  className="h-8 rounded-md border bg-background px-2 text-base sm:text-xs"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                >
                  <option value="default">{lang === "zh" ? "默认" : "Default"}</option>
                  <option value="newest">{lang === "zh" ? "最新优先" : "Newest"}</option>
                  <option value="oldest">{lang === "zh" ? "最早优先" : "Oldest"}</option>
                </select>
              </div>
            </div>

            {/* 论文列表 - 响应式网格布局：移动端单列，平板双列，桌面三列 */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
              {sortedPapers.map((paper) => {
                const sourceStyle = getSourceStyle(paper.source);
                return (
                  <div
                    key={paper.arxiv_id}
                    className={`border rounded-lg p-2.5 sm:p-3 lg:p-4 transition-colors ${
                      downloadStatus.arxivId === paper.arxiv_id && downloadStatus.phase !== "idle"
                        ? "bg-primary/5 border-primary/30"
                        : "hover:bg-accent/50"
                    }`}
                  >
                    {/* 标题和来源标签 */}
                    <div className="flex items-start gap-2 mb-1.5 sm:mb-2">
                      <h3 className="text-sm sm:text-base lg:text-lg font-semibold leading-tight flex-1 line-clamp-2">
                        {highlightText(paper.title, highlightKeywords)}
                      </h3>
                      <span className={`shrink-0 text-xs px-1.5 sm:px-2 py-0.5 rounded ${sourceStyle.bg} ${sourceStyle.text}`}>
                        {sourceStyle.label}
                      </span>
                    </div>
                    
                    {/* 元信息 */}
                    <div className="flex flex-wrap gap-1 sm:gap-2 text-xs text-muted-foreground mb-2 sm:mb-3">
                      <span className="truncate max-w-24 sm:max-w-32 md:max-w-none">{formatAuthors(paper.authors, 2)}</span>
                      <span>·</span>
                      <span>{formatDate(paper.published)}</span>
                      {paper.categories.length > 0 && (
                        <>
                          <span className="hidden sm:inline">·</span>
                          <span className="hidden sm:inline text-xs bg-secondary px-1.5 py-0.5 rounded truncate max-w-20 md:max-w-24">
                            {formatCategories(paper.categories)}
                          </span>
                        </>
                      )}
                    </div>

                    {/* 摘要 */}
                    <div className="mb-2 sm:mb-3">
                      <p
                        className={`text-xs sm:text-sm text-muted-foreground ${
                          !expandedAbstracts.has(paper.arxiv_id) ? "line-clamp-2 lg:line-clamp-3" : ""
                        }`}
                      >
                        {highlightText(paper.abstract, highlightKeywords)}
                      </p>
                      {paper.abstract.length > 200 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1 h-auto p-0 text-primary text-xs"
                          onClick={() => toggleAbstract(paper.arxiv_id)}
                        >
                          {expandedAbstracts.has(paper.arxiv_id) ? (
                            <>
                              {t.collapseAbstract || "收起"} <ChevronUp className="h-3 w-3 ml-1" />
                            </>
                          ) : (
                            <>
                              {t.expandAbstract || "展开"} <ChevronDown className="h-3 w-3 ml-1" />
                            </>
                          )}
                        </Button>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex gap-1.5 sm:gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleDownload(paper)}
                        disabled={isDownloading(paper.arxiv_id) || downloadStatus.arxivId === paper.arxiv_id}
                        className={`flex-1 sm:flex-none text-xs ${downloadStatus.phase === "completed" && downloadStatus.arxivId === paper.arxiv_id ? "bg-green-600 hover:bg-green-700" : ""}`}
                      >
                        {downloadStatus.arxivId === paper.arxiv_id ? (
                          <>
                            <div className={PHASE_CONFIG[downloadStatus.phase].color}>
                              {PHASE_CONFIG[downloadStatus.phase].icon}
                            </div>
                            <span className="ml-1.5 hidden sm:inline">{getPhaseText(downloadStatus.phase)}</span>
                          </>
                        ) : (
                          <>
                            <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span className="ml-1.5 hidden sm:inline">{t.downloadToKB || "下载到知识库"}</span>
                            <span className="ml-1.5 sm:hidden">{lang === "zh" ? "下载" : "DL"}</span>
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(paper.abs_url, "_blank")}
                        className="text-xs px-2 sm:px-3"
                      >
                        <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span className="ml-1.5 hidden sm:inline">arXiv</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 加载更多按钮 */}
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="min-w-32"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {t.loadingMore}
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      {t.loadMore}
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* 没有更多结果 */}
            {!hasMore && papers.length > 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                {t.noMoreResults}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}