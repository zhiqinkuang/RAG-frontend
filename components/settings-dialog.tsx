"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Settings, Key, Check, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PROVIDERS, getProvider, type ProviderId } from "@/lib/providers";
import { useI18n } from "@/lib/i18n";

export interface ApiKeySettings {
  provider: ProviderId;
  apiKey: string;
  baseURL: string;
  model: string;
}

const STORAGE_KEY = "chat-settings";

const defaultSettings: ApiKeySettings = {
  provider: "doubao",
  apiKey: "",
  baseURL: "",
  model: "doubao-seed-2-0-lite-260215",
};

interface SettingsDialogProps {
  /** 保存设置后回调，用于刷新 header 显示的模型 */
  onSaved?: () => void;
}

export function SettingsDialog({ onSaved }: SettingsDialogProps) {
  const { t } = useI18n();
  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<ApiKeySettings>(defaultSettings);
  const [saved, setSaved] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

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
        });
      } catch {
        setSettings({ ...defaultSettings });
      }
    }
  }, [mounted, open]);

  const handleProviderChange = (provider: ProviderId) => {
    const prov = getProvider(provider);
    setSettings((prev) => ({
      ...prev,
      provider,
      baseURL: prev.baseURL && prev.provider === "custom" ? prev.baseURL : prov.baseURL,
      model: prov.defaultModel,
    }));
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);
    onSaved?.();
    setTimeout(() => {
      setSaved(false);
      setOpen(false);
    }, 1500);
  };

  const currentProvider = getProvider(settings.provider);
  const hasApiKey = settings.apiKey.length > 0;
  const showBaseURL = settings.provider === "custom" || !currentProvider.baseURL;

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon-sm" className="ml-2" disabled>
        <Settings className="size-4" />
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="ml-2">
          <Settings className="size-4" />
          <span className="sr-only">{t.settings}</span>
        </Button>
      </DialogTrigger>
      <DialogContent
        className="flex max-h-[90dvh] w-[calc(100vw-1rem)] max-w-md flex-col rounded-xl p-4 pb-6 sm:p-6 sm:pb-6 [--padding:1rem] sm:[--padding:1.5rem]"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Key className="size-5 shrink-0" />
            {t.apiSettings}
          </DialogTitle>
          <DialogDescription className="text-left text-sm">
            {t.apiSettingsDesc}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t.provider}</label>
            <select
              className="flex h-11 w-full min-h-[44px] appearance-none rounded-lg border border-input bg-background pl-3 pr-10 py-2 text-lg font-medium touch-manipulation [font-size:1.125rem]"
              value={settings.provider}
              onChange={(e) => handleProviderChange(e.target.value as ProviderId)}
              aria-label={t.providerAria}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 0.75rem center",
                backgroundSize: "1.25rem",
              }}
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {showBaseURL && (
            <div className="space-y-2">
              <label htmlFor="baseURL" className="text-sm font-medium">
                Base URL
              </label>
              <Input
                id="baseURL"
                type="url"
                placeholder="https://api.example.com/v1"
                value={settings.baseURL}
                className="min-h-[44px] text-base touch-manipulation"
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, baseURL: e.target.value }))
                }
              />
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="apiKey" className="text-sm font-medium">
              {t.apiKey}
            </label>
            <Input
              id="apiKey"
              type="password"
              placeholder={t.apiKeyPlaceholder}
              value={settings.apiKey}
              className="min-h-[44px] text-base touch-manipulation"
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, apiKey: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="model" className="text-sm font-medium">
              {t.model}
            </label>
            <Input
              id="model"
              type="text"
              placeholder={currentProvider.placeholder}
              value={settings.model}
              className="min-h-[44px] text-base touch-manipulation"
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, model: e.target.value }))
              }
            />
          </div>

          <div className="flex min-h-[44px] items-center gap-2 rounded-lg border p-3">
            {hasApiKey ? (
              <>
                <Check className="size-4 shrink-0 text-green-500" />
                <span className="text-sm text-green-600 dark:text-green-400">{t.apiKeyConfigured}</span>
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

        <DialogFooter className="flex-shrink-0 flex-col gap-2 pt-2 sm:flex-row">
          <Button
            variant="outline"
            className="min-h-[44px] w-full touch-manipulation sm:w-auto"
            onClick={() => setOpen(false)}
          >
            {t.cancel}
          </Button>
          <Button
            className="min-h-[44px] w-full touch-manipulation sm:w-auto"
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
    if (typeof window === "undefined") {
      return { ...defaultSettings };
    }
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
