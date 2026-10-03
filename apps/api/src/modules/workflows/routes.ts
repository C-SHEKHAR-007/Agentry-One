import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client.js";
import { getQueue } from "../../queue/queues.js";
import { advanceStep, reapStaleWorkflows, startWorkflow, WorkflowError } from "./service.js";
import { artifactUrl, withArtifactUrls } from "../artifacts/urls.js";
import { authorize, requireAdmin, viaProject } from "../../auth/access.js";
import { nonEmpty, parse, z } from "../../http/validate.js";
import { NEWEST_FIRST, pageQuery, toPage } from "../../http/paging.js";

const StartWorkflowBody = z.object({
  agentId: nonEmpty(100),
  input: z.unknown().optional(),
  providerConfigId: z.string().uuid().optional(),
});

const TERMINAL = ["completed", "failed", "cancelled"];

export async function workflowsRoutes(app: FastifyInstance) {
  app.post("/workflows/reap-stale", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const reaped = await reapStaleWorkflows();
    return { reaped };
  });

  app.post<{ Params: { id: string } }>(
    "/projects/:id/workflows",
    async (req, reply) => {
      const body = parse(StartWorkflowBody, req.body);
      if (!(await authorize(req, reply, "project", req.params.id))) return;
      try {
        const workflow = await startWorkflow(req.params.id, body.agentId, body.input ?? {}, {
          providerConfigId: body.providerConfigId,
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
  app.get<{ Querystring: { limit?: string; status?: string; paged?: string; cursor?: string } }>(
    "/workflows/recent",
    async (req) => {
      const limit = Math.min(Number(req.query.limit ?? 10) || 10, 100);
      const page = pageQuery(req.query);
      const rows = await prisma.workflow.findMany({
        where: { AND: [{ ...viaProject(req), ...(req.query.status ? { status: req.query.status } : {}) }, page.where] },
        orderBy: NEWEST_FIRST,
        take: page.take(limit),
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

      const { items: workflows, nextCursor } = toPage(rows, limit);
      const summaries = await Promise.all(
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
          const thumbPreviewUrl = thumb ? await artifactUrl({ ...thumb, kind: "image" }, "preview") : null;
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
      return page.paged ? { items: summaries, nextCursor } : summaries;
    },
  );

  app.get<{ Params: { id: string } }>("/workflows/:id", async (req, reply) => {
    if (!(await authorize(req, reply, "workflow", req.params.id))) return;
    const workflow = await prisma.workflow.findUnique({
      where: { id: req.params.id },
      include: {
        project: { select: { id: true, name: true } },
        agent: { select: { id: true, name: true, description: true } },
        steps: {
          orderBy: { sequence: "asc" },
          include: {
            // Attempts carry timings and the failure reason, so the page can
            // say *why* a run failed rather than just that it did.
            job: { include: { runs: { orderBy: { attemptNumber: "asc" } } } },
            artifacts: true,
          },
        },
      },
    });
    if (!workflow) return reply.code(404).send({ error: "workflow_not_found" });

    // Runs started by a multi-step workflow link back to it.
    const parent = await prisma.templateRunStep.findFirst({
      where: { workflowId: workflow.id },
      select: { templateRun: { select: { id: true, template: { select: { id: true, name: true } } } } },
    });

    const stepsWithUrls = await Promise.all(
      workflow.steps.map(async (step) => ({
        ...step,
        artifacts: await Promise.all(step.artifacts.map(withArtifactUrls)),
      })),
    );
    return {
      ...workflow,
      steps: stepsWithUrls,
      templateRun: parent ? { id: parent.templateRun.id, templateId: parent.templateRun.template.id, templateName: parent.templateRun.template.name } : null,
    };
  });

  // Every attempt's log lines, oldest first: attempt starts, progress
  // messages, worker log calls and completion/failure summaries.
  app.get<{ Params: { id: string } }>("/workflows/:id/logs", async (req, reply) => {
    if (!(await authorize(req, reply, "workflow", req.params.id))) return;
    const logs = await prisma.log.findMany({
      where: { jobRun: { job: { workflowStep: { workflowId: req.params.id } } } },
      orderBy: { createdAt: "asc" },
      take: 2000,
      select: { id: true, level: true, message: true, createdAt: true, jobRun: { select: { id: true, attemptNumber: true } } },
    });
    return logs.map((l) => ({
      id: l.id,
      level: l.level,
      message: l.message,
      createdAt: l.createdAt,
      jobRunId: l.jobRun.id,
      attemptNumber: l.jobRun.attemptNumber,
    }));
  });

  app.get<{ Params: { id: string } }>("/workflows/:id/steps", async (req, reply) => {
    if (!(await authorize(req, reply, "workflow", req.params.id))) return;
    return prisma.workflowStep.findMany({ where: { workflowId: req.params.id }, orderBy: { sequence: "asc" } });
  });

  app.post<{ Params: { id: string; stepKey: string }; Body: unknown }>(
    "/workflows/:id/steps/:stepKey/advance",
    async (req, reply) => {
      if (!(await authorize(req, reply, "workflow", req.params.id))) return;
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
    if (!(await authorize(req, reply, "workflow", req.params.id))) return;
    const workflow = await prisma.workflow.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { steps: { include: { job: true } }, agent: true },
    });
    // Finished workflows keep their history; cancelling them is a no-op.
    if (TERMINAL.includes(workflow.status)) {
      return reply.code(409).send({ error: `workflow is already ${workflow.status}` });
    }

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
    // Conditional: a worker may have finished the workflow while we were
    // inspecting the queue -- don't overwrite that outcome.
    const { count } = await prisma.workflow.updateMany({
      where: { id: req.params.id, status: { notIn: TERMINAL } },
      data: { status },
    });
    if (count === 0) return reply.code(409).send({ error: "workflow finished before it could be cancelled" });
    if (status === "cancelled") {
      for (const s of workflow.steps) {
        if (["running", "queued", "pending", "awaiting_review"].includes(s.status)) {
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
