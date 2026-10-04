import type { FastifyInstance } from "fastify";
import { activityEmitter, prisma, type ActivitySignal } from "../../db/client.js";
import { authorize, scopedUserId, viaProject } from "../../auth/access.js";
import { openSse } from "../../http/sse.js";
import { NEWEST_FIRST, pageQuery, toPage } from "../../http/paging.js";

function eventSummary(type: string, payload: unknown): Record<string, unknown> | null {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const pick = (...keys: string[]) => Object.fromEntries(keys.filter((k) => p[k] !== undefined && p[k] !== null).map((k) => [k, p[k]]));
  if (type === "job.failed") return { failedReason: typeof p.failedReason === "string" ? p.failedReason.slice(0, 300) : null, ...pick("attemptNumber") };
  if (type === "job.completed") return pick("durationMs", "model", "inputTokens", "outputTokens", "costUsd", "artifacts", "attemptNumber");
  if (type === "job.started") return pick("attemptNumber", "model");
  return null;
}

export async function eventsRoutes(app: FastifyInstance) {
  // Push, not poll: live pages (dashboard, runs) keep one stream open and
  // refetch only when something actually happened. Signals carry just the
  // event type; a scoped (non-admin) caller only hears about their own
  // projects' workflows.
  app.get("/events/stream", async (req, reply) => {
    const userId = scopedUserId(req);
    const stream = openSse(req, reply);
    const owners = new Map<string, string | null>();
    const ownerOf = async (workflowId: string) => {
      if (!owners.has(workflowId)) {
        const wf = await prisma.workflow.findUnique({ where: { id: workflowId }, select: { project: { select: { userId: true } } } });
        owners.set(workflowId, wf?.project.userId ?? null);
        if (owners.size > 500) owners.delete(owners.keys().next().value!);
      }
      return owners.get(workflowId);
    };
    const onActivity = (signal: ActivitySignal) => {
      if (!userId) return stream.send({ type: signal.type });
      if (!signal.workflowId) return;
      ownerOf(signal.workflowId)
        .then((owner) => owner === userId && stream.send({ type: signal.type }))
        .catch(() => {});
    };
    activityEmitter.on("activity", onActivity);
    stream.onClose(() => activityEmitter.off("activity", onActivity));
  });

  // Recent activity feed. job.progress is written once per progress tick and
  // would drown everything else, so it is excluded here.
  app.get<{ Querystring: { limit?: string; projectId?: string; paged?: string; cursor?: string } }>("/events", async (req) => {
    const limit = Math.min(Number(req.query.limit ?? 20) || 20, 100);
    const page = pageQuery(req.query);
    const rows = await prisma.event.findMany({
      where: {
        ...page.where,
        type: { not: "job.progress" },
        // Only workflow-attached events can be attributed to a project, so a
        // scoped caller sees exactly the events of their own workflows.
        workflow: { ...viaProject(req), ...(req.query.projectId ? { projectId: req.query.projectId } : {}) },
      },
      orderBy: NEWEST_FIRST,
      take: page.take(limit),
      include: {
        workflow: {
          select: {
            agentId: true,
            projectId: true,
            agent: { select: { name: true } },
            project: { select: { name: true } },
          },
        },
      },
    });
    const { items: events, nextCursor } = toPage(rows, limit);
    const out = events.map((e) => ({
      id: e.id,
      type: e.type,
      createdAt: e.createdAt,
      workflowId: e.workflowId,
      jobId: e.jobId,
      agentId: e.workflow?.agentId ?? null,
      agentName: e.workflow?.agent?.name ?? null,
      // Small, display-only details: failure reason, duration, model, tokens.
      payload: eventSummary(e.type, e.payload),
      projectId: e.workflow?.projectId ?? null,
      projectName: e.workflow?.project?.name ?? null,
    }));
    return page.paged ? { items: out, nextCursor } : out;
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
