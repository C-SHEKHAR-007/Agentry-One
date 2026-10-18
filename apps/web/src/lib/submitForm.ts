/** How the Submit agent page renders each field of an agent's input schema.
 * rjsf draws plain inputs; this picks a richer widget per field from the
 * schema alone, so a new agent still needs no UI code. */

export interface SchemaProperty {
  type?: string | string[];
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  maxLength?: number;
}

export type FieldWidget = "prompt" | "seed" | "slider" | "chips" | "textarea" | "default";

/** Free-text fields that read better as a multi-line box. */
const LONG_TEXT = /^(prompt|negativeprompt|text|caption|context|script|message|instructions|description|body)$/i;

/** Enums with more choices than this stay a dropdown. */
const MAX_CHIPS = 6;

const typeOf = (p: SchemaProperty) => (Array.isArray(p.type) ? p.type.find((t) => t !== "null") : p.type);

/** The field a saved prompt targets: a string field named "prompt", else the
 * first string field. Null when the schema has no string field. */
export function promptFieldOf(properties: Record<string, SchemaProperty> | undefined): string | null {
  const props = properties ?? {};
  if (typeOf(props.prompt ?? {}) === "string") return "prompt";
  return Object.entries(props).find(([, v]) => typeOf(v) === "string")?.[0] ?? null;
}

export function widgetFor(name: string, prop: SchemaProperty, promptField: string | null): FieldWidget {
  const t = typeOf(prop);
  if (name === promptField && t === "string" && !prop.enum) return "prompt";
  if (/^seed$/i.test(name) && (t === "integer" || t === "number")) return "seed";
  if (prop.enum && prop.enum.length > 0 && prop.enum.length <= MAX_CHIPS) return "chips";
  if ((t === "integer" || t === "number") && typeof prop.minimum === "number" && typeof prop.maximum === "number" && prop.maximum > prop.minimum)
    return "slider";
  if (t === "string" && !prop.enum && (LONG_TEXT.test(name) || (prop.maxLength ?? 0) > 200)) return "textarea";
  return "default";
}

/** rjsf uiSchema: one widget per top-level field (unknown fields keep rjsf's default). */
export function buildUiSchema(properties: Record<string, SchemaProperty> | undefined, promptField: string | null) {
  const ui: Record<string, { "ui:widget": string; "ui:options"?: Record<string, unknown> }> = {};
  for (const [name, prop] of Object.entries(properties ?? {})) {
    const w = widgetFor(name, prop, promptField);
    if (w !== "default") ui[name] = { "ui:widget": w };
  }
  return ui;
}

/** A seed in the range most image models accept (0 .. 2^32 - 1). */
export function randomSeed(rand: () => number = Math.random): number {
  return Math.floor(rand() * 4_294_967_295);
}

/** The step of a slider: whole numbers for integers, else a hundredth of the range. */
export function sliderStep(prop: SchemaProperty): number {
  if (typeOf(prop) === "integer") return 1;
  const span = (prop.maximum ?? 1) - (prop.minimum ?? 0);
  return span > 0 ? Number((span / 100).toPrecision(2)) : 0.01;
}
