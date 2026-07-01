// Pure aggregation helpers for the stats endpoints. Kept free of Prisma so
// they can be unit-tested without a database (same pattern as
// templates/validation.ts).

export interface RunSample {
  status: string;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export interface RunStats {
  successRate: number | null;
  avgDurationMs: number | null;
}

export function computeRunStats(runs: RunSample[]): RunStats {
  const settled = runs.filter((r) => r.status === "completed" || r.status === "failed");
  if (settled.length === 0) return { successRate: null, avgDurationMs: null };

  const completed = settled.filter((r) => r.status === "completed");
  const successRate = completed.length / settled.length;

  const durations = completed
    .filter((r) => r.startedAt && r.finishedAt)
    .map((r) => r.finishedAt!.getTime() - r.startedAt!.getTime())
    .filter((ms) => ms >= 0);
  const avgDurationMs =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;

  return { successRate, avgDurationMs };
}

export interface AgentGroupRow {
  agentId: string;
  status: string;
  count: number;
  lastRunAt: Date | null;
}

export interface AgentRunSample extends RunSample {
  agentId: string;
}

export interface AgentStats {
  agentId: string;
  runs: number;
  completed: number;
  failed: number;
  successRate: number | null;
  avgDurationMs: number | null;
  lastRunAt: Date | null;
  share: number;
}

export function buildAgentStats(
  groupRows: AgentGroupRow[],
  runSamples: AgentRunSample[],
): AgentStats[] {
  const byAgent = new Map<string, AgentStats>();

  for (const row of groupRows) {
    let agg = byAgent.get(row.agentId);
    if (!agg) {
      agg = {
        agentId: row.agentId,
        runs: 0,
        completed: 0,
        failed: 0,
        successRate: null,
        avgDurationMs: null,
        lastRunAt: null,
        share: 0,
      };
      byAgent.set(row.agentId, agg);
    }
    agg.runs += row.count;
    if (row.status === "completed") agg.completed += row.count;
    if (row.status === "failed") agg.failed += row.count;
    if (row.lastRunAt && (!agg.lastRunAt || row.lastRunAt > agg.lastRunAt)) {
      agg.lastRunAt = row.lastRunAt;
    }
  }

  const samplesByAgent = new Map<string, AgentRunSample[]>();
  for (const s of runSamples) {
    const list = samplesByAgent.get(s.agentId) ?? [];
    list.push(s);
    samplesByAgent.set(s.agentId, list);
  }
  for (const [agentId, samples] of samplesByAgent) {
    const agg = byAgent.get(agentId);
    if (!agg) continue;
    const { successRate, avgDurationMs } = computeRunStats(samples);
    agg.successRate = successRate;
    agg.avgDurationMs = avgDurationMs;
  }

  const totalRuns = [...byAgent.values()].reduce((a, s) => a + s.runs, 0);
  for (const agg of byAgent.values()) {
    agg.share = totalRuns > 0 ? agg.runs / totalRuns : 0;
    // groupBy has no duration info; if an agent had no settled samples the
    // rate can still be derived from the status counts.
    if (agg.successRate === null && agg.completed + agg.failed > 0) {
      agg.successRate = agg.completed / (agg.completed + agg.failed);
    }
  }

  return [...byAgent.values()].sort((a, b) => b.runs - a.runs);
}

export interface DayCount {
  date: string; // YYYY-MM-DD
  count: number;
}

// Fill a contiguous day series (oldest -> newest, `days` entries ending today)
// from sparse per-day rows so sparklines don't skip empty days.
export function fillDaySeries(rows: DayCount[], days: number, today = new Date()): DayCount[] {
  const byDate = new Map(rows.map((r) => [r.date, r.count]));
  const out: DayCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({ date: key, count: byDate.get(key) ?? 0 });
  }
  return out;
}

// Rough "what this would have cost on a paid API" figure for the dashboard.
// Jobs created before provider attribution landed have no providerType, so
// the dashboard headline stays a labeled estimate: completed image jobs x a
// typical per-image price. The Cost Monitor uses computeCosts for real
// attribution instead.
export const PREMIUM_PRICE_PER_IMAGE_USD = 0.04;

