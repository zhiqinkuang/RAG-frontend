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
      transformers: [
        {
          pre(node) {
            // VSCode dark-plus theme background
            node.properties.style = "background: #1e1e1e !important;";
          },
        },
      ],
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
      className="[&>pre]:!m-0 [&>pre]:!bg-[#1e1e1e] [&>pre]:!pl-8 [&>pre]:!pr-6 [&>pre]:!py-5 [&_code]:!bg-transparent [&>pre]:!overflow-x-auto [&>pre]:!whitespace-pre [&_code]:!whitespace-pre"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default memo(ShikiHighlighter);
