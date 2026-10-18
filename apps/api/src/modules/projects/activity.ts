import { Prisma } from "@prisma/client";
import { prisma } from "../../db/client.js";

export const ACTIVITY_DAYS = 30;
const DAY_MS = 86_400_000;

/** A project's agent runs over the last 30 days, for its card and overview. */
export interface ProjectActivity {
  runs30d: number;
  completed30d: number;
  failed30d: number;
  /** completed / (completed + failed); null when nothing has settled yet. */
  successRate: number | null;
  /** Runs per UTC day, oldest first, ending today: always ACTIVITY_DAYS long. */
  daily: number[];
}

export interface ActivityRow {
  projectId: string;
  /** The UTC day the run started. */
  day: Date;
  status: string;
  n: number;
}

const utcDay = (d: Date) => Math.floor(d.getTime() / DAY_MS);

export const emptyActivity = (): ProjectActivity => ({
  runs30d: 0,
  completed30d: 0,
  failed30d: 0,
  successRate: null,
  daily: Array(ACTIVITY_DAYS).fill(0),
});

/** Folds per-day, per-status counts into one summary per project. */
export function summarizeActivity(rows: ActivityRow[], now: Date): Map<string, ProjectActivity> {
  const today = utcDay(now);
  const first = today - (ACTIVITY_DAYS - 1);
  const out = new Map<string, ProjectActivity>();
  for (const r of rows) {
    const day = utcDay(r.day);
    if (day < first || day > today) continue;
    const a = out.get(r.projectId) ?? emptyActivity();
    a.daily[day - first] += r.n;
    a.runs30d += r.n;
    if (r.status === "completed") a.completed30d += r.n;
    else if (r.status === "failed") a.failed30d += r.n;
    out.set(r.projectId, a);
  }
  for (const a of out.values()) {
    const settled = a.completed30d + a.failed30d;
    a.successRate = settled ? a.completed30d / settled : null;
  }
  return out;
}

/** Activity for these projects, from one grouped query over `workflows` (one row per agent run). */
export async function projectActivity(ids: string[], now = new Date()): Promise<Map<string, ProjectActivity>> {
  if (ids.length === 0) return new Map();
  // created_at is a UTC timestamp without a zone: compare with a zoneless UTC value,
  // not a Date (which Postgres would read in the session's timezone).
  const since = new Date((utcDay(now) - (ACTIVITY_DAYS - 1)) * DAY_MS);
  const rows = await prisma.$queryRaw<{ project_id: string; day: Date; status: string; n: bigint }[]>`
    SELECT project_id, date_trunc('day', created_at) AS day, status, COUNT(*)::bigint AS n
    FROM workflows
    WHERE project_id IN (${Prisma.join(ids)}) AND created_at >= ${since.toISOString()}::timestamp
    GROUP BY 1, 2, 3`;
  return summarizeActivity(
    rows.map((r) => ({ projectId: r.project_id, day: r.day, status: r.status, n: Number(r.n) })),
    now,
  );
}
