"use client";

import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export function LangSwitcher() {
  const { lang, setLang } = useI18n();

  const toggle = () => setLang(lang === "zh" ? "en" : "zh");

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="min-h-8 px-2 font-medium text-muted-foreground text-xs hover:text-foreground"
      onClick={toggle}
      aria-label={lang === "zh" ? "Switch to English" : "切换到中文"}
    >
      {lang === "zh" ? "EN" : "中"}
    </Button>
  );
}
