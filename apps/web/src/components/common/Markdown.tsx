import { Fragment, type ReactNode } from "react";

/* A small markdown renderer for agent output (captions, briefs, research):
 * headings, paragraphs, bullet and numbered lists, block quotes, code
 * blocks, rules, and inline bold / italic / code / links. It builds React
 * elements, never HTML strings, so agent text can't inject markup; links
 * are only rendered for http(s) URLs. */

type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; text: string }
  | { type: "code"; text: string }
  | { type: "rule" };

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.trimStart().startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) body.push(lines[i++]);
      i++; // closing fence (or end of text)
      blocks.push({ type: "code", text: body.join("\n") });
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: Math.min(heading[1].length, 3) as 1 | 2 | 3, text: heading[2].trim() });
      i++;
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push({ type: "rule" });
      i++;
      continue;
    }
    const bullet = /^\s*[-*+]\s+/;
    const numbered = /^\s*\d+[.)]\s+/;
    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line);
      const marker = ordered ? numbered : bullet;
      const items: string[] = [];
      while (i < lines.length && marker.test(lines[i])) items.push(lines[i++].replace(marker, ""));
      blocks.push({ type: "list", ordered, items });
      continue;
    }
    if (/^\s*>/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ""));
      blocks.push({ type: "quote", text: body.join(" ") });
      continue;
    }
    const body: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|\s*[-*+]\s|\s*\d+[.)]\s|\s*>)/.test(lines[i])) body.push(lines[i++]);
    blocks.push({ type: "paragraph", text: body.join("\n") });
  }
  return blocks;
}

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

/** Inline formatting: **bold**, *italic*, `code`, [links](https://...). */
export function renderInline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (!part) return null;
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__")))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return (
        <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      return /^https?:\/\//i.test(link[2]) ? (
        <a key={i} href={link[2]} target="_blank" rel="noreferrer noopener" className="text-primary underline underline-offset-2">
          {link[1]}
        </a>
      ) : (
        <Fragment key={i}>{link[1]}</Fragment>
      );
    }
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_")))
      return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/** Whether text uses enough markdown to be worth rendering as such. */
export function looksLikeMarkdown(text: string): boolean {
  return /^(#{1,6}\s|\s*[-*+]\s|\s*\d+[.)]\s|>\s|```)/m.test(text) || /\*\*[^*]+\*\*/.test(text);
}

export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`space-y-3 text-sm leading-relaxed text-foreground/90 ${className}`}>
      {parseMarkdown(text).map((b, i) => {
        switch (b.type) {
          case "heading": {
            const size = b.level === 1 ? "text-lg" : b.level === 2 ? "text-base" : "text-sm";
            return (
              <p key={i} role="heading" aria-level={b.level} className={`${size} font-semibold text-foreground`}>
                {renderInline(b.text)}
              </p>
            );
          }
          case "list": {
            const List = b.ordered ? "ol" : "ul";
            return (
              <List key={i} className={`space-y-1 pl-5 ${b.ordered ? "list-decimal" : "list-disc"} marker:text-muted-foreground`}>
                {b.items.map((item, j) => (
                  <li key={j}>{renderInline(item)}</li>
                ))}
              </List>
            );
          }
          case "quote":
            return (
              <blockquote key={i} className="border-l-2 border-primary/50 pl-3 text-muted-foreground">
                {renderInline(b.text)}
              </blockquote>
            );
          case "code":
            return (
              <pre key={i} className="overflow-x-auto rounded-lg border border-border bg-background/80 p-3 font-mono text-xs">
                {b.text}
              </pre>
            );
          case "rule":
            return <hr key={i} className="border-border" />;
          default:
            return (
              <p key={i} className="whitespace-pre-wrap break-words">
                {renderInline(b.text)}
              </p>
            );
        }
      })}
    </div>
  );
}

/** Markdown reduced to plain text, for one-glance snippets (cards). */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, "")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}
