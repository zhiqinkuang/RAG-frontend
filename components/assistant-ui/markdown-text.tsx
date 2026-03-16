"use client";

import "@assistant-ui/react-markdown/styles/dot.css";

import {
  type CodeHeaderProps,
  MarkdownTextPrimitive,
  unstable_memoizeMarkdownComponents as memoizeMarkdownComponents,
  useIsMarkdownCodeBlock,
} from "@assistant-ui/react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { type FC, memo, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";

import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import ShikiHighlighter from "@/components/assistant-ui/syntax-highlighter";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * 移除来源标签的函数
 * 匹配 [来源[数字]] 或 [数字] 格式的引用标签
 */
function removeSourceTags(text: string): string {
  return text
    // 移除 [来源[数字]] 格式，如 [来源[5]]
    .replace(/\[来源\[(\d+)\]\]/g, "")
    // 移除纯数字的方括号标签 [数字]，如 [5]
    // 但保留其他格式如 [1,2,3] 或 [a-z] 等
    .replace(/\[(\d+)\]/g, "");
}

/**
 * 自动包裹未包裹的 LaTeX 公式
 * 识别常见 LaTeX 模式并添加 $...$ 包裹
 */
function wrapLatexFormulas(text: string): string {
  // 已经被 $ 或 $$ 包裹的内容，跳过
  // 匹配 LaTeX 命令模式
  const latexPatterns = [
    // 分数 \frac{}{}
    /\\frac\{[^}]*\}\{[^}]*\}/g,
    // 求和/积分/极限等 \sum_{}^{}, \int_{}^{}, \lim_{}
    /\\(sum|int|prod|lim|bigcup|bigcap|oint|iint|iiint)[_\^]?\{[^}]*\}/g,
    // 下标/上标 X_{...}, X^{...} (字母后跟下标/上标)
    /([A-Za-z])[_\^]\{[^}]+\}/g,
    // 希腊字母 \alpha, \beta, \gamma 等
    /\\(alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|omicron|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Alpha|Beta|Gamma|Delta|Epsilon|Zeta|Eta|Theta|Iota|Kappa|Lambda|Mu|Nu|Xi|Omicron|Pi|Rho|Sigma|Tau|Upsilon|Phi|Chi|Psi|Omega)(?![a-zA-Z])/g,
    // \text{...}
    /\\text\{[^}]+\}/g,
    // \sqrt{...}, \sqrt[n]{...}
    /\\sqrt(\[[^\]]+\])?\{[^}]+\}/g,
    // \left( \right) 等配对括号
    /\\left[(\[{]\\right[)\]}]/g,
    // \overline{}, \underline{}, \hat{}, \tilde{}, \bar{}, \vec{}
    /\\(overline|underline|hat|tilde|bar|vec|dot|ddot|breve|check|acute|grave)\{[^}]+\}/g,
    // \mathbb{}, \mathbf{}, \mathit{}, \mathrm{}, \mathcal{}, \mathscr{}, \mathfrak{}
    /\\math(bb|bf|it|rm|cal|scr|frak)\{[^}]+\}/g,
    // \begin{...}...\end{...} 环境
    /\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}/g,
    // \partial, \nabla, \infty, \pm, \mp, \times, \div, \cdot
    /\\(partial|nabla|infty|pm|mp|times|div|cdot|leq|geq|neq|approx|equiv|sim|propto|subset|supset|in|notin|cup|cap|emptyset|forall|exists|neg|land|lor|implies|iff|rightarrow|leftarrow|Rightarrow|Leftarrow|leftrightarrow|Leftrightarrow)(?![a-zA-Z])/g,
  ];

  // 合并所有模式
  const combinedPattern = new RegExp(
    latexPatterns.map(p => p.source).join('|'),
    'g'
  );

  // 找到所有未包裹的 LaTeX 片段
  let result = text;
  const matches: { start: number; end: number; text: string }[] = [];

  let match;
  while ((match = combinedPattern.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    // 检查是否已经被 $ 包裹
    const beforeStart = Math.max(0, start - 2);
    const afterEnd = Math.min(text.length, end + 2);
    const surrounding = text.slice(beforeStart, afterEnd);

    // 如果前后已经有 $，跳过
    if (surrounding.includes('$') && (
      text.slice(Math.max(0, start - 1), start) === '$' ||
      text.slice(end, Math.min(text.length, end + 1)) === '$'
    )) {
      continue;
    }

    matches.push({ start, end, text: match[0] });
  }

  // 从后往前替换，避免索引偏移
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    result = result.slice(0, m.start) + '$' + m.text + '$' + result.slice(m.end);
  }

  return result;
}

/**
 * 预处理文本：移除来源标签 + 自动包裹 LaTeX 公式
 */
function preprocessText(text: string): string {
  let result = removeSourceTags(text);
  result = wrapLatexFormulas(result);
  return result;
}

const MarkdownTextImpl = () => {
  return (
    <MarkdownTextPrimitive
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      className="aui-md"
      components={defaultComponents}
      preprocess={preprocessText}
    />
  );
};

export const MarkdownText = memo(MarkdownTextImpl);

const CodeHeader: FC<CodeHeaderProps> = ({ language, code }) => {
  const { t } = useI18n();
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  const onCopy = () => {
    if (!code || isCopied) return;
    copyToClipboard(code);
  };

  return (
    <div
      className="aui-code-header-root mt-3 flex items-center justify-between rounded-t-xl border pl-8 pr-6 py-3 text-xs"
      style={{
        background: "#1e1e1e",
        borderColor: "#3c3c3c",
        borderBottom: "none",
        borderLeftWidth: "3px",
        borderLeftColor: "#007acc",
        color: "#9d9d9d",
      }}
    >
      <span className="aui-code-header-language font-medium lowercase tracking-wide">
        {language || "plain"}
      </span>
      <TooltipIconButton tooltip={t.copyCode} onClick={onCopy}>
        {!isCopied && <CopyIcon className="size-3.5 opacity-80" />}
        {isCopied && <CheckIcon className="size-3.5 text-green-400" />}
      </TooltipIconButton>
    </div>
  );
};

const useCopyToClipboard = ({
  copiedDuration = 3000,
}: {
  copiedDuration?: number;
} = {}) => {
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const copyToClipboard = (value: string) => {
    if (!value) return;

    navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), copiedDuration);
    });
  };

  return { isCopied, copyToClipboard };
};

const defaultComponents = memoizeMarkdownComponents({
  h1: ({ className, ...props }) => (
    <h1
      className={cn(
        "aui-md-h1 mb-2 scroll-m-20 font-semibold text-base first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={cn(
        "aui-md-h2 mt-3 mb-1.5 scroll-m-20 font-semibold text-sm first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3
      className={cn(
        "aui-md-h3 mt-2.5 mb-1 scroll-m-20 font-semibold text-sm first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h4: ({ className, ...props }) => (
    <h4
      className={cn(
        "aui-md-h4 mt-2 mb-1 scroll-m-20 font-medium text-sm first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h5: ({ className, ...props }) => (
    <h5
      className={cn(
        "aui-md-h5 mt-2 mb-1 font-medium text-sm first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h6: ({ className, ...props }) => (
    <h6
      className={cn(
        "aui-md-h6 mt-2 mb-1 font-medium text-sm first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  p: ({ className, ...props }) => (
    <p
      className={cn(
        "aui-md-p my-2.5 leading-normal first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  a: ({ className, ...props }) => (
    <a
      className={cn(
        "aui-md-a text-primary underline underline-offset-2 hover:text-primary/80",
        className,
      )}
      {...props}
    />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn(
        "aui-md-blockquote my-2.5 border-muted-foreground/30 border-l-2 pl-3 text-muted-foreground italic",
        className,
      )}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul
      className={cn(
        "aui-md-ul my-2 ml-4 list-disc marker:text-muted-foreground [&>li]:mt-1",
        className,
      )}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={cn(
        "aui-md-ol my-2 ml-4 list-decimal marker:text-muted-foreground [&>li]:mt-1",
        className,
      )}
      {...props}
    />
  ),
  hr: ({ className, ...props }) => (
    <hr
      className={cn("aui-md-hr my-2 border-muted-foreground/20", className)}
      {...props}
    />
  ),
  table: ({ className, ...props }) => (
    <table
      className={cn(
        "aui-md-table my-2 w-full border-separate border-spacing-0 overflow-y-auto",
        className,
      )}
      {...props}
    />
  ),
  th: ({ className, ...props }) => (
    <th
      className={cn(
        "aui-md-th bg-muted px-2 py-1 text-left font-medium first:rounded-tl-lg last:rounded-tr-lg [[align=center]]:text-center [[align=right]]:text-right",
        className,
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td
      className={cn(
        "aui-md-td border-muted-foreground/20 border-b border-l px-2 py-1 text-left last:border-r [[align=center]]:text-center [[align=right]]:text-right",
        className,
      )}
      {...props}
    />
  ),
  tr: ({ className, ...props }) => (
    <tr
      className={cn(
        "aui-md-tr m-0 border-b p-0 first:border-t [&:last-child>td:first-child]:rounded-bl-lg [&:last-child>td:last-child]:rounded-br-lg",
        className,
      )}
      {...props}
    />
  ),
  li: ({ className, ...props }) => (
    <li className={cn("aui-md-li leading-normal", className)} {...props} />
  ),
  sup: ({ className, ...props }) => (
    <sup
      className={cn("aui-md-sup [&>a]:text-xs [&>a]:no-underline", className)}
      {...props}
    />
  ),
  pre: ({ className, ...props }) => (
    <pre
      className={cn(
        "aui-md-pre overflow-x-auto overflow-y-hidden rounded-b-xl rounded-t-none border border-t-0 pl-8 pr-6 py-5 text-[13px] leading-[1.8] font-mono selection:bg-[#264f78] whitespace-pre [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-[#2d2d2d] [&::-webkit-scrollbar-thumb]:bg-[#555] [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb:hover]:bg-[#777]",
        className,
      )}
      style={{
        background: "#1e1e1e",
        color: "#d4d4d4",
        borderColor: "#3c3c3c",
        borderLeftWidth: "3px",
        borderLeftColor: "#007acc",
        caretColor: "#d4d4d4",
      }}
      {...props}
    />
  ),
  code: function Code({ className, ...props }) {
    const isCodeBlock = useIsMarkdownCodeBlock();
    return (
      <code
        className={cn(
          !isCodeBlock &&
            "aui-md-inline-code rounded border border-border/60 bg-muted/70 px-1.5 py-0.5 font-mono text-[0.9em] text-foreground",
          isCodeBlock && "aui-md-block-code bg-transparent p-0 text-inherit",
          className,
        )}
        style={isCodeBlock ? { color: "#d4d4d4" } : undefined}
        {...props}
      />
    );
  },
  CodeHeader,
  SyntaxHighlighter: ShikiHighlighter,
});
