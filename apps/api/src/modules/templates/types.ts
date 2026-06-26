/** A field in a template step's input can be a literal value, a value
 * collected at run time (fromRunInput), or an earlier step's output
 * artifact (fromStep) -- see the plan's ordered-list, forward-only-reference
 * template design (not a graph/edge table). */
export type InputMappingValue =
  | { kind: "literal"; value: unknown }
  | { kind: "fromRunInput"; field: string }
  | { kind: "fromStep"; stepOrder: number; artifactKind: string };

export type InputMapping = Record<string, InputMappingValue>;

export interface TemplateStepInput {
  stepOrder: number;
  agentId: string;
  agentStepKey: string;
  inputMapping: InputMapping;
}

export interface UpstreamStepInfo {
  stepOrder: number;
  producesArtifactKinds: string[];
}
