import type { Artifact } from "./artifacts";

export interface JobRun {
  id: string;
  attemptNumber: number;
  status: string;
  progressPercent: number | null;
  progressMessage: string | null;
  error: unknown;
  startedAt: string | null;
  finishedAt: string | null;
  /** Reported by the worker (or the model the job was enqueued against). */
  model?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  costUsd?: number | null;
}

export interface Job {
  id: string;
  status: string;
  createdAt: string;
  providerType?: string | null;
  providerModel?: string | null;
  runs?: JobRun[];
}

export interface WorkflowStep {
  id: string;
  stepKey: string;
  sequence: number;
  humanGate: boolean;
  status: string;
  job?: Job | null;
  artifacts?: Artifact[];
}

export interface Workflow {
  id: string;
  projectId: string;
  agentId: string;
  agentVersion: string;
  status: string;
  inputParams: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  steps?: WorkflowStep[];
  project?: { id: string; name: string };
  agent?: { id: string; name: string; description?: string | null };
  /** Set when this run is one step of a multi-step workflow run. */
  templateRun?: { id: string; templateId: string; templateName: string } | null;
}

export interface RecentWorkflow {
  id: string;
  agentId: string;
  agentName: string;
  agentVersion: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  project: { id: string; name: string };
  durationMs: number | null;
  thumbArtifactId: string | null;
  thumbPreviewUrl?: string | null;
}

export interface WorkflowEvent {
  id: string;
  type: string;
  payload: unknown;
  createdAt: string;
  jobId: string | null;
}

export interface RunLogLine {
  id: string;
  level: "debug" | "info" | "warn" | "error" | string;
  message: string;
  createdAt: string;
  jobRunId: string;
  attemptNumber: number;
}
