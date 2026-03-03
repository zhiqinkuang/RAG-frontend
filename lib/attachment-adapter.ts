import { generateId } from "ai";
import type {
  AttachmentAdapter,
  PendingAttachment,
  CompleteAttachment,
} from "@assistant-ui/react";

const getFileDataURL = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const ACCEPTED_FILE_TYPES = [
  "image/*",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "video/*",
  "audio/*",
  "text/plain",
  "text/csv",
  "text/markdown",
].join(", ");

function resolveType(mimeType: string): "image" | "document" | "file" {
  if (mimeType.startsWith("image/")) return "image";
  if (
    mimeType === "application/pdf" ||
    mimeType.includes("word") ||
    mimeType.includes("excel") ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("powerpoint") ||
    mimeType.includes("presentation")
  )
    return "document";
  return "file";
}

export const customAttachmentAdapter: AttachmentAdapter = {
  accept: ACCEPTED_FILE_TYPES,

  async add({ file }: { file: File }): Promise<PendingAttachment> {
    return {
      id: generateId(),
      type: resolveType(file.type),
      name: file.name,
      file,
      contentType: file.type,
      content: [],
      status: { type: "requires-action", reason: "composer-send" },
    } as PendingAttachment;
  },

  async send(attachment: PendingAttachment): Promise<CompleteAttachment> {
    const file = (attachment as PendingAttachment & { file?: File }).file;
    const dataURL = file ? await getFileDataURL(file) : "";
    return {
      ...attachment,
      status: { type: "complete" as const },
      content: [
        {
          type: "file" as const,
          mimeType: attachment.contentType ?? "",
          filename: attachment.name,
          data: dataURL,
        },
      ],
    } as CompleteAttachment;
  },

  async remove() {},
};
