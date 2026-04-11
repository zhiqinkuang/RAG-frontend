"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  Settings,
  Check,
  Sun,
  Moon,
  Monitor,
  Globe,
  User,
  Database,
  MessageSquare,
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
  clearStoredRagAuth,
  clearAllChatData,
} from "@/lib/rag-auth";
import { RagSettings } from "@/components/rag-settings";

export interface ApiKeySettings {
  provider: ProviderId;
  apiKey: string;
  baseURL: string;
  model: string;
  knowledgeBaseId?: number;
  localDownloadPath?: string;
}

const STORAGE_KEY = "chat-settings";

const defaultSettings: ApiKeySettings = {
  provider: "doubao",
  apiKey: "",
  baseURL: "",
  model: "",
  localDownloadPath: "",
};

type Tab = "general" | "mode" | "rag";

interface SettingsDialogProps {
  onSaved?: () => void;
}

export function SettingsDialog({ onSaved }: SettingsDialogProps) {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("mode");
  const [settings, setSettings] = useState<ApiKeySettings>(defaultSettings);
  const [saved, setSaved] = useState(false);
  const [ragUser, setRagUser] =
    useState<ReturnType<typeof getStoredRagUser>>(null);

  const handleRagLogout = () => {
    clearStoredRagAuth();
    clearAllChatData();
    setRagUser(null);
    setSettings((prev) => ({ ...prev, apiKey: "" }));
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...settings, apiKey: "" }),
    );
    window.dispatchEvent(new CustomEvent("rag-auth-changed"));
    window.location.href = "/login";
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
        let provider = (parsed.provider ??
          defaultSettings.provider) as ProviderId;
        if (provider !== "doubao" && provider !== "rag") {
          provider = "doubao";
        }
        const prov = getProvider(provider);
        setSettings({
          provider,
          apiKey: parsed.apiKey ?? "",
          baseURL: prov.baseURL,
          model: prov.defaultModel,
          knowledgeBaseId: parsed.knowledgeBaseId,
          localDownloadPath: parsed.localDownloadPath ?? "",
        });
      } catch {
        setSettings({ ...defaultSettings });
      }
    }
  }, [mounted]);

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
      apiKey: provider === "rag" ? token : "",
      knowledgeBaseId:
        provider === "rag" ? (prev.knowledgeBaseId ?? undefined) : undefined,
    }));
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);
    window.dispatchEvent(new CustomEvent("settings-changed"));
    onSaved?.();
    setTimeout(() => {
      setSaved(false);
      setOpen(false);
    }, 1200);
  };

  const isRag = settings.provider === "rag";

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon-sm" className="ml-2" disabled>
        <Settings className="size-4" />
      </Button>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
      id: "mode",
      label: t.chatMode,
      icon: <MessageSquare className="size-3.5" />,
    },
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

          {/* ---- Chat Mode Tab ---- */}
          {tab === "mode" && (
            <div className="space-y-2.5 sm:space-y-3 md:space-y-4">
              <div className="space-y-1.5 sm:space-y-2">
                <label className="font-medium text-xs sm:text-sm">
                  {t.chatMode}
                </label>
                <div className="flex gap-2">
                  {PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleProviderChange(p.id)}
                      className={`flex flex-1 flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors sm:p-4 ${
                        settings.provider === p.id
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-input text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {p.id === "doubao" ? (
                        <MessageSquare className="size-5 sm:size-6" />
                      ) : (
                        <Database className="size-5 sm:size-6" />
                      )}
                      <span className="font-medium text-xs sm:text-sm">
                        {p.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground sm:text-xs">
                        {p.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Current mode status */}
              <div className="flex items-center gap-1.5 rounded-lg border p-2 sm:gap-2 sm:p-2.5 md:p-3">
                <Check className="size-3.5 shrink-0 text-green-500 sm:size-4" />
                <span className="text-green-600 text-xs sm:text-sm dark:text-green-400">
                  {isRag ? t.ragModeActive : t.doubaoModeActive}
                </span>
              </div>

              {/* RAG user info (when logged in and RAG mode) */}
              {isRag && ragUser && getStoredRagToken() && (
                <div className="space-y-2 rounded-lg border p-2.5 sm:space-y-3 sm:p-3 md:p-4">
                  <div className="font-medium text-xs sm:text-sm">
                    {t.ragAccount}
                  </div>
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
                </div>
              )}

              {/* RAG login hint */}
              {isRag && !getStoredRagToken() && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-2.5 sm:p-3 dark:border-yellow-900 dark:bg-yellow-950">
                  <p className="text-xs text-yellow-700 sm:text-sm dark:text-yellow-300">
                    {t.ragLoginRequired}
                  </p>
                </div>
              )}
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
        let provider = (parsed.provider ??
          defaultSettings.provider) as ProviderId;
        if (provider !== "doubao" && provider !== "rag") {
          provider = "doubao";
        }
        const prov = getProvider(provider);
        return {
          provider,
          apiKey: parsed.apiKey ?? "",
          baseURL: prov.baseURL,
          model: prov.defaultModel,
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
