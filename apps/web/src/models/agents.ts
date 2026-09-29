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

export interface Capability {
  id: string;
  key: string;
  name: string;
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
  /** Last 30 days. */
  tokens?: number;
  costUsd?: number;
}
