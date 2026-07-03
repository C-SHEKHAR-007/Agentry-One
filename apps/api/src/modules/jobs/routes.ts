import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client.js";
import { subscribeJobEvents } from "../../queue/sse.js";

export async function jobsRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>("/jobs/:id", async (req, reply) => {
    const job = await prisma.job.findUnique({ where: { id: req.params.id }, include: { runs: true } });
    if (!job) return reply.code(404).send({ error: "job_not_found" });
    return job;
  });

  app.get<{ Params: { id: string } }>("/jobs/:id/logs", async (req) => {
    const runs = await prisma.jobRun.findMany({ where: { jobId: req.params.id }, include: { logs: true } });
    return runs.flatMap((r) => r.logs);
  });

  app.get<{ Params: { id: string } }>("/jobs/:id/events", async (req, reply) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const unsubscribe = subscribeJobEvents(req.params.id, (event) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      if (event.type === "completed" || event.type === "failed") {
        reply.raw.end();
      }
    });

    req.raw.on("close", unsubscribe);
  });
}
