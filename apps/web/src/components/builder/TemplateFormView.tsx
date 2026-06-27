import { Plus, Trash2 } from "lucide-react";
import type { TemplateDraft } from "../../hooks/useTemplateDraft";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Select } from "../ui/select";
import { StepMappingPanel } from "./StepMappingPanel";

/** The classic list/form editor -- same draft state as the canvas view. */
export function TemplateFormView({ draft }: { draft: TemplateDraft }) {
  return (
    <div className="grid gap-4">
      {draft.steps.map((step, index) => (
        <Card key={index} glass className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {step.stepOrder + 1}
              </span>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Step {step.stepOrder}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Remove step ${step.stepOrder}`}
              disabled={draft.steps.length === 1}
              onClick={() => draft.removeStep(index)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <Select
            value={step.agentId}
            onChange={(e) => draft.updateStep(index, { agentId: e.target.value })}
            className="mb-3"
          >
            <option value="">Select agent...</option>
            {draft.agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>

          {step.agentId && <StepMappingPanel draft={draft} index={index} />}
        </Card>
      ))}

      <div>
        <Button variant="secondary" onClick={draft.addStep}>
          <Plus className="h-4 w-4" /> Add step
        </Button>
      </div>
    </div>
  );
}
