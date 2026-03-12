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
    apiKeyOptional: "API Key 可选（取决于你的后端是否需要鉴权）",
    customApiHint: "填写完整的 API 地址，后端需返回 UI Message Stream SSE 格式",
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
    unarchive: "取消归档",
    archivedThreads: "已归档",
    deleteThread: "删除",
    moreOptions: "更多选项",
    rename: "重命名",
    // Settings tabs & sections
    settingsGeneral: "通用",
    settingsApi: "API",
    settingsUser: "用户",
    settingsRag: "知识库",
    // Theme
    theme: "主题",
    themeLight: "浅色",
    themeDark: "深色",
    themeSystem: "跟随系统",
    // Language
    language: "语言",
    langZh: "中文",
    langEn: "English",
    // User info
    userInfo: "用户信息",
    nickname: "昵称",
    nicknamePlaceholder: "请输入昵称",
    avatar: "头像",
    avatarHint: "输入头像 URL 或留空使用默认头像",
    notLoggedIn: "未登录",
    loginHint: "登录后可同步聊天记录到云端（即将推出）",
    // Suggestions
    suggestionsTitle: "你可能想问",
    // RAG
    knowledgeBase: "知识库",
    knowledgeBaseId: "知识库 ID",
    knowledgeBaseIdPlaceholder: "可选，留空则不指定",
    ragApiHint: "Base URL 为 RAG 后端地址；API Key 为登录后获得的 Token。",
    // Auth (RAG)
    login: "登录",
    register: "注册",
    logout: "退出登录",
    logoutConfirm: "确定要退出登录吗？",
    email: "邮箱",
    password: "密码",
    username: "用户名",
    loginTitle: "RAG 账号登录",
    registerTitle: "注册 RAG 账号",
    loginWithRagHint: "请先在 API 中选择 RAG 知识库并填写 Base URL，再在此登录。",
    loginSuccess: "登录成功，Token 已写入 API Key",
    registerSuccess: "注册成功，请登录",
    ragAccount: "RAG 账号",
    ragBaseUrlRequired: "请先在 API 中填写 Base URL",
    passwordMinLength: "密码至少 6 位",
    // Validation errors
    invalidEmail: "邮箱格式不正确",
    invalidPassword: "密码至少 8 位，包含大小写字母和数字",
    invalidUsername: "用户名为 3-20 位字母、数字或下划线",
    passwordRequired: "请输入密码",
    loginFailed: "登录失败，请检查邮箱和密码",
    networkError: "网络错误，请检查连接",
    pleaseWait: "请等待 {seconds} 秒",
    loginSuccess: "登录成功",
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
    apiKeyOptional: "API Key is optional (depends on your backend auth)",
    customApiHint: "Enter full API URL. Backend must return UI Message Stream SSE format.",
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
    unarchive: "Unarchive",
    archivedThreads: "Archived",
    deleteThread: "Delete",
    moreOptions: "More options",
    rename: "Rename",
    // Settings tabs & sections
    settingsGeneral: "General",
    settingsApi: "API",
    settingsUser: "User",
    settingsRag: "Knowledge Base",
    // Theme
    theme: "Theme",
    themeLight: "Light",
    themeDark: "Dark",
    themeSystem: "System",
    // Language
    language: "Language",
    langZh: "中文",
    langEn: "English",
    // User info
    userInfo: "User Info",
    nickname: "Nickname",
    nicknamePlaceholder: "Enter nickname",
    avatar: "Avatar",
    avatarHint: "Enter avatar URL or leave blank for default",
    notLoggedIn: "Not logged in",
    loginHint: "Login to sync chat history to cloud (coming soon)",
    // Suggestions
    suggestionsTitle: "You might want to ask",
    // RAG
    knowledgeBase: "Knowledge Base",
    knowledgeBaseId: "Knowledge Base ID",
    knowledgeBaseIdPlaceholder: "Optional, leave empty to not specify",
    ragApiHint: "Base URL is your RAG backend; API Key is the token from login.",
    // Auth (RAG)
    login: "Login",
    register: "Register",
    logout: "Log out",
    logoutConfirm: "Are you sure you want to log out?",
    email: "Email",
    password: "Password",
    username: "Username",
    loginTitle: "RAG Account Login",
    registerTitle: "Register RAG Account",
    loginWithRagHint: "Select RAG Knowledge Base and set Base URL in API tab first, then login here.",
    loginSuccess: "Login successful, token saved to API Key",
    registerSuccess: "Registered. Please log in.",
    ragAccount: "RAG Account",
    ragBaseUrlRequired: "Please set Base URL in API tab first",
    passwordMinLength: "Password must be at least 6 characters",
    // Validation errors
    invalidEmail: "Invalid email format",
    invalidPassword: "Password must be at least 8 characters with uppercase, lowercase and number",
    invalidUsername: "Username must be 3-20 characters (letters, numbers, underscores)",
    passwordRequired: "Password is required",
    loginFailed: "Login failed, please check your email and password",
    networkError: "Network error, please check your connection",
    pleaseWait: "Please wait {seconds}s",
    loginSuccess: "Login successful",
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
