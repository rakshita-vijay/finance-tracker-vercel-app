"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ensureAsciiTablesFenced } from "@/lib/markdownFix";

/**
 * Renders saved/streamed report markdown (headings, bold, tables, code
 * fences, horizontal rules, etc.) as actual formatted HTML instead of
 * dumping the raw "# Heading\n**bold**" text into a <pre>-like block.
 * Used anywhere we show `report.content`, `analysisText`, `draftReport`,
 * or `report.analysis`.
 *
 * Also runs ensureAsciiTablesFenced as a display-time safety net, in case
 * the content was saved before that fix existed (or an agent otherwise
 * slips an un-fenced ASCII table past the pipeline-level fix).
 */
export default function Markdown({ content }: { content: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{ensureAsciiTablesFenced(content)}</ReactMarkdown>
    </div>
  );
}
