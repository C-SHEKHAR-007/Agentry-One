import { prisma } from "../../db/client.js";
import { decryptSecret } from "./crypto.js";

export interface ProviderContext {
  capability: string;
  /** id of the provider_configs row that was resolved -- persisted on the job
   * for cost attribution (never sent to the worker payload consumers). */
  providerConfigId: string;
  providerType: string;
  baseUrl: string | null;
  apiKey: string | null;
  config: Record<string, unknown>;
}

/** Resolves which provider_config to use for a required capability, following
 * the same project-overrides-global precedence the `settings` table uses.
 * Returns null if nothing is configured -- callers must reject the request
 * (422) rather than let a job fail partway through a worker run. */
export async function resolveProvider(
  capabilityKey: string,
  opts: { projectId?: string; explicitProviderConfigId?: string } = {},
): Promise<ProviderContext | null> {
  const capability = await prisma.capability.findUnique({ where: { key: capabilityKey } });
  if (!capability) return null;

  let config = null;

  if (opts.explicitProviderConfigId) {
    config = await prisma.providerConfig.findFirst({
      where: { id: opts.explicitProviderConfigId, capabilityId: capability.id, status: "active" },
    });
  }

  if (!config && opts.projectId) {
    config = await prisma.providerConfig.findFirst({
      where: { capabilityId: capability.id, scope: "project", projectId: opts.projectId, isDefault: true, status: "active" },
    });
  }

  if (!config) {
    config = await prisma.providerConfig.findFirst({
      where: { capabilityId: capability.id, scope: "global", isDefault: true, status: "active" },
    });
  }

  if (!config) return null;

  return {
    capability: capabilityKey,
    providerConfigId: config.id,
    providerType: config.providerType,
    baseUrl: config.baseUrl,
    apiKey: config.encryptedSecret ? decryptSecret(config.encryptedSecret) : null,
    config: (config.config as Record<string, unknown>) ?? {},
  };
}
