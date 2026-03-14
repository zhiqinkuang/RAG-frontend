"use client";

import { useEffect } from "react";

/**
 * 安全的主题初始化组件
 * 使用 useEffect 在客户端设置主题，避免 dangerouslySetInnerHTML 导致的 XSS 风险
 */
export function ThemeInit() {
  useEffect(() => {
    try {
      const stored = localStorage.getItem("app-theme");
      const isDark =
        stored === "dark" ||
        (stored !== "light" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      
      document.documentElement.classList.toggle("dark", isDark);
    } catch {
      // 忽略 localStorage 访问错误（如隐私模式）
    }
  }, []);

  return null;
}