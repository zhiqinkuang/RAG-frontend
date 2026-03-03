"use client";

import * as React from "react";
import type { Attachment } from "@assistant-ui/react";

export type QueueItem = {
  id: string;
  text: string;
  attachments: Attachment[];
};

export type QueueContextValue = {
  items: QueueItem[];
  addItem: (text: string, attachments?: Attachment[]) => void;
  removeItem: (id: string) => void;
};

export const QueueContext = React.createContext<QueueContextValue>({
  items: [],
  addItem: () => {},
  removeItem: () => {},
});

export function useQueue() {
  return React.useContext(QueueContext);
}
