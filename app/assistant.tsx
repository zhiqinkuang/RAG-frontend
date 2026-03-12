"use client";

import { toast } from "sonner";
import {
  AssistantRuntimeProvider,
  useAui,
  useAuiState,
  useAssistantState,
  unstable_useRemoteThreadListRuntime,
} from "@assistant-ui/react";
import {
  AssistantChatTransport,
  useAISDKRuntime,
} from "@assistant-ui/react-ai-sdk";
import { useChat } from "@ai-sdk/react";
import { lastAssistantMessageIsCompleteWithToolCalls, type UIMessage, type UIMessageChunk } from "ai";
import { Thread } from "@/components/assistant-ui/thread";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThreadListSidebar } from "@/components/assistant-ui/threadlist-sidebar";
import { Separator } from "@/components/ui/separator";
import { SettingsDialog, useApiKey, type ApiKeySettings } from "@/components/settings-dialog";
import { useI18n } from "@/lib/i18n";
import { Component, useMemo, useState, useCallback, useEffect, useRef, type FC, type ReactNode } from "react";
import { getProvider } from "@/lib/providers";
import { QueueContext, useQueue, type QueueItem } from "@/lib/queue-context";
import type { Attachment } from "@assistant-ui/react";
import { customAttachmentAdapter } from "@/lib/attachment-adapter";
import { LocalStorageThreadListAdapter, setOnThreadDeletedCallback } from "@/lib/local-thread-list-adapter";
import { createThreadHistoryAdapter } from "@/lib/message-store";

type SendMessagesOptions = Parameters<AssistantChatTransport<UIMessage>["sendMessages"]>[0];
type SendMessagesResult = ReadableStream<UIMessageChunk>;

class CustomChatTransport extends AssistantChatTransport<UIMessage> {
  private getSettings: () => ApiKeySettings;

  constructor(options: { api: string; getSettings: () => ApiKeySettings }) {
    super({
      ...options,
      // 自定义 fetch 禁用缓冲
      fetch: (url, init) => {
        return fetch(url, {
          ...init,
          // @ts-expect-error - 非标准属性，用于禁用浏览器缓冲
          cache: "no-store",
        });
      },
    });
    this.getSettings = options.getSettings;
  }

  private injectSettings(options: SendMessagesOptions): SendMessagesOptions {
    const settings = this.getSettings();
    const body =
      typeof options.body === "object" && options.body !== null
        ? { ...options.body }
        : {};
    const next: Record<string, unknown> = {
      ...body,
      provider: settings.provider,
      apiKey: settings.apiKey,
      baseURL: settings.baseURL || undefined,
      model: settings.model,
    };
    if (settings.provider === "rag" && settings.knowledgeBaseId != null && settings.knowledgeBaseId > 0) {
      next.knowledgeBaseId = settings.knowledgeBaseId;
    }
    return { ...options, body: next };
  }

  override sendMessages(options: SendMessagesOptions): Promise<SendMessagesResult> {
    return super.sendMessages(this.injectSettings(options));
  }
}

/**
 * Proxy wrapper that keeps transport ref up-to-date without creating new instances.
 * This mirrors the useDynamicChatTransport pattern from the library internals.
 */
function useDynamicChatTransport(transport: AssistantChatTransport<UIMessage>) {
  const transportRef = useRef(transport);
  useEffect(() => {
    transportRef.current = transport;
  });
  return useMemo(
    () =>
      new Proxy(transportRef.current, {
        get(_, prop) {
          const res = (transportRef.current as unknown as Record<string, unknown>)[prop as string];
          return typeof res === "function"
            ? (res as Function).bind(transportRef.current)
            : res;
        },
      }),
    [],
  );
}

/**
 * Per-thread runtime hook. Called once per active thread inside the
 * unstable_useRemoteThreadListRuntime framework.
 */
