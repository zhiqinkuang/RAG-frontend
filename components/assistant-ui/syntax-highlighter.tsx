"use client";

import { memo, useEffect, useState, type FC } from "react";
import type { SyntaxHighlighterProps } from "@assistant-ui/react-markdown";
import { codeToHtml, type BundledLanguage, bundledLanguages } from "shiki";

function isSupportedLang(lang: string): lang is BundledLanguage {
  return lang in bundledLanguages;
}

const ShikiHighlighter: FC<SyntaxHighlighterProps> = ({
  components: { Pre, Code },
  language,
  code,
}) => {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const lang = isSupportedLang(language) ? language : "text";

    codeToHtml(code, {
      lang,
      theme: "dark-plus",
    }).then((result) => {
      if (!cancelled) setHtml(result);
    });

    return () => {
      cancelled = true;
    };
  }, [code, language]);

  if (!html) {
    // Fallback: plain text while loading
    return (
      <Pre>
        <Code>{code}</Code>
      </Pre>
    );
  }

  return (
    <div
      className="[&>pre]:!m-0 [&>pre]:!bg-transparent [&>pre]:!p-0 [&_code]:!bg-transparent"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default memo(ShikiHighlighter);
