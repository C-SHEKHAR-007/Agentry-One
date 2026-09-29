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

/** The subset of JSON Schema the workflow editor renders fields from. */
export interface FieldSchema {
  type?: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
}

/** An agent with the manifest details the editor needs (GET /agents/:id). */
export interface AgentManifestDetail {
  id: string;
  name: string;
  description?: string;
  manifest: {
    steps: Array<{
      key: string;
      name?: string;
      requiresCapability?: string;
      requiresSocialAccount?: boolean;
      producesArtifactKinds: string[];
      consumesArtifactKinds?: string[];
      inputSchema: { properties?: Record<string, FieldSchema>; required?: string[] };
    }>;
  };
}
