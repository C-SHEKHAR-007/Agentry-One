import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, Keyboard, Link2, PenLine } from "lucide-react";
import type { InputMappingValue } from "../../models";
import { useSocialAccountsQuery } from "../../features/integrations/socialAccounts.api";
import type { FieldSchema, TemplateDraft } from "../../hooks/useTemplateDraft";
import { consumersOf, fieldIssues, stepLabel } from "../../lib/workflowGraph";
import { cn } from "../../lib/utils";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { KindChip } from "./stepVisuals";

type Source = InputMappingValue["kind"];

const SOURCES: Array<{ kind: Source; label: string; short: string; icon: typeof PenLine }> = [
  { kind: "literal", label: "Fixed value", short: "Fixed", icon: PenLine },
  { kind: "fromRunInput", label: "Run input", short: "Input", icon: Keyboard },
  { kind: "fromStep", label: "Earlier step", short: "Step", icon: Link2 },
];

/** Fields whose values are prose -- edited in a textarea, not a one-liner. */
const LONG_TEXT = /prompt|text|caption|brief|description|message|topic|content/i;

/** Everything that configures one step: its agent, how each input is
 * sourced, and what it outputs. Used by the canvas sidebar and the form view. */
export function StepFields({ draft, index, compact = false }: { draft: TemplateDraft; index: number; compact?: boolean }) {
  const step = draft.steps[index];
  const agent = step ? draft.manifestsById.get(step.agentId) : undefined;
  const manifestStep = agent?.manifest.steps.find((s) => s.key === step?.agentStepKey) ?? agent?.manifest.steps[0];
  const properties = manifestStep?.inputSchema.properties ?? {};
  const required = manifestStep?.inputSchema.required ?? [];
  const fields = Object.keys(properties);

  // If the draft's step key doesn't exist on this agent (agent switched),
  // snap to the agent's first real step.
  useEffect(() => {
    if (agent && manifestStep && step && step.agentStepKey !== manifestStep.key) {
      draft.updateStep(index, { agentStepKey: manifestStep.key, inputMapping: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.id, manifestStep?.key]);

  const issues = useMemo(
    () => (step ? fieldIssues(step, draft.steps, draft.producesFor, required) : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step, draft.steps, draft.manifestsById, required.join(",")],
  );

  if (!step) return null;
  const produces = draft.producesFor(step);
  const consumers = consumersOf(draft.steps, step.stepOrder);
  const agentSummary = draft.agents.find((a) => a.id === step.agentId);

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      <section className={compact ? "space-y-1.5" : "space-y-2"}>
        <Label htmlFor={`agent-${index}`} className={cn(compact && "text-xs")}>Agent</Label>
        <Select
          id={`agent-${index}`}
          className={cn(compact && "h-8 py-1 text-sm")}
          value={step.agentId}
          onChange={(e) => draft.updateStep(index, { agentId: e.target.value, inputMapping: {} })}
        >
          <option value="">Choose an agent…</option>
          {draft.agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        {(agent?.description || agentSummary?.description) && (
          <p
            title={agent?.description || agentSummary?.description}
            className={cn("text-muted-foreground", compact ? "line-clamp-2 text-[11px] leading-snug" : "text-xs leading-relaxed")}
          >
            {agent?.description || agentSummary?.description}
          </p>
        )}
        {agent && agent.manifest.steps.length > 1 && (
          <div className="pt-1">
            <Label htmlFor={`agent-step-${index}`}>Action</Label>
            <Select
              id={`agent-step-${index}`}
              value={step.agentStepKey}
              onChange={(e) => draft.updateStep(index, { agentStepKey: e.target.value, inputMapping: {} })}
              className="mt-1.5"
            >
              {agent.manifest.steps.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name ?? s.key}
                </option>
              ))}
            </Select>
          </div>
        )}
      </section>

      {!step.agentId ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Choose an agent to configure this step's inputs.
        </p>
      ) : !agent ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-secondary/40" />
          ))}
        </div>
      ) : (
        <>
          <section className={compact ? "space-y-2" : "space-y-3"}>
            <h4 className={cn("font-semibold uppercase tracking-wider text-muted-foreground", compact ? "text-[11px]" : "text-xs")}>
              Inputs <span className="font-normal normal-case tracking-normal">· {fields.length}</span>
            </h4>
            {fields.length === 0 && <p className="text-sm text-muted-foreground">This agent takes no inputs.</p>}
            {fields.map((field) => (
              <FieldMapping
                key={field}
                draft={draft}
                index={index}
                field={field}
                schema={properties[field] ?? {}}
                required={required.includes(field)}
                issue={issues[field]}
                compact={compact}
              />
            ))}
          </section>

          <section className="space-y-2">
            <h4 className={cn("font-semibold uppercase tracking-wider text-muted-foreground", compact ? "text-[11px]" : "text-xs")}>Outputs</h4>
            <div className="flex flex-wrap gap-1.5">
              {produces.length ? produces.map((k) => <KindChip key={k} kind={k} />) : <span className="text-sm text-muted-foreground">None</span>}
            </div>
            {consumers.length > 0 ? (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {consumers.map((c) => (
                  <li key={`${c.stepOrder}-${c.field}`} className="flex items-center gap-1.5">
                    <ArrowRight className="h-3 w-3" /> {c.artifactKind} feeds <strong className="font-medium text-foreground">{stepLabel(c.stepOrder)}</strong> ·{" "}
                    <code>{c.field}</code>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No later step uses these outputs yet.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function FieldMapping({
  draft,
  index,
  field,
  schema,
  required,
  issue,
  compact = false,
}: {
  draft: TemplateDraft;
  index: number;
  field: string;
  schema: FieldSchema;
  required: boolean;
  issue?: string;
  compact?: boolean;
}) {
  const step = draft.steps[index];
  const current: InputMappingValue = step.inputMapping[field] ?? { kind: "literal", value: "" };
  const earlierSteps = draft.steps.filter((s) => s.stepOrder < step.stepOrder);
  const label = schema.title ?? field;
  const id = `field-${index}-${field}`;

  const setSource = (kind: Source) => {
    if (kind === current.kind) return;
    if (kind === "literal") draft.updateMapping(index, field, { kind, value: schema.default ?? "" });
    else if (kind === "fromRunInput") draft.updateMapping(index, field, { kind, field });
    else {
      // Default to the nearest earlier step that produces a fitting kind.
      const preferred = /image/i.test(field) ? "image" : /audio/i.test(field) ? "audio" : /video/i.test(field) ? "video" : "text";
      const candidates = [...earlierSteps].reverse();
      const source =
        candidates.find((s) => draft.producesFor(s).includes(preferred)) ?? candidates.find((s) => draft.producesFor(s).length) ?? candidates[0];
      const kinds = source ? draft.producesFor(source) : [];
      draft.updateMapping(index, field, {
        kind: "fromStep",
        stepOrder: source?.stepOrder ?? -1,
        artifactKind: kinds.includes(preferred) ? preferred : (kinds[0] ?? preferred),
      });
    }
  };

  return (
    <div className={cn("rounded-lg border bg-card/40", compact ? "p-2.5" : "p-3", issue ? "border-destructive/50" : "border-border/70")}>
      <div className={cn("flex items-baseline justify-between gap-2", compact ? "mb-1.5" : "mb-2")}>
        <label htmlFor={id} className={cn("min-w-0 font-medium", compact ? "text-xs" : "text-sm")}>
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </label>
        {schema.title && <code className={cn("shrink-0 text-muted-foreground", compact ? "text-[11px]" : "text-[11px]")}>{field}</code>}
      </div>
      <div className={compact ? "mb-2" : "mb-2.5"}>
        <div role="radiogroup" aria-label={`Source for ${label}`} className="grid grid-cols-3 rounded-md border border-border/70 p-0.5">
          {SOURCES.map(({ kind, label: sourceLabel, short, icon: Icon }) => {
            const disabled = kind === "fromStep" && earlierSteps.length === 0;
            return (
              <button
                key={kind}
                type="button"
                role="radio"
                aria-checked={current.kind === kind}
                aria-label={sourceLabel}
                title={disabled ? "No earlier step to read from" : sourceLabel}
                disabled={disabled}
                onClick={() => setSource(kind)}
                className={cn(
                  "flex items-center justify-center gap-1 rounded font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  compact ? "px-1.5 py-1 text-[11px]" : "gap-1.5 px-2 py-1.5 text-xs",
                  current.kind === kind ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("shrink-0", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
                {compact ? (
                  <span className="whitespace-nowrap">{short}</span>
                ) : (
                  <>
                    <span className="hidden whitespace-nowrap min-[440px]:inline">{sourceLabel}</span>
                    <span className="whitespace-nowrap min-[440px]:hidden">{short}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {current.kind === "literal" && (
        <LiteralInput id={id} draft={draft} index={index} field={field} schema={schema} value={current.value} compact={compact} />
      )}

      {current.kind === "fromRunInput" && (
        <div className="space-y-1">
          <span className={cn("text-muted-foreground", compact ? "text-[11px]" : "text-xs")}>Asked for when the workflow runs, as:</span>
          <Input
            id={id}
            value={current.field}
            onChange={(e) => draft.updateMapping(index, field, { kind: "fromRunInput", field: e.target.value })}
            placeholder="input name"
            className={cn("font-mono", compact ? "h-8 text-xs" : "text-sm")}
          />
        </div>
      )}

      {current.kind === "fromStep" && (
        <div className={cn("grid gap-2", compact ? "grid-cols-[minmax(0,1fr)_5.5rem]" : "grid-cols-[minmax(0,1fr)_7rem]")}>
          <Select
            id={id}
            aria-label="Source step"
            className={cn(compact && "h-8 py-1 text-xs")}
            value={current.stepOrder}
            onChange={(e) => {
              const order = Number(e.target.value);
              const src = draft.steps.find((s) => s.stepOrder === order);
              const kinds = src ? draft.producesFor(src) : [];
              draft.updateMapping(index, field, {
                kind: "fromStep",
                stepOrder: order,
                artifactKind: kinds.includes(current.artifactKind) ? current.artifactKind : (kinds[0] ?? current.artifactKind),
              });
            }}
          >
            {!draft.steps.some((s) => s.stepOrder === current.stepOrder) && <option value={current.stepOrder}>Removed step</option>}
            {earlierSteps.map((s) => (
              <option key={s.stepOrder} value={s.stepOrder}>
                {stepLabel(s.stepOrder)} · {draft.manifestsById.get(s.agentId)?.name ?? (s.agentId || "no agent")}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Output to use"
            className={cn(compact && "h-8 py-1 text-xs")}
            value={current.artifactKind}
            onChange={(e) => draft.updateMapping(index, field, { ...current, artifactKind: e.target.value })}
          >
            {(() => {
              const src = draft.steps.find((s) => s.stepOrder === current.stepOrder);
              const kinds = src ? draft.producesFor(src) : [];
              const all = kinds.includes(current.artifactKind) ? kinds : [...kinds, current.artifactKind];
              return all.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ));
            })()}
          </Select>
        </div>
      )}

      {schema.description && <p className={cn("mt-1.5 text-muted-foreground", compact ? "text-[11px]" : "text-xs")}>{schema.description}</p>}
      {issue && (
        <p className={cn("mt-2 flex items-start gap-1.5 text-destructive", compact ? "text-[11px]" : "text-xs")}>
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" /> {issue}
        </p>
      )}
    </div>
  );
}

function LiteralInput({
  id,
  draft,
  index,
  field,
  schema,
  value,
  compact = false,
}: {
  id: string;
  draft: TemplateDraft;
  index: number;
  field: string;
  schema: FieldSchema;
  value: unknown;
  compact?: boolean;
}) {
  const set = (v: unknown) => draft.updateMapping(index, field, { kind: "literal", value: v });
  const size = compact ? "h-8 py-1 text-xs" : undefined;
  const placeholder = schema.default !== undefined ? `Default: ${String(schema.default)}` : "Enter a value";

  const { data: socialAccounts } = useSocialAccountsQuery(draft.targetProjectId ?? "", {
    skip: field !== "socialAccountId" || !draft.targetProjectId,
  });

  if (field === "socialAccountId") {
    return (
      <div className="space-y-1.5">
        <Select id={id} value={String(value ?? "")} onChange={(e) => set(e.target.value)} className={size}>
          <option value="">Choose a connected account…</option>
          {(socialAccounts ?? []).map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.handle || acc.id} ({acc.platform})
            </option>
          ))}
        </Select>
        {socialAccounts && socialAccounts.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No accounts connected to this project.{" "}
            <Link to="/integrations" className="text-primary hover:underline">
              Connect one
            </Link>
          </p>
        )}
      </div>
    );
  }
  if (schema.enum) {
    return (
      <Select id={id} value={String(value ?? "")} onChange={(e) => set(e.target.value)} className={size}>
        <option value="">{schema.default !== undefined ? `Default (${String(schema.default)})` : "Choose…"}</option>
        {schema.enum.map((opt) => (
          <option key={String(opt)} value={String(opt)}>
            {String(opt)}
          </option>
        ))}
      </Select>
    );
  }
  if (schema.type === "boolean") {
    return (
      <Select id={id} value={value === true ? "true" : value === false ? "false" : ""} onChange={(e) => set(e.target.value === "" ? "" : e.target.value === "true")} className={size}>
        <option value="">{schema.default !== undefined ? `Default (${String(schema.default)})` : "Not set"}</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </Select>
    );
  }
  if (schema.type === "number" || schema.type === "integer") {
    return (
      <Input
        id={id}
        type="number"
        value={value === "" || value === undefined || value === null ? "" : String(value)}
        min={schema.minimum}
        max={schema.maximum}
        step={schema.type === "integer" ? 1 : "any"}
        onChange={(e) => set(e.target.value === "" ? "" : Number(e.target.value))}
        placeholder={placeholder}
       
      />
    );
  }
  if (LONG_TEXT.test(field)) {
    return <Textarea id={id} value={String(value ?? "")} onChange={(e) => set(e.target.value)} placeholder={placeholder} rows={compact ? 2 : 3} className={compact ? "min-h-[56px] text-xs" : "text-sm"} />;
  }
  return <Input id={id} value={String(value ?? "")} onChange={(e) => set(e.target.value)} placeholder={placeholder} className={size} />;
}
