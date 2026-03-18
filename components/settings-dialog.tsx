"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  Settings,
  Key,
  Check,
  AlertCircle,
  Sun,
  Moon,
  Monitor,
  Globe,
  User,
  Database,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PROVIDERS, getProvider, type ProviderId } from "@/lib/providers";
import { useI18n, type Lang } from "@/lib/i18n";
import { useTheme, type Theme } from "@/lib/theme";
import {
  getStoredRagUser,
  getStoredRagToken,
  setStoredRagAuth,
  clearStoredRagAuth,
  clearAllChatData,
  ragLogin,
  ragRegister,
} from "@/lib/rag-auth";
import { getRagBackendUrl } from "@/lib/config";
import { RagSettings } from "@/components/rag-settings";

export interface ApiKeySettings {
  provider: ProviderId;
  apiKey: string;
  baseURL: string;
  model: string;
  /** RAG 知识库 ID，仅当 provider 为 rag 时使用 */
  knowledgeBaseId?: number;
  /** 本地下载地址，用于论文备份 */
  localDownloadPath?: string;
}

const STORAGE_KEY = "chat-settings";

const defaultSettings: ApiKeySettings = {
  provider: "doubao",
  apiKey: "",
  baseURL: "",
  model: "doubao-seed-2-0-lite-260215",
  localDownloadPath: "",
};

type Tab = "general" | "api" | "rag";

interface SettingsDialogProps {
  onSaved?: () => void;
}

