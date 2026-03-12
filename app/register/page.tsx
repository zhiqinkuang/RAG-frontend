"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { ragRegister, setStoredRagAuth, ragLogin } from "@/lib/rag-auth";
import { getProvider } from "@/lib/providers";
import {
  validateEmail,
  validatePassword,
  validateUsername,
  validateURL,
  type ValidationResult,
  type PasswordStrength,
} from "@/lib/validation";

const STORAGE_KEY = "chat-settings";

/** 密码强度指示器组件 */
function PasswordStrengthIndicator({ strength }: { strength: PasswordStrength }) {
  if (strength.score === 0 && !strength.valid) return null;

  const getStrengthLabel = (score: number): string => {
    if (score <= 1) return "Weak";
    if (score <= 2) return "Fair";
    if (score <= 3) return "Good";
    return "Strong";
  };

  const getStrengthColor = (score: number): string => {
    if (score <= 1) return "bg-red-500";
    if (score <= 2) return "bg-yellow-500";
    if (score <= 3) return "bg-blue-500";
    return "bg-green-500";
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${getStrengthColor(strength.score)}`}
            style={{ width: `${(strength.score / 4) * 100}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {getStrengthLabel(strength.score)}
        </span>
      </div>
      {strength.errors.length > 0 && (
        <ul className="text-xs text-destructive space-y-0.5">
          {strength.errors.map((error, i) => (
            <li key={i}>• {error}</li>
          ))}
        </ul>
      )}
      {strength.warnings.length > 0 && (
        <ul className="text-xs text-yellow-600 space-y-0.5">
          {strength.warnings.map((warning, i) => (
            <li key={i}>• {warning}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

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

  // 验证状态
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [baseURLError, setBaseURLError] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>({
    valid: false,
    score: 0,
    errors: [],
    warnings: [],
  });

  // 实时验证用户名
  const validateUsernameField = useCallback((value: string) => {
    if (value.trim() === "") {
      setUsernameError(null);
      return;
    }
    const result: ValidationResult = validateUsername(value);
    setUsernameError(result.valid ? null : result.error || null);
  }, []);

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

  // 实时验证密码强度
  const validatePasswordField = useCallback((value: string) => {
    const strength = validatePassword(value);
    setPasswordStrength(strength);
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

    // 验证用户名
    const usernameResult = validateUsername(username);
    if (!usernameResult.valid) {
      setError(usernameResult.error || "Invalid username");
      return;
    }

    // 验证邮箱
    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
      setError(emailResult.error || "Invalid email");
      return;
    }

    // 验证密码强度
    const passwordResult = validatePassword(password);
    if (!passwordResult.valid) {
      setError(passwordResult.errors[0] || "Invalid password");
      return;
    }

    setLoading(true);
    try {
      await ragRegister(baseURL.trim(), username.trim(), email.trim().toLowerCase(), password);
      const res = await ragLogin(baseURL.trim(), email.trim().toLowerCase(), password);
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
            <label htmlFor="username" className="text-sm font-medium">
              {t.username}
            </label>
            <Input
              id="username"
              type="text"
              placeholder={t.username}
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                validateUsernameField(e.target.value);
              }}
              onBlur={() => validateUsernameField(username)}
              className={`h-10 ${usernameError ? "border-destructive" : ""}`}
              aria-invalid={!!usernameError}
              aria-describedby={usernameError ? "username-error" : undefined}
              required
            />
            {usernameError ? (
              <p id="username-error" className="text-destructive text-xs">
                {usernameError}
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                3-20 characters, letters, numbers, and underscores only
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
              onChange={(e) => {
                setPassword(e.target.value);
                validatePasswordField(e.target.value);
              }}
              className={`h-10 ${passwordStrength.errors.length > 0 && password ? "border-destructive" : ""}`}
              required
            />
            {password && <PasswordStrengthIndicator strength={passwordStrength} />}
          </div>
          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={loading || !passwordStrength.valid}
            aria-disabled={loading || !passwordStrength.valid}
          >
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