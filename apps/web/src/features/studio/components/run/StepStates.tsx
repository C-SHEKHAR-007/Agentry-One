import { Link } from "react-router-dom";
import { AlertTriangle, ArrowUpRight, Check, Eye } from "lucide-react";
import { useNow } from "../../../../hooks/useNow";
import { failureHint } from "../../../../lib/failureHints";
import { formatDuration, formatTokens } from "../../../../lib/format";
import type { Role } from "../../../../lib/studioPlan";
import { cn } from "../../../../lib/utils";
import { ROLES } from "../roles";
import { type RunStep, type StepState } from "./shared";

/** model · 2.4s · 1,284 tokens under an output. */
export function StepMeta({ step, className }: { step?: RunStep; className?: string }) {
  if (!step || step.status !== "completed") return null;
  const u = step.usage;
  const tokens = u.inputTokens + u.outputTokens;
  const parts = [u.model, u.durationMs != null ? formatDuration(u.durationMs) : null, tokens > 0 ? `${formatTokens(tokens)} tokens` : null].filter(Boolean);
  if (parts.length === 0) return null;
  return <p className={cn("truncate font-mono text-[11px] text-muted-foreground/90", className)}>{parts.join(" · ")}</p>;
}

/** What the step is doing right now, with a placeholder shaped like its
 * output (an image frame, text lines, a waveform, a video frame). */
export function Working({ role, step }: { role: Role; step?: RunStep }) {
  const now = useNow(1000);
  const since = step?.usage.startedAt ? now - new Date(step.usage.startedAt).getTime() : null;
  const shape =
    role === "image" ? (
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted/60">
        <span className="absolute inset-0 animate-sweep bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
      </div>
    ) : role === "video" ? (
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted/60">
        <span className="absolute inset-0 animate-sweep bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
      </div>
    ) : role === "voice" ? (
      <div className="flex h-14 items-center justify-center gap-1 rounded-lg bg-muted/50">
        {Array.from({ length: 28 }).map((_, i) => (
          <span key={i} className="w-1 animate-pulse rounded-full bg-primary/50" style={{ height: `${20 + ((i * 37) % 60)}%`, animationDelay: `${(i % 7) * 120}ms` }} />
        ))}
      </div>
    ) : (
      <div className="space-y-2 rounded-lg bg-muted/40 p-3">
        {[92, 78, 85, 60].map((w, i) => (
          <div key={i} className="relative h-2.5 overflow-hidden rounded bg-muted" style={{ width: `${w}%` }}>
            <span className="absolute inset-0 animate-sweep bg-gradient-to-r from-transparent via-primary/25 to-transparent" style={{ animationDelay: `${i * 150}ms` }} />
          </div>
        ))}
      </div>
    );
  return (
    <div className="space-y-2.5">
      {shape}
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="status-dot h-1.5 w-1.5 text-primary" data-live="true" />
        <span className="min-w-0 flex-1 truncate">{step?.usage.progressMessage ?? ROLES[role].working}</span>
        {since !== null && <span className="font-mono tabular">{formatDuration(since)}</span>}
      </p>
    </div>
  );
}

export function Failed({ step }: { step?: RunStep }) {
  const hint = failureHint(step?.usage.error);
  return (
    <div className="space-y-1.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs">
      <p className="flex items-center gap-1.5 font-semibold text-destructive">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {hint.title}
      </p>
      <p className="text-muted-foreground">{hint.advice}</p>
      {step?.usage.error && <p className="line-clamp-3 font-mono text-[11px] text-destructive/90" title={step.usage.error}>{step.usage.error}</p>}
      <div className="flex flex-wrap gap-3 pt-0.5">
        {hint.action && (
          <Link to={hint.action.to} className="font-medium text-foreground underline-offset-2 hover:underline">
            {hint.action.label}
          </Link>
        )}
        {step?.workflowId && (
          <Link to={`/workflows/${step.workflowId}`} className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-2 hover:underline">
            See what happened <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

export function Placeholder({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-[88px] items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 px-4 text-center text-xs text-muted-foreground">
      <span>
        {text} {children}
      </span>
    </div>
  );
}

/** Any non-finished state of a step, or null when it has output to show. */
export function StepStatusBody({ role, step, state, runId }: { role: Role; step?: RunStep; state: StepState; runId: string }) {
  if (state === "waiting") return <Placeholder text="Waiting for the previous step…" />;
  if (state === "running") return <Working role={role} step={step} />;
  if (state === "skipped") return <Placeholder text="Didn't run — the pipeline stopped before this step." />;
  if (state === "failed") return <Failed step={step} />;
  if (state === "review")
    return (
      <Placeholder text="Waiting for your approval.">
        <Link to={`/template-runs/${runId}`} className="text-primary hover:underline">
          Review
        </Link>
      </Placeholder>
    );
  return null;
}

export function StateIcon({ state }: { state: StepState }) {
  if (state === "done") return <Check className="h-3.5 w-3.5 text-success" />;
  if (state === "running") return <span className="status-dot h-2 w-2 text-primary" data-live="true" />;
  if (state === "failed") return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
  if (state === "review") return <Eye className="h-3.5 w-3.5 text-warning" />;
  return <span className="h-2 w-2 rounded-full border border-muted-foreground/50" />;
}
