import { useState } from "react";
import { toast } from "sonner";
import { Copy as CopyIcon, RefreshCw } from "lucide-react";
import type { RunDetail } from "../../../../models";
import { useRetryWorkflowRunMutation, useWorkflowRunVariantsMutation } from "../../../runs/runs.api";
import { errorMessage } from "../../../../services/http/errors";
import { versionsOf } from "../../../../lib/stepVersions";
import { cn } from "../../../../lib/utils";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import type { RunStep } from "./shared";

/** How many versions "Variants" tops a step up to. */
const VARIANTS = 3;

export interface VersionControlsProps {
  run: RunDetail;
  step: RunStep;
  /** What it is, for messages ("caption", "visual"). */
  what: string;
  /** The step reads a prompt, so a note ("warmer colours") can steer it. */
  takesNote: boolean;
  /** The workflow shown now (the picked version, or the run's own). */
  shownWorkflowId: string | null;
  onPick: (workflowId: string) => void;
  /** A regenerate started: open that run. */
  onOpen: (runId: string) => void;
}

/**
 * v1 · v2 · v3 for one output, plus "Regenerate" (this output only, with an
 * optional note) and "Variants" (make up to three to choose from). Only on a
 * finished run: the other outputs are reused as they are.
 */
export function VersionControls({ run, step, what, takesNote, shownWorkflowId, onPick, onOpen }: VersionControlsProps) {
  const versions = versionsOf(run, step);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [retry, retryState] = useRetryWorkflowRunMutation();
  const [variants, variantsState] = useWorkflowRunVariantsMutation();
  const busy = retryState.isLoading || variantsState.isLoading;
  const canRegenerate = run.status === "completed" && step.status === "completed";
  const missing = Math.max(VARIANTS - versions.length, 0);

  const regenerate = () =>
    retry({ runId: run.id, fromStepOrder: step.templateStep.stepOrder, onlyStep: true, note: note.trim() || undefined })
      .unwrap()
      .then((next) => {
        toast.success(`Regenerating the ${what}`);
        setNoteOpen(false);
        setNote("");
        onOpen(next.id);
      })
      .catch((err) => toast.error(errorMessage(err)));

  const makeVariants = () =>
    variants({ runId: run.id, stepOrder: step.templateStep.stepOrder, count: missing })
      .unwrap()
      .then(() => toast.success(`Making ${missing} more ${what} variant${missing === 1 ? "" : "s"}; they appear here as they finish`))
      .catch((err) => toast.error(errorMessage(err)));

  if (!canRegenerate && versions.length < 2) return null;

  return (
    <div className="space-y-2 border-b border-border/60 px-4 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {versions.length > 1 && (
          <div role="group" aria-label={`${what} versions`} className="flex items-center gap-1">
            {versions.map((v) => {
              const on = v.workflowId === shownWorkflowId;
              return (
                <button
                  key={v.workflowId}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onPick(v.workflowId)}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[11px] font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    on ? "border-primary/60 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        )}
        {canRegenerate && (
          <div className="ml-auto flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-7 px-2" disabled={busy} onClick={() => (takesNote ? setNoteOpen((o) => !o) : regenerate())}>
              <RefreshCw className={cn("h-3.5 w-3.5", retryState.isLoading && "animate-spin")} /> Regenerate
            </Button>
            {missing > 0 && (
              <Button size="sm" variant="ghost" className="h-7 px-2" disabled={busy} onClick={makeVariants} title={`Make ${missing} more to choose from`}>
                <CopyIcon className="h-3.5 w-3.5" /> {VARIANTS} variants
              </Button>
            )}
          </div>
        )}
      </div>
      {noteOpen && (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            regenerate();
          }}
        >
          <Input
            autoFocus
            aria-label={`Note for the new ${what}`}
            value={note}
            maxLength={500}
            placeholder={`Optional: what to change (e.g. ${what === "visual" ? "warmer colours" : "shorter, more playful"})`}
            onChange={(e) => setNote(e.target.value)}
            className="h-8 text-xs"
          />
          <Button type="submit" size="sm" className="h-8" disabled={busy}>
            Go
          </Button>
        </form>
      )}
    </div>
  );
}
