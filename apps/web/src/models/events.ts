export interface EventItem {
  id: string;
  type: string;
  createdAt: string;
  workflowId: string | null;
  jobId: string | null;
  agentId: string | null;
  agentName?: string | null;
  projectId: string | null;
  projectName: string | null;
  /** job.failed: failedReason; job.completed: durationMs/model/tokens/cost. */
  payload?: {
    failedReason?: string | null;
    attemptNumber?: number;
    durationMs?: number;
    model?: string;
    inputTokens?: number | null;
    outputTokens?: number | null;
    costUsd?: number | null;
    artifacts?: number;
  } | null;
}
