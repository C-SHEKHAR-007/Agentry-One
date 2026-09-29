import { Link } from "react-router-dom";
import { Activity, AlertTriangle, Ban, CheckCircle2, CircleDot, Eye, Play, type LucideIcon } from "lucide-react";
import type { EventItem } from "../models";
import { formatClock, formatDuration, formatTokens, timeAgo } from "../lib/format";
import { cn } from "../lib/utils";
import { TONE, type StatusStyle } from "../lib/status";
import { EmptyState } from "./ui/empty-state";

interface EventMeta {
  icon: LucideIcon;
  tone: StatusStyle["tone"];
  label: string;
}

const EVENT_META: Record<string, EventMeta> = {
  "workflow.started": { icon: CircleDot, tone: "muted", label: "Run queued" },
  "job.started": { icon: Play, tone: "primary", label: "Agent started" },
  "job.completed": { icon: CheckCircle2, tone: "success", label: "Agent completed" },
  "job.failed": { icon: AlertTriangle, tone: "destructive", label: "Attempt failed" },
  "workflow.completed": { icon: CheckCircle2, tone: "success", label: "Run completed" },
  "workflow.failed": { icon: AlertTriangle, tone: "destructive", label: "Run failed" },
  "workflow.awaiting_review": { icon: Eye, tone: "warning", label: "Waiting for review" },
  "workflow.cancelled": { icon: Ban, tone: "muted", label: "Run cancelled" },
};

/** The detail line under an event: what it cost, how long, or why it failed. */
function detail(e: EventItem): string | null {
  const p = e.payload;
  if (!p) return null;
  if (e.type === "job.failed") return p.failedReason ?? null;
  if (e.type === "job.completed") {
    const tokens = (p.inputTokens ?? 0) + (p.outputTokens ?? 0);
    return [tokens > 0 ? `${formatTokens(tokens)} tokens` : null, p.durationMs != null ? formatDuration(p.durationMs) : null, p.model ?? null]
      .filter(Boolean)
      .join(" · ");
  }
  if (e.type === "job.started") {
    return [p.attemptNumber && p.attemptNumber > 1 ? `attempt ${p.attemptNumber}` : null, p.model ?? null].filter(Boolean).join(" · ") || null;
  }
  return null;
}

/** Observability-style event stream: time, what happened, which agent, and
 * the numbers that matter (tokens, duration, model, failure reason). */
export function ActivityFeed({ events }: { events: EventItem[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No activity yet"
        description="Run an agent and every step it takes will stream in here."
        className="py-6"
      />
    );
  }

  return (
    <ol className="relative">
      {/* timeline spine */}
      <span className="absolute bottom-3 left-[5.1rem] top-3 w-px bg-border/70" aria-hidden="true" />
      {events.map((e, i) => {
        const meta = EVENT_META[e.type] ?? { icon: CircleDot, tone: "muted" as const, label: e.type };
        const tone = TONE[meta.tone];
        const Icon = meta.icon;
        const line = detail(e);
        const body = (
          <>
            <time
              dateTime={e.createdAt}
              title={timeAgo(e.createdAt)}
              className="w-[4.1rem] shrink-0 pt-0.5 text-right font-mono text-[11px] tabular text-muted-foreground"
            >
              {formatClock(e.createdAt)}
            </time>
            <span
              className={cn(
                "relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-4 ring-card",
                tone.bg,
                tone.text,
                i === 0 && meta.tone === "primary" && "animate-status-glow",
              )}
            >
              <Icon className="h-3 w-3" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-foreground">{meta.label}</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {e.agentName ?? e.agentId ?? "—"}
                {e.projectName ? ` · ${e.projectName}` : ""}
              </span>
              {line && (
                <span
                  className={cn(
                    "mt-0.5 block truncate font-mono text-[11px]",
                    e.type === "job.failed" ? "text-destructive/90" : "text-muted-foreground/90",
                  )}
                  title={line}
                >
                  {line}
                </span>
              )}
            </span>
          </>
        );
        return (
          <li key={e.id} className="animate-fade-in">
            {e.workflowId ? (
              <Link to={`/workflows/${e.workflowId}`} className="flex gap-3 rounded-md px-1 py-2 transition-colors hover:bg-muted/50">
                {body}
              </Link>
            ) : (
              <div className="flex gap-3 px-1 py-2">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
