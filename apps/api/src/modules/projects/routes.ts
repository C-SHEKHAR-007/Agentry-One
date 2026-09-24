import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client.js";
import { getDefaultUserId } from "./defaultUser.js";
import { artifactUrl } from "../artifacts/urls.js";
import { Prisma } from "@prisma/client";
import { authorize, projectWhere } from "../../auth/access.js";
import { nonEmpty, parse, z } from "../../http/validate.js";

const ProjectBody = z.object({ name: nonEmpty(120) });

export async function projectsRoutes(app: FastifyInstance) {
  app.get("/projects", async (req) => {
    const projects = await prisma.project.findMany({
      where: projectWhere(req),
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { workflows: true, templates: true } } },
    });
    const ids = projects.map((p) => p.id);
    if (ids.length === 0) return [];
    const [activity, artifactRows] = await Promise.all([
      // Project has no updatedAt column; derive last activity from its
      // workflows instead of changing the schema.
      prisma.workflow.groupBy({ by: ["projectId"], where: { projectId: { in: ids } }, _max: { updatedAt: true } }),
      // Artifact count + latest image artifact per project in one pass
      // (artifacts hang off workflow_steps, not projects directly).
      prisma.$queryRaw<
        {
          project_id: string;
          artifact_count: bigint;
          cover_artifact_id: string | null;
          cover_storage_key: string | null;
          cover_mime_type: string | null;
        }[]
      >`
        SELECT w.project_id,
               COUNT(a.id)::bigint AS artifact_count,
               (ARRAY_AGG(a.id ORDER BY a.created_at DESC)
                  FILTER (WHERE a.mime_type LIKE 'image/%'))[1] AS cover_artifact_id,
               (ARRAY_AGG(a.storage_key ORDER BY a.created_at DESC)
                  FILTER (WHERE a.mime_type LIKE 'image/%'))[1] AS cover_storage_key,
               (ARRAY_AGG(a.mime_type ORDER BY a.created_at DESC)
                  FILTER (WHERE a.mime_type LIKE 'image/%'))[1] AS cover_mime_type
        FROM artifacts a
        JOIN workflow_steps ws ON ws.id = a.workflow_step_id
        JOIN workflows w ON w.id = ws.workflow_id
        WHERE w.project_id IN (${Prisma.join(ids)})
        GROUP BY w.project_id`,
    ]);

    const activityByProject = new Map(activity.map((a) => [a.projectId, a._max.updatedAt]));
    const artifactsByProject = new Map(artifactRows.map((r) => [r.project_id, r]));

    return Promise.all(
      projects.map(async ({ _count, ...p }) => {
        const art = artifactsByProject.get(p.id);
        const coverPreviewUrl =
          art?.cover_artifact_id && art.cover_storage_key
            ? await artifactUrl(
                { id: art.cover_artifact_id, kind: "image", storageKey: art.cover_storage_key, mimeType: art.cover_mime_type || "image/png" },
                "preview",
              )
            : null;
        return {
          ...p,
          counts: {
            workflows: _count.workflows,
            templates: _count.templates,
            artifacts: art ? Number(art.artifact_count) : 0,
          },
          lastActivityAt: activityByProject.get(p.id) ?? null,
          coverArtifactId: art?.cover_artifact_id ?? null,
          coverPreviewUrl,
        };
      }),
    );
  });

  app.post("/projects", async (req, reply) => {
    const { name } = parse(ProjectBody, req.body);
    // Session users own their projects; API-key callers fall back to the
    // pre-auth stub user.
    const userId = req.principal?.kind === "user" ? req.principal.user.id : getDefaultUserId();
    const project = await prisma.project.create({
      data: { name, userId },
    });
    
    await prisma.notification.create({
      data: {
        userId,
        type: "success",
        title: "Project Created",
        message: `Project "${name}" was created successfully.`,
        link: `/projects/${project.id}`
      }
    });
    
    return reply.code(201).send(project);
  });

  app.get<{ Params: { id: string } }>("/projects/:id", async (req, reply) => {
    if (!(await authorize(req, reply, "project", req.params.id))) return;
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return reply.code(404).send({ error: "project_not_found" });
    return project;
  });

  app.patch<{ Params: { id: string } }>("/projects/:id", async (req, reply) => {
    const { name } = parse(ProjectBody, req.body);
    if (!(await authorize(req, reply, "project", req.params.id))) return;
    return prisma.project.update({ where: { id: req.params.id }, data: { name } });
  });

  app.delete<{ Params: { id: string } }>("/projects/:id", async (req, reply) => {
    if (!(await authorize(req, reply, "project", req.params.id))) return;
    await prisma.project.delete({ where: { id: req.params.id } });
    return reply.code(204).send();
  });
}
