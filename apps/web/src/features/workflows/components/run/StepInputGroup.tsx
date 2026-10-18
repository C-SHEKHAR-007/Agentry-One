import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { useAgentQuery } from "../../../agents/agents.api";
import type { SocialAccount } from "../../../../models/socialAccounts";
import type { FieldSchema } from "../../../../models/agents";
import { coerceRunInput, type RunInputGroup } from "../../../../lib/runInputs";
import { widgetFor } from "../../../../lib/submitForm";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Select } from "../../../../components/ui/select";
import { Textarea } from "../../../../components/ui/textarea";

const humanize = (field: string) => field.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

export interface StepInputGroupProps {
  group: RunInputGroup;
  raw: Record<string, string>;
  /** `value` is what is sent: typed from the agent field's schema. */
  onChange: (field: string, raw: string, value: unknown) => void;
  socialAccounts?: SocialAccount[];
}

/** The run inputs one step uses, typed and titled from that agent's schema. */
export function StepInputGroup({ group, raw, onChange, socialAccounts }: StepInputGroupProps) {
  const { data: agent } = useAgentQuery(group.agentId);
  const step = agent?.manifest.steps.find((s) => s.key === group.agentStepKey) ?? agent?.manifest.steps[0];
  const props = step?.inputSchema.properties ?? {};
  const required = new Set(step?.inputSchema.required ?? []);

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[11px] text-primary">{group.stepOrder + 1}</span>
        {agent?.name ?? group.agentId}
      </h3>
      {group.fields.map(({ field, agentField, alsoUsedBy }) => {
        const schema: FieldSchema = props[agentField] ?? {};
        const id = `run-input-${field}`;
        const label = schema.title ?? humanize(field);
        const set = (v: string) => onChange(field, v, coerceRunInput(v, schema.type));
        const note = alsoUsedBy.length ? `Also used by step ${alsoUsedBy.map((o) => o + 1).join(", ")}` : null;

        let control: React.ReactNode;
        if (field === "socialAccountId" || agentField === "socialAccountId") {
          control = (
            <>
              <Select id={id} value={raw[field] ?? ""} onChange={(e) => set(e.target.value)}>
                <option value="">Select connected social account...</option>
                {(socialAccounts ?? []).map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.platform.toUpperCase()} — {acc.handle || acc.id.slice(0, 8)}
                  </option>
                ))}
              </Select>
              {(!socialAccounts || socialAccounts.length === 0) && (
                <p className="text-xs text-warning">
                  No social accounts connected in this project.{" "}
                  <Link to="/integrations" className="font-semibold underline">
                    Connect one in Integrations
                  </Link>
                </p>
              )}
            </>
          );
        } else if (schema.enum?.length) {
          control = (
            <Select id={id} value={raw[field] ?? ""} onChange={(e) => set(e.target.value)}>
              <option value="">{required.has(agentField) ? "Choose…" : "Default"}</option>
              {schema.enum.map((v) => (
                <option key={String(v)} value={String(v)}>
                  {String(v)}
                </option>
              ))}
            </Select>
          );
        } else if (schema.type === "boolean") {
          control = (
            <Select id={id} value={raw[field] ?? ""} onChange={(e) => set(e.target.value)}>
              <option value="">Default</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </Select>
          );
        } else if (schema.type === "integer" || schema.type === "number") {
          control = (
            <Input
              id={id}
              type="number"
              min={schema.minimum}
              max={schema.maximum}
              step={schema.type === "integer" ? 1 : "any"}
              value={raw[field] ?? ""}
              placeholder={schema.default !== undefined ? String(schema.default) : undefined}
              onChange={(e) => set(e.target.value)}
              className="w-40"
            />
          );
        } else {
          const w = widgetFor(agentField, { ...schema, type: schema.type ?? "string" }, null);
          control =
            w === "textarea" || /topic|brief|idea|content/i.test(field) ? (
              <Textarea id={id} rows={3} value={raw[field] ?? ""} placeholder={schema.description} onChange={(e) => set(e.target.value)} />
            ) : (
              <Input id={id} value={raw[field] ?? ""} placeholder={schema.description} onChange={(e) => set(e.target.value)} />
            );
        }

        return (
          <div key={field} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={id}>
                {label}
                {required.has(agentField) && <span className="text-destructive"> *</span>}
              </Label>
              {(field === "socialAccountId" || agentField === "socialAccountId") && (
                <Link to="/integrations" className="flex items-center gap-1 text-xs text-primary hover:underline">
                  Manage accounts <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
            {control}
            {note && <p className="text-xs text-muted-foreground">{note}</p>}
          </div>
        );
      })}
    </section>
  );
}
