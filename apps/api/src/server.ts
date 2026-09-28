import { buildApp } from "./app.js";
import { validateEnv } from "./config.js";
import { prisma } from "./db/client.js";
import { syncAgentRegistry } from "./modules/agents/registry.js";
import { ensureDefaultUser } from "./modules/projects/defaultUser.js";
import { ensureCapabilitiesAndDefaults } from "./modules/providers/bootstrap.js";
import { ensurePricingDefaults } from "./modules/settings/bootstrap.js";
import { reapStaleWorkflows } from "./modules/workflows/service.js";
import { closeRedisConnection } from "./queue/connection.js";
import { wireQueueListeners } from "./queue/listener.js";
import { closeQueues } from "./queue/queues.js";
import { startSchedulerWorker } from "./modules/templates/scheduler.js";

const REAPER_INTERVAL_MS = Number(process.env.REAPER_INTERVAL_MS ?? 120_000);
const SHUTDOWN_TIMEOUT_MS = 25_000;

async function main() {
  validateEnv();

  await ensureDefaultUser();
  await ensureCapabilitiesAndDefaults();
  await ensurePricingDefaults();

  const manifests = await syncAgentRegistry();
  console.log(`Agent registry synced: ${manifests.map((m) => m.id).join(", ") || "(none found)"}`);

  for (const manifest of manifests) {
    wireQueueListeners(manifest.entrypoint.queueName);
  }

  const scheduler = startSchedulerWorker();

  const app = buildApp();
  const port = Number(process.env.PORT ?? 4000);
  await app.listen({ port, host: process.env.HOST ?? "0.0.0.0" });

  // Stale-workflow reaping runs on a timer, not as a side effect of GET
  // requests (which made reads slow and did writes on every dashboard poll).
  const reaper = setInterval(() => {
    reapStaleWorkflows()
      .then((n) => n > 0 && app.log.info({ reaped: n }, "reaped stale workflows"))
      .catch((err) => app.log.error({ err }, "stale workflow reaper failed"));
  }, REAPER_INTERVAL_MS);
  reaper.unref();

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, "shutting down");
    const force = setTimeout(() => {
      app.log.error("graceful shutdown timed out; exiting");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    force.unref();

    clearInterval(reaper);
    try {
      // Stop accepting requests, let the scheduler finish its in-flight run
      // (so BullMQ doesn't treat it as stalled and re-run it), then release
      // queue, Redis and DB connections.
      await app.close();
      await scheduler.close();
      await closeQueues();
      await closeRedisConnection();
      await prisma.$disconnect();
    } catch (err) {
      app.log.error({ err }, "error during shutdown");
    }
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

process.on("unhandledRejection", (reason) => {
  console.error("[agentry] unhandled promise rejection", reason);
});

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
