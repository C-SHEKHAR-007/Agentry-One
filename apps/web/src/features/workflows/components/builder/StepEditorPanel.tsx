import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";
import type { TemplateDraft } from "../../hooks/useTemplateDraft";
import { Button } from "../../../../components/ui/button";
import { StepFields } from "./StepFields";
import { stepIcon } from "../../../../components/common/graph/stepVisuals";

/** Right-hand sidebar that edits one step at a time, with previous/next to
 * walk through the workflow without going back to the canvas. */
export function StepEditorPanel({
  draft,
  index,
  onSelect,
  onClose,
}: {
  draft: TemplateDraft;
  index: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const step = draft.steps[index];
  const agent = step ? draft.manifestsById.get(step.agentId) : undefined;
  const Icon = stepIcon(step?.agentId ?? "", agent);
  const total = draft.steps.length;

  useEffect(() => setConfirmDelete(false), [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < total - 1) onSelect(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onSelect(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, total, onClose, onSelect]);

  if (!step) return null;

  return (
    <aside
      aria-label={`Edit step ${index + 1}`}
      className="absolute inset-y-0 right-0 z-20 flex w-full max-w-[380px] flex-col border-l border-border bg-popover shadow-2xl animate-slide-in-right"
    >
      <header className="flex items-center gap-2.5 border-b border-border px-4 py-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Step {index + 1} of {total}
          </p>
          <h3 className="truncate text-sm font-semibold">{agent?.name ?? (step.agentId || "New step")}</h3>
        </div>
        <div className="flex items-center gap-0.5">
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Previous step" disabled={index === 0} onClick={() => onSelect(index - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Next step" disabled={index === total - 1} onClick={() => onSelect(index + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Close step editor" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <StepFields draft={draft} index={index} compact />
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5">
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Remove this step?</span>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                draft.removeStep(index);
                onClose();
              }}
            >
              Remove
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
              Keep
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={total === 1}
            title={total === 1 ? "A workflow needs at least one step" : undefined}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-4 w-4" /> Remove step
          </Button>
        )}
        {!confirmDelete && (
          <Button size="sm" onClick={index < total - 1 ? () => onSelect(index + 1) : onClose}>
            {index < total - 1 ? (
              <>
                Next step <ChevronRight className="h-4 w-4" />
              </>
            ) : (
              "Done"
            )}
          </Button>
        )}
      </footer>
    </aside>
  );
}
