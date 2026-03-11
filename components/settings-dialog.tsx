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
  ragLogin,
  ragRegister,
} from "@/lib/rag-auth";
import { RagSettings } from "@/components/rag-settings";

export interface ApiKeySettings {
  provider: ProviderId;
  apiKey: string;
  baseURL: string;
  model: string;
  /** RAG 知识库 ID，仅当 provider 为 rag 时使用 */
  knowledgeBaseId?: number;
}

const STORAGE_KEY = "chat-settings";

const defaultSettings: ApiKeySettings = {
  provider: "doubao",
  apiKey: "",
  baseURL: "",
  model: "doubao-seed-2-0-lite-260215",
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
  const [ragUser, setRagUser] = useState<ReturnType<typeof getStoredRagUser>>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authUsername, setAuthUsername] = useState("");

  const handleRagLogin = async () => {
    setAuthError("");
    setAuthLoading(true);
    try {
      const res = await ragLogin(settings.baseURL.trim() || "http://127.0.0.1:8080", authEmail.trim(), authPassword);
      setStoredRagAuth(res.token, res.user);
      setRagUser(res.user);
      setSettings((prev) => ({ ...prev, apiKey: res.token }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, apiKey: res.token }));
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
      await ragRegister(settings.baseURL.trim() || "http://127.0.0.1:8080", authUsername.trim(), authEmail.trim(), authPassword);
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
    setRagUser(null);
    setSettings((prev) => ({ ...prev, apiKey: "" }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, apiKey: "" }));
    // 触发自定义事件通知其他组件更新
    window.dispatchEvent(new CustomEvent("rag-auth-changed"));
    onSaved?.();
  };

  React.useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    setRagUser(getStoredRagUser());
  }, [mounted, open, tab]);

  useEffect(() => {
    if (!mounted) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<ApiKeySettings>;
        const provider = (parsed.provider ?? defaultSettings.provider) as ProviderId;
        const prov = getProvider(provider);
        setSettings({
          provider,
          apiKey: parsed.apiKey ?? "",
          baseURL: parsed.baseURL ?? prov.baseURL,
          model: parsed.model ?? prov.defaultModel,
          knowledgeBaseId: parsed.knowledgeBaseId,
        });
      } catch {
        setSettings({ ...defaultSettings });
      }
    }
  }, [mounted, open]);

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
      knowledgeBaseId: provider === "rag" ? (prev.knowledgeBaseId ?? undefined) : undefined,
    }));
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);
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
    { id: "rag", label: t.settingsRag, icon: <Database className="size-3.5" /> },
    { id: "general", label: t.settingsGeneral, icon: <Monitor className="size-3.5" /> },
  ];

  const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: t.themeLight, icon: <Sun className="size-4" /> },
    { value: "dark", label: t.themeDark, icon: <Moon className="size-4" /> },
    { value: "system", label: t.themeSystem, icon: <Monitor className="size-4" /> },
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
      <DialogContent
        className="flex max-h-[90dvh] w-[calc(100vw-1rem)] max-w-md flex-col rounded-xl p-0 sm:p-0"
      >
        <DialogHeader className="flex-shrink-0 px-5 pt-5 pb-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Settings className="size-5 shrink-0" />
            {t.settings}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 border-b px-5">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              type="button"
              onClick={() => setTab(tb.id)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                tab === tb.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tb.icon}
              {tb.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {/* ---- General Tab ---- */}
          {tab === "general" && (
            <div className="space-y-5">
              {/* Theme */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.theme}</label>
                <div className="flex gap-2">
                  {themeOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTheme(opt.value)}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                        theme === opt.value
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-input text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {opt.icon}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Globe className="size-4" />
                  {t.language}
                </label>
                <div className="flex gap-2">
                  {langOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setLang(opt.value)}
                      className={`flex flex-1 items-center justify-center rounded-lg border px-3 py-2.5 text-sm transition-colors ${
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
            </div>
          )}

          {/* ---- API Tab ---- */}
          {tab === "api" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.provider}</label>
                <select
                  className="flex h-10 w-full appearance-none rounded-lg border border-input bg-background pl-3 pr-10 py-2 text-sm touch-manipulation"
                  value={settings.provider}
                  onChange={(e) =>
                    handleProviderChange(e.target.value as ProviderId)
                  }
                  aria-label={t.providerAria}
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 0.75rem center",
                    backgroundSize: "1rem",
                  }}
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Base URL - RAG 和 custom/custom-api 模式下显示 */}
              {(isRag || showBaseURLInput) && (
                <div className="space-y-2">
                  <label htmlFor="baseURL" className="text-sm font-medium">
                    {isCustomApi ? "API URL" : "Base URL"}
                  </label>
                  <Input
                    id="baseURL"
                    type="url"
                    placeholder={currentProvider.placeholder || "http://127.0.0.1:8080"}
                    value={settings.baseURL}
                    className="h-10 text-sm"
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        baseURL: e.target.value,
                      }))
                    }
                  />
                  {isRag && (
                    <p className="text-xs text-muted-foreground">
                      RAG 后端服务地址
                    </p>
                  )}
                  {isCustomApi && (
                    <p className="text-xs text-muted-foreground">
                      {t.customApiHint}
                    </p>
                  )}
                </div>
              )}

              {/* API Key - RAG 模式不显示，其他模式显示 */}
              {!isRag && (
                <div className="space-y-2">
                  <label htmlFor="apiKey" className="text-sm font-medium">
                    {t.apiKey}
                  </label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder={t.apiKeyPlaceholder}
                    value={settings.apiKey}
                    className="h-10 text-sm"
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
              <div className="space-y-2">
                <label htmlFor="model" className="text-sm font-medium">
                  {t.model}
                </label>
                <Input
                  id="model"
                  type="text"
                  placeholder={currentProvider.placeholder}
                  value={settings.model}
                  className="h-10 text-sm"
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, model: e.target.value }))
                  }
                />
              </div>

              {/* RAG 知识库 ID */}
              {isRag && (
                <div className="space-y-2">
                  <label htmlFor="knowledgeBaseId" className="text-sm font-medium">
                    {t.knowledgeBaseId}
                  </label>
                  <Input
                    id="knowledgeBaseId"
                    type="number"
                    min={1}
                    placeholder={t.knowledgeBaseIdPlaceholder}
                    value={settings.knowledgeBaseId ?? ""}
                    className="h-10 text-sm"
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
              )}

              {/* RAG 登录区域 */}
              {isRag && (
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="text-sm font-medium">{t.ragAccount}</div>
                  {ragUser && getStoredRagToken() ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted">
                          {ragUser.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={ragUser.avatar}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : (
                            <User className="size-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 text-sm">
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
                        className="w-full"
                        onClick={handleRagLogout}
                      >
                        {t.logout}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className={`flex-1 rounded-lg border px-3 py-1.5 text-sm ${
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
                          className={`flex-1 rounded-lg border px-3 py-1.5 text-sm ${
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
                        <div className="space-y-1.5">
                          <label className="text-xs text-muted-foreground">
                            {t.username}
                          </label>
                          <Input
                            type="text"
                            placeholder={t.username}
                            value={authUsername}
                            className="h-9 text-sm"
                            onChange={(e) => setAuthUsername(e.target.value)}
                          />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">
                          {t.email}
                        </label>
                        <Input
                          type="email"
                          placeholder={t.email}
                          value={authEmail}
                          className="h-9 text-sm"
                          onChange={(e) => setAuthEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">
                          {t.password}
                        </label>
                        <Input
                          type="password"
                          placeholder={t.password}
                          value={authPassword}
                          className="h-9 text-sm"
                          onChange={(e) => setAuthPassword(e.target.value)}
                        />
                      </div>
                      {authError && (
                        <p className="text-destructive text-xs">{authError}</p>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        className="w-full"
                        disabled={authLoading}
                        onClick={
                          authMode === "login" ? handleRagLogin : handleRagRegister
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
              <div className="flex items-center gap-2 rounded-lg border p-3">
                {hasApiKey ? (
                  <>
                    <Check className="size-4 shrink-0 text-green-500" />
                    <span className="text-sm text-green-600 dark:text-green-400">
                      {t.apiKeyConfigured}
                    </span>
                  </>
                ) : isCustomApi ? (
                  <>
                    <Check className="size-4 shrink-0 text-blue-500" />
                    <span className="text-sm text-blue-600 dark:text-blue-400">
                      {t.apiKeyOptional}
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="size-4 shrink-0 text-yellow-500" />
                    <span className="text-sm text-yellow-600 dark:text-yellow-400">
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

        <DialogFooter className="flex-shrink-0 flex-col gap-2 border-t px-5 py-4 sm:flex-row">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => setOpen(false)}
          >
            {t.cancel}
          </Button>
          <Button
            className="w-full sm:w-auto"
            onClick={handleSave}
            disabled={saved}
          >
            {saved ? (
              <>
                <Check className="size-4" />
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
        const provider = (parsed.provider ?? defaultSettings.provider) as ProviderId;
        const prov = getProvider(provider);
        return {
          provider,
          apiKey: parsed.apiKey ?? "",
          baseURL: parsed.baseURL ?? prov.baseURL,
          model: parsed.model ?? prov.defaultModel,
        };
      } catch {
        return { ...defaultSettings };
      }
    }
    return { ...defaultSettings };
  };

  return { getSettings };
}