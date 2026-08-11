import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client.js";
import { createTemplate, runTemplate, TemplateError, updateTemplate, validateTemplateDryRun } from "./service.js";
import { addSchedule, removeSchedule } from "./scheduler.js";
import type { TemplateStepInput } from "./types.js";

interface TemplateBody {
  name: string;
  description?: string;
  steps: TemplateStepInput[];
}

export async function templatesRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>("/projects/:id/templates", async (req) =>
    prisma.template.findMany({ where: { projectId: req.params.id }, orderBy: { createdAt: "desc" } }),
  );

  app.post<{ Params: { id: string }; Body: TemplateBody }>("/projects/:id/templates", async (req, reply) => {
    try {
      const template = await createTemplate(req.params.id, req.body.name, req.body.description, req.body.steps);
      return reply.code(201).send(template);
    } catch (err) {
      if (err instanceof TemplateError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.get<{ Params: { id: string } }>("/templates/:id", async (req, reply) => {
    const template = await prisma.template.findUnique({
      where: { id: req.params.id },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
    if (!template) return reply.code(404).send({ error: "template_not_found" });
    return template;
  });

  app.put<{ Params: { id: string }; Body: TemplateBody }>("/templates/:id", async (req, reply) => {
    try {
      const template = await updateTemplate(req.params.id, req.body.name, req.body.description, req.body.steps);
      return template;
    } catch (err) {
      if (err instanceof TemplateError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.delete<{ Params: { id: string } }>("/templates/:id", async (req, reply) => {
    await prisma.template.delete({ where: { id: req.params.id } });
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string }; Body: { steps: TemplateStepInput[] } }>("/templates/:id/validate", async (req) => {
    const errors = await validateTemplateDryRun(req.body.steps);
    return { valid: errors.length === 0, errors };
  });

  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>("/templates/:id/run", async (req, reply) => {
    try {
      const run = await runTemplate(req.params.id, req.body);
      return reply.code(201).send(run);
    } catch (err) {
      if (err instanceof TemplateError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.get<{ Params: { id: string } }>("/template-runs/:id", async (req, reply) => {
    const run = await prisma.templateRun.findUnique({
      where: { id: req.params.id },
      include: { steps: { include: { templateStep: true }, orderBy: { createdAt: "asc" } } },
    });
    if (!run) return reply.code(404).send({ error: "template_run_not_found" });
    return run;
  });

  app.post<{ Params: { id: string } }>("/template-runs/:id/cancel", async (req, reply) => {
    await prisma.templateRun.update({ where: { id: req.params.id }, data: { status: "cancelling" } });
    return reply.code(202).send({ status: "cancelling" });
  });

  app.post<{ Params: { id: string }; Body: { cronExpr: string; runInputs: Record<string, unknown> } }>(
    "/templates/:id/schedule",
    async (req, reply) => {
      const { cronExpr, runInputs } = req.body;
      const schedule = await addSchedule(req.params.id, cronExpr, runInputs);
      return reply.code(201).send(schedule);
    }
  );

  app.delete<{ Params: { id: string } }>("/schedules/:id", async (req, reply) => {
    await removeSchedule(req.params.id);
    return reply.code(204).send();
  });
}
