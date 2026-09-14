// Shared API response types. Single source of truth -- pages should import
// from here instead of redeclaring local interfaces.

export interface Agent {
  id: string;
  version: string;
  name: string;
  description: string;
  status: string;
}

export interface ManifestStep {
  key: string;
  name?: string;
  humanGate?: boolean;
  requiresCapability?: string;
  producesArtifactKinds?: string[];
  inputSchema?: Record<string, unknown>;
}

export interface AgentDetail extends Agent {
  manifest: {
    entrypoint?: { queueName?: string };
    steps: ManifestStep[];
    [key: string]: unknown;
  };
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  counts: { workflows: number; templates: number; artifacts: number };
  lastActivityAt: string | null;
  coverArtifactId: string | null;
  coverPreviewUrl?: string | null;
}

export interface JobRun {
  id: string;
  attemptNumber: number;
  status: string;
  progressPercent: number | null;
  progressMessage: string | null;
  error: unknown;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface Job {
  id: string;
  status: string;
  createdAt: string;
  runs?: JobRun[];
}

export interface Artifact {
  id: string;
  workflowStepId?: string;
  kind: string;
  mimeType: string;
  sizeBytes: number | null;
  checksum: string | null;
  createdAt: string;
  metadata?: Record<string, any> | null;
  previewUrl?: string | null;
  downloadUrl?: string | null;
}

export interface ArtifactListItem extends Artifact {
  workflowId: string;
  projectId: string;
  projectName: string;
  agentId: string;
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

export interface Capability {
  id: string;
  key: string;
  name: string;
}

export interface ProviderConfig {
  id: string;
  capabilityKey: string;
  providerType: string;
  name: string;
  authMode: string;
  isDefault: boolean;
  isActive: boolean;
  hasSecret: boolean;
  scope: string;
}

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

export interface Prompt {
  id: string;
  agentId: string;
  key: string;
  version: number;
  template: string;
  createdAt: string;
}

export interface EventItem {
  id: string;
  type: string;
  createdAt: string;
  workflowId: string | null;
  jobId: string | null;
  agentId: string | null;
  projectId: string | null;
  projectName: string | null;
}

export interface WorkflowEvent {
  id: string;
  type: string;
  payload: unknown;
  createdAt: string;
  jobId: string | null;
}

export interface StatsOverview {
  agents: { total: number };
  workflows: { running: number; awaitingReview: number; total: number };
  jobs: {
    active: number;
    completedToday: number;
    failedToday: number;
    completedYesterday: number;
  };
  successRate: number | null;
  avgDurationMs: number | null;
  artifacts: { total: number };
  costSavedEstUsd: number;
  series: { completedPerDay: { date: string; count: number }[] };
}

export interface AgentStats {
  agentId: string;
  name: string;
  runs: number;
  completed: number;
  failed: number;
  successRate: number | null;
  avgDurationMs: number | null;
  lastRunAt: string | null;
  share: number;
}

export interface CostBreakdown {
  totalUsd: number;
  savedUsd: number;
  unattributedJobs: number;
  perProvider: { providerType: string; jobs: number; usd: number }[];
  perDay: { date: string; usd: number; savedUsd: number; jobs: number }[];
  pricing: Record<string, { perJobUsd: number }>;
  referenceUsd: number;
  days: number;
}

export interface SystemHealth {
  api: boolean;
  db: boolean;
  redis: boolean;
  workers: { queue: string; agentId: string; online: boolean }[];
}
