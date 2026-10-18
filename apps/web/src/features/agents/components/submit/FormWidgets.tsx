import type { RegistryWidgetsType, WidgetProps } from "@rjsf/utils";
import { BookmarkPlus, Dices } from "lucide-react";
import type { Prompt } from "../../../../models/prompts";
import { randomSeed, sliderStep, type SchemaProperty } from "../../../../lib/submitForm";
import { cn } from "../../../../lib/utils";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Select } from "../../../../components/ui/select";
import { Textarea } from "../../../../components/ui/textarea";

/** What the page hands every widget through rjsf's formContext. */
export interface SubmitFormContext {
  prompts?: Prompt[];
  onInsertPrompt?: (p: Prompt) => void;
  onSavePrompt?: (template: string) => void;
}

const toNumber = (raw: string, integer: boolean): number | undefined => {
  if (raw.trim() === "") return undefined;
  const n = integer ? Number.parseInt(raw, 10) : Number(raw);
  return Number.isFinite(n) ? n : undefined;
};

const isInteger = (schema: SchemaProperty) => (Array.isArray(schema.type) ? schema.type.includes("integer") : schema.type === "integer");

/** The large text box for the main prompt, with the saved-prompt picker built in. */
function PromptWidget({ id, value, onChange, onBlur, onFocus, disabled, readonly, placeholder, autofocus, formContext }: WidgetProps) {
  const ctx = (formContext ?? {}) as SubmitFormContext;
  const text = typeof value === "string" ? value : "";
  return (
    <div className="space-y-2">
      <Textarea
        id={id}
        value={text}
        rows={6}
        className="min-h-[140px] text-[15px] leading-relaxed"
        placeholder={placeholder || "Describe what you want…"}
        disabled={disabled || readonly}
        autoFocus={autofocus}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
        onBlur={(e) => onBlur(id, e.target.value)}
        onFocus={(e) => onFocus(id, e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-2">
        {ctx.prompts && ctx.prompts.length > 0 && (
          <Select
            aria-label="Insert saved prompt"
            value=""
            className="h-8 w-56"
            onChange={(e) => {
              const p = ctx.prompts?.find((x) => x.id === e.target.value);
              if (p) ctx.onInsertPrompt?.(p);
            }}
          >
            <option value="">Insert saved prompt…</option>
            {ctx.prompts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.key} v{p.version}
              </option>
            ))}
          </Select>
        )}
        {text && ctx.onSavePrompt && (
          <Button type="button" size="sm" variant="ghost" onClick={() => ctx.onSavePrompt?.(text)}>
            <BookmarkPlus className="h-3.5 w-3.5" /> Save as prompt
          </Button>
        )}
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">{text.length} chars</span>
      </div>
    </div>
  );
}

/** A slider and a number box for a bounded number. */
function SliderWidget({ id, value, schema, onChange, disabled, readonly }: WidgetProps) {
  const s = schema as SchemaProperty;
  const min = s.minimum ?? 0;
  const max = s.maximum ?? 100;
  const integer = isInteger(s);
  const current = typeof value === "number" ? value : typeof s.default === "number" ? s.default : min;
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        aria-label={`${s.title ?? id} slider`}
        min={min}
        max={max}
        step={sliderStep(s)}
        value={current}
        disabled={disabled || readonly}
        onChange={(e) => onChange(toNumber(e.target.value, integer))}
        className="h-2 flex-1 cursor-pointer accent-[hsl(var(--primary))] !border-0 !p-0"
      />
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        step={sliderStep(s)}
        value={typeof value === "number" ? value : ""}
        placeholder={String(current)}
        disabled={disabled || readonly}
        onChange={(e) => onChange(toNumber(e.target.value, integer))}
        className="h-8 w-20 text-right tabular-nums"
      />
    </div>
  );
}

/** One chip per choice for a short enum. */
function ChipsWidget({ id, value, options, onChange, disabled, readonly, required }: WidgetProps) {
  const choices = options.enumOptions ?? [];
  return (
    <div id={id} role="radiogroup" className="flex flex-wrap gap-1.5">
      {choices.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled || readonly}
            // A second click clears an optional field.
            onClick={() => onChange(on && !required ? undefined : o.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              on ? "border-primary/60 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A seed box with a 🎲 button. Empty means a random seed per run. */
function SeedWidget({ id, value, schema, onChange, disabled, readonly }: WidgetProps) {
  return (
    <div className="flex items-center gap-2">
      <Input
        id={id}
        type="number"
        value={typeof value === "number" ? value : ""}
        placeholder="Random each run"
        disabled={disabled || readonly}
        onChange={(e) => onChange(toNumber(e.target.value, isInteger(schema as SchemaProperty)))}
        className="h-9 tabular-nums"
      />
      <Button type="button" size="sm" variant="outline" aria-label="Pick a random seed" title="Pick a random seed" disabled={disabled || readonly} onClick={() => onChange(randomSeed())}>
        <Dices className="h-4 w-4" />
      </Button>
    </div>
  );
}

function TextareaWidget({ id, value, onChange, onBlur, onFocus, disabled, readonly, placeholder }: WidgetProps) {
  return (
    <Textarea
      id={id}
      value={typeof value === "string" ? value : ""}
      rows={3}
      placeholder={placeholder}
      disabled={disabled || readonly}
      onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
      onBlur={(e) => onBlur(id, e.target.value)}
      onFocus={(e) => onFocus(id, e.target.value)}
    />
  );
}

export const SUBMIT_WIDGETS: RegistryWidgetsType = {
  prompt: PromptWidget,
  slider: SliderWidget,
  chips: ChipsWidget,
  seed: SeedWidget,
  textarea: TextareaWidget,
};
