export interface TemplateStep {
  id?: string;
  stepOrder: number;
  agentId: string;
  agentStepKey: string;
  inputMapping: Record<string, InputMappingValue>;
}

export type InputMappingValue =
  | { kind: "literal"; value: unknown }
  | { kind: "fromRunInput"; field: string }
  | { kind: "fromStep"; stepOrder: number; artifactKind: string };

export interface Template {
  id: string;
  projectId: string;
  name: string;
  status: string;
  steps: TemplateStep[];
}
