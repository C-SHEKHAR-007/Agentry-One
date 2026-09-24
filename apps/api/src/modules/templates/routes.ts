import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client.js";
import { createTemplate, handleWorkflowSettled, runTemplate, TemplateError, updateTemplate, validateTemplateDryRun } from "./service.js";
import { addSchedule, removeSchedule, ScheduleError } from "./scheduler.js";
import type { TemplateStepInput } from "./types.js";
import { authorize } from "../../auth/access.js";
import { WorkflowError } from "../workflows/service.js";
import { nonEmpty, parse, z } from "../../http/validate.js";

const TemplateBodySchema = z.object({
  name: nonEmpty(200),
  description: z.string().max(2000).optional(),
  steps: z.array(z.any()).min(1).max(50),
});

const ScheduleBody = z.object({
  cronExpr: nonEmpty(120),
  runInputs: z.record(z.unknown()).default({}),
});

/** Maps domain errors thrown by template/workflow services to HTTP replies. */
function domainError(err: unknown): { statusCode: number; message: string } | null {
  if (err instanceof TemplateError || err instanceof WorkflowError || err instanceof ScheduleError) {
    return { statusCode: err.statusCode, message: err.message };
  }
  return null;
}

interface TemplateBody {
  name: string;
  description?: string;
  steps: TemplateStepInput[];
}

export async function templatesRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>("/projects/:id/templates", async (req, reply) => {
    if (!(await authorize(req, reply, "project", req.params.id))) return;
    return prisma.template.findMany({ where: { projectId: req.params.id }, orderBy: { createdAt: "desc" } });
  });

  app.post<{ Params: { id: string }; Body: TemplateBody }>("/projects/:id/templates", async (req, reply) => {
    const body = parse(TemplateBodySchema, req.body);
    if (!(await authorize(req, reply, "project", req.params.id))) return;
    try {
      const template = await createTemplate(req.params.id, body.name, body.description, body.steps as TemplateStepInput[]);
      return reply.code(201).send(template);
    } catch (err) {
      const e = domainError(err);
      if (e) return reply.code(e.statusCode).send({ error: e.message });
      throw err;
    }
  });

  app.get<{ Params: { id: string } }>("/templates/:id", async (req, reply) => {
    if (!(await authorize(req, reply, "template", req.params.id))) return;
    const template = await prisma.template.findUnique({
      where: { id: req.params.id },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
    if (!template) return reply.code(404).send({ error: "template_not_found" });
    return template;
  });

  app.put<{ Params: { id: string }; Body: TemplateBody }>("/templates/:id", async (req, reply) => {
    const body = parse(TemplateBodySchema, req.body);
    if (!(await authorize(req, reply, "template", req.params.id))) return;
    try {
      const template = await updateTemplate(req.params.id, body.name, body.description, body.steps as TemplateStepInput[]);
      return template;
    } catch (err) {
      const e = domainError(err);
      if (e) return reply.code(e.statusCode).send({ error: e.message });
      throw err;
    }
  });

  app.delete<{ Params: { id: string } }>("/templates/:id", async (req, reply) => {
    if (!(await authorize(req, reply, "template", req.params.id))) return;
    // Stop its recurring triggers before the cascade removes the schedule rows.
    const schedules = await prisma.workflowSchedule.findMany({ where: { templateId: req.params.id }, select: { id: true } });
    for (const sch of schedules) await removeSchedule(sch.id);
    await prisma.template.delete({ where: { id: req.params.id } });
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string }; Body: { steps: TemplateStepInput[] } }>("/templates/:id/validate", async (req, reply) => {
    const { steps } = parse(z.object({ steps: z.array(z.any()).max(50) }), req.body);
    if (!(await authorize(req, reply, "template", req.params.id))) return;
    const errors = await validateTemplateDryRun(steps as TemplateStepInput[]);
    return { valid: errors.length === 0, errors };
  });

  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>("/templates/:id/run", async (req, reply) => {
    const inputs = parse(z.record(z.unknown()), req.body);
    if (!(await authorize(req, reply, "template", req.params.id))) return;
    try {
      const run = await runTemplate(req.params.id, inputs);
      return reply.code(201).send(run);
    } catch (err) {
      const e = domainError(err);
      if (e) return reply.code(e.statusCode).send({ error: e.message });
      throw err;
    }
  });

  app.get<{ Params: { id: string } }>("/template-runs/:id", async (req, reply) => {
    if (!(await authorize(req, reply, "templateRun", req.params.id))) return;
    let run = await prisma.templateRun.findUnique({
      where: { id: req.params.id },
      include: {
        steps: {
          include: { templateStep: true, workflow: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!run) return reply.code(404).send({ error: "template_run_not_found" });

    // Self-healing: if any step's linked workflow has settled but the templateRunStep is still unsynced
    let didSync = false;
    for (const step of run.steps) {
      if (
        step.workflowId &&
        step.workflow &&
        ["completed", "failed", "awaiting_review"].includes(step.workflow.status) &&
        step.status !== step.workflow.status
      ) {
        await handleWorkflowSettled(step.workflowId, step.workflow.status as any);
        didSync = true;
      }
    }

    if (didSync) {
      run = await prisma.templateRun.findUnique({
        where: { id: req.params.id },
        include: {
          steps: {
            include: { templateStep: true, workflow: true },
            orderBy: { createdAt: "asc" },
          },
        },
      });
    }

    return run;
  });

  app.post<{ Params: { id: string } }>("/template-runs/:id/cancel", async (req, reply) => {
    if (!(await authorize(req, reply, "templateRun", req.params.id))) return;
    await prisma.templateRun.update({ where: { id: req.params.id }, data: { status: "cancelling" } });
    return reply.code(202).send({ status: "cancelling" });
  });

  app.get<{ Params: { id: string } }>("/templates/:id/schedules", async (req, reply) => {
    if (!(await authorize(req, reply, "template", req.params.id))) return;
    return prisma.workflowSchedule.findMany({ where: { templateId: req.params.id }, orderBy: { createdAt: "desc" } });
  });

  app.post<{ Params: { id: string } }>("/templates/:id/schedule", async (req, reply) => {
    const { cronExpr, runInputs } = parse(ScheduleBody, req.body);
    if (!(await authorize(req, reply, "template", req.params.id))) return;
    try {
      const schedule = await addSchedule(req.params.id, cronExpr, runInputs);
      return reply.code(201).send(schedule);
    } catch (err) {
      const e = domainError(err);
      if (e) return reply.code(e.statusCode).send({ error: e.message });
      throw err;
    }
  });

  app.delete<{ Params: { id: string } }>("/schedules/:id", async (req, reply) => {
    if (!(await authorize(req, reply, "schedule", req.params.id))) return;
    await removeSchedule(req.params.id);
    return reply.code(204).send();
  });
}
