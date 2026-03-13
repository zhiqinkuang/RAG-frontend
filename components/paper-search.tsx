"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, Download, ExternalLink, FileText, Loader2, 
  ChevronDown, ChevronUp, ArrowLeft, Check, Clock, 
  RefreshCw, Database, ArrowRight, Sparkles, Hash, 
  Flame, History, X, Plus, Tag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import {
  searchPapers,
  formatAuthors,
  formatDate,
  formatCategories,
  type Paper,
  type PaperSource,
} from "@/lib/paper-search";
import { listKnowledgeBases, type KnowledgeBase } from "@/lib/rag-kb";
import { usePaperSearchCache } from "@/hooks/use-paper-search-cache";
import { usePaperDownload, type DownloadPhase } from "@/hooks/use-paper-download";

// 搜索模式类型
type SearchMode = "keyword" | "natural" | "smart";

// 智能提取结果类型
interface ExtractedInfo {
  keywords?: string[];
  detected_title?: string;
  suggested_query?: string;
  confidence?: number;
}

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

export function PaperSearch() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("keyword");
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
  
  // 智能识别模式状态
  const [inputText, setInputText] = useState("");
  const [extractedInfo, setExtractedInfo] = useState<ExtractedInfo | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  
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

  // 防抖搜索函数
  const debouncedSearch = useCallback((searchQuery: string, forceRefresh = false) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      // 执行搜索
      performSearch(searchQuery, forceRefresh, false);
    }, 500);
  }, []);

  // 实际执行搜索的函数
  const performSearch = async (searchQuery: string, forceRefresh = false, appendResults = false) => {
    if (!searchQuery.trim()) {
      toast.error(t.enterKeyword || "请输入搜索关键词");
      return;
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
      const result = await searchPapers(searchQuery.trim(), {
        maxResults: 10,
        naturalLanguage: searchMode === "natural",
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
        // 添加到搜索历史
        addToSearchHistory(searchQuery.trim());
        setSearchHistory(getSearchHistory());
      }
      
      // 记录搜索时间
      setSearchTime(Date.now() - startTime);
      
      if (result.papers.length === 0 && !appendResults) {
        toast.info(t.noResults || "未找到相关论文");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "搜索失败");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

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

  // 搜索模式切换
  const handleModeChange = (mode: SearchMode) => {
    setSearchMode(mode);
    setQuery(""); // 切换模式时清空查询
    setInputText(""); // 清空智能识别输入
    setExtractedInfo(null); // 清空提取结果
    setPapers([]);
    setTotalResults(0);
    setHasMore(false);
  };

  // 智能识别搜索
  const handleSmartSearch = async () => {
    if (!inputText.trim()) {
      toast.error(t.enterKeyword || "请输入搜索关键词");
      return;
    }

    // 短文本自动切换到关键词模式
    const wordCount = inputText.trim().split(/\s+/).length;
    if (wordCount < 20) {
      toast.info(lang === "zh" ? "文本较短，已切换到关键词模式" : "Short text, switched to keyword mode");
      setQuery(inputText.trim());
      setSearchMode("keyword");
      return;
    }

    setIsExtracting(true);
    setExtractedInfo(null);

    try {
      // 1. 调用提取 API
      const extractRes = await fetch("http://127.0.0.1:8080/api/v1/paper/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText.trim() })
      });

      if (!extractRes.ok) {
        throw new Error("Extract API failed");
      }

      const extractData = await extractRes.json();

      // 2. 用提取的查询词搜索
      const extracted = extractData.data || extractData;
      const query = extracted.suggested_query || extracted.keywords?.join(" ");

      if (query) {
        setQuery(query);
        setExtractedInfo(extracted);
        // 执行搜索
        await handleSearchWithQuery(query);
      } else {
        toast.warning(lang === "zh" ? "未能提取有效关键词" : "Could not extract valid keywords");
      }
    } catch (error) {
      console.error("Smart search error:", error);
      toast.error(lang === "zh" ? "识别失败，请重试" : "Extraction failed, please try again");
    } finally {
      setIsExtracting(false);
    }
  };

  // 带查询参数的搜索（供智能识别调用）
  const handleSearchWithQuery = async (searchQuery: string) => {
    // 直接调用 performSearch，不使用防抖
    await performSearch(searchQuery, false, false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* 顶部导航栏 */}
      <div className="p-4 border-b flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/")}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t.backToChat || "返回聊天"}</span>
        </Button>
        <h2 className="text-lg font-semibold">{t.paperSearch || "论文搜索"}</h2>
      </div>

      {/* 搜索区域 */}
      <div className="p-4 border-b">
        {/* 搜索模式切换 */}
        <div className="flex gap-2 mb-3">
          <Button
            variant={searchMode === "keyword" ? "default" : "outline"}
            size="sm"
            onClick={() => handleModeChange("keyword")}
            className="flex items-center gap-1.5"
          >
            <Hash className="h-3.5 w-3.5" />
            {t.keywordSearch}
          </Button>
          <Button
            variant={searchMode === "natural" ? "default" : "outline"}
            size="sm"
            onClick={() => handleModeChange("natural")}
            className="flex items-center gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t.naturalLanguageSearch}
          </Button>
          <Button
            variant={searchMode === "smart" ? "default" : "outline"}
            size="sm"
            onClick={() => handleModeChange("smart")}
            className="flex items-center gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t.smartSearch}
          </Button>
        </div>

        {/* 搜索输入框 */}
        {searchMode === "smart" ? (
          /* 智能识别模式 UI */
          <div className="space-y-3">
            <textarea
              placeholder={t.pasteTextPlaceholder || "粘贴论文摘要、描述或引用文字..."}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full h-[120px] px-3 py-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-background"
              disabled={isExtracting || loading}
            />
            <div className="flex gap-2">
              <Button
                onClick={handleSmartSearch}
                disabled={isExtracting || loading || !inputText.trim()}
                className="flex items-center gap-2"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{t.extracting || "正在识别..."}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>{t.extractAndSearch || "识别并搜索"}</span>
                  </>
                )}
              </Button>
              {inputText.trim() && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setInputText("");
                    setExtractedInfo(null);
                  }}
                  disabled={isExtracting || loading}
                >
                  <X className="h-4 w-4 mr-1" />
                  {lang === "zh" ? "清空" : "Clear"}
                </Button>
              )}
            </div>

            {/* 提取结果展示 */}
            {extractedInfo && (
              <div className="p-3 border rounded-md bg-muted/30 space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {t.extractedInfo || "识别结果"}
                </h4>
                {extractedInfo.detected_title && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">{t.extractedTitle || "识别标题"}: </span>
                    <span className="font-medium">{extractedInfo.detected_title}</span>
                  </div>
                )}
                {extractedInfo.keywords && extractedInfo.keywords.length > 0 && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">{t.extractedKeywords || "关键词"}: </span>
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
            )}
          </div>
        ) : (
          /* 关键词/自然语言搜索 UI */
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                placeholder={searchMode === "keyword"
                  ? (t.paperSearchPlaceholder || "输入关键词搜索 arXiv 论文...")
                  : (t.paperSearchPlaceholderNL || "描述你想要的论文，如：帮我找关于深度学习图像分类的最新论文...")
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                onFocus={() => setShowHistory(true)}
                onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                className="flex-1 pr-20"
                disabled={loading}
              />
              {/* 缓存指示器 */}
              {cacheInfo && !loading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{cacheInfo.remainingTTL}s</span>
                </div>
              )}
            </div>
            <Button onClick={() => handleSearch()} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="ml-2">{loading ? (t.searching || "搜索中...") : (t.search || "搜索")}</span>
            </Button>
            {papers.length > 0 && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleSearch(true)}
                disabled={loading}
                title="强制刷新（忽略缓存）"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            )}
          </div>
        )}

        {/* 搜索历史下拉 */}
        {showHistory && searchHistory.length > 0 && (
          <div className="absolute z-10 mt-1 w-full max-w-md bg-popover border rounded-md shadow-lg">
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

        {/* 自然语言搜索示例 */}
        {searchMode === "natural" && papers.length === 0 && !loading && (
          <div className="mt-3">
            <p className="text-sm text-muted-foreground mb-2">{t.exampleQueries}:</p>
            <div className="flex flex-wrap gap-2">
              {exampleQueries.map((example, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => handleExampleClick(example)}
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  {example.length > 30 ? example.slice(0, 30) + "..." : example}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* 热门搜索（关键词模式） */}
        {searchMode === "keyword" && papers.length === 0 && !loading && (
          <div className="mt-3">
            <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
              <Flame className="h-3.5 w-3.5 text-orange-500" />
              {t.hotSearches}:
            </p>
            <div className="flex flex-wrap gap-2">
              {hotSearches.map((hot, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => handleHotSearchClick(hot)}
                >
                  {hot}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* 搜索状态信息 */}
        <div className="mt-3 flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            {/* 知识库选择 */}
            {knowledgeBases.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-muted-foreground">{t.selectKB}:</label>
                <select
                  className="h-8 rounded-md border bg-background px-2 text-sm"
                  value={selectedKB}
                  onChange={(e) => setSelectedKB(e.target.value)}
                >
                  {knowledgeBases.map((kb) => (
                    <option key={kb.ID} value={String(kb.ID)}>
                      {kb.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          
          {/* 搜索时间和缓存状态 */}
          <div className="flex items-center gap-2 text-muted-foreground">
            {isFromCache && papers.length > 0 && (
              <span className="flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded">
                <Database className="h-3 w-3" />
                {lang === "zh" ? "来自缓存" : "From cache"}
              </span>
            )}
            {searchTime !== null && !isFromCache && (
              <span className="text-xs">
                {formatSearchTime(searchTime)}
              </span>
            )}
          </div>
        </div>
      </div>

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
                onClick={() => router.push(`/paper?kb=${selectedKB}`)}
              >
                {lang === "zh" ? "查看文档" : "View Docs"}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 搜索结果 */}
      <div className="flex-1 overflow-auto p-4">
        {papers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <FileText className="h-12 w-12 mb-4" />
            <p>{t.paperSearch || "搜索 arXiv 论文并下载到知识库"}</p>
            {loading && (
              <div className="mt-4 flex flex-col items-center gap-2">
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
            {/* 论文数量统计 */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t.totalPapers?.replace("{count}", String(totalResults)) || `找到 ${totalResults} 篇论文`}
                {isFromCache && (
                  <span className="ml-2 text-xs">
                    ({lang === "zh" ? "缓存结果" : "cached"})
                  </span>
                )}
              </p>
              {/* 来源统计 */}
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded">
                  {t.sourceArxiv}: {papers.length}
                </span>
              </div>
            </div>

            {/* 论文列表 */}
            {papers.map((paper) => {
              const sourceStyle = getSourceStyle(paper.source);
              return (
                <div
                  key={paper.arxiv_id}
                  className={`border rounded-lg p-4 transition-colors ${
                    downloadStatus.arxivId === paper.arxiv_id && downloadStatus.phase !== "idle"
                      ? "bg-primary/5 border-primary/30"
                      : "hover:bg-accent/50"
                  }`}
                >
                  {/* 标题和来源标签 */}
                  <div className="flex items-start gap-2 mb-2">
                    <h3 className="text-lg font-semibold leading-tight flex-1">
                      {paper.title}
                    </h3>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded ${sourceStyle.bg} ${sourceStyle.text}`}>
                      {sourceStyle.label}
                    </span>
                  </div>
                  
                  {/* 元信息 */}
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground mb-3">
                    <span>{formatAuthors(paper.authors, 3)}</span>
                    <span>·</span>
                    <span>{formatDate(paper.published)}</span>
                    {paper.categories.length > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-xs bg-secondary px-1.5 py-0.5 rounded">
                          {formatCategories(paper.categories)}
                        </span>
                      </>
                    )}
                  </div>

                  {/* 摘要 */}
                  <div className="mb-3">
                    <p
                      className={`text-sm text-muted-foreground ${
                        !expandedAbstracts.has(paper.arxiv_id) ? "line-clamp-3" : ""
                      }`}
                    >
                      {paper.abstract}
                    </p>
                    {paper.abstract.length > 200 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1 h-auto p-0 text-primary"
                        onClick={() => toggleAbstract(paper.arxiv_id)}
                      >
                        {expandedAbstracts.has(paper.arxiv_id) ? (
                          <>
                            {t.collapseAbstract || "收起"} <ChevronUp className="h-4 w-4 ml-1" />
                          </>
                        ) : (
                          <>
                            {t.expandAbstract || "展开"} <ChevronDown className="h-4 w-4 ml-1" />
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleDownload(paper)}
                      disabled={isDownloading || downloadStatus.arxivId === paper.arxiv_id}
                      className={downloadStatus.phase === "completed" && downloadStatus.arxivId === paper.arxiv_id ? "bg-green-600 hover:bg-green-700" : ""}
                    >
                      {downloadStatus.arxivId === paper.arxiv_id ? (
                        <>
                          <div className={PHASE_CONFIG[downloadStatus.phase].color}>
                            {PHASE_CONFIG[downloadStatus.phase].icon}
                          </div>
                          <span className="ml-2">{getPhaseText(downloadStatus.phase)}</span>
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4" />
                          <span className="ml-2">{t.downloadToKB || "下载到知识库"}</span>
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(paper.abs_url, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span className="ml-2">arXiv</span>
                    </Button>
                  </div>
                </div>
              );
            })}

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