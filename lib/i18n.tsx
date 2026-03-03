"use client";

import * as React from "react";

export type Lang = "zh" | "en";

const STORAGE_KEY = "app-lang";

const translations = {
  zh: {
    settings: "设置",
    apiSettings: "API 设置",
    apiSettingsDesc: "选择提供商并填写 API Key",
    provider: "提供商",
    providerAria: "选择 API 提供商",
    apiKey: "API Key",
    apiKeyPlaceholder: "请输入 API Key",
    model: "模型",
    apiKeyConfigured: "API Key 已配置",
    apiKeyRequired: "请配置 API Key 以使用对话功能",
    cancel: "取消",
    save: "保存设置",
    saved: "已保存",
    copyCode: "复制代码",
    notConfigured: "未配置",
    greetingTitle: "你好！",
    greetingSubtitle: "今天有什么可以帮你的？",
    chat: "对话",
    sendMessagePlaceholder: "发送消息...",
    messageInputAria: "消息输入",
    sendMessage: "发送",
    stopGenerating: "停止生成",
    update: "更新",
    thinking: "思考中",
    addAttachment: "添加图片或文件",
    removeAttachment: "移除",
    reasoning: "思考",
    sendQueued: "发送会加入队列，回复完成后自动发送",
    queueTitle: "等待队列",
    queueRemove: "移除",
    newThread: "新对话",
    newChat: "新对话",
    archive: "归档",
    deleteThread: "删除",
    moreOptions: "更多选项",
    rename: "重命名",
  },
  en: {
    settings: "Settings",
    apiSettings: "API Settings",
    apiSettingsDesc: "Choose provider and enter API Key",
    provider: "Provider",
    providerAria: "Select API provider",
    apiKey: "API Key",
    apiKeyPlaceholder: "Enter API Key",
    model: "Model",
    apiKeyConfigured: "API Key configured",
    apiKeyRequired: "Configure API Key to use chat",
    cancel: "Cancel",
    save: "Save",
    saved: "Saved",
    copyCode: "Copy code",
    notConfigured: "Not set",
    greetingTitle: "Hello there!",
    greetingSubtitle: "How can I help you today?",
    chat: "Chat",
    sendMessagePlaceholder: "Send a message...",
    messageInputAria: "Message input",
    sendMessage: "Send message",
    stopGenerating: "Stop generating",
    update: "Update",
    thinking: "Thinking...",
    addAttachment: "Add image or file",
    removeAttachment: "Remove",
    reasoning: "Reasoning",
    sendQueued: "Send will be queued and sent after current reply",
    queueTitle: "Queue",
    queueRemove: "Remove",
    newThread: "New Thread",
    newChat: "New Chat",
    archive: "Archive",
    deleteThread: "Delete",
    moreOptions: "More options",
    rename: "Rename",
  },
} as const;

type Messages = (typeof translations)[Lang];

function getStoredLang(): Lang {
  if (typeof window === "undefined") return "zh";
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "en" ? "en" : "zh";
}

function setStoredLang(lang: Lang) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, lang);
}

const I18nContext = React.createContext<{
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Messages;
} | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>("zh");

  // 客户端挂载后从 localStorage 恢复语言，避免与服务端初始 "zh" 的 hydration 不一致
  React.useEffect(() => {
    setLangState(getStoredLang());
  }, []);

  // 跨标签页同步：其他标签修改 app-lang 时更新本页
  React.useEffect(() => {
    const handler = () => setLangState(getStoredLang());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const setLang = React.useCallback((next: Lang) => {
    setStoredLang(next);
    setLangState((prev) => (prev === next ? prev : next));
  }, []);

  const t = translations[lang];

  // 同步到 <html lang>，便于无障碍与验证语言已更新
  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    }
  }, [lang]);

  const value = React.useMemo(
    () => ({ lang, setLang, t }),
    [lang, setLang, t]
  );

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
