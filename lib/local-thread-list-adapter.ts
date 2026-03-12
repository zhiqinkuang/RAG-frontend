/**
 * A RemoteThreadListAdapter backed by localStorage.
 * Persists thread metadata (id, title, status) so the sidebar shows history across reloads.
 * Chat message content is managed by the AI SDK's useChat (keyed by thread id).
 */

const STORAGE_KEY = "chat-threads";

type ThreadStatus = "regular" | "archived";

export type StoredThread = {
  remoteId: string;
  externalId?: string;
  title?: string;
  status: ThreadStatus;
  createdAt: number;
};

// 回调函数类型
type OnThreadDeletedCallback = (deletedId: string, remainingThreads: StoredThread[]) => void;
let onThreadDeletedCallback: OnThreadDeletedCallback | null = null;

export function setOnThreadDeletedCallback(cb: OnThreadDeletedCallback | null) {
  onThreadDeletedCallback = cb;
}

function readThreads(): StoredThread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeThreads(threads: StoredThread[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
}

function findThread(remoteId: string): StoredThread | undefined {
  return readThreads().find((t) => t.remoteId === remoteId);
}

function updateThread(remoteId: string, patch: Partial<StoredThread>) {
  const threads = readThreads();
  const idx = threads.findIndex((t) => t.remoteId === remoteId);
  if (idx !== -1) {
    threads[idx] = { ...threads[idx], ...patch };
    writeThreads(threads);
  }
}

export class LocalStorageThreadListAdapter {
  async list() {
    const threads = readThreads()
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((t) => ({
        remoteId: t.remoteId,
        externalId: t.externalId,
        title: t.title,
        status: t.status as "regular" | "archived",
      }));
    return { threads };
  }

  async initialize(threadId: string) {
    const existing = findThread(threadId);
    if (existing) {
      return { remoteId: existing.remoteId, externalId: existing.externalId };
    }
    const thread: StoredThread = {
      remoteId: threadId,
      status: "regular",
      createdAt: Date.now(),
    };
    const threads = readThreads();
    threads.unshift(thread);
    writeThreads(threads);
    return { remoteId: threadId, externalId: undefined };
  }

  async rename(remoteId: string, newTitle: string) {
    updateThread(remoteId, { title: newTitle });
  }

  async archive(remoteId: string) {
    updateThread(remoteId, { status: "archived" });
  }

  async unarchive(remoteId: string) {
    updateThread(remoteId, { status: "regular" });
  }

  async delete(remoteId: string) {
    const threads = readThreads();
    const remainingThreads = threads.filter((t) => t.remoteId !== remoteId);
    writeThreads(remainingThreads);
    // Also clean up persisted messages for this thread
    try {
      localStorage.removeItem("chat-messages:" + remoteId);
    } catch {
      // ignore
    }
    // 通知删除回调
    if (onThreadDeletedCallback) {
      onThreadDeletedCallback(remoteId, remainingThreads);
    }
  }

  async generateTitle(
    _remoteId: string,
    messages: readonly { role: string; content?: unknown }[],
  ) {
    // Generate a simple title from the first user message
    let title = "New Chat";
    for (const msg of messages) {
      if (msg.role === "user") {
        const text =
          typeof msg.content === "string"
            ? msg.content
            : Array.isArray(msg.content)
              ? (msg.content as Array<{ type?: string; text?: string }>)
                  .filter((p) => p.type === "text")
                  .map((p) => p.text ?? "")
                  .join("")
              : "";
        if (text.trim()) {
          title = text.trim().slice(0, 50);
          if (text.trim().length > 50) title += "…";
          break;
        }
      }
    }

    updateThread(_remoteId, { title });

    // Return a proper AssistantStream with correct chunk types
    type Chunk = {
      readonly path: readonly number[];
      readonly type: string;
      [key: string]: unknown;
    };
    return new ReadableStream<Chunk>({
      start(controller) {
        controller.enqueue({ path: [], type: "step-start", messageId: "title" });
        controller.enqueue({ path: [0], type: "part-start", part: { type: "text" } });
        controller.enqueue({ path: [0], type: "text-delta", textDelta: title });
        controller.enqueue({ path: [0], type: "part-finish" });
        controller.enqueue({
          path: [],
          type: "step-finish",
          finishReason: "stop",
          usage: { promptTokens: 0, completionTokens: 0 },
          isContinued: false,
        });
        controller.close();
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
  }

  async fetch(threadId: string) {
    const thread = findThread(threadId);
    if (!thread) {
      return {
        remoteId: threadId,
        externalId: undefined,
        title: undefined,
        status: "regular" as const,
      };
    }
    return {
      remoteId: thread.remoteId,
      externalId: thread.externalId,
      title: thread.title,
      status: thread.status as "regular" | "archived",
    };
  }
}
