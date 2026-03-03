"use client";

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
import { LangSwitcher } from "@/components/lang-switcher";
import { useI18n } from "@/lib/i18n";
import { useMemo, useState, useCallback, useEffect, useRef, type FC } from "react";
import { getProvider } from "@/lib/providers";
import { QueueContext, useQueue, type QueueItem } from "@/lib/queue-context";
import type { Attachment } from "@assistant-ui/react";
import { customAttachmentAdapter } from "@/lib/attachment-adapter";
import { LocalStorageThreadListAdapter } from "@/lib/local-thread-list-adapter";
import { createThreadHistoryAdapter } from "@/lib/message-store";

type SendMessagesOptions = Parameters<AssistantChatTransport<UIMessage>["sendMessages"]>[0];
type SendMessagesResult = ReadableStream<UIMessageChunk>;

class CustomChatTransport extends AssistantChatTransport<UIMessage> {
  private getSettings: () => ApiKeySettings;

  constructor(options: { api: string; getSettings: () => ApiKeySettings }) {
    super(options);
    this.getSettings = options.getSettings;
  }

  private injectSettings(options: SendMessagesOptions): SendMessagesOptions {
    const settings = this.getSettings();
    const body =
      typeof options.body === "object" && options.body !== null
        ? { ...options.body }
        : {};
    return {
      ...options,
      body: {
        ...body,
        provider: settings.provider,
        apiKey: settings.apiKey,
        baseURL: settings.baseURL || undefined,
        model: settings.model,
      },
    };
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
  const id = useAuiState(({ threadListItem }) => threadListItem.id);

  const historyAdapter = useMemo(() => createThreadHistoryAdapter(id), [id]);

  const chat = useChat({
    id,
    transport: dynamicTransport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

  const runtime = useAISDKRuntime(chat, {
    adapters: {
      attachments: customAttachmentAdapter,
      history: historyAdapter,
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
  const isRunning = useAssistantState((s) => s.thread.isRunning);
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
    setDisplayModel(s.model || prov.defaultModel || t.notConfigured);
  }, [getSettings, t.notConfigured]);

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

  const runtime = unstable_useRemoteThreadListRuntime({
    runtimeHook: function RuntimeHook() {
      return useThreadRuntime({ transport, getSettings });
    },
    adapter,
    allowNesting: true,
  });

  return (
    <QueueContext.Provider
      value={{ items: queueItems, addItem: addQueueItem, removeItem: removeQueueItem }}
    >
      <AssistantRuntimeProvider runtime={runtime}>
        <AutoSendQueue />
        <SidebarProvider>
          <div className="flex h-dvh w-full pr-0.5">
            <ThreadListSidebar />
            <SidebarInset>
              <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
                <SidebarTrigger />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <div className="flex flex-1 items-center justify-between">
                  <h1 className="text-lg font-semibold">
                    {t.chat}{" "}
                    <span className="font-normal text-muted-foreground">
                      · {displayModel}
                    </span>
                  </h1>
                  <div className="flex items-center gap-1">
                    <LangSwitcher />
                    <SettingsDialog onSaved={refreshDisplayModel} />
                  </div>
                </div>
              </header>
              <div className="flex-1 overflow-hidden">
                <Thread />
              </div>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </AssistantRuntimeProvider>
    </QueueContext.Provider>
  );
};
