import { describe, expect, it } from "vitest";
import type { RJSFSchema } from "@rjsf/utils";
import { cspSafeValidator as validator } from "../schemaValidator";

const schema: RJSFSchema = {
  type: "object",
  required: ["prompt"],
  properties: {
    prompt: { type: "string", title: "Prompt / Input", minLength: 3 },
    steps: { type: "integer", minimum: 1 },
    style: { type: "object", properties: { tone: { type: "string", enum: ["calm", "bold"] } } },
  },
};

describe("CSP-safe rjsf validator", () => {
  it("accepts valid data", () => {
    const { errors, errorSchema } = validator.validateFormData({ prompt: "a lighthouse", steps: 2 }, schema);
    expect(errors).toEqual([]);
    expect(errorSchema).toEqual({});
  });

  it("reports a missing required field on that field, using its title", () => {
    const { errors, errorSchema } = validator.validateFormData({}, schema);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ name: "required", property: ".prompt", message: "must have required property 'prompt'" });
    expect(errors[0].stack).toBe("must have required property 'Prompt / Input'");
    expect(errorSchema).toEqual({ prompt: { __errors: ["must have required property 'prompt'"] } });
  });

  it("reports type, range and nested enum errors at their paths", () => {
    const { errors } = validator.validateFormData({ prompt: "ok", steps: 0.5, style: { tone: "loud" } }, schema);
    const at = (prop: string) => errors.filter((e) => e.property === prop).map((e) => [e.name, e.message]);
    expect(at(".prompt")).toContainEqual(["minLength", "must NOT have fewer than 3 characters"]);
    // 0.5 breaks both rules; each is reported.
    expect(at(".steps")).toContainEqual(["type", "must be integer"]);
    expect(at(".steps")).toContainEqual(["minimum", "must be >= 1"]);
    expect(at(".style.tone")).toEqual([["enum", "must be equal to one of the allowed values"]]);
    // Wrapper keywords ("properties") aren't reported twice.
    expect(errors.some((e) => e.name === "properties")).toBe(false);
  });

  it("runs custom validation and merges its errors", () => {
    const { errors } = validator.validateFormData({ prompt: "abc" }, schema, (data, errs) => {
      if ((data as { prompt?: string }).prompt === "abc") errs.prompt?.addError("pick a better prompt");
      return errs;
    });
    expect(errors.map((e) => e.stack)).toContain(".prompt pick a better prompt");
  });

  it("isValid resolves refs against the root schema (oneOf matching)", () => {
    const root: RJSFSchema = { definitions: { size: { type: "integer", minimum: 256 } }, type: "object" };
    expect(validator.isValid({ $ref: "#/definitions/size" }, 512, root)).toBe(true);
    expect(validator.isValid({ $ref: "#/definitions/size" }, 10, root)).toBe(false);
  });
});
