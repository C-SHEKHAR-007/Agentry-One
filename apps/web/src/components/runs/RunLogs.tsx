import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Terminal } from "lucide-react";
import { api } from "../../api/client";
import type { RunLogLine } from "../../api/types";
import { formatClock } from "../../lib/format";
import { cn } from "../../lib/utils";

const LEVEL: Record<string, string> = {
  error: "text-destructive",
  warn: "text-warning",
  info: "text-info",
  debug: "text-muted-foreground",
};

export function useRunLogs(workflowId: string | null | undefined, live: boolean) {
  return useQuery({
    queryKey: ["workflow-logs", workflowId],
    queryFn: () => api.get<RunLogLine[]>(`/workflows/${workflowId}/logs`),
    enabled: Boolean(workflowId),
    refetchInterval: live ? 1500 : false,
  });
}

/** Terminal-style log for one agent run: attempt starts, progress messages,
 * worker log lines and the completion/failure summary. Follows the tail
 * while the run is live. */
export function RunLogs({
  workflowId,
  live,
  className,
  emptyText = "No log lines yet.",
  header = true,
}: {
  workflowId: string | null | undefined;
  live: boolean;
  className?: string;
  emptyText?: string;
  header?: boolean;
}) {
  const { data: logs, isLoading } = useRunLogs(workflowId, live);
  const box = useRef<HTMLDivElement>(null);
  const count = logs?.length ?? 0;
  useEffect(() => {
    const el = box.current;
    if (el && live) el.scrollTop = el.scrollHeight;
  }, [count, live]);

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border/70 bg-background/80", className)}>
      <div className={cn("flex items-center gap-2 border-b border-border/60 px-3 py-1.5 text-[11px] text-muted-foreground", !header && "hidden")}>
        <Terminal className="h-3 w-3" />
        <span className="font-medium uppercase tracking-wider">Logs</span>
        {live && (
          <span className="ml-auto flex items-center gap-1.5 text-primary">
            <span className="status-dot h-1.5 w-1.5" data-live="true" /> streaming
          </span>
        )}
      </div>
      <div ref={box} className="max-h-64 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed scrollbar-thin">
        {!workflowId ? (
          <p className="px-1 py-2 text-muted-foreground">This step hasn't started yet.</p>
        ) : isLoading ? (
          <p className="px-1 py-2 text-muted-foreground">Loading…</p>
        ) : count === 0 ? (
          <p className="px-1 py-2 text-muted-foreground">{emptyText}</p>
        ) : (
          logs!.map((l, i) => (
            <div key={l.id} className={cn("flex gap-2 rounded px-1 py-px hover:bg-muted/40", i === count - 1 && live && "animate-fade-in")}>
              <span className="shrink-0 tabular text-muted-foreground/70">{formatClock(l.createdAt)}</span>
              <span className={cn("w-10 shrink-0 uppercase", LEVEL[l.level] ?? "text-muted-foreground")}>{l.level}</span>
              <span className="min-w-0 whitespace-pre-wrap break-words text-foreground/90">
                {l.attemptNumber > 1 && <span className="mr-1 text-muted-foreground">[#{l.attemptNumber}]</span>}
                {l.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
