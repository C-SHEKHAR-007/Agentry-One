import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client.js";
import { getRedisConnection } from "../../queue/connection.js";
import {
  buildAgentStats,
  buildDailySeries,
  computeCosts,
  computeRunStats,
  estimateCostSavedUsd,
  fillDaySeries,
  type AgentGroupRow,
  type AgentRunSample,
  type CostRow,
  type DailyStatusRow,
  type DayCount,
} from "./service.js";

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfDay(offsetDays = 0): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d;
}

export async function statsRoutes(app: FastifyInstance) {
  app.get("/stats/overview", async () => {
    const today = startOfDay();
    const yesterday = startOfDay(-1);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      agentsTotal,
      workflowGroups,
      activeJobs,
      completedToday,
      failedToday,
      completedYesterday,
      recentRuns,
      artifactsTotal,
      completedAllTime,
      perDayRows,
    ] = await Promise.all([
      prisma.agent.count(),
      prisma.workflow.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.job.count({ where: { status: { in: ["pending", "queued", "running"] } } }),
      prisma.jobRun.count({ where: { status: "completed", finishedAt: { gte: today } } }),
      prisma.jobRun.count({ where: { status: "failed", finishedAt: { gte: today } } }),
      prisma.jobRun.count({
        where: { status: "completed", finishedAt: { gte: yesterday, lt: today } },
      }),
      prisma.jobRun.findMany({
        where: { status: { in: ["completed", "failed"] }, finishedAt: { gte: thirtyDaysAgo } },
        select: { status: true, startedAt: true, finishedAt: true },
        orderBy: { finishedAt: "desc" },
        take: 500,
      }),
      prisma.artifact.count(),
      prisma.jobRun.count({ where: { status: "completed" } }),
      prisma.$queryRaw<{ day: Date; count: bigint }[]>`
        SELECT date_trunc('day', finished_at) AS day, COUNT(*)::bigint AS count
        FROM job_runs
        WHERE status = 'completed' AND finished_at >= NOW() - INTERVAL '14 days'
        GROUP BY 1 ORDER BY 1`,
    ]);

    const wfCount = (status: string) =>
      workflowGroups.find((g) => g.status === status)?._count._all ?? 0;

    const sparse: DayCount[] = perDayRows.map((r) => {
      const d = new Date(r.day);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return { date: key, count: Number(r.count) };
    });

    return {
      agents: { total: agentsTotal },
      workflows: {
        running: wfCount("running"),
        awaitingReview: wfCount("awaiting_review"),
        total: workflowGroups.reduce((a, g) => a + g._count._all, 0),
      },
      jobs: { active: activeJobs, completedToday, failedToday, completedYesterday },
      ...computeRunStats(recentRuns),
      artifacts: { total: artifactsTotal },
      costSavedEstUsd: estimateCostSavedUsd(completedAllTime),
      series: { completedPerDay: fillDaySeries(sparse, 14) },
    };
  });

  app.get("/stats/agents", async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [groups, agents, runRows] = await Promise.all([
      prisma.workflow.groupBy({
        by: ["agentId", "status"],
        _count: { _all: true },
        _max: { updatedAt: true },
      }),
      prisma.agent.findMany({ select: { id: true, name: true } }),
      prisma.jobRun.findMany({
        where: { status: { in: ["completed", "failed"] }, finishedAt: { gte: thirtyDaysAgo } },
        select: {
          status: true,
          startedAt: true,
          finishedAt: true,
          job: {
            select: {
              workflowStep: { select: { workflow: { select: { agentId: true } } } },
            },
          },
        },
        orderBy: { finishedAt: "desc" },
        take: 1000,
      }),
    ]);

    const groupRows: AgentGroupRow[] = groups.map((g) => ({
      agentId: g.agentId,
      status: g.status,
      count: g._count._all,
      lastRunAt: g._max.updatedAt,
    }));
    const samples: AgentRunSample[] = runRows.map((r) => ({
      agentId: r.job.workflowStep.workflow.agentId,
      status: r.status,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
    }));

    const nameById = new Map(agents.map((a) => [a.id, a.name]));
    return {
      agents: buildAgentStats(groupRows, samples).map((s) => ({
        ...s,
        name: nameById.get(s.agentId) ?? s.agentId,
      })),
    };
  });

  app.get<{ Querystring: { days?: string } }>("/stats/series", async (req) => {
    const days = Math.min(Math.max(Number(req.query.days ?? 30) || 30, 1), 365);
    const rows = await prisma.$queryRaw<
      { day: Date; status: string; count: bigint; avg_ms: number | null }[]
    >`
      SELECT date_trunc('day', finished_at) AS day, status, COUNT(*)::bigint AS count,
             AVG(EXTRACT(EPOCH FROM (finished_at - started_at)) * 1000) AS avg_ms
      FROM job_runs
      WHERE status IN ('completed','failed') AND started_at IS NOT NULL
        AND finished_at >= NOW() - make_interval(days => ${days}::int)
      GROUP BY 1, 2 ORDER BY 1`;

    const shaped: DailyStatusRow[] = rows.map((r) => ({
      day: dayKey(new Date(r.day)),
      status: r.status,
      count: Number(r.count),
      avgMs: r.avg_ms != null ? Number(r.avg_ms) : null,
    }));

    return { days, perDay: buildDailySeries(shaped, days) };
  });

  app.get<{ Querystring: { days?: string } }>("/stats/costs", async (req) => {
    const days = Math.min(Math.max(Number(req.query.days ?? 30) || 30, 1), 365);

    const [rows, pricingSettings] = await Promise.all([
      prisma.$queryRaw<{ day: Date; provider_type: string | null; jobs: bigint }[]>`
        SELECT date_trunc('day', jr.finished_at) AS day, j.provider_type, COUNT(*)::bigint AS jobs
        FROM job_runs jr JOIN jobs j ON j.id = jr.job_id
        WHERE jr.status = 'completed' AND jr.finished_at >= NOW() - make_interval(days => ${days}::int)
        GROUP BY 1, 2 ORDER BY 1`,
      prisma.setting.findMany({
        where: { scope: "global", key: { startsWith: "pricing." } },
      }),
    ]);

    const pricing: Record<string, { perJobUsd: number }> = {};
    for (const s of pricingSettings) {
      const v = s.value as { perJobUsd?: number };
      if (typeof v?.perJobUsd === "number") pricing[s.key] = { perJobUsd: v.perJobUsd };
    }
    const referenceUsd = pricing["pricing.reference"]?.perJobUsd ?? 0.04;

    const costRows: CostRow[] = rows.map((r) => ({
      day: dayKey(new Date(r.day)),
      providerType: r.provider_type,
      jobs: Number(r.jobs),
    }));

    return { ...computeCosts(costRows, pricing, referenceUsd), pricing, referenceUsd, days };
  });

  app.get("/stats/system", async () => {
    const [dbOk, redisOk, agents] = await Promise.all([
      prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      getRedisConnection().ping().then(() => true).catch(() => false),
      prisma.agent.findMany({ select: { id: true, manifest: true } }),
    ]);

    // BullMQ's getWorkers() only recognizes Node clients (it matches the
    // base64-encoded connection name); the Python worker port names its
    // connections "bull:<queueName>" verbatim. Inspect CLIENT LIST directly
    // so both implementations register as online.
    const clientNames = redisOk
      ? await getRedisConnection()
          .client("LIST")
          .then((list) => String(list))
          .catch(() => "")
      : "";

    const workers = agents.map((a) => {
      const manifest = a.manifest as { entrypoint?: { queueName?: string } };
      const queueName = manifest.entrypoint?.queueName ?? a.id;
      const plain = `name=bull:${queueName}`;
      const b64 = `name=bull:${Buffer.from(queueName).toString("base64")}`;
      const online = clientNames.includes(plain) || clientNames.includes(b64 + ":w");
      return { queue: queueName, agentId: a.id, online };
    });

    return { api: true, db: dbOk, redis: redisOk, workers };
  });
}
