"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getStoredRagToken, clearStoredRagAuth } from "@/lib/rag-auth";
import { AUTH_CHANGE_EVENT, TOKEN_EXPIRED_EVENT } from "@/lib/api-interceptor";

// 需要登录才能访问的路径
const PROTECTED_PATHS = ["/"];

// 公开路径（不需要登录）
const PUBLIC_PATHS = ["/login", "/register"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const isPublic = pathname != null && PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isProtected = pathname != null && PROTECTED_PATHS.some((p) => pathname === p);

  // 处理 token 过期：清除认证信息并跳转登录页
  const handleTokenExpired = useCallback(() => {
    if (typeof window === "undefined") return;

    // 清除认证信息
    clearStoredRagAuth();

    // 构建登录页 URL，带上重定向参数
    const currentPath = pathname || "/";
    const loginUrl = currentPath !== "/" 
      ? `/login?redirect=${encodeURIComponent(currentPath)}`
      : "/login";
    
    // 使用 router.replace 避免产生历史记录
    router.replace(loginUrl);
    setAllowed(false);
    setChecking(false);
  }, [pathname, router]);

  // 检查登录状态
  useEffect(() => {
    if (isPublic) {
      setAllowed(true);
      setChecking(false);
      return;
    }

    if (!isProtected) {
      // 非保护路径，允许访问
      setAllowed(true);
      setChecking(false);
      return;
    }

    // 检查登录状态
    const token = getStoredRagToken();
    if (!token) {
      // 未登录，跳转到登录页
      const currentPath = pathname || "/";
      const loginUrl = currentPath !== "/"
        ? `/login?redirect=${encodeURIComponent(currentPath)}`
        : "/login";
      router.replace(loginUrl);
      setAllowed(false);
    } else {
      setAllowed(true);
    }
    setChecking(false);
  }, [pathname, router, isPublic, isProtected]);

  // 监听 token 过期事件
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleExpired = () => {
      handleTokenExpired();
    };

    // 监听 token 过期事件
    window.addEventListener(TOKEN_EXPIRED_EVENT, handleExpired);
    
    // 也监听认证状态变化事件（如登出）
    window.addEventListener(AUTH_CHANGE_EVENT, handleExpired);

    return () => {
      window.removeEventListener(TOKEN_EXPIRED_EVENT, handleExpired);
      window.removeEventListener(AUTH_CHANGE_EVENT, handleExpired);
    };
  }, [handleTokenExpired]);

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