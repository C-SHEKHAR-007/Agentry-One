import { prisma } from "../../db/client.js";

// Default per-job pricing (USD) used by /stats/costs. Stored in the generic
// settings table (global scope) so the operator can edit them from the UI.
// `pricing.reference` is the "what a premium API would have charged" price
// that savings are computed against.
const PRICING_DEFAULTS: Record<string, { perJobUsd: number }> = {
  "pricing.sd_turbo_local": { perJobUsd: 0 },
  "pricing.stability_ai": { perJobUsd: 0.04 },
  "pricing.reference": { perJobUsd: 0.04 },
};

export async function ensurePricingDefaults() {
  for (const [key, value] of Object.entries(PRICING_DEFAULTS)) {
    const existing = await prisma.setting.findFirst({
      where: { scope: "global", projectId: null, agentId: null, key },
    });
    if (!existing) {
      await prisma.setting.create({ data: { scope: "global", key, value } });
    }
  }
}
