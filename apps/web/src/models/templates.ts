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

/** A workflow in the library (GET /templates): with its steps, latest runs
 * and schedules. */
export interface WorkflowSummary {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  project: { id: string; name: string };
  steps: Array<{ stepOrder: number; agentId: string; inputMapping: Record<string, InputMappingValue> }>;
  runs: Array<{ id: string; status: string; createdAt: string; updatedAt: string }>;
  schedules: Array<{ id: string; cronExpr: string }>;
  runCount: number;
}

/** A workflow as edited (GET /templates/:id). */
export interface TemplateDetail {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  status?: string;
  steps: TemplateStep[];
}

export interface TemplateBody {
  name: string;
  description?: string;
  steps: Array<Pick<TemplateStep, "stepOrder" | "agentId" | "agentStepKey" | "inputMapping">>;
}

export interface Schedule {
  id: string;
  templateId?: string;
  cronExpr: string;
  isActive: boolean;
  createdAt: string;
}
