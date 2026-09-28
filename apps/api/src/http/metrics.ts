import type { FastifyInstance } from "fastify";
import client from "prom-client";
import { requireAdmin } from "../auth/access.js";
import { getQueue } from "../queue/queues.js";

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry, prefix: "agentry_" });

const httpDuration = new client.Histogram({
  name: "agentry_http_request_duration_seconds",
  help: "HTTP request latency by route and status",
  labelNames: ["method", "route", "status"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const jobOutcomes = new client.Counter({
  name: "agentry_jobs_finished_total",
  help: "Agent jobs that reached a terminal state, by queue and outcome",
  labelNames: ["queue", "outcome"] as const,
  registers: [registry],
});

const trackedQueues = new Set<string>();
/** Queues whose depth is exported (every wired agent queue). */
export function trackQueue(queueName: string): void {
  trackedQueues.add(queueName);
}

new client.Gauge({
  name: "agentry_queue_jobs",
  help: "Jobs per BullMQ queue and state (sampled at scrape time)",
  labelNames: ["queue", "state"] as const,
  registers: [registry],
  async collect() {
    this.reset();
    await Promise.all(
      [...trackedQueues].map(async (name) => {
        try {
          const counts = await getQueue(name).getJobCounts("waiting", "active", "delayed", "failed", "prioritized");
          for (const [state, n] of Object.entries(counts)) this.set({ queue: name, state }, n);
        } catch {
          /* Redis unavailable: /health reports it; skip this sample */
        }
      }),
    );
  },
});

/** Request metrics for every route, plus an admin-only /metrics endpoint for
 * Prometheus (send the API key as X-API-Key). */
export function registerMetrics(app: FastifyInstance): void {
  app.addHook("onResponse", async (req, reply) => {
    // routeOptions.url is the route pattern (/workflows/:id), keeping label
    // cardinality bounded; unmatched requests share one label.
    const route = req.routeOptions?.url ?? "unmatched";
    httpDuration.observe({ method: req.method, route, status: String(reply.statusCode) }, reply.elapsedTime / 1000);
  });

  app.get("/metrics", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    reply.header("Content-Type", registry.contentType);
    return registry.metrics();
  });
}
