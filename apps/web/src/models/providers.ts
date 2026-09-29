import type { Capability } from "./agents";

/** A configured AI provider (GET /providers). Secrets are write-only:
 * only `hasSecret` is ever returned. */
export interface ProviderConfig {
  id: string;
  capabilityId: string;
  capability?: Capability;
  providerType: string;
  name: string;
  baseUrl: string | null;
  authMode: string;
  config: Record<string, unknown>;
  isDefault: boolean;
  scope: string;
  projectId: string | null;
  /** "active" | "disabled" */
  status: string;
  discoverySupported: boolean;
  lastDiscoveredAt: string | null;
  createdAt: string;
  updatedAt: string;
  hasSecret: boolean;
  models?: DiscoveredModel[];
}

/** A model discovered on (or added to) a provider (GET /models). */
export interface DiscoveredModel {
  id: string;
  modelId: string;
  name: string;
  description?: string | null;
  inputTypes: string[];
  outputTypes: string[];
  contextLength?: number | null;
  metadata?: Record<string, unknown>;
  isActive?: boolean;
  providerConfigId?: string;
  providerConfig?: { name: string };
  createdAt?: string;
}

/** POST /providers */
export interface CreateProviderBody {
  capabilityKey: string;
  providerType: string;
  name: string;
  baseUrl?: string;
  secret?: string;
  authMode: string;
  config: Record<string, unknown>;
  isDefault: boolean;
}

/** PUT /providers/:id -- `secret` only when replacing the saved key. */
export interface UpdateProviderBody {
  name: string;
  baseUrl: string;
  secret?: string;
  config: Record<string, unknown>;
  status: string;
}

/** POST /models: a model added to a provider by hand. */
export interface CreateModelBody {
  providerConfigId: string;
  modelId: string;
  name: string;
  description?: string;
  inputTypes: string[];
  outputTypes: string[];
  contextLength?: number;
}
