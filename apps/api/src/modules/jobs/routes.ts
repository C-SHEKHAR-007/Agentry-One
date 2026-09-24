import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client.js";
import { subscribeJobEvents } from "../../queue/sse.js";
import { authorize } from "../../auth/access.js";
import { openSse } from "../../http/sse.js";
import { providerSecret } from "../providers/resolve.js";
import { decryptSocialAccountToken } from "../socialAccounts/routes.js";

const TERMINAL_JOB = ["completed", "failed", "cancelled"];

export async function jobsRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>("/jobs/:id", async (req, reply) => {
    if (!(await authorize(req, reply, "job", req.params.id))) return;
    return prisma.job.findUniqueOrThrow({ where: { id: req.params.id }, include: { runs: true } });
  });

  app.get<{ Params: { id: string } }>("/jobs/:id/logs", async (req, reply) => {
    if (!(await authorize(req, reply, "job", req.params.id))) return;
    const runs = await prisma.jobRun.findMany({ where: { jobId: req.params.id }, include: { logs: true } });
    return runs.flatMap((r) => r.logs);
  });

  app.get<{ Params: { id: string } }>("/jobs/:id/events", async (req, reply) => {
    if (!(await authorize(req, reply, "job", req.params.id))) return;
    const job = await prisma.job.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { runs: { orderBy: { attemptNumber: "desc" }, take: 1 } },
    });

    const stream = openSse(req, reply);
    // Replay current state first: a client that subscribes after the job
    // already finished would otherwise wait forever for an event.
    if (job.status === "completed" || job.status === "failed") {
      stream.send({ type: job.status });
      stream.close();
      return;
    }
    const latest = job.runs[0];
    if (latest?.progressPercent != null) {
      stream.send({ type: "progress", percent: latest.progressPercent, message: latest.progressMessage });
    }

    const unsubscribe = subscribeJobEvents(req.params.id, (event) => {
      stream.send(event);
      if (event.type === "completed" || event.type === "failed") stream.close();
    });
    stream.onClose(unsubscribe);
  });

  /** Worker-only: the decrypted credentials a live job needs. Secrets are
   * deliberately absent from the Redis job payload (see enqueueStepJob); a
   * worker fetches them here at run time. Only the API key may call this,
   * and only while the job is still live. */
  app.get<{ Params: { id: string } }>("/internal/jobs/:id/secrets", async (req, reply) => {
    if (req.principal?.kind !== "apiKey") return reply.code(403).send({ error: "worker credentials required" });
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: { workflowStep: { select: { workflow: { select: { projectId: true } } } } },
    });
    if (!job) return reply.code(404).send({ error: "job_not_found" });
    if (TERMINAL_JOB.includes(job.status)) return reply.code(410).send({ error: "job is no longer running" });

    const apiKey = job.providerConfigId ? await providerSecret(job.providerConfigId) : null;
    const socialAccountId = (job.params as { socialAccountId?: string } | null)?.socialAccountId;
    const social = socialAccountId
      ? await decryptSocialAccountToken(socialAccountId, job.workflowStep.workflow.projectId)
      : null;

    reply.header("Cache-Control", "no-store");
    return { apiKey, socialAccessToken: social?.accessToken ?? null };
  });
}
