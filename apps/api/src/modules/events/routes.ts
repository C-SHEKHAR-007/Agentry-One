import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client.js";
import { authorize, viaProject } from "../../auth/access.js";

export async function eventsRoutes(app: FastifyInstance) {
  // Recent activity feed. job.progress is written once per progress tick and
  // would drown everything else, so it is excluded here.
  app.get<{ Querystring: { limit?: string; projectId?: string } }>("/events", async (req) => {
    const limit = Math.min(Number(req.query.limit ?? 20) || 20, 100);
    const events = await prisma.event.findMany({
      where: {
        type: { not: "job.progress" },
        // Only workflow-attached events can be attributed to a project, so a
        // scoped caller sees exactly the events of their own workflows.
        workflow: { ...viaProject(req), ...(req.query.projectId ? { projectId: req.query.projectId } : {}) },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        workflow: {
          select: {
            agentId: true,
            projectId: true,
            project: { select: { name: true } },
          },
        },
      },
    });
    return events.map((e) => ({
      id: e.id,
      type: e.type,
      createdAt: e.createdAt,
      workflowId: e.workflowId,
      jobId: e.jobId,
      agentId: e.workflow?.agentId ?? null,
      projectId: e.workflow?.projectId ?? null,
      projectName: e.workflow?.project?.name ?? null,
    }));
  });

  // Chronological timeline for one workflow. job-level events (job.progress,
  // job.failed) carry only jobId with a null workflowId, so the filter has to
  // union both paths to the workflow.
  app.get<{ Params: { id: string } }>("/workflows/:id/events", async (req, reply) => {
    if (!(await authorize(req, reply, "workflow", req.params.id))) return;
    const events = await prisma.event.findMany({
      where: {
        OR: [
          { workflowId: req.params.id },
          { job: { workflowStep: { workflowId: req.params.id } } },
        ],
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, type: true, payload: true, createdAt: true, jobId: true },
    });
    return events;
  });
}