export function SettingsDialog({ onSaved }: SettingsDialogProps) {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("api");
  const [settings, setSettings] = useState<ApiKeySettings>(defaultSettings);
  const [saved, setSaved] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [ragUser, setRagUser] =
    useState<ReturnType<typeof getStoredRagUser>>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authUsername, setAuthUsername] = useState("");

  const handleRagLogin = async () => {
    setAuthError("");
    setAuthLoading(true);
    try {
      const res = await ragLogin(
        settings.baseURL.trim() || getRagBackendUrl(),
        authEmail.trim(),
        authPassword,
      );
      setStoredRagAuth(res.token, res.user);
      setRagUser(res.user);
      setSettings((prev) => ({ ...prev, apiKey: res.token }));
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...settings, apiKey: res.token }),
      );
      // 触发自定义事件通知其他组件更新
      window.dispatchEvent(new CustomEvent("rag-auth-changed"));
      onSaved?.();
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRagRegister = async () => {
    if (authPassword.length < 6) {
      setAuthError(t.passwordMinLength);
      return;
    }
    setAuthError("");
    setAuthLoading(true);
    try {
      await ragRegister(
        settings.baseURL.trim() || getRagBackendUrl(),
        authUsername.trim(),
        authEmail.trim(),
        authPassword,
      );
      setAuthMode("login");
      setAuthUsername("");
      setAuthError("注册成功，请登录");
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Register failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRagLogout = () => {
    clearStoredRagAuth();
    // 清除所有聊天缓存数据，防止新用户看到上一个用户的聊天记录
    clearAllChatData();
    setRagUser(null);
    setSettings((prev) => ({ ...prev, apiKey: "" }));
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...settings, apiKey: "" }),
    );
    // 触发自定义事件通知其他组件更新
    window.dispatchEvent(new CustomEvent("rag-auth-changed"));
    onSaved?.();
  };

  React.useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    setRagUser(getStoredRagUser());
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<ApiKeySettings>;
        const provider = (parsed.provider ??
          defaultSettings.provider) as ProviderId;
        const prov = getProvider(provider);
        setSettings({
          provider,
          apiKey: parsed.apiKey ?? "",
          baseURL: parsed.baseURL ?? prov.baseURL,
          model: parsed.model ?? prov.defaultModel,
          knowledgeBaseId: parsed.knowledgeBaseId,
          localDownloadPath: parsed.localDownloadPath ?? "",
        });
      } catch {
        setSettings({ ...defaultSettings });
      }
    }
  }, [mounted]);

  // RAG 模式下，自动同步 token
  useEffect(() => {
    if (!mounted) return;
    const token = getStoredRagToken();
    if (settings.provider === "rag" && token && settings.apiKey !== token) {
      setSettings((prev) => ({ ...prev, apiKey: token }));
    }
  }, [mounted, settings.provider, settings.apiKey]);

  const handleProviderChange = (provider: ProviderId) => {
    const prov = getProvider(provider);
    const token = provider === "rag" ? getStoredRagToken() || "" : "";
    setSettings((prev) => ({
      ...prev,
      provider,
      baseURL: prov.baseURL,
      model: prov.defaultModel,
      apiKey: provider === "rag" ? token : prev.apiKey,
      knowledgeBaseId:
        provider === "rag" ? (prev.knowledgeBaseId ?? undefined) : undefined,
    }));
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);
    // 触发自定义事件通知其他组件设置已更新
    window.dispatchEvent(new CustomEvent("settings-changed"));
    onSaved?.();
    setTimeout(() => {
      setSaved(false);
      setOpen(false);
    }, 1200);
  };

  const currentProvider = getProvider(settings.provider);
  const hasApiKey = settings.apiKey.length > 0;
  const isCustomApi = settings.provider === "custom-api";
  const isRag = settings.provider === "rag";
  // 只有 custom 和 custom-api 需要显示 Base URL 输入框
  const showBaseURLInput = settings.provider === "custom" || isCustomApi;

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon-sm" className="ml-2" disabled>
        <Settings className="size-4" />
      </Button>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "api", label: t.settingsApi, icon: <Key className="size-3.5" /> },
    {
      id: "rag",
      label: t.settingsRag,
      icon: <Database className="size-3.5" />,
    },
    {
      id: "general",
      label: t.settingsGeneral,
      icon: <Monitor className="size-3.5" />,
    },
  ];

  const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] =
    [
      { value: "light", label: t.themeLight, icon: <Sun className="size-4" /> },
      { value: "dark", label: t.themeDark, icon: <Moon className="size-4" /> },
      {
        value: "system",
        label: t.themeSystem,
        icon: <Monitor className="size-4" />,
      },
    ];

  const langOptions: { value: Lang; label: string }[] = [
    { value: "zh", label: t.langZh },
    { value: "en", label: t.langEn },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="ml-2">
          <Settings className="size-4" />
          <span className="sr-only">{t.settings}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-1rem)] flex-col rounded-xl p-0 sm:max-w-md sm:p-0 md:max-w-lg">
        <DialogHeader className="flex-shrink-0 px-3 pt-3 pb-0 sm:px-4 sm:pt-4 md:px-5 md:pt-5">
          <DialogTitle className="flex items-center gap-2 text-sm sm:text-base md:text-lg">
            <Settings className="size-4 shrink-0 sm:size-5" />
            {t.settings}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-0.5 overflow-x-auto border-b px-3 sm:gap-1 sm:px-4 md:px-5">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              type="button"
              onClick={() => setTab(tb.id)}
              className={`flex items-center gap-1 whitespace-nowrap border-b-2 px-2 py-2 font-medium text-xs transition-colors sm:gap-1.5 sm:px-2.5 sm:py-2.5 sm:text-sm md:px-3 ${
                tab === tb.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tb.icon}
              <span className="hidden sm:inline">{tb.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5 sm:px-4 sm:py-3 md:px-5 md:py-4">
          {/* ---- General Tab ---- */}
          {tab === "general" && (
            <div className="space-y-3 sm:space-y-4 md:space-y-5">
              {/* Theme */}
              <div className="space-y-1.5 sm:space-y-2">
                <label className="font-medium text-xs sm:text-sm">
                  {t.theme}
                </label>
                <div className="flex gap-1.5 sm:gap-2">
                  {themeOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTheme(opt.value)}
                      className={`flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs transition-colors sm:gap-1.5 sm:px-2.5 sm:py-2 sm:text-sm md:px-3 md:py-2.5 ${
                        theme === opt.value
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-input text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {opt.icon}
                      <span className="hidden sm:inline">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Language */}
              <div className="space-y-1.5 sm:space-y-2">
                <label className="flex items-center gap-1.5 font-medium text-xs sm:text-sm">
                  <Globe className="size-3.5 sm:size-4" />
                  {t.language}
                </label>
                <div className="flex gap-1.5 sm:gap-2">
                  {langOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setLang(opt.value)}
                      className={`flex flex-1 items-center justify-center rounded-lg border px-2 py-1.5 text-xs transition-colors sm:px-2.5 sm:py-2 sm:text-sm md:px-3 md:py-2.5 ${
                        lang === opt.value
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-input text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Local Download Path */}
              <div className="space-y-1.5 sm:space-y-2">
                <label
                  htmlFor="localDownloadPath"
                  className="font-medium text-xs sm:text-sm"
                >
                  {t.localDownloadPath}
                </label>
                <Input
                  id="localDownloadPath"
                  type="text"
                  placeholder={t.localDownloadPathHint}
                  value={settings.localDownloadPath ?? ""}
                  className="h-8 text-xs sm:h-9 sm:text-sm md:h-10"
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      localDownloadPath: e.target.value,
                    }))
                  }
                />
                <p className="text-muted-foreground text-xs">
                  {t.localDownloadPathHint}
                </p>
              </div>
            </div>
          )}

          {/* ---- API Tab ---- */}
          {tab === "api" && (
            <div className="space-y-2.5 sm:space-y-3 md:space-y-4">
              <div className="space-y-1.5 sm:space-y-2">
                <label className="font-medium text-xs sm:text-sm">
                  {t.provider}
                </label>
                <select
                  className="flex h-8 w-full touch-manipulation appearance-none rounded-lg border border-input bg-[length:1rem] bg-[right_0.75rem_center] bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%2716%27%20height%3D%2716%27%20viewBox%3D%270%200%2024%2024%27%20fill%3D%27none%27%20stroke%3D%27%236b7280%27%20stroke-width%3D%272%27%20stroke-linecap%3D%27round%27%20stroke-linejoin%3D%27round%27%3E%3Cpath%20d%3D%27m6%209%206%206%206-6%27%2F%3E%3C%2Fsvg%3E')] bg-background bg-no-repeat py-1.5 pr-8 pl-2.5 text-base sm:h-9 sm:py-2 sm:pr-10 sm:pl-3 sm:text-sm md:h-10"
                  value={settings.provider}
                  onChange={(e) =>
                    handleProviderChange(e.target.value as ProviderId)
                  }
                  aria-label={t.providerAria}
                >
                  {PROVIDERS.map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                      className="text-base sm:text-sm"
                    >
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Base URL - RAG 和 custom/custom-api 模式下显示 */}
              {(isRag || showBaseURLInput) && (
                <div className="space-y-1.5 sm:space-y-2">
                  <label
                    htmlFor="baseURL"
                    className="font-medium text-xs sm:text-sm"
                  >
                    {isCustomApi ? "API URL" : "Base URL"}
                  </label>
                  <Input
                    id="baseURL"
                    type="url"
                    placeholder={currentProvider.placeholder || "https://..."}
                    value={settings.baseURL}
                    className="h-8 text-xs sm:h-9 sm:text-sm md:h-10"
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        baseURL: e.target.value,
                      }))
                    }
                  />
                  {isRag && (
                    <p className="text-muted-foreground text-xs">
                      RAG 后端服务地址
                    </p>
                  )}
                  {isCustomApi && (
                    <p className="text-muted-foreground text-xs">
                      {t.customApiHint}
                    </p>
                  )}
                </div>
              )}

              {/* API Key - RAG 模式不显示，其他模式显示 */}
              {!isRag && (
                <div className="space-y-1.5 sm:space-y-2">
                  <label
                    htmlFor="apiKey"
                    className="font-medium text-xs sm:text-sm"
                  >
                    {t.apiKey}
                  </label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder={t.apiKeyPlaceholder}
                    value={settings.apiKey}
                    className="h-8 text-xs sm:h-9 sm:text-sm md:h-10"
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        apiKey: e.target.value,
                      }))
                    }
                  />
                </div>
              )}

              {/* Model */}
              <div className="space-y-1.5 sm:space-y-2">
                <label
                  htmlFor="model"
                  className="font-medium text-xs sm:text-sm"
                >
                  {t.model}
                </label>
                <Input
                  id="model"
                  type="password"
                  placeholder={currentProvider.placeholder}
                  value={settings.model}
                  className="h-8 text-xs sm:h-9 sm:text-sm md:h-10"
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, model: e.target.value }))
                  }
                />
              </div>

              {/* RAG 知识库 ID - 已隐藏，用户在论文搜索页面选择 */}
              {/* {isRag && (
                <div className="space-y-2">
                  <label htmlFor="knowledgeBaseId" className="text-xs sm:text-sm font-medium">
                    {t.knowledgeBaseId}
                  </label>
                  <Input
                    id="knowledgeBaseId"
                    type="number"
                    min={1}
                    placeholder={t.knowledgeBaseIdPlaceholder}
                    value={settings.knowledgeBaseId ?? ""}
                    className="h-9 sm:h-10 text-xs sm:text-sm"
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      setSettings((prev) => ({
                        ...prev,
                        knowledgeBaseId: v === "" ? undefined : parseInt(v, 10) || undefined,
                      }));
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    可在"知识库"标签页管理知识库
                  </p>
                </div>
              )} */}

              {/* RAG 登录区域 */}
              {isRag && (
                <div className="space-y-2 rounded-lg border p-2.5 sm:space-y-3 sm:p-3 md:p-4">
                  <div className="font-medium text-xs sm:text-sm">
                    {t.ragAccount}
                  </div>
                  {ragUser && getStoredRagToken() ? (
                    <div className="space-y-1.5 sm:space-y-2">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted sm:size-9 md:size-10">
                          {ragUser.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={ragUser.avatar}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : (
                            <User className="size-3.5 text-muted-foreground sm:size-4 md:size-5" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 text-xs sm:text-sm">
                          <div className="font-medium">{ragUser.username}</div>
                          <div className="truncate text-muted-foreground text-xs">
                            {ragUser.email}
                          </div>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 w-full text-xs sm:h-9 sm:text-sm"
                        onClick={handleRagLogout}
                      >
                        {t.logout}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2 sm:space-y-3">
                      <div className="flex gap-1.5 sm:gap-2">
                        <button
                          type="button"
                          className={`flex-1 rounded-lg border px-2 py-1 text-xs sm:px-2.5 sm:py-1.5 sm:text-sm md:px-3 ${
                            authMode === "login"
                              ? "border-primary bg-primary/5"
                              : "border-input"
                          }`}
                          onClick={() => {
                            setAuthMode("login");
                            setAuthError("");
                          }}
                        >
                          {t.login}
                        </button>
                        <button
                          type="button"
                          className={`flex-1 rounded-lg border px-2 py-1 text-xs sm:px-2.5 sm:py-1.5 sm:text-sm md:px-3 ${
                            authMode === "register"
                              ? "border-primary bg-primary/5"
                              : "border-input"
                          }`}
                          onClick={() => {
                            setAuthMode("register");
                            setAuthError("");
                          }}
                        >
                          {t.register}
                        </button>
                      </div>
                      {authMode === "register" && (
                        <div className="space-y-1 sm:space-y-1.5">
                          <label className="text-muted-foreground text-xs">
                            {t.username}
                          </label>
                          <Input
                            type="text"
                            placeholder={t.username}
                            value={authUsername}
                            className="h-8 text-xs sm:h-9 sm:text-sm"
                            onChange={(e) => setAuthUsername(e.target.value)}
                          />
                        </div>
                      )}
                      <div className="space-y-1 sm:space-y-1.5">
                        <label className="text-muted-foreground text-xs">
                          {t.email}
                        </label>
                        <Input
                          type="email"
                          placeholder={t.email}
                          value={authEmail}
                          className="h-8 text-xs sm:h-9 sm:text-sm"
                          onChange={(e) => setAuthEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1 sm:space-y-1.5">
                        <label className="text-muted-foreground text-xs">
                          {t.password}
                        </label>
                        <Input
                          type="password"
                          placeholder={t.password}
                          value={authPassword}
                          className="h-8 text-xs sm:h-9 sm:text-sm"
                          onChange={(e) => setAuthPassword(e.target.value)}
                        />
                      </div>
                      {authError && (
                        <p className="text-destructive text-xs">{authError}</p>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 w-full text-xs sm:h-9 sm:text-sm"
                        disabled={authLoading}
                        onClick={
                          authMode === "login"
                            ? handleRagLogin
                            : handleRagRegister
                        }
                      >
                        {authLoading
                          ? "..."
                          : authMode === "login"
                            ? t.login
                            : t.register}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* 状态提示 */}
              <div className="flex items-center gap-1.5 rounded-lg border p-2 sm:gap-2 sm:p-2.5 md:p-3">
                {hasApiKey ? (
                  <>
                    <Check className="size-3.5 shrink-0 text-green-500 sm:size-4" />
                    <span className="text-green-600 text-xs sm:text-sm dark:text-green-400">
                      {t.apiKeyConfigured}
                    </span>
                  </>
                ) : isCustomApi ? (
                  <>
                    <Check className="size-3.5 shrink-0 text-blue-500 sm:size-4" />
                    <span className="text-blue-600 text-xs sm:text-sm dark:text-blue-400">
                      {t.apiKeyOptional}
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="size-3.5 shrink-0 text-yellow-500 sm:size-4" />
                    <span className="text-xs text-yellow-600 sm:text-sm dark:text-yellow-400">
                      {t.apiKeyRequired}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ---- RAG Tab ---- */}
          {tab === "rag" && (
            <RagSettings
              selectedKbId={settings.knowledgeBaseId}
              onKnowledgeBaseChange={(kbId) => {
                setSettings((prev) => ({ ...prev, knowledgeBaseId: kbId }));
              }}
            />
          )}
        </div>

        <DialogFooter className="flex-shrink-0 flex-col gap-1.5 border-t px-3 py-2.5 sm:flex-row sm:gap-2 sm:px-4 sm:py-3 md:px-5 md:py-4">
          <Button
            variant="outline"
            className="h-8 w-full text-xs sm:h-9 sm:w-auto sm:text-sm md:h-10"
            onClick={() => setOpen(false)}
          >
            {t.cancel}
          </Button>
          <Button
            className="h-8 w-full text-xs sm:h-9 sm:w-auto sm:text-sm md:h-10"
            onClick={handleSave}
            disabled={saved}
          >
            {saved ? (
              <>
                <Check className="size-3.5 sm:size-4" />
                {t.saved}
              </>
            ) : (
              t.save
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useApiKey() {
  const getSettings = (): ApiKeySettings => {
    if (typeof window === "undefined") return { ...defaultSettings };
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<ApiKeySettings>;
        const provider = (parsed.provider ??
          defaultSettings.provider) as ProviderId;
        const prov = getProvider(provider);
        return {
          provider,
          apiKey: parsed.apiKey ?? "",
          baseURL: parsed.baseURL ?? prov.baseURL,
          model: parsed.model ?? prov.defaultModel,
          knowledgeBaseId: parsed.knowledgeBaseId,
          localDownloadPath: parsed.localDownloadPath ?? "",
        };
      } catch {
        return { ...defaultSettings };
      }
    }
    return { ...defaultSettings };
  };

  return { getSettings };
}
