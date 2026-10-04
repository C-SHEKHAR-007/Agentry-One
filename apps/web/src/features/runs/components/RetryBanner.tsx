import { AlertTriangle, Ban, RotateCcw } from "lucide-react";
import type { RunDetail } from "../../../models";
import { planRetry } from "../../../lib/retryPlan";
import { Button } from "../../../components/ui/button";
import { Spinner } from "../../../components/ui/spinner";

/** Shown on a failed or cancelled run: what stopped, and a retry that reuses
 * the steps that finished. */
export function RetryBanner({
  run,
  nameOf,
  pending,
  onRetry,
}: {
  run: RunDetail;
  nameOf: (step: RunDetail["steps"][number]) => string;
  pending: boolean;
  onRetry: () => void;
}) {
  const steps = [...run.steps].sort((a, b) => a.templateStep.stepOrder - b.templateStep.stepOrder);
  const failed = steps.find((s) => s.status === "failed");
  const completed = new Set(steps.filter((s) => s.status === "completed").map((s) => s.templateStep.stepOrder));
  const { rerun, reuse } = planRetry(steps.map((s) => s.templateStep), completed);
  if (rerun.size === 0) return null;
  const cancelled = run.status === "cancelled";
  const Icon = cancelled ? Ban : AlertTriangle;

  return (
    <div
      className={
        cancelled
          ? "flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          : "flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      }
    >
      <div className="flex items-start gap-2.5">
        <Icon className={cancelled ? "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" : "mt-0.5 h-4 w-4 shrink-0 text-destructive"} />
        <div className="text-sm">
          <p className="font-medium text-foreground">
            {failed
              ? `Step ${failed.templateStep.stepOrder + 1} · ${nameOf(failed)} failed.`
              : cancelled
                ? "This run was cancelled before it finished."
                : "This run stopped before it finished."}
          </p>
          <p className="text-xs text-muted-foreground">
            {reuse.size > 0
              ? `Retrying reuses ${reuse.size} finished ${reuse.size === 1 ? "step" : "steps"} and runs ${rerun.size} again (${failed ? "the failed step" : "the unfinished steps"} and everything that uses ${failed ? "its" : "their"} output).`
              : "Retrying runs every step again with the same inputs."}
          </p>
        </div>
      </div>
      <Button size="sm" className="shrink-0" onClick={onRetry} disabled={pending}>
        {pending ? <Spinner className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
        {failed ? "Retry from failed step" : "Retry"}
      </Button>
    </div>
  );
}
