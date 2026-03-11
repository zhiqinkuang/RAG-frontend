"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { ragRegister, setStoredRagAuth, ragLogin } from "@/lib/rag-auth";
import { getProvider } from "@/lib/providers";

const STORAGE_KEY = "chat-settings";

export default function RegisterPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [baseURL, setBaseURL] = useState(() => {
    if (typeof window === "undefined") return getProvider("rag").baseURL;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { baseURL?: string; provider?: string };
        if (p.provider === "rag" && p.baseURL) return p.baseURL;
      }
    } catch {}
    return getProvider("rag").baseURL;
  });
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!baseURL.trim()) {
      setError(t.ragBaseUrlRequired);
      return;
    }
    if (password.length < 6) {
      setError(t.passwordMinLength);
      return;
    }
    setLoading(true);
    try {
      await ragRegister(baseURL.trim(), username.trim(), email.trim(), password);
      const res = await ragLogin(baseURL.trim(), email.trim(), password);
      setStoredRagAuth(res.token, res.user);
      const settings = {
        provider: "rag",
        apiKey: res.token,
        baseURL: baseURL.trim(),
        model: getProvider("rag").defaultModel,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Register failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">{t.registerTitle}</h1>
          <p className="mt-1 text-muted-foreground text-sm">{t.ragAccount}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="baseURL" className="text-sm font-medium">
              Base URL
            </label>
            <Input
              id="baseURL"
              type="url"
              placeholder="http://127.0.0.1:8080"
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium">
              {t.username}
            </label>
            <Input
              id="username"
              type="text"
              placeholder={t.username}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-10"
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              {t.email}
            </label>
            <Input
              id="email"
              type="email"
              placeholder={t.email}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10"
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              {t.password}
            </label>
            <Input
              id="password"
              type="password"
              placeholder={t.password}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10"
              required
              minLength={6}
            />
          </div>
          {error && (
            <p className="text-destructive text-sm">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "..." : t.register}
          </Button>
        </form>
        <p className="text-center text-muted-foreground text-sm">
          <Link href="/login" className="text-primary underline underline-offset-2">
            {t.login}
          </Link>
        </p>
      </div>
    </div>
  );
}
