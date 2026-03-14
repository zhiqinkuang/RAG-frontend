"use client";

import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from "@/components/assistant-ui/attachment";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import { Reasoning, ReasoningGroup } from "@/components/assistant-ui/reasoning";
import { ToolFallback } from "@/components/assistant-ui/tool-fallback";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  ActionBarMorePrimitive,
  ActionBarPrimitive,
  AuiIf,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  SuggestionPrimitive,
  ThreadPrimitive,
  useAssistantState,
  useAui,
  useAuiState,
} from "@assistant-ui/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  MoreHorizontalIcon,
  PencilIcon,
  RefreshCwIcon,
  SquareIcon,
  XIcon,
  ClockIcon,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef, type FC } from "react";
import { useQueue } from "@/lib/queue-context";
import { customAttachmentAdapter } from "@/lib/attachment-adapter";
import type { KeyboardEvent } from "react";
import type { Attachment } from "@assistant-ui/react";
import { useApiKey } from "@/components/settings-dialog";
import { SparklesIcon } from "lucide-react";

export const Thread: FC = () => {
  return (
    <ThreadPrimitive.Root
      className="aui-root aui-thread-root @container flex h-full flex-col bg-background"
      style={{
        ["--thread-max-width" as string]: "44rem",
      }}
    >
      <ThreadPrimitive.Viewport
        turnAnchor="top"
        className="aui-thread-viewport relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth px-4 pt-4"
      >
        <AuiIf condition={(s) => s.thread.isEmpty}>
          <ThreadWelcome />
        </AuiIf>

        <ThreadPrimitive.Messages
          components={{
            UserMessage,
            EditComposer,
            AssistantMessage,
          }}
        />

        <FollowUpSuggestions />

        <ThreadPrimitive.ViewportFooter className="aui-thread-viewport-footer sticky bottom-0 mx-auto mt-auto flex w-full max-w-(--thread-max-width) flex-col gap-4 overflow-visible rounded-t-3xl bg-background pb-4 md:pb-6">
          <ThreadScrollToBottom />
          <Composer />
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
};

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        variant="outline"
        className="aui-thread-scroll-to-bottom absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible dark:bg-background dark:hover:bg-accent"
      >
        <ArrowDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

const ThreadWelcome: FC = () => {
  const { t } = useI18n();
  return (
    <div className="aui-thread-welcome-root mx-auto my-auto flex w-full max-w-(--thread-max-width) grow flex-col">
      <div className="aui-thread-welcome-center flex w-full grow flex-col items-center justify-center">
        <div className="aui-thread-welcome-message flex size-full flex-col justify-center px-4">
          <h1 className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in fill-mode-both font-semibold text-2xl duration-200">
            {t.greetingTitle}
          </h1>
          <p className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in fill-mode-both text-muted-foreground text-xl delay-75 duration-200">
            {t.greetingSubtitle}
          </p>
        </div>
      </div>
      <ThreadSuggestions />
    </div>
  );
};

const ThreadSuggestions: FC = () => {
  return (
    <div className="aui-thread-welcome-suggestions grid w-full @md:grid-cols-2 gap-2 pb-4">
      <ThreadPrimitive.Suggestions
        components={{
          Suggestion: ThreadSuggestionItem,
        }}
      />
    </div>
  );
};

const ThreadSuggestionItem: FC = () => {
  return (
    <div className="aui-thread-welcome-suggestion-display fade-in slide-in-from-bottom-2 @md:nth-[n+3]:block nth-[n+3]:hidden animate-in fill-mode-both duration-200">
      <SuggestionPrimitive.Trigger send asChild>
        <Button
          variant="ghost"
          className="aui-thread-welcome-suggestion h-auto w-full @md:flex-col flex-wrap items-start justify-start gap-1 rounded-2xl border px-4 py-3 text-left text-sm transition-colors hover:bg-muted"
        >
          <span className="aui-thread-welcome-suggestion-text-1 font-medium">
            <SuggestionPrimitive.Title />
          </span>
          <span className="aui-thread-welcome-suggestion-text-2 text-muted-foreground">
            <SuggestionPrimitive.Description />
          </span>
        </Button>
      </SuggestionPrimitive.Trigger>
    </div>
  );
};

const EMPTY_SUGGESTIONS: string[] = [];

const FollowUpSuggestions: FC = () => {
  const { t } = useI18n();
  const { getSettings } = useApiKey();
  const aui = useAui();
  const isRunning = useAssistantState((s) => s.thread.isRunning);

  const [suggestions, setSuggestions] = useState<string[]>(EMPTY_SUGGESTIONS);
  const [loading, setLoading] = useState(false);
  const prevRunningRef = useRef(isRunning);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const wasRunning = prevRunningRef.current;
    prevRunningRef.current = isRunning;

    // Only fetch when transitioning from running → idle
    if (wasRunning && !isRunning) {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const settings = getSettings();

      // Read messages imperatively from the runtime
      const threadState = aui.thread().getState();
      const allMsgs = (threadState as unknown as { messages?: { role: string; parts?: { type?: string; text?: string }[] }[] }).messages ?? [];

      if (allMsgs.length === 0) return;

      const simpleMsgs = allMsgs.slice(-6).map((m) => {
        const text = Array.isArray(m.parts)
          ? m.parts
              .filter((p) => p.type === "text")
              .map((p) => p.text ?? "")
              .join("")
          : "";
        return { role: m.role, content: text };
      });

      setLoading(true);
      setSuggestions(EMPTY_SUGGESTIONS);

      fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: simpleMsgs,
          provider: settings.provider,
          apiKey: settings.apiKey,
          baseURL: settings.baseURL,
          model: settings.model,
          knowledgeBaseId: settings.knowledgeBaseId,
        }),
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data.suggestions)) {
            setSuggestions(data.suggestions.slice(0, 3));
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }

    // Clear suggestions when a new run starts
    if (isRunning) {
      abortRef.current?.abort();
      setSuggestions(EMPTY_SUGGESTIONS);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  const handleClick = useCallback(
    (text: string) => {
      aui.thread().append({ role: "user", content: [{ type: "text", text }] });
      setSuggestions([]);
    },
    [aui],
  );

  if (isRunning || (suggestions.length === 0 && !loading)) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-(--thread-max-width) px-2 pb-2">
      <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
        <SparklesIcon className="size-3" />
        <span>{t.suggestionsTitle}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {loading
          ? Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="h-8 w-36 animate-pulse rounded-full bg-muted"
              />
            ))
          : suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleClick(s)}
                className="rounded-full border border-border bg-background px-3.5 py-1.5 text-sm text-foreground transition-colors hover:bg-muted hover:border-foreground/20 active:scale-[0.97]"
              >
                {s}
              </button>
            ))}
      </div>
    </div>
  );
};

