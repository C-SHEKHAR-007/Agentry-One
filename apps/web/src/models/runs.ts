import type { TemplateStep } from "./templates";

export interface TemplateRunStep {
  id: string;
  stepOrder: number;
  agentId: string;
  status: string;
  workflowId: string | null;
}

export interface TemplateRun {
  id: string;
  templateId: string;
  status: string;
  createdAt: string;
  steps: TemplateRunStep[];
}

export interface RunSummaryStep {
  id: string;
  status: string;
  workflowId: string | null;
  stepOrder: number;
  agentId: string;
  agentName: string;
  dependsOn: number[];
}

export interface RunSummary {
  id: string;
  status: string;
  createdAt: string;
  template: { id: string; name: string };
  project: { id: string; name: string };
  steps: RunSummaryStep[];
}

export interface StepUsage {
  attempts: number;
  model: string | null;
  providerType: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  progressPercent: number | null;
  progressMessage: string | null;
  error: string | null;
}

export interface RunDetail {
  id: string;
  templateId: string;
  status: string;
  runInputs: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  template: { id: string; name: string; projectId: string };
  steps: Array<{
    id: string;
    status: string;
    workflowId: string | null;
    createdAt: string;
    updatedAt: string;
    templateStep: TemplateStep & { id: string; producesArtifactKindsSnapshot?: string[] };
    workflow: { id: string; status: string; agentId: string; agentName: string; createdAt: string } | null;
    usage: StepUsage;
  }>;
  totals: { inputTokens: number; outputTokens: number; costUsd: number; durationMs: number | null };
}

/** One step of a workflow run (GET /template-runs/:id). */
export type RunStepWorkflow = RunDetail["steps"][number];
