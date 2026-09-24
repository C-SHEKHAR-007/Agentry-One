import { z, type ZodTypeAny } from "zod";

export { z };

export class ValidationError extends Error {
  statusCode = 400;
  constructor(public issues: { path: string; message: string }[]) {
    super(issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join("; "));
  }
}

/** Parses untrusted input (body/query/params) against a zod schema, throwing
 * a 400 ValidationError that the central error handler renders. */
export function parse<S extends ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value ?? {});
  if (result.success) return result.data;
  throw new ValidationError(
    result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  );
}

export const nonEmpty = (max = 200) => z.string().trim().min(1).max(max);
export const uuid = () => z.string().uuid();
