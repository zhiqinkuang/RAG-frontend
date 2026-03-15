"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { ragLogin, setStoredRagAuth } from "@/lib/rag-auth";
import { getProvider } from "@/lib/providers";
import { validateEmail } from "@/lib/validation";

const STORAGE_KEY = "chat-settings";

/** 防暴力破解：登录失败后禁用时间（毫秒） */
const LOCKOUT_DURATION = 3000;

/** 默认 RAG 后端地址 */
const DEFAULT_RAG_BASE_URL = "http://127.0.0.1:8080";

export default function LoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  // 验证状态
  const [emailError, setEmailError] = useState<string | null>(null);
  
  // 防暴力破解状态
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutCountdown, setLockoutCountdown] = useState(0);

  // 实时验证邮箱
  const validateEmailField = useCallback((value: string) => {
    if (value.trim() === "") {
      setEmailError(null);
      return;
    }
    const result = validateEmail(value);
    setEmailError(result.valid ? null : t.invalidEmail);
  }, [t.invalidEmail]);

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

    // 验证邮箱
    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
      setError(t.invalidEmail);
      return;
    }

    // 验证密码非空
    if (!password) {
      setError(t.passwordRequired);
      return;
    }

    setLoading(true);
    try {
      const res = await ragLogin(DEFAULT_RAG_BASE_URL, email.trim().toLowerCase(), password);
      setStoredRagAuth(res.token, res.user);
      const settings = {
        provider: "rag",
        apiKey: res.token,
        baseURL: DEFAULT_RAG_BASE_URL,
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
      setError(err instanceof Error ? err.message : t.loginFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm space-y-4 sm:space-y-6">
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-semibold">{t.loginTitle}</h1>
          <p className="mt-1 text-muted-foreground text-xs sm:text-sm">{t.ragAccount}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-xs sm:text-sm font-medium">
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
              className={`h-9 sm:h-10 text-sm ${emailError ? "border-destructive" : ""}`}
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
            <label htmlFor="password" className="text-xs sm:text-sm font-medium">
              {t.password}
            </label>
            <Input
              id="password"
              type="password"
              placeholder={t.password}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-9 sm:h-10 text-sm"
              required
            />
          </div>
          {error && (
            <p className="text-destructive text-xs sm:text-sm" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="w-full h-9 sm:h-10"
            disabled={loading || isLocked}
            aria-disabled={loading || isLocked}
          >
            {isLocked
              ? t.pleaseWait.replace("{seconds}", String(lockoutCountdown))
              : loading
                ? "..."
                : t.login}
          </Button>
        </form>
        <p className="text-center text-muted-foreground text-xs sm:text-sm">
          {t.notLoggedIn}{" "}
          <Link href="/register" className="text-primary underline underline-offset-2">
            {t.register}
          </Link>
        </p>
      </div>
    </div>
  );
}