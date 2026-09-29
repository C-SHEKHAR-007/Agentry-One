import { useMemo } from "react";
import { diffLines, segmentTemplate } from "../../lib/promptText";
import { cn } from "../../lib/utils";

/** A prompt template rendered as written (line breaks kept), with
 * `{{placeholders}}` highlighted. */
export function TemplateView({ template, className }: { template: string; className?: string }) {
  const segments = useMemo(() => segmentTemplate(template), [template]);
  return (
    <pre
      className={cn(
        "whitespace-pre-wrap break-words rounded-lg border border-border/70 bg-muted/40 p-4 font-sans text-sm leading-relaxed text-foreground",
        className,
      )}
    >
      {segments.map((s, i) =>
        s.kind === "placeholder" ? (
          <mark key={i} className="rounded bg-primary/15 px-1 py-px font-semibold text-primary">
            {s.value}
          </mark>
        ) : (
          <span key={i}>{s.value}</span>
        ),
      )}
    </pre>
  );
}

/** Line diff between two versions of a prompt. */
export function TemplateDiff({ before, after }: { before: string; after: string }) {
  const lines = useMemo(() => diffLines(before, after), [before, after]);
  const added = lines.filter((l) => l.kind === "added").length;
  const removed = lines.filter((l) => l.kind === "removed").length;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-success">+{added}</span> added ·{" "}
        <span className="font-medium text-destructive">−{removed}</span> removed
      </p>
      <div className="overflow-hidden rounded-lg border border-border/70 text-sm leading-relaxed">
        {lines.map((l, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-3 px-3 py-0.5",
              l.kind === "added" && "bg-success/10 text-foreground",
              l.kind === "removed" && "bg-destructive/10 text-muted-foreground line-through decoration-destructive/40",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "w-3 shrink-0 select-none text-center",
                l.kind === "added" ? "text-success" : l.kind === "removed" ? "text-destructive" : "text-muted-foreground/50",
              )}
            >
              {l.kind === "added" ? "+" : l.kind === "removed" ? "−" : " "}
            </span>
            <span className="min-w-0 whitespace-pre-wrap break-words">{l.text || " "}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
