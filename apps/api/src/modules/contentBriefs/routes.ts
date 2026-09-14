import type { FastifyInstance } from "fastify";
import { createContentBriefTemplate, ContentBriefError } from "./quickStart.js";

export async function contentBriefsRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string }; Body: { topic: string; tone?: string; formats: string[]; socialAccountId?: string } }>(
    "/projects/:id/briefs",
    async (req, reply) => {
      try {
        const result = await createContentBriefTemplate(
          req.params.id,
          req.body.topic,
          req.body.tone,
          req.body.formats,
          req.body.socialAccountId,
        );
        return reply.code(201).send(result);
      } catch (err) {
        if (err instanceof ContentBriefError) return reply.code(err.statusCode).send({ error: err.message });
        throw err;
      }
    },
  );
}
