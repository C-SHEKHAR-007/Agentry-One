import {
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  XCircle,
  Eye,
  type LucideIcon,
} from "lucide-react";
import type { WorkflowStep } from "../api/types";
import { cn } from "../lib/utils";

const STEP_META: Record<string, { icon: LucideIcon; color: string; spin?: boolean }> = {
  pending: { icon: Circle, color: "text-muted-foreground/50" },
  queued: { icon: Clock, color: "text-warning" },
  running: { icon: Loader2, color: "text-primary", spin: true },
  completed: { icon: CheckCircle2, color: "text-success" },
  failed: { icon: XCircle, color: "text-destructive" },
  awaiting_review: { icon: Eye, color: "text-warning" },
};

export function StepTimeline({ steps }: { steps: WorkflowStep[] }) {
  return (
    <ol className="space-y-0">
      {steps.map((step, i) => {
        const meta = STEP_META[step.status] ?? STEP_META.pending;
        const Icon = meta.icon;
        const last = i === steps.length - 1;
        return (
          <li key={step.id} className="relative flex gap-3 pb-6 last:pb-0">
            {!last && (
              <span className="absolute left-[9px] top-6 h-full w-px bg-border" aria-hidden />
            )}
            <span className={cn("relative z-10 mt-0.5 shrink-0 bg-background", meta.color)}>
              <Icon className={cn("h-5 w-5", meta.spin && "animate-spin")} />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-sm font-medium">{step.stepKey}</p>
              <p className="text-xs text-muted-foreground">
                {step.status.replace("_", " ")}
                {step.humanGate ? " · human gate" : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