const ComposerQueue: FC = () => {
  const { items, removeItem } = useQueue();
  const { t } = useI18n();
  if (items.length === 0) return null;

  return (
    <div className="mb-2 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 px-1 text-muted-foreground text-xs">
        <ClockIcon className="size-3" />
        <span>{t.queueTitle}</span>
        <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none">
          {items.length}
        </span>
      </div>
      {items.map((item, i) => (
        <div
          key={item.id}
          className="group flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm"
        >
          <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground/60">
            {i + 1}
          </span>
          <span className="flex-1 truncate text-foreground/80">
            {item.attachments && item.attachments.length > 0 && (
              <span className="mr-1 text-muted-foreground/60" title={item.attachments.map((a) => a.name).join(", ")}>
                📎{item.attachments.length}
              </span>
            )}
            {item.text || "…"}
          </span>
          <button
            type="button"
            onClick={() => removeItem(item.id)}
            aria-label={t.queueRemove}
            className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <XIcon className="size-3" />
          </button>
        </div>
      ))}
    </div>
  );
};

/**
 * Returns an async callback that captures the current composer text + attachments
 * into the local queue (instead of calling the SDK's send, which is blocked during inference).
 * Pending attachments are processed through the adapter to get base64 data URLs before queuing.
 */
const useQueueCapture = () => {
  const { addItem } = useQueue();
  const aui = useAui();
  const canCapture = useAuiState((s) => s.thread.isRunning && s.composer.isEditing && !s.composer.isEmpty);
  if (!canCapture) return null;

  return async () => {
    const state = aui.composer().getState();
    const text = state.text.trim();
    const pendingAttachments = state.attachments as Attachment[];

    // Process any pending attachments through the adapter so we have complete data URLs
    const completeAttachments = await Promise.all(
      pendingAttachments.map(async (a) => {
        if (a.status.type === "complete") return a;
        // PendingAttachment has a file property
        const pending = a as Attachment & { file: File };
        if (!pending.file) return a;
        return customAttachmentAdapter.send(pending as Parameters<typeof customAttachmentAdapter.send>[0]);
      })
    );

    addItem(text, completeAttachments as Attachment[]);
    aui.composer().setText("");
    aui.composer().clearAttachments();
  };
};

