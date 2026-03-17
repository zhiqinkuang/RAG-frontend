"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut, MessagesSquare, User, BookOpen } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ThreadList } from "@/components/assistant-ui/thread-list";
import { useI18n } from "@/lib/i18n";
import {
  getStoredRagUser,
  clearStoredRagAuth,
  clearAllChatData,
} from "@/lib/rag-auth";
import { SettingsDialog } from "@/components/settings-dialog";

const _STORAGE_KEY = "chat-settings";

export function ThreadListSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { t } = useI18n();
  const router = useRouter();
  const [ragUser, setRagUser] =
    React.useState<ReturnType<typeof getStoredRagUser>>(null);
  const [mounted, setMounted] = React.useState(false);

  // 监听用户信息变化
  React.useEffect(() => {
    setMounted(true);

    const updateUser = () => {
      setRagUser(getStoredRagUser());
    };

    // 初始读取
    updateUser();

    // 监听 storage 变化（跨标签页同步）
    const handleStorageChange = () => {
      updateUser();
    };

    // 监听自定义事件（同标签页内的登录/登出）
    const handleAuthChange = () => {
      updateUser();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("rag-auth-changed", handleAuthChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("rag-auth-changed", handleAuthChange);
    };
  }, []);

  const handleLogout = () => {
    if (!confirm(t.logoutConfirm || "确定要退出登录吗？")) {
      return;
    }
    // 清除认证信息
    clearStoredRagAuth();
    // 清除所有聊天缓存数据，防止新用户看到上一个用户的聊天记录
    clearAllChatData();
    // 触发认证状态变化事件
    window.dispatchEvent(new CustomEvent("rag-auth-changed"));
    // 强制完全刷新页面，确保清除所有内存状态
    window.location.href = "/login";
  };

  if (!mounted) {
    return (
      <Sidebar {...props}>
        <SidebarHeader className="aui-sidebar-header mb-2 border-b">
          <div className="aui-sidebar-header-content flex items-center justify-between">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg">
                  <div className="aui-sidebar-header-icon-wrapper flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <MessagesSquare className="aui-sidebar-header-icon size-4" />
                  </div>
                  <div className="aui-sidebar-header-heading mr-6 flex flex-col gap-0.5 leading-none">
                    <span className="aui-sidebar-header-title font-semibold">
                      {t.chat}
                    </span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        </SidebarHeader>
        <SidebarContent className="aui-sidebar-content px-2">
          <ThreadList />
        </SidebarContent>
      </Sidebar>
    );
  }

  return (
    <Sidebar {...props}>
      <SidebarHeader className="aui-sidebar-header mb-2 border-b">
        <div className="aui-sidebar-header-content flex items-center justify-between">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg">
                <div className="aui-sidebar-header-icon-wrapper flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <MessagesSquare className="aui-sidebar-header-icon size-4" />
                </div>
                <div className="aui-sidebar-header-heading mr-6 flex flex-col gap-0.5 leading-none">
                  <span className="aui-sidebar-header-title font-semibold">
                    {t.chat}
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          {/* 论文搜索入口 */}
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => router.push("/paper-search")}
          >
            <BookOpen className="size-4" />
            <span className="text-xs">{t.paperSearch || "论文搜索"}</span>
          </Button>
        </div>
      </SidebarHeader>
      <SidebarContent className="aui-sidebar-content px-2">
        <ThreadList />
      </SidebarContent>
      <SidebarFooter className="mt-auto border-t p-2">
        {ragUser ? (
          <div className="flex items-center gap-2 rounded-lg p-2">
            <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-sidebar-accent">
              {ragUser.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ragUser.avatar}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <User className="size-4 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-sm">
                {ragUser.username}
              </div>
              <div className="truncate text-muted-foreground text-xs">
                {ragUser.email}
              </div>
            </div>
            <SettingsDialog />
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              onClick={handleLogout}
              aria-label={t.logout}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between p-2">
            <span className="text-muted-foreground text-sm">
              {t.notLoggedIn}
            </span>
            <div className="flex gap-1">
              <SettingsDialog />
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
