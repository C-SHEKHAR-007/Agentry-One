import { useEffect } from "react";
import type { InputMappingValue } from "../../api/types";
import type { TemplateDraft } from "../../hooks/useTemplateDraft";
import { Input } from "../ui/input";
import { Select } from "../ui/select";

/** Per-step field-mapping editor shared by the form view and the canvas's
 * side panel. Fields come from the selected agent's real manifest inputSchema
 * (the "generic UI" promise -- new agents need zero editor changes). */
export function StepMappingPanel({ draft, index }: { draft: TemplateDraft; index: number }) {
  const step = draft.steps[index];
  const agent = step ? draft.manifestsById.get(step.agentId) : undefined;

  const manifestStep =
    agent?.manifest.steps.find((s) => s.key === step?.agentStepKey) ?? agent?.manifest.steps[0];
  const fields = Object.keys(manifestStep?.inputSchema.properties ?? {});

  // If the draft's step key doesn't exist on this agent (agent switched),
  // snap to the agent's first real step.
  useEffect(() => {
    if (agent && manifestStep && step && step.agentStepKey !== manifestStep.key) {
      draft.updateStep(index, { agentStepKey: manifestStep.key, inputMapping: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.id, manifestStep?.key]);

  if (!step || !agent) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <span className="w-28 shrink-0 text-muted-foreground">agent step</span>
        <Select
          value={step.agentStepKey}
          onChange={(e) => draft.updateStep(index, { agentStepKey: e.target.value, inputMapping: {} })}
          className="h-8 w-auto min-w-36"
        >
          {agent.manifest.steps.map((s) => (
            <option key={s.key} value={s.key}>
              {s.key}
            </option>
          ))}
        </Select>
      </div>
      {fields.map((field) => {
        const current = step.inputMapping[field];
        return (
          <div key={field} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-28 shrink-0 truncate text-muted-foreground">{field}</span>
            <Select
              value={current?.kind ?? "literal"}
              onChange={(e) => {
                const kind = e.target.value as InputMappingValue["kind"];
                if (kind === "literal") draft.updateMapping(index, field, { kind, value: "" });
                else if (kind === "fromRunInput") draft.updateMapping(index, field, { kind, field });
                else draft.updateMapping(index, field, { kind, stepOrder: 0, artifactKind: "image" });
              }}
              className="h-8 w-auto min-w-40"
            >
              <option value="literal">literal</option>
              <option value="fromRunInput">from run input</option>
              <option value="fromStep">from earlier step</option>
            </Select>
            {current?.kind === "literal" && (
              <Input
                value={String(current.value ?? "")}
                onChange={(e) => draft.updateMapping(index, field, { kind: "literal", value: e.target.value })}
                className="h-8 min-w-40 flex-1"
              />
            )}
            {current?.kind === "fromRunInput" && (
              <Input
                value={current.field}
                onChange={(e) => draft.updateMapping(index, field, { kind: "fromRunInput", field: e.target.value })}
                placeholder="run input field name"
                className="h-8 min-w-40 flex-1"
              />
            )}
            {current?.kind === "fromStep" && (
              <>
                <Input
                  type="number"
                  value={current.stepOrder}
                  onChange={(e) =>
                    draft.updateMapping(index, field, { ...current, stepOrder: Number(e.target.value) })
                  }
                  className="h-8 w-20"
                />
                <Input
                  value={current.artifactKind}
                  onChange={(e) =>
                    draft.updateMapping(index, field, { ...current, artifactKind: e.target.value })
                  }
                  placeholder="artifact kind"
                  className="h-8 min-w-40 flex-1"
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
