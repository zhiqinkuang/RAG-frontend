"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { ragRegister, setStoredRagAuth, ragLogin } from "@/lib/rag-auth";
import { getProvider } from "@/lib/providers";
import {
  validateEmail,
  validatePassword,
  validateUsername,
  type PasswordStrength,
} from "@/lib/validation";

const STORAGE_KEY = "chat-settings";

/** 默认 RAG 后端地址（优先使用环境变量） */
const DEFAULT_RAG_BASE_URL = process.env.NEXT_PUBLIC_RAG_API_URL || "http://127.0.0.1:8080";

/** 密码强度指示器组件 */
function PasswordStrengthIndicator({ strength, t }: { strength: PasswordStrength; t: Record<string, string> }) {
  if (strength.score === 0 && !strength.valid) return null;

  const getStrengthLabel = (score: number): string => {
    if (score <= 1) return t.lang === "en" ? "Weak" : "弱";
    if (score <= 2) return t.lang === "en" ? "Fair" : "一般";
    if (score <= 3) return t.lang === "en" ? "Good" : "良好";
    return t.lang === "en" ? "Strong" : "强";
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
    </div>
  );
}

export default function RegisterPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // 验证状态
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
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
    const result = validateUsername(value);
    setUsernameError(result.valid ? null : t.invalidUsername);
  }, [t.invalidUsername]);

  // 实时验证邮箱
  const validateEmailField = useCallback((value: string) => {
    if (value.trim() === "") {
      setEmailError(null);
      return;
    }
    const result = validateEmail(value);
    setEmailError(result.valid ? null : t.invalidEmail);
  }, [t.invalidEmail]);

  // 实时验证密码强度
  const validatePasswordField = useCallback((value: string) => {
    const strength = validatePassword(value);
    setPasswordStrength(strength);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // 验证用户名
    const usernameResult = validateUsername(username);
    if (!usernameResult.valid) {
      setError(t.invalidUsername);
      return;
    }

    // 验证邮箱
    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
      setError(t.invalidEmail);
      return;
    }

    // 验证密码强度
    const passwordResult = validatePassword(password);
    if (!passwordResult.valid) {
      setError(t.invalidPassword);
      return;
    }

    setLoading(true);
    try {
      await ragRegister(DEFAULT_RAG_BASE_URL, username.trim(), email.trim().toLowerCase(), password);
      const res = await ragLogin(DEFAULT_RAG_BASE_URL, email.trim().toLowerCase(), password);
      setStoredRagAuth(res.token, res.user);
      const settings = {
        provider: "rag",
        apiKey: res.token,
        baseURL: DEFAULT_RAG_BASE_URL,
        model: getProvider("rag").defaultModel,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : (lang === "zh" ? "注册失败" : "Register failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm space-y-4 sm:space-y-6">
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-semibold">{t.registerTitle}</h1>
          <p className="mt-1 text-muted-foreground text-xs sm:text-sm">{t.ragAccount}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div className="space-y-2">
            <label htmlFor="username" className="text-xs sm:text-sm font-medium">
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
              className={`h-9 sm:h-10 text-sm ${usernameError ? "border-destructive" : ""}`}
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
                {lang === "zh" ? "3-20 位字母、数字或下划线" : "3-20 characters, letters, numbers, and underscores only"}
              </p>
            )}
          </div>
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
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder={t.password}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  validatePasswordField(e.target.value);
                }}
                className={`h-9 sm:h-10 text-sm pr-10 ${passwordStrength.errors.length > 0 && password ? "border-destructive" : ""}`}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "隐藏密码" : "显示密码"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {password && <PasswordStrengthIndicator strength={passwordStrength} t={{ lang }} />}
          </div>
          {error && (
            <p className="text-destructive text-xs sm:text-sm" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="w-full h-9 sm:h-10"
            disabled={loading || !passwordStrength.valid}
            aria-disabled={loading || !passwordStrength.valid}
          >
            {loading ? "..." : t.register}
          </Button>
        </form>
        <p className="text-center text-muted-foreground text-xs sm:text-sm">
          {lang === "zh" ? "已有账号？" : "Already have an account?"}{" "}
          <Link href="/login" className="text-primary underline underline-offset-2">
            {t.login}
          </Link>
        </p>
      </div>
    </div>
  );
}