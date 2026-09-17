import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client.js";
import { getQueue } from "../../queue/queues.js";
import { advanceStep, reapStaleWorkflows, startWorkflow, WorkflowError } from "./service.js";
import { generateReadSasUrl } from "../artifacts/azureClient.js";

export async function workflowsRoutes(app: FastifyInstance) {
  app.post("/workflows/reap-stale", async () => {
    const reaped = await reapStaleWorkflows();
    return { reaped };
  });

  app.post<{ Params: { id: string }; Body: { agentId: string; input: unknown; providerConfigId?: string } }>(
    "/projects/:id/workflows",
    async (req, reply) => {
      try {
        const workflow = await startWorkflow(req.params.id, req.body.agentId, req.body.input, {
          providerConfigId: req.body.providerConfigId,
        });
        const steps = await prisma.workflowStep.findMany({ where: { workflowId: workflow.id }, orderBy: { sequence: "asc" } });
        return reply.code(201).send({ ...workflow, steps });
      } catch (err) {
        if (err instanceof WorkflowError) return reply.code(err.statusCode).send({ error: err.message });
        throw err;
      }
    },
  );

  // Cross-project listing for the dashboard/executions views. The static
  // "recent" segment wins over the :id param route in Fastify's router.
  app.get<{ Querystring: { limit?: string; status?: string } }>(
    "/workflows/recent",
    async (req) => {
      // Auto-reap stale or orphaned executions when viewing executions
      if (!req.query.status || req.query.status === "running") {
        await reapStaleWorkflows();
      }

      const limit = Math.min(Number(req.query.limit ?? 10) || 10, 100);
      const workflows = await prisma.workflow.findMany({
        where: req.query.status ? { status: req.query.status } : undefined,
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          project: { select: { id: true, name: true } },
          agent: { select: { name: true } },
          steps: {
            orderBy: { sequence: "asc" },
            include: {
              job: { select: { runs: { select: { startedAt: true, finishedAt: true, status: true } } } },
              artifacts: {
                where: { mimeType: { startsWith: "image/" } },
                orderBy: { createdAt: "asc" },
                take: 1,
                select: { id: true, storageKey: true, mimeType: true },
              },
            },
          },
        },
      });

      return Promise.all(
        workflows.map(async (w) => {
          let durationMs: number | null = null;
          const runs = w.steps.flatMap((s) => s.job?.runs ?? []);
          const started = runs.map((r) => r.startedAt).filter(Boolean) as Date[];
          const finished = runs
            .filter((r) => r.status === "completed" || r.status === "failed")
            .map((r) => r.finishedAt)
            .filter(Boolean) as Date[];
          if (started.length && finished.length) {
            durationMs =
              Math.max(...finished.map((d) => d.getTime())) -
              Math.min(...started.map((d) => d.getTime()));
            if (durationMs < 0) durationMs = null;
          }
          const thumb = w.steps.flatMap((s) => s.artifacts)[0];
          const thumbArtifactId = thumb?.id ?? null;
          let thumbPreviewUrl: string | null = null;
          if (thumb) {
            const blobName = thumb.storageKey.replace(/^azure:\/\//, "");
            const res = await generateReadSasUrl(blobName, {
              mode: "preview",
              mimeType: thumb.mimeType,
              expiresInMinutes: 120,
            });
            thumbPreviewUrl = res.url;
          }
          return {
            id: w.id,
            agentId: w.agentId,
            agentName: w.agent.name,
            agentVersion: w.agentVersion,
            status: w.status,
            createdAt: w.createdAt,
            updatedAt: w.updatedAt,
            project: w.project,
            durationMs,
            thumbArtifactId,
            thumbPreviewUrl,
          };
        }),
      );
    },
  );

  app.get<{ Params: { id: string } }>("/workflows/:id", async (req, reply) => {
    const workflow = await prisma.workflow.findUnique({
      where: { id: req.params.id },
      include: { steps: { orderBy: { sequence: "asc" }, include: { job: true, artifacts: true } } },
    });
    if (!workflow) return reply.code(404).send({ error: "workflow_not_found" });

    const stepsWithUrls = await Promise.all(
      workflow.steps.map(async (step) => ({
        ...step,
        artifacts: await Promise.all(
          step.artifacts.map(async (a) => {
            const blobName = a.storageKey.replace(/^azure:\/\//, "");
            const [preview, download] = await Promise.all([
              generateReadSasUrl(blobName, { mode: "preview", mimeType: a.mimeType, expiresInMinutes: 120 }),
              generateReadSasUrl(blobName, {
                mode: "download",
                mimeType: a.mimeType,
                fileName: `${a.kind}-${a.id.slice(0, 8)}`,
                expiresInMinutes: 120,
              }),
            ]);
            return { ...a, previewUrl: preview.url, downloadUrl: download.url };
          }),
        ),
      })),
    );
    return { ...workflow, steps: stepsWithUrls };
  });

  app.get<{ Params: { id: string } }>("/workflows/:id/steps", async (req) =>
    prisma.workflowStep.findMany({ where: { workflowId: req.params.id }, orderBy: { sequence: "asc" } }),
  );

  app.post<{ Params: { id: string; stepKey: string }; Body: unknown }>(
    "/workflows/:id/steps/:stepKey/advance",
    async (req, reply) => {
      try {
        const job = await advanceStep(req.params.id, req.params.stepKey, req.body);
        return reply.code(202).send({ stepKey: req.params.stepKey, status: "queued", jobId: job.id });
      } catch (err) {
        if (err instanceof WorkflowError) return reply.code(err.statusCode).send({ error: err.message });
        throw err;
      }
    },
  );

  app.post<{ Params: { id: string } }>("/workflows/:id/cancel", async (req, reply) => {
    const workflow = await prisma.workflow.findUnique({
      where: { id: req.params.id },
      include: { steps: { include: { job: true } }, agent: true },
    });
    if (!workflow) return reply.code(404).send({ error: "workflow_not_found" });

    let removedQueued = 0;
    let stillRunning = false;

    try {
      const manifest = workflow.agent?.manifest as { entrypoint?: { queueName?: string } };
      const queueName = manifest?.entrypoint?.queueName;
      if (queueName) {
        const queue = getQueue(queueName);
        for (const step of workflow.steps) {
          if (step.job?.id) {
            const bullJob = await queue.getJob(step.job.id);
            const state = bullJob ? await bullJob.getState() : null;
            if (bullJob && (state === "waiting" || state === "delayed" || state === "prioritized")) {
              await bullJob.remove();
              await prisma.job.update({ where: { id: step.job.id }, data: { status: "cancelled" } });
              await prisma.workflowStep.update({ where: { id: step.id }, data: { status: "failed" } });
              removedQueued++;
            } else if (state === "active") {
              stillRunning = true;
            }
          }
        }
      }
    } catch {
      // queue access error
    }

    const status = stillRunning ? "cancelling" : "cancelled";
    await prisma.workflow.update({ where: { id: req.params.id }, data: { status } });
    if (status === "cancelled") {
      for (const s of workflow.steps) {
        if (["running", "queued", "pending"].includes(s.status)) {
          await prisma.workflowStep.update({ where: { id: s.id }, data: { status: "failed" } });
        }
      }
      await prisma.event.create({
        data: {
          workflowId: workflow.id,
          type: "workflow.cancelled",
          payload: { cancelledAt: new Date() },
        },
      });
      try {
        const { handleWorkflowSettled } = await import("../templates/service.js");
        await handleWorkflowSettled(workflow.id, "failed");
      } catch {}
    }
    return reply.code(202).send({ status, removedQueued });
  });
}
