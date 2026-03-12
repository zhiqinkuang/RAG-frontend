"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { ragLogin, setStoredRagAuth } from "@/lib/rag-auth";
import { getProvider } from "@/lib/providers";
import {
  validateEmail,
  validatePassword,
  validateURL,
  type ValidationResult,
  type PasswordStrength,
} from "@/lib/validation";

const STORAGE_KEY = "chat-settings";

/** 防暴力破解：登录失败后禁用时间（毫秒） */
const LOCKOUT_DURATION = 3000;

export default function LoginPage() {
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  // 验证状态
  const [emailError, setEmailError] = useState<string | null>(null);
  const [baseURLError, setBaseURLError] = useState<string | null>(null);
  
  // 防暴力破解状态
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutCountdown, setLockoutCountdown] = useState(0);

  // 实时验证邮箱
  const validateEmailField = useCallback((value: string) => {
    if (value.trim() === "") {
      setEmailError(null);
      return;
    }
    const result: ValidationResult = validateEmail(value);
    setEmailError(result.valid ? null : result.error || null);
  }, []);

  // 实时验证 Base URL
  const validateBaseURLField = useCallback((value: string) => {
    if (value.trim() === "") {
      setBaseURLError("Base URL is required");
      return;
    }
    const result = validateURL(value, { allowLocalhost: true });
    setBaseURLError(result.valid ? null : result.error || null);
  }, []);

  // 防暴力破解倒计时
  useEffect(() => {
    if (lockoutCountdown > 0) {
      const timer = setTimeout(() => {
        setLockoutCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (isLocked) {
      setIsLocked(false);
    }
  }, [lockoutCountdown, isLocked]);

  // 触发锁定
  const triggerLockout = useCallback(() => {
    setIsLocked(true);
    setLockoutCountdown(Math.ceil(LOCKOUT_DURATION / 1000));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // 验证 Base URL
    const baseURLResult = validateURL(baseURL.trim(), { allowLocalhost: true });
    if (!baseURLResult.valid) {
      setError(baseURLResult.error || "Invalid Base URL");
      return;
    }

    // 验证邮箱
    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
      setError(emailResult.error || "Invalid email");
      return;
    }

    // 验证密码非空
    if (!password) {
      setError("Password is required");
      return;
    }

    setLoading(true);
    try {
      const res = await ragLogin(baseURL.trim(), email.trim().toLowerCase(), password);
      setStoredRagAuth(res.token, res.user);
      const settings = {
        provider: "rag",
        apiKey: res.token,
        baseURL: baseURL.trim(),
        model: getProvider("rag").defaultModel,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      // 触发自定义事件通知其他组件更新
      window.dispatchEvent(new CustomEvent("rag-auth-changed"));
      router.push("/");
      router.refresh();
    } catch (err) {
      // 登录失败，触发防暴力破解锁定
      triggerLockout();
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">{t.loginTitle}</h1>
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
              onChange={(e) => {
                setBaseURL(e.target.value);
                validateBaseURLField(e.target.value);
              }}
              onBlur={() => validateBaseURLField(baseURL)}
              className={`h-10 ${baseURLError ? "border-destructive" : ""}`}
              aria-invalid={!!baseURLError}
              aria-describedby={baseURLError ? "baseURL-error" : undefined}
            />
            {baseURLError && (
              <p id="baseURL-error" className="text-destructive text-xs">
                {baseURLError}
              </p>
            )}
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
              onChange={(e) => {
                setEmail(e.target.value);
                validateEmailField(e.target.value);
              }}
              onBlur={() => validateEmailField(email)}
              className={`h-10 ${emailError ? "border-destructive" : ""}`}
              aria-invalid={!!emailError}
              aria-describedby={emailError ? "email-error" : undefined}
              required
            />
            {emailError && (
              <p id="email-error" className="text-destructive text-xs">
                {emailError}
              </p>
            )}
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
            />
          </div>
          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={loading || isLocked}
            aria-disabled={loading || isLocked}
          >
            {isLocked
              ? `Please wait ${lockoutCountdown}s`
              : loading
                ? "..."
                : t.login}
          </Button>
        </form>
        <p className="text-center text-muted-foreground text-sm">
          {t.notLoggedIn}{" "}
          <Link href="/register" className="text-primary underline underline-offset-2">
            {t.register}
          </Link>
        </p>
      </div>
    </div>
  );
}