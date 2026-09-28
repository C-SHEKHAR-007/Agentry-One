import type { FastifyInstance } from "fastify";
import { createContentBriefTemplate, ContentBriefError } from "./quickStart.js";
import { authorize } from "../../auth/access.js";
import { WorkflowError } from "../workflows/service.js";
import { TemplateError } from "../templates/service.js";
import { nonEmpty, parse, z } from "../../http/validate.js";

const BriefBody = z.object({
  topic: nonEmpty(2000),
  tone: z.string().max(200).optional(),
  formats: z.array(z.string().max(50)).min(1).max(10),
  socialAccountId: z.string().uuid().optional(),
});

export async function contentBriefsRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>(
    "/projects/:id/briefs",
    async (req, reply) => {
      const body = parse(BriefBody, req.body);
      if (!(await authorize(req, reply, "project", req.params.id))) return;
      try {
        const result = await createContentBriefTemplate(req.params.id, body.topic, body.tone, body.formats, body.socialAccountId);
        return reply.code(201).send(result);
      } catch (err) {
        if (err instanceof ContentBriefError || err instanceof TemplateError || err instanceof WorkflowError) {
          return reply.code(err.statusCode).send({ error: err.message });
        }
        throw err;
      }
    },
  );
}