export function estimateCostSavedUsd(completedImageJobs: number): number {
  return Math.round(completedImageJobs * PREMIUM_PRICE_PER_IMAGE_USD * 100) / 100;
}

// ---- Analytics ---------------------------------------------------------------

export interface DailyStatusRow {
  day: string; // YYYY-MM-DD
  status: string;
  count: number;
  avgMs: number | null;
}

export interface DailySeriesPoint {
  date: string;
  completed: number;
  failed: number;
  avgDurationMs: number | null;
}

/** Shape sparse day x status rows into a contiguous per-day series (oldest ->
 * newest, `days` entries ending today). avgDurationMs comes from completed
 * runs only. */
export function buildDailySeries(
  rows: DailyStatusRow[],
  days: number,
  today = new Date(),
): DailySeriesPoint[] {
  const byDate = new Map<string, DailySeriesPoint>();
  for (const r of rows) {
    const point = byDate.get(r.day) ?? {
      date: r.day,
      completed: 0,
      failed: 0,
      avgDurationMs: null,
    };
    if (r.status === "completed") {
      point.completed = r.count;
      point.avgDurationMs = r.avgMs != null ? Math.round(r.avgMs) : null;
    }
    if (r.status === "failed") point.failed = r.count;
    byDate.set(r.day, point);
  }

  const out: DailySeriesPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push(byDate.get(key) ?? { date: key, completed: 0, failed: 0, avgDurationMs: null });
  }
  return out;
}

// ---- Cost Monitor -----------------------------------------------------------

export interface CostRow {
  day: string; // YYYY-MM-DD
  providerType: string | null;
  jobs: number;
}

export interface CostBreakdown {
  totalUsd: number;
  savedUsd: number;
  unattributedJobs: number;
  perProvider: { providerType: string; jobs: number; usd: number }[];
  perDay: { date: string; usd: number; savedUsd: number; jobs: number }[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Attribute real spend per provider from day x providerType job counts.
 * Savings = jobs that ran on a zero-cost (local) provider x the reference
 * per-job price of a premium API. Jobs with a null providerType predate
 * attribution and are counted separately, never priced. */
export function computeCosts(
  rows: CostRow[],
  pricing: Record<string, { perJobUsd: number }>,
  referenceUsd: number,
): CostBreakdown {
  const priceFor = (providerType: string) => pricing[`pricing.${providerType}`]?.perJobUsd ?? 0;

  let totalUsd = 0;
  let savedUsd = 0;
  let unattributedJobs = 0;
  const perProvider = new Map<string, { jobs: number; usd: number }>();
  const perDay = new Map<string, { usd: number; savedUsd: number; jobs: number }>();

  for (const row of rows) {
    const dayAgg = perDay.get(row.day) ?? { usd: 0, savedUsd: 0, jobs: 0 };
    dayAgg.jobs += row.jobs;

    if (row.providerType === null) {
      unattributedJobs += row.jobs;
    } else {
      const price = priceFor(row.providerType);
      const usd = price * row.jobs;
      totalUsd += usd;
      dayAgg.usd += usd;
      if (price === 0) {
        const saved = referenceUsd * row.jobs;
        savedUsd += saved;
        dayAgg.savedUsd += saved;
      }
      const prov = perProvider.get(row.providerType) ?? { jobs: 0, usd: 0 };
      prov.jobs += row.jobs;
      prov.usd += usd;
      perProvider.set(row.providerType, prov);
    }
    perDay.set(row.day, dayAgg);
  }

  return {
    totalUsd: round2(totalUsd),
    savedUsd: round2(savedUsd),
    unattributedJobs,
    perProvider: [...perProvider.entries()]
      .map(([providerType, v]) => ({ providerType, jobs: v.jobs, usd: round2(v.usd) }))
      .sort((a, b) => b.jobs - a.jobs),
    perDay: [...perDay.entries()]
      .map(([date, v]) => ({ date, usd: round2(v.usd), savedUsd: round2(v.savedUsd), jobs: v.jobs }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}
