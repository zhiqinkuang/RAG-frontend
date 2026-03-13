"use client";

import { PaperSearch } from "@/components/paper-search";

export default function PaperSearchPage() {
  return (
    <div className="h-screen flex flex-col">
      <header className="border-b px-4 py-3">
        <h1 className="text-xl font-semibold">📚 论文搜索</h1>
        <p className="text-sm text-muted-foreground">
          搜索 arXiv 论文并下载到知识库
        </p>
      </header>
      <main className="flex-1 overflow-hidden">
        <PaperSearch />
      </main>
    </div>
  );
}