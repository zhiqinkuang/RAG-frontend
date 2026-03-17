"use client";

import { PaperSearch } from "@/components/paper-search";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function PaperSearchPage() {
  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="flex-1 overflow-hidden">
          <PaperSearch />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