const Composer: FC = () => {
  const { t } = useI18n();
  const aui = useAui();
  const isRunning = useAssistantState((s) => s.thread.isRunning);
  const { addItem } = useQueue();

  // When running, intercept Enter to enqueue instead of attempting SDK send
  const handleKeyDownWhileRunning = async (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      isRunning &&
      e.key === "Enter" &&
      !e.shiftKey &&
      !(e.nativeEvent as unknown as InputEvent & { isComposing?: boolean }).isComposing
    ) {
      e.preventDefault();
      const state = aui.composer().getState();
      const text = state.text.trim();
      if (!text) return;

      const pendingAttachments = state.attachments as Attachment[];
      const completeAttachments = await Promise.all(
        pendingAttachments.map(async (a) => {
          if (a.status.type === "complete") return a;
          const pending = a as Attachment & { file: File };
          if (!pending.file) return a;
          return customAttachmentAdapter.send(pending as Parameters<typeof customAttachmentAdapter.send>[0]);
        })
      );

      addItem(text, completeAttachments as Attachment[]);
      aui.composer().setText("");
      aui.composer().clearAttachments();
    }
  };

  return (
    <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
      <ComposerQueue />
      <ComposerPrimitive.AttachmentDropzone className="aui-composer-attachment-dropzone flex w-full flex-col rounded-2xl border border-input bg-background px-1 pt-2 outline-none transition-shadow has-[textarea:focus-visible]:border-ring has-[textarea:focus-visible]:ring-2 has-[textarea:focus-visible]:ring-ring/20 data-[dragging=true]:border-ring data-[dragging=true]:border-dashed data-[dragging=true]:bg-accent/50">
        <ComposerAttachments />
        <ComposerPrimitive.Input
          placeholder={t.sendMessagePlaceholder}
          className="aui-composer-input mb-1 max-h-32 min-h-14 w-full resize-none bg-transparent px-4 pt-2 pb-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-0"
          rows={1}
          autoFocus
          aria-label={t.messageInputAria}
          onKeyDown={handleKeyDownWhileRunning}
        />
        <ComposerAction />
      </ComposerPrimitive.AttachmentDropzone>
    </ComposerPrimitive.Root>
  );
};

const ComposerAction: FC = () => {
  const { t } = useI18n();
  const isRunning = useAssistantState((s) => s.thread.isRunning);
  const captureToQueue = useQueueCapture();

  return (
    <div className="aui-composer-action-wrapper relative mx-2 mb-2 flex items-center justify-between">
      <ComposerAddAttachment />
      <div className="flex items-center gap-1">
        <AuiIf condition={(s) => s.thread.isRunning}>
          <ComposerPrimitive.Cancel asChild>
            <Button
              type="button"
              variant="default"
              size="icon"
              className="aui-composer-cancel size-8 rounded-full"
              aria-label={t.stopGenerating}
            >
              <SquareIcon className="aui-composer-cancel-icon size-3 fill-current" />
            </Button>
          </ComposerPrimitive.Cancel>
        </AuiIf>
        {isRunning ? (
          // Capture text into queue instead of attempting SDK send (which creates duplicate IDs)
          <TooltipIconButton
            tooltip={t.sendQueued}
            side="bottom"
            type="button"
            variant="default"
            size="icon"
            disabled={!captureToQueue}
            onClick={() => captureToQueue?.()}
            className="aui-composer-send size-8 rounded-full disabled:opacity-40"
            aria-label={t.sendQueued}
          >
            <ArrowUpIcon className="aui-composer-send-icon size-4" />
          </TooltipIconButton>
        ) : (
          <ComposerPrimitive.Send asChild>
            <TooltipIconButton
              tooltip={t.sendMessage}
              side="bottom"
              type="submit"
              variant="default"
              size="icon"
              className="aui-composer-send size-8 rounded-full"
              aria-label={t.sendMessage}
            >
              <ArrowUpIcon className="aui-composer-send-icon size-4" />
            </TooltipIconButton>
          </ComposerPrimitive.Send>
        )}
      </div>
    </div>
  );
};

const MessageError: FC = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className="aui-message-error-root mt-2 rounded-md border border-destructive bg-destructive/10 p-3 text-destructive text-sm dark:bg-destructive/5 dark:text-red-200">
        <ErrorPrimitive.Message className="aui-message-error-message line-clamp-2" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  );
};

