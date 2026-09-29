import { Fragment } from "react";
import { Check, Lock } from "lucide-react";
import type { Role } from "../../../lib/studioPlan";
import { statusStyle, TONE } from "../../../lib/status";
import { cn } from "../../../lib/utils";
import { ROLES } from "./roles";

export interface StripStep {
  role: Role;
  /** Run status of the step; omit for a preview (nothing has run yet). */
  status?: string;
  /** Preview only: pulled in because another output needs it. */
  auto?: boolean;
}

/**
 * The agents a creation runs, as a left-to-right flow of nodes. As a preview
 * it shows what *will* run (picked vs. auto-included); during a run each node
 * takes its live status and the link into the running step animates.
 */
export function PipelineStrip({ steps, size = "md", className }: { steps: StripStep[]; size?: "md" | "lg"; className?: string }) {
  const big = size === "lg";
  return (
    <ol className={cn("flex items-start", className)} aria-label="Pipeline">
      {steps.map((s, i) => {
        const meta = ROLES[s.role];
        const Icon = meta.icon;
        const st = s.status ? statusStyle(s.status) : null;
        const tone = st ? TONE[st.tone] : null;
        const running = s.status === "running";
        const done = s.status === "completed";
        const prevDone = i > 0 && steps[i - 1].status === "completed";
        return (
          <Fragment key={s.role}>
            {i > 0 && (
              <li aria-hidden="true" className={cn("relative mx-1 flex-1 overflow-hidden rounded-full", big ? "mt-6 h-0.5 min-w-6" : "mt-4 h-px min-w-3")}>
                <span className={cn("absolute inset-0", prevDone ? "bg-success/60" : "bg-border")} />
                {prevDone && running && (
                  <span className="absolute inset-y-0 w-1/2 animate-sweep bg-gradient-to-r from-transparent via-primary to-transparent" />
                )}
                {!s.status && <span className="absolute inset-0 bg-gradient-to-r from-primary/40 to-primary/10" />}
              </li>
            )}
            <li className={cn("flex shrink-0 flex-col items-center text-center", big ? "w-[4.75rem]" : "w-14")}>
              <span
                className={cn(
                  "relative flex items-center justify-center rounded-xl border transition-all",
                  big ? "h-12 w-12" : "h-8 w-8",
                  !st && (s.auto ? "border-dashed border-border bg-card text-muted-foreground" : "border-primary/50 bg-primary/10 text-primary shadow-[0_0_20px_hsl(var(--primary)/0.25)]"),
                  st && tone && (done ? "border-success/50 bg-success/10 text-success" : s.status === "pending" ? "border-dashed border-border bg-card text-muted-foreground" : cn(tone.border, tone.bg, tone.text)),
                  running && "animate-status-glow",
                )}
              >
                <Icon className={big ? "h-5 w-5" : "h-3.5 w-3.5"} />
                {(done || s.auto) && (
                  <span
                    className={cn(
                      "absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-card",
                      done ? "bg-success text-white" : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="h-2.5 w-2.5" /> : <Lock className="h-2 w-2" />}
                  </span>
                )}
              </span>
              <span className={cn("mt-1.5 text-[11px] leading-tight", st?.tone === "destructive" ? "text-destructive" : done || !st ? "text-foreground/90" : "text-muted-foreground")}>
                {meta.short}
              </span>
              {st && !done && s.status !== "pending" && <span className={cn("text-[11px] leading-tight", tone?.text)}>{st.label}</span>}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
