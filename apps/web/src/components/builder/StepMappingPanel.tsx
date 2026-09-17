import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client.js";
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

  const { data: socialAccounts } = useQuery({
    queryKey: ["socialAccounts", draft.targetProjectId],
    queryFn: () =>
      api.get<Array<{ id: string; platform: string; handle?: string }>>(
        `/social-accounts?projectId=${draft.targetProjectId}`,
      ),
    enabled: Boolean(draft.targetProjectId),
  });

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
        const isSocialField = field === "socialAccountId";

        return (
          <div key={field} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-28 shrink-0 truncate text-muted-foreground">{field}</span>
            <Select
              value={current?.kind ?? "literal"}
              onChange={(e) => {
                const kind = e.target.value as InputMappingValue["kind"];
                if (kind === "literal") draft.updateMapping(index, field, { kind, value: "" });
                else if (kind === "fromRunInput") draft.updateMapping(index, field, { kind, field });
                else {
                  // Find the first step earlier than this one, if any
                  const earlierStep = draft.steps.find((s) => s.stepOrder < step.stepOrder) ?? draft.steps[0];
                  const earlierOrder = earlierStep?.stepOrder ?? 0;
                  const available = earlierStep ? draft.producesFor(earlierStep) : [];
                  let defaultKind = available[0] ?? "text";
                  if ((field === "mediaUrl" || field === "imagePath") && available.includes("image")) defaultKind = "image";
                  if ((field === "mediaUrl" || field === "videoPath") && available.includes("video")) defaultKind = "video";
                  if (field === "audioPath" && available.includes("audio")) defaultKind = "audio";
                  draft.updateMapping(index, field, {
                    kind: "fromStep",
                    stepOrder: earlierOrder,
                    artifactKind: defaultKind,
                  });
                }
              }}
              className="h-8 w-auto min-w-36"
            >
              <option value="literal">literal</option>
              <option value="fromRunInput">from run input</option>
              <option value="fromStep">from earlier step</option>
            </Select>
            {current?.kind === "literal" && (
              isSocialField ? (
                <div className="flex flex-1 items-center gap-2">
                  <Select
                    value={String(current.value ?? "")}
                    onChange={(e) => draft.updateMapping(index, field, { kind: "literal", value: e.target.value })}
                    className="h-8 min-w-44 flex-1"
                  >
                    <option value="">Select connected account...</option>
                    {(socialAccounts ?? []).map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.handle || acc.id} ({acc.platform})
                      </option>
                    ))}
                  </Select>
                  {(!socialAccounts || socialAccounts.length === 0) && (
                    <a
                      href="/integrations"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary underline shrink-0 hover:text-primary/80"
                    >
                      Connect
                    </a>
                  )}
                </div>
              ) : (
                <Input
                  value={String(current.value ?? "")}
                  onChange={(e) => draft.updateMapping(index, field, { kind: "literal", value: e.target.value })}
                  className="h-8 min-w-40 flex-1"
                  placeholder={`Enter ${field}...`}
                />
              )
            )}
            {current?.kind === "fromRunInput" && (
              <Input
                value={current.field}
                onChange={(e) => draft.updateMapping(index, field, { kind: "fromRunInput", field: e.target.value })}
                placeholder="run input field name"
                className="h-8 min-w-40 flex-1"
              />
            )}
            {current?.kind === "fromStep" && (() => {
              const sourceStep = draft.steps.find((s) => s.stepOrder === current.stepOrder);
              const availableKinds = sourceStep ? draft.producesFor(sourceStep) : ["text", "image", "video", "audio", "json"];
              const earlierSteps = draft.steps.filter((s) => s.stepOrder < step.stepOrder);
              const stepOptions = earlierSteps.length > 0 ? earlierSteps : draft.steps;

              return (
                <>
                  <Select
                    value={current.stepOrder}
                    onChange={(e) => {
                      const newOrder = Number(e.target.value);
                      const newSource = draft.steps.find((s) => s.stepOrder === newOrder);
                      const newKinds = newSource ? draft.producesFor(newSource) : [];
                      draft.updateMapping(index, field, {
                        ...current,
                        stepOrder: newOrder,
                        artifactKind: newKinds[0] ?? current.artifactKind,
                      });
                    }}
                    className="h-8 w-28"
                  >
                    {stepOptions.map((s) => (
                      <option key={s.stepOrder} value={s.stepOrder}>
                        Step {s.stepOrder}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={current.artifactKind}
                    onChange={(e) =>
                      draft.updateMapping(index, field, { ...current, artifactKind: e.target.value })
                    }
                    className="h-8 min-w-40 flex-1"
                  >
                    {availableKinds.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                    {!availableKinds.includes(current.artifactKind) && (
                      <option value={current.artifactKind}>{current.artifactKind}</option>
                    )}
                  </Select>
                </>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}
