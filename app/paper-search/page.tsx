"use client";

import { PaperSearch } from "@/components/paper-search";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThreadListSidebar } from "@/components/assistant-ui/threadlist-sidebar";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n";

export default function PaperSearchPage() {
  const { t } = useI18n();

  return (
    <SidebarProvider>
      <div className="flex h-dvh w-full pr-0.5">
        <ThreadListSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <h1 className="text-sm font-medium">{t.paperSearch}</h1>
          </header>
          <div className="flex-1 overflow-hidden">
            <PaperSearch />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}