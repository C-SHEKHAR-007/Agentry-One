import { buildApp } from "./app.js";
import { syncAgentRegistry } from "./modules/agents/registry.js";
import { ensureDefaultUser } from "./modules/projects/defaultUser.js";
import { ensureCapabilitiesAndDefaults } from "./modules/providers/bootstrap.js";
import { ensurePricingDefaults } from "./modules/settings/bootstrap.js";
import { wireQueueListeners } from "./queue/listener.js";

async function main() {
  await ensureDefaultUser();
  await ensureCapabilitiesAndDefaults();
  await ensurePricingDefaults();

  const manifests = await syncAgentRegistry();
  console.log(`Agent registry synced: ${manifests.map((m) => m.id).join(", ") || "(none found)"}`);

  for (const manifest of manifests) {
    wireQueueListeners(manifest.entrypoint.queueName);
  }

  const app = buildApp();
  const port = Number(process.env.PORT ?? 4000);
  await app.listen({ port, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
