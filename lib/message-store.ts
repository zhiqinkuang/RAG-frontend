/**
 * localStorage-backed ThreadHistoryAdapter with per-thread message persistence.
 * Uses the aiSDKV6FormatAdapter's encode/decode to serialize UIMessages.
 */

import type {
  ThreadHistoryAdapter,
  MessageFormatAdapter,
} from "@assistant-ui/react";

const MSG_PREFIX = "chat-messages:";

type StoredEntry = {
  id: string;
  parent_id: string | null;
  format: string;
  content: unknown;
};

type StoredRepo = {
  headId?: string | null;
  messages: StoredEntry[];
};

function loadRepo(threadId: string): StoredRepo {
  if (typeof window === "undefined") return { messages: [] };
  try {
    const raw = localStorage.getItem(MSG_PREFIX + threadId);
    return raw ? JSON.parse(raw) : { messages: [] };
  } catch {
    return { messages: [] };
  }
}

function saveRepo(threadId: string, repo: StoredRepo) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MSG_PREFIX + threadId, JSON.stringify(repo));
  } catch {
    // quota exceeded
  }
}

export function deleteMessages(threadId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(MSG_PREFIX + threadId);
}

export function createThreadHistoryAdapter(threadId: string): ThreadHistoryAdapter {
  return {
    async load() {
      return { messages: [] };
    },
    async append() {},
    withFormat<TMessage, TStorageFormat>(
      formatAdapter: MessageFormatAdapter<TMessage, TStorageFormat>,
    ) {
      return {
        async load() {
          const repo = loadRepo(threadId);
          if (repo.messages.length === 0) return { messages: [] };

          const decoded = repo.messages.map((entry) =>
            formatAdapter.decode({
              id: entry.id,
              parent_id: entry.parent_id,
              format: entry.format,
              content: entry.content as TStorageFormat,
            }),
          );
          return {
            headId: repo.headId,
            messages: decoded,
          };
        },
        async append(item: { parentId: string | null; message: TMessage }) {
          const id = formatAdapter.getId(item.message);
          const encoded = formatAdapter.encode(item);

          const repo = loadRepo(threadId);
          const existing = repo.messages.findIndex((m) => m.id === id);
          const entry: StoredEntry = {
            id,
            parent_id: item.parentId,
            format: formatAdapter.format,
            content: encoded,
          };

          if (existing >= 0) {
            repo.messages[existing] = entry;
          } else {
            repo.messages.push(entry);
          }
          repo.headId = id;

          saveRepo(threadId, repo);
        },
      };
    },
  };
}