const AssistantMessage: FC = () => {
  const isRunning = useAssistantState(
    (s) => (s as { message?: { status?: { type?: string } } }).message?.status?.type === "running"
  );
  const { t } = useI18n();
  return (
    <MessagePrimitive.Root
      className="aui-assistant-message-root fade-in slide-in-from-bottom-1 relative mx-auto w-full max-w-(--thread-max-width) animate-in py-3 duration-150"
      data-role="assistant"
    >
      <div className="aui-assistant-message-content wrap-break-word px-2 text-foreground leading-relaxed">
        {isRunning && (
          <p className="aui-assistant-thinking text-muted-foreground text-sm italic mb-2" aria-live="polite">
            {t.thinking}
          </p>
        )}
        <MessagePrimitive.Parts
          components={{
            Text: MarkdownText,
            Reasoning,
            ReasoningGroup,
            tools: { Fallback: ToolFallback },
          }}
        />
        <MessageError />
      </div>

      <div className="aui-assistant-message-footer mt-1 ml-2 flex">
        <BranchPicker />
        <AssistantActionBar />
      </div>
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      autohideFloat="single-branch"
      className="aui-assistant-action-bar-root col-start-3 row-start-2 -ml-1 flex gap-1 text-muted-foreground data-floating:absolute data-floating:rounded-md data-floating:border data-floating:bg-background data-floating:p-1 data-floating:shadow-sm"
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip="Copy">
          <AuiIf condition={(s) => s.message.isCopied}>
            <CheckIcon />
          </AuiIf>
          <AuiIf condition={(s) => !s.message.isCopied}>
            <CopyIcon />
          </AuiIf>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip="Refresh">
          <RefreshCwIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
      <ActionBarMorePrimitive.Root>
        <ActionBarMorePrimitive.Trigger asChild>
          <TooltipIconButton
            tooltip="More"
            className="data-[state=open]:bg-accent"
          >
            <MoreHorizontalIcon />
          </TooltipIconButton>
        </ActionBarMorePrimitive.Trigger>
        <ActionBarMorePrimitive.Content
          side="bottom"
          align="start"
          className="aui-action-bar-more-content z-50 min-w-32 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <ActionBarPrimitive.ExportMarkdown asChild>
            <ActionBarMorePrimitive.Item className="aui-action-bar-more-item flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
              <DownloadIcon className="size-4" />
              Export as Markdown
            </ActionBarMorePrimitive.Item>
          </ActionBarPrimitive.ExportMarkdown>
        </ActionBarMorePrimitive.Content>
      </ActionBarMorePrimitive.Root>
    </ActionBarPrimitive.Root>
  );
};

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root
      className="aui-user-message-root fade-in slide-in-from-bottom-1 mx-auto grid w-full max-w-(--thread-max-width) animate-in auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 py-3 duration-150 [&:where(>*)]:col-start-2"
      data-role="user"
    >
      <UserMessageAttachments />

      <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
        <div className="aui-user-message-content wrap-break-word rounded-2xl bg-muted px-4 py-2.5 text-foreground">
          <MessagePrimitive.Parts />
        </div>
        <div className="aui-user-action-bar-wrapper absolute top-1/2 left-0 -translate-x-full -translate-y-1/2 pr-2">
          <UserActionBar />
        </div>
      </div>

      <BranchPicker className="aui-user-branch-picker col-span-full col-start-1 row-start-3 -mr-1 justify-end" />
    </MessagePrimitive.Root>
  );
};

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-user-action-bar-root flex flex-col items-end"
    >
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton tooltip="Edit" className="aui-user-action-edit p-4">
          <PencilIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  );
};

const EditComposer: FC = () => {
  const { t } = useI18n();
  return (
    <MessagePrimitive.Root className="aui-edit-composer-wrapper mx-auto flex w-full max-w-(--thread-max-width) flex-col px-2 py-3">
      <ComposerPrimitive.Root className="aui-edit-composer-root ml-auto flex w-full max-w-[85%] flex-col rounded-2xl bg-muted">
        <ComposerPrimitive.Input
          className="aui-edit-composer-input min-h-14 w-full resize-none bg-transparent p-4 text-foreground text-sm outline-none"
          autoFocus
        />
        <div className="aui-edit-composer-footer mx-3 mb-3 flex items-center gap-2 self-end">
          <ComposerPrimitive.Cancel asChild>
            <Button variant="ghost" size="sm">
              {t.cancel}
            </Button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <Button size="sm">{t.update}</Button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  );
};

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
  className,
  ...rest
}) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        "aui-branch-picker-root mr-2 -ml-2 inline-flex items-center text-muted-foreground text-xs",
        className,
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton tooltip="Previous">
          <ChevronLeftIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      <span className="aui-branch-picker-state font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton tooltip="Next">
          <ChevronRightIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};
