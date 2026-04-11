"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  getStoredRagToken,
  getStoredTokenExpire,
  isTokenExpired,
  clearStoredRagAuth,
  clearAllChatData,
} from "@/lib/rag-auth";
import {
  AUTH_CHANGE_EVENT,
  TOKEN_EXPIRED_EVENT,
  setupFetchInterceptor,
} from "@/lib/api-interceptor";

const PUBLIC_PATHS = ["/login", "/register"];

function requireRagLogin(): boolean {
  return process.env.NEXT_PUBLIC_REQUIRE_RAG_LOGIN === "true";
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const interceptorSetup = useRef(false);

  const isPublic =
    pathname != null &&
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // 启用全局 fetch 拦截器（处理 401 自动跳转）
  useEffect(() => {
    if (!interceptorSetup.current) {
      setupFetchInterceptor();
      interceptorSetup.current = true;
    }
  }, []);

  const redirectToLogin = useCallback(
    (clear: boolean = false) => {
      if (typeof window === "undefined") return;
      if (clear) {
        clearStoredRagAuth();
        clearAllChatData();
      }
      const currentPath = pathname || "/";
      const loginUrl =
        currentPath !== "/"
          ? `/login?redirect=${encodeURIComponent(currentPath)}`
          : "/login";
      router.replace(loginUrl);
      setAllowed(false);
      setChecking(false);
    },
    [pathname, router],
  );

  // 检查登录状态
  useEffect(() => {
    if (isPublic) {
      setAllowed(true);
      setChecking(false);
      return;
    }

    if (!requireRagLogin()) {
      setAllowed(true);
      setChecking(false);
      return;
    }

    const token = getStoredRagToken();
    if (!token) {
      redirectToLogin();
      return;
    }

    const expire = getStoredTokenExpire();
    if (isTokenExpired(expire, 0)) {
      redirectToLogin(true);
      return;
    }

    setAllowed(true);
    setChecking(false);
  }, [isPublic, redirectToLogin]);

  // 监听 token 过期事件
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleExpired = () => {
      redirectToLogin(true);
    };

    window.addEventListener(TOKEN_EXPIRED_EVENT, handleExpired);

    return () => {
      window.removeEventListener(TOKEN_EXPIRED_EVENT, handleExpired);
    };
  }, [redirectToLogin]);

  // 监听认证状态变化，重新检查登录状态
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleAuthChange = () => {
      // 重新检查登录状态，而不是清除认证
      const token = getStoredRagToken();
      if (token) {
        setAllowed(true);
        setChecking(false);
      }
    };

    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);

    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    };
  }, []);

  // 公开路径直接渲染
  if (isPublic) return <>{children}</>;

  // 检查中或未授权时显示加载状态
  if (checking || !allowed) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">...</div>
      </div>
    );
  }

  return <>{children}</>;
}
