import { useMemo } from "react";
import { JsonView } from "./JsonView";
import { looksLikeMarkdown, Markdown } from "./Markdown";

/** An agent's text output, shown the way it was written: JSON as a tree,
 * markdown rendered, anything else as plain text. */
export function TextBody({ text, mimeType = "" }: { text: string; mimeType?: string }) {
  const json = useMemo(() => {
    const t = text.trim();
    if (!(mimeType.includes("json") || t.startsWith("{") || t.startsWith("["))) return undefined;
    try {
      return JSON.parse(t) as unknown;
    } catch {
      return undefined;
    }
  }, [text, mimeType]);

  if (json !== undefined) return <JsonView value={json} />;
  if (mimeType.includes("markdown") || looksLikeMarkdown(text)) return <Markdown text={text} />;
  return <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">{text}</p>;
}
