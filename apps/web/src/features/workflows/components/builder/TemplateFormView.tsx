import { useState } from "react";
import { AlertTriangle, ChevronDown, Plus, Trash2 } from "lucide-react";
import type { TemplateDraft } from "../../hooks/useTemplateDraft";
import { fieldIssues } from "../../../../lib/workflowGraph";
import { cn } from "../../../../lib/utils";
import { Button } from "../../../../components/ui/button";
import { StepFields } from "./StepFields";
import { KindChip, stepIcon } from "../../../../components/common/graph/stepVisuals";

/** List editor -- same draft state and step editor as the canvas view, laid
 * out as a vertical sequence with collapsible steps. */
export function TemplateFormView({ draft }: { draft: TemplateDraft }) {
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);

  return (
    <div className="mx-auto max-w-3xl pb-10">
      <ol className="relative space-y-4 before:absolute before:bottom-16 before:left-[19px] before:top-6 before:w-px before:bg-border">
        {draft.steps.map((step, index) => {
          const agent = draft.manifestsById.get(step.agentId);
          const ms = agent?.manifest.steps.find((m) => m.key === step.agentStepKey) ?? agent?.manifest.steps[0];
          const issueCount =
            Object.keys(fieldIssues(step, draft.steps, draft.producesFor, ms?.inputSchema.required ?? [])).length + (step.agentId ? 0 : 1);
          const Icon = stepIcon(step.agentId, agent);
          const isCollapsed = collapsed[index] ?? false;
          return (
            <li key={index} className="relative pl-14">
              <span
                className={cn(
                  "absolute left-0 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 bg-background text-sm font-semibold",
                  issueCount ? "border-destructive/60 text-destructive" : "border-primary/50 text-primary",
                )}
              >
                {index + 1}
              </span>
              <div className={cn("rounded-xl border bg-card", issueCount ? "border-destructive/40" : "border-border")}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setCollapsed((c) => ({ ...c, [index]: !isCollapsed }))}
                    aria-expanded={!isCollapsed}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Step {index + 1}</span>
                      <span className={cn("block truncate font-semibold", !step.agentId && "text-muted-foreground")}>
                        {agent?.name ?? (step.agentId || "Choose an agent")}
                      </span>
                    </span>
                    <span className="hidden items-center gap-1 sm:flex">
                      {draft.producesFor(step).map((k) => (
                        <KindChip key={k} kind={k} />
                      ))}
                    </span>
                    {issueCount > 0 && (
                      <span className="flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                        <AlertTriangle className="h-3 w-3" /> {issueCount}
                      </span>
                    )}
                    <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isCollapsed && "-rotate-90")} />
                  </button>
                  {confirmRemove === index ? (
                    <span className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          draft.removeStep(index);
                          setConfirmRemove(null);
                        }}
                      >
                        Remove
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(null)}>
                        Keep
                      </Button>
                    </span>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove step ${index + 1}`}
                      disabled={draft.steps.length === 1}
                      onClick={() => setConfirmRemove(index)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
                {!isCollapsed && (
                  <div className="border-t border-border/70 px-4 py-5">
                    <StepFields draft={draft} index={index} />
                  </div>
                )}
              </div>
            </li>
          );
        })}
        <li className="relative pl-14">
          <span className="absolute left-0 top-0 z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-border bg-background text-muted-foreground">
            <Plus className="h-4 w-4" />
          </span>
          <Button variant="secondary" onClick={() => draft.addStep()}>
            <Plus className="h-4 w-4" /> Add step
          </Button>
        </li>
      </ol>
    </div>
  );
}