function useThreadRuntime(options: {
  transport: AssistantChatTransport<UIMessage>;
  getSettings: () => ApiKeySettings;
}) {
  const dynamicTransport = useDynamicChatTransport(options.transport);
  const id = useAuiState(({ threadListItem }) => threadListItem?.id);

  const historyAdapter = useMemo(() => id ? createThreadHistoryAdapter(id) : null, [id]);

  const chat = useChat({
    id,
    transport: dynamicTransport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

  const runtime = useAISDKRuntime(chat, {
    adapters: {
      attachments: customAttachmentAdapter,
      ...(historyAdapter ? { history: historyAdapter } : {}),
    },
  });

  if (dynamicTransport instanceof AssistantChatTransport) {
    (dynamicTransport as AssistantChatTransport<UIMessage>).setRuntime(runtime);
  }

  return runtime;
}

const AutoSendQueue: FC = () => {
  const { items, removeItem } = useQueue();
  const aui = useAui();
  const isRunning = useAssistantState((s) => s.thread?.isRunning ?? false);
  const prevRunning = useRef(false);

  useEffect(() => {
    const justFinished = !isRunning && prevRunning.current;
    prevRunning.current = isRunning;

    if (justFinished && items.length > 0) {
      const first = items[0];
      removeItem(first.id);
      aui.thread().append({
        role: "user",
        content: [{ type: "text", text: first.text }],
        attachments: (first.attachments ?? []) as never,
      });
    }
  }, [isRunning, items, removeItem, aui]);

  return null;
};

// 处理删除当前对话后自动切换
const ThreadDeleteHandler: FC = () => {
  const aui = useAui();
  const currentThreadId = useAuiState(({ threadListItem }) => threadListItem?.id);

  useEffect(() => {
    if (!currentThreadId) return;
    
    setOnThreadDeletedCallback((deletedId, remainingThreads) => {
      // 如果删除的是当前对话
      if (deletedId === currentThreadId) {
        toast.success("对话已删除");
        // 切换到最近的对话或创建新对话
        if (remainingThreads.length > 0) {
          const latestThread = remainingThreads[0];
          aui.threadList().switchToThread(latestThread.remoteId);
        } else {
          // 没有其他对话，创建新对话
          aui.threadList().newThread();
        }
      }
    });

    return () => {
      setOnThreadDeletedCallback(null);
    };
  }, [aui, currentThreadId]);

  return null;
};

class RuntimeErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; key: number }
> {
  state = { hasError: false, key: 0 };
  static getDerivedStateFromError(error: Error) {
    // 只捕获 assistant-ui 的初始化错误
    if (error.message === "Entry not available in the store") {
      return { hasError: true };
    }
    // 其他错误继续抛出
    throw error;
  }
  componentDidCatch() {
    setTimeout(() => {
      this.setState((s) => ({ hasError: false, key: s.key + 1 }));
    }, 100);
  }
  render() {
    if (this.state.hasError) return null;
    return <div key={this.state.key}>{this.props.children}</div>;
  }
}

// 内部组件 - 创建 runtime 并渲染 UI
const AssistantContent: FC<{
  transport: AssistantChatTransport<UIMessage>;
  adapter: LocalStorageThreadListAdapter;
  getSettings: () => ApiKeySettings;
  displayModel: string;
}> = ({ transport, adapter, getSettings, displayModel }) => {
  const { t } = useI18n();
  
  const runtime = unstable_useRemoteThreadListRuntime({
    runtimeHook: function RuntimeHook() {
      return useThreadRuntime({ transport, getSettings });
    },
    adapter,
    allowNesting: true,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AutoSendQueue />
      <ThreadDeleteHandler />
      <SidebarProvider>
        <div className="flex h-dvh w-full pr-0.5">
          <ThreadListSidebar />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <h1 className="text-sm font-medium">
                {t.chat}{" "}
                <span className="font-normal text-muted-foreground">
                  · {displayModel}
                </span>
              </h1>
            </header>
            <div className="flex-1 overflow-hidden">
              <Thread />
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </AssistantRuntimeProvider>
  );
};

export const Assistant = () => {
  const { getSettings } = useApiKey();
  const { t } = useI18n();
  const [displayModel, setDisplayModel] = useState(() => {
    const s = getSettings();
    const prov = getProvider(s.provider);
    return s.model || prov.defaultModel || t.notConfigured;
  });

  const refreshDisplayModel = useCallback(() => {
    const s = getSettings();
    const prov = getProvider(s.provider);
    // RAG 模式显示 "知识库"，其他模式显示模型名称
    if (s.provider === "rag") {
      setDisplayModel(t.knowledgeBase || "知识库");
    } else {
      setDisplayModel(s.model || prov.defaultModel || t.notConfigured);
    }
  }, [getSettings, t.notConfigured, t.knowledgeBase]);

  useEffect(() => {
    refreshDisplayModel();
  }, [refreshDisplayModel]);

  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);

  const addQueueItem = useCallback((text: string, attachments?: Attachment[]) => {
    setQueueItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text, attachments: attachments ?? [] },
    ]);
  }, []);

  const removeQueueItem = useCallback((id: string) => {
    setQueueItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const transport = useMemo(
    () => new CustomChatTransport({ api: "/api/chat", getSettings }),
    [getSettings],
  );

  const adapter = useMemo(() => new LocalStorageThreadListAdapter(), []);

  return (
    <QueueContext.Provider
      value={{ items: queueItems, addItem: addQueueItem, removeItem: removeQueueItem }}
    >
      <RuntimeErrorBoundary>
        <AssistantContent
          transport={transport}
          adapter={adapter}
          getSettings={getSettings}
          displayModel={displayModel}
        />
      </RuntimeErrorBoundary>
    </QueueContext.Provider>
  );
};