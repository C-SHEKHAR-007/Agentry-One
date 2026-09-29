import { useEffect, useRef } from "react";
import { Bot, Braces, Layers } from "lucide-react";
import { timeAgo } from "../../../lib/format";
import { cn } from "../../../lib/utils";
import { Badge } from "../../../components/ui/badge";
import type { PromptGroup } from "../grouping";

export function PromptListItem({
  group,
  agentName,
  active,
  onSelect,
}: {
  group: PromptGroup;
  agentName: string;
  active: boolean;
  onSelect: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  // Keep a deep-linked or keyboard-selected prompt visible in the list.
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest" });
  }, [active]);
  return (
    <button
      ref={ref}
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={cn(
        "group w-full rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary/50 bg-primary/[0.07] shadow-[inset_3px_0_0_0_hsl(var(--primary))]"
          : "border-border/70 bg-card/60 hover:border-border hover:bg-card",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm font-semibold text-foreground">{group.key}</p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <Bot className="h-3 w-3 shrink-0" /> {agentName}
          </p>
        </div>
        <Badge variant={active ? "default" : "secondary"} className="shrink-0 tabular-nums">
          v{group.latest.version}
        </Badge>
      </div>
      <p className="mt-2.5 line-clamp-2 text-sm leading-snug text-muted-foreground">{group.latest.template}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground/80">
        <span className="flex items-center gap-1">
          <Layers className="h-3 w-3" />
          {group.versions.length} {group.versions.length === 1 ? "version" : "versions"}
        </span>
        {group.placeholders.length > 0 && (
          <span className="flex items-center gap-1">
            <Braces className="h-3 w-3" />
            {group.placeholders.length} {group.placeholders.length === 1 ? "placeholder" : "placeholders"}
          </span>
        )}
        <span className="ml-auto">Updated {timeAgo(group.latest.createdAt)}</span>
      </div>
    </button>
  );
}
