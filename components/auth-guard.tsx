"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getStoredRagToken } from "@/lib/rag-auth";

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
      router.replace("/login");
      setAllowed(false);
    } else {
      setAllowed(true);
    }
    setChecking(false);
  }, [pathname, router, isPublic, isProtected]);

  if (isPublic) return <>{children}</>;
  
  if (checking || !allowed) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">...</div>
      </div>
    );
  }
  
  return <>{children}</>;
}