import { Validator, type OutputUnit, type Schema } from "@cfworker/json-schema";
import {
  createErrorHandler,
  getDefaultFormState,
  toErrorList,
  toErrorSchema,
  unwrapErrorHandler,
  validationDataMerge,
  type CustomValidator,
  type ErrorSchema,
  type ErrorTransformer,
  type FormContextType,
  type RJSFSchema,
  type RJSFValidationError,
  type StrictRJSFSchema,
  type UiSchema,
  type ValidationData,
  type ValidatorType,
} from "@rjsf/utils";

/**
 * A react-jsonschema-form validator that doesn't need `eval`.
 *
 * rjsf's default (@rjsf/validator-ajv8) compiles every schema to code with
 * `new Function`, which the app's Content-Security-Policy (`script-src
 * 'self'`, no 'unsafe-eval') rightly blocks -- so submitting a generated form
 * failed in production. @cfworker/json-schema interprets the schema instead,
 * and this adapter maps its output to rjsf's error format (same property
 * paths and message style as the ajv validator), so forms behave the same.
 */

/** Keywords whose failure only says "a child failed"; the child's own error
 * is reported separately, so these would be duplicates. */
const WRAPPERS = new Set(["properties", "items", "prefixItems", "$ref", "allOf", "patternProperties", "dependentSchemas", "if", "then", "else"]);

const LIMITS: Record<string, (n: string) => string> = {
  minimum: (n) => `must be >= ${n}`,
  maximum: (n) => `must be <= ${n}`,
  exclusiveMinimum: (n) => `must be > ${n}`,
  exclusiveMaximum: (n) => `must be < ${n}`,
  minLength: (n) => `must NOT have fewer than ${n} characters`,
  maxLength: (n) => `must NOT have more than ${n} characters`,
  minItems: (n) => `must NOT have fewer than ${n} items`,
  maxItems: (n) => `must NOT have more than ${n} items`,
};

const pointerToProperty = (loc: string) =>
  loc
    .replace(/^#/, "")
    .split("/")
    .filter(Boolean)
    .map((seg) => decodeURIComponent(seg.replace(/~1/g, "/").replace(/~0/g, "~")))
    .map((seg) => `.${seg}`)
    .join("");

const quoted = (text: string) => [...text.matchAll(/"([^"]*)"/g)].map((m) => m[1]);

function withDefinitions(schema: RJSFSchema, root?: RJSFSchema): Schema {
  // rjsf passes sub-schemas that still use "#/definitions/…" refs relative to
  // the root schema; carry the root's definitions along so they resolve.
  if (!root || root === schema) return schema as Schema;
  return { ...(schema as object), definitions: root.definitions, $defs: (root as { $defs?: unknown }).$defs } as Schema;
}

export function toRjsfErrors(units: OutputUnit[], schema?: RJSFSchema): RJSFValidationError[] {
  const out: RJSFValidationError[] = [];
  for (const u of units) {
    if (WRAPPERS.has(u.keyword)) continue;
    let property = pointerToProperty(u.instanceLocation);
    let message = u.error;
    const params: Record<string, unknown> = {};
    if (u.keyword === "required") {
      const missing = quoted(u.error)[0];
      if (missing) {
        params.missingProperty = missing;
        property = `${property}.${missing}`;
        message = `must have required property '${missing}'`;
      }
    } else if (u.keyword === "type") {
      const expected = quoted(u.error).pop();
      if (expected) {
        params.type = expected;
        message = `must be ${expected}`;
      }
    } else if (u.keyword === "enum" || u.keyword === "const") {
      message = "must be equal to one of the allowed values";
    } else if (LIMITS[u.keyword]) {
      // "Instance 9 is greater than maximum 4." -> "must be <= 4" (ajv wording)
      const limit = u.error.match(/(-?\d+(?:\.\d+)?)\D*$/)?.[1];
      if (limit !== undefined) {
        params.limit = Number(limit);
        message = LIMITS[u.keyword](limit);
      }
    }
    const title =
      params.missingProperty && schema?.properties
        ? (schema.properties[params.missingProperty as string] as { title?: string } | undefined)?.title
        : undefined;
    const stack = title ? message.replace(`'${params.missingProperty}'`, `'${title}'`) : `${property} ${message}`.trim();
    out.push({ name: u.keyword, property, message, params, stack, schemaPath: u.keywordLocation });
  }
  // Dedupe identical errors (e.g. from anyOf branches).
  const seen = new Set<string>();
  return out.filter((e) => {
    const key = `${e.property}|${e.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function run(schema: Schema, data: unknown): { units: OutputUnit[]; schemaError?: Error } {
  try {
    const result = new Validator(schema, "2020-12", false).validate(data);
    return { units: result.valid ? [] : result.errors };
  } catch (err) {
    return { units: [], schemaError: err as Error };
  }
}

export class CspSafeValidator<T = unknown, S extends StrictRJSFSchema = RJSFSchema, F extends FormContextType = FormContextType>
  implements ValidatorType<T, S, F>
{
  validateFormData(
    formData: T | undefined,
    schema: S,
    customValidate?: CustomValidator<T, S, F>,
    transformErrors?: ErrorTransformer<T, S, F>,
    uiSchema?: UiSchema<T, S, F>,
  ): ValidationData<T> {
    const { units, schemaError } = run(schema as Schema, formData ?? {});
    let errors = toRjsfErrors(units, schema as RJSFSchema);
    if (schemaError) errors = [...errors, { stack: `invalid schema: ${schemaError.message}` } as RJSFValidationError];
    if (typeof transformErrors === "function") errors = transformErrors(errors, uiSchema);

    let errorSchema = toErrorSchema<T>(errors);
    if (schemaError) errorSchema = { ...errorSchema, $schema: { __errors: [schemaError.message] } } as ErrorSchema<T>;
    if (typeof customValidate !== "function") return { errors, errorSchema };

    const newFormData = getDefaultFormState<T, S, F>(this, schema, formData, schema, true) as T;
    const errorHandler = customValidate(newFormData, createErrorHandler<T>(newFormData), uiSchema);
    return validationDataMerge<T>({ errors, errorSchema }, unwrapErrorHandler<T>(errorHandler));
  }

  toErrorList(errorSchema?: ErrorSchema<T>, fieldPath: string[] = []): RJSFValidationError[] {
    return toErrorList<T>(errorSchema, fieldPath);
  }

  /** Used by rjsf to pick matching oneOf/anyOf options. */
  isValid(schema: S, formData: T | undefined, rootSchema: S): boolean {
    const { units, schemaError } = run(withDefinitions(schema as RJSFSchema, rootSchema as RJSFSchema), formData);
    return !schemaError && units.length === 0;
  }

  rawValidation<Result = unknown>(schema: S, formData?: T): { errors?: Result[]; validationError?: Error } {
    const { units, schemaError } = run(schema as Schema, formData);
    return { errors: units as unknown as Result[], validationError: schemaError };
  }
}

/** Drop-in for `import validator from "@rjsf/validator-ajv8"` (also typed
 * for any form data). */
export const cspSafeValidator = new CspSafeValidator<any>();
