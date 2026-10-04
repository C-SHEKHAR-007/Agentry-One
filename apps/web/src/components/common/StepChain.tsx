import { Fragment } from "react";
import { ChevronRight } from "lucide-react";
import type { RunSummaryStep } from "../../models";
import { cn } from "../../lib/utils";
import { statusStyle, TONE } from "../../lib/status";
import { StatusDot } from "./StatusBadge";

/** Groups steps into columns by dependency depth, so parallel branches sit
 * in the same column (Research → [Visual | Polish] → Publish). */
export function chainColumns(steps: RunSummaryStep[]): RunSummaryStep[][] {
  const byOrder = new Map(steps.map((s) => [s.stepOrder, s]));
  const depth = new Map<number, number>();
  const depthOf = (order: number, seen = new Set<number>()): number => {
    const known = depth.get(order);
    if (known !== undefined) return known;
    if (seen.has(order)) return 0;
    seen.add(order);
    const deps = (byOrder.get(order)?.dependsOn ?? []).filter((d) => byOrder.has(d) && d !== order);
    const d = deps.length ? 1 + Math.max(...deps.map((x) => depthOf(x, seen))) : 0;
    depth.set(order, d);
    return d;
  };
  const cols: RunSummaryStep[][] = [];
  for (const s of [...steps].sort((a, b) => a.stepOrder - b.stepOrder)) {
    const d = depthOf(s.stepOrder);
    (cols[d] ??= []).push(s);
  }
  return cols.filter(Boolean);
}

function StepChip({ step }: { step: RunSummaryStep }) {
  const st = statusStyle(step.status);
  const tone = TONE[st.tone];
  const Icon = st.icon;
  return (
    <span
      title={`${step.agentName} · ${st.label}`}
      className={cn(
        "inline-flex max-w-[11rem] items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
        step.status === "running" ? "border-primary/50 bg-primary/10 text-foreground" : "border-border/70 bg-card/60",
        step.status === "pending" && "text-muted-foreground",
      )}
    >
      {st.live ? <StatusDot status={step.status} className="h-1.5 w-1.5" /> : <Icon className={cn("h-3 w-3 shrink-0", tone.text)} />}
      <span className="truncate">{step.agentName}</span>
    </span>
  );
}

/** A run's steps as a compact left-to-right chain with live status. */
export function StepChain({ steps, className, wrap = true }: { steps: RunSummaryStep[]; className?: string; wrap?: boolean }) {
  const cols = chainColumns(steps);
  return (
    <div className={cn("flex items-center gap-1.5", wrap ? "flex-wrap" : "flex-nowrap", className)}>
      {cols.map((col, i) => (
        <Fragment key={i}>
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
          <div className="flex flex-col gap-1">
            {col.map((s) => (
              <StepChip key={s.id} step={s} />
            ))}
          </div>
        </Fragment>
      ))}
    </div>
  );
}
