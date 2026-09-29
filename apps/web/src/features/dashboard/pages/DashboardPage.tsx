import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis } from "recharts";
import { cn } from "../../../lib/utils";
import {
  Activity as ActivityIcon,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  Coins,
  Gauge,
  TrendingDown,
  TrendingUp } from "lucide-react";
import { CHART, ChartLegend, ChartTooltip } from "../../../components/common/charts/chartTheme";
import { useArtifactPreviewUrlQuery } from "../../artifacts/artifacts.api";
import { useProjectsQuery } from "../../projects/projects.api";
import { useRecentAgentRuns } from "../../runs/agentRuns.api";
import { useWorkflowRuns } from "../../runs/runs.api";
import { useAgentStats, useRecentEvents, useStatsOverview, useStatsSeriesQuery, useSystemHealth } from "../../stats/stats.api";
import { formatDuration, formatPercent, formatTokens, formatUsd, timeAgo } from "../../../lib/format";
import { useAuth } from "../../auth/useAuth";
import { ActivityFeed } from "../components/ActivityFeed";
import { ExecutionsTable } from "../../../components/common/ExecutionsTable";
import { StatCard } from "../../../components/common/StatCard";
import { SystemHealthPanel } from "../../../components/common/SystemHealthPanel";
import { ActiveRuns } from "../components/ActiveRuns";
import { DashboardHero } from "../components/DashboardHero";
import { UsageBars } from "../components/UsageBars";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import type { Project } from "../../../models";

// ── Project card with SAS cover image ────────────────────────────────────────
function ProjectCard({ project }: { project: Project }) {
  const sasId = !project.coverPreviewUrl && project.coverArtifactId ? project.coverArtifactId : undefined;
  const { data: sas } = useArtifactPreviewUrlQuery(sasId ?? "", { skip: !sasId });
  const url = project.coverPreviewUrl || sas?.url;
  const initial = project.name[0]?.toUpperCase() ?? "P";

  return (
    <Link
      to={`/projects/${project.id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
    >
      {/* Cover / preview */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-secondary/50">
        {url ? (
          <img
            src={url}
            alt={project.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary/5">
            <span className="text-3xl font-semibold text-muted-foreground/40">{initial}</span>
          </div>
        )}
              </div>

      {/* Footer */}
      <div className="bg-card/80 px-4 py-3">
        <p className="truncate font-semibold text-sm group-hover:text-primary transition-colors">{project.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {project.counts.workflows} workflows · {project.counts.artifacts} artifacts
        </p>
        <div className="mt-2 flex items-center justify-between">
          {/* Avatar stack (initials) */}
          <div className="flex -space-x-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-card/80 bg-primary/20 text-[11px] font-semibold text-primary"
              >
                {String.fromCharCode(65 + ((project.name.charCodeAt(i % project.name.length) ?? 65) % 26))}
              </span>
            ))}
          </div>
          <span className="text-[11px] text-muted-foreground">
            {project.lastActivityAt ? `Updated ${timeAgo(project.lastActivityAt)}` : "No activity"}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ── Section card wrapper ──────────────────────────────────────────────────────
function SectionCard({
  title,
  action,
  children,
  className,
  contentClassName,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card glass className={cn("min-w-0 overflow-hidden", className)}>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 pb-3 min-w-0">
        <CardTitle className="truncate pr-2">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className={cn("min-w-0", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

function ViewAll({ to, label = "View all" }: { to: string; label?: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
    >
      {label} <ArrowRight className="h-3 w-3" />
    </Link>
  );
}

// ── Dashboard page ────────────────────────────────────────────────────────────
function Delta({ value, suffix }: { value: number; suffix: string }) {
  if (value === 0) return <span className="text-muted-foreground">No change {suffix}</span>;
  const up = value > 0;
  return (
    <span className={cn("flex items-center gap-1", up ? "text-success" : "text-destructive")}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : "−"}
      {Math.abs(value)} {suffix}
    </span>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data: overview } = useStatsOverview();
  const { data: agentStats } = useAgentStats();
  const { data: events } = useRecentEvents(14);
  const { data: recent } = useRecentAgentRuns(6);
  const { data: health, dataUpdatedAt: healthUpdatedAt } = useSystemHealth();
  const { data: projects } = useProjectsQuery();
  const { data: activeRuns } = useWorkflowRuns("active", 4);

  const [trendDays, setTrendDays] = useState<number>(14);
  const { data: trendSeries, isLoading: isLoadingTrends } = useStatsSeriesQuery(trendDays);

  const displayName = user?.firstName?.trim() || user?.email?.split("@")[0] || "there";
  const series = overview?.series.completedPerDay.map((d) => d.count) ?? [];
  const agents = agentStats?.agents ?? [];
  const tokens30d = agents.reduce((a, s) => a + (s.tokens ?? 0), 0);
  const cost30d = agents.reduce((a, s) => a + (s.costUsd ?? 0), 0);
  const inFlight = (activeRuns?.length ?? 0) + (overview?.workflows.running ?? 0);

  const trendPoints = trendSeries?.perDay ?? [];
  const trendTotalCompleted = trendPoints.reduce((acc, p) => acc + p.completed, 0);
  const trendTotalFailed = trendPoints.reduce((acc, p) => acc + p.failed, 0);
  const trendTotalRuns = trendTotalCompleted + trendTotalFailed;
  const trendSuccessRate = trendTotalRuns > 0 ? trendTotalCompleted / trendTotalRuns : null;
  const trendPeakDay = trendPoints.reduce((max, p) => Math.max(max, p.completed + p.failed), 0);
  const trendValidDurations = trendPoints
    .filter((p) => p.avgDurationMs != null)
    .map((p) => p.avgDurationMs as number);
  const trendAvgDuration =
    trendValidDurations.length > 0
      ? Math.round(trendValidDurations.reduce((a, b) => a + b, 0) / trendValidDurations.length)
      : null;

  return (
    <div className="space-y-6">
      <DashboardHero
        name={displayName}
        health={health}
        healthUpdatedAt={healthUpdatedAt}
        activeRuns={activeRuns?.length ?? overview?.workflows.running ?? 0}
        agentCount={agents.length}
      />

      {/* ── KPIs ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overview ? (
          <>
            <StatCard
              icon={ActivityIcon}
              label="Active runs"
              value={<span className="font-mono tabular">{String(overview.workflows.running + overview.workflows.awaitingReview).padStart(2, "0")}</span>}
              sub={
                <span className="flex items-center gap-1.5">
                  <span className="status-dot h-1.5 w-1.5 text-primary" data-live={overview.workflows.running > 0 ? "true" : undefined} />
                  {overview.workflows.running} running · {overview.workflows.awaitingReview} in review
                </span>
              }
              series={series}
              color="hsl(var(--chart-1))"
              to="/runs?status=running"
            />
            <StatCard
              icon={CheckCircle2}
              label="Completed today"
              value={<span className="font-mono tabular">{overview.jobs.completedToday}</span>}
              sub={<Delta value={overview.jobs.completedToday - overview.jobs.completedYesterday} suffix="vs yesterday" />}
              series={series}
              color="hsl(var(--chart-2))"
              delay={0.05}
              to="/runs?status=completed"
            />
            <StatCard
              icon={Gauge}
              label="Success rate"
              value={<span className="font-mono tabular">{formatPercent(overview.successRate)}</span>}
              sub={`avg ${formatDuration(overview.avgDurationMs)} · ${overview.jobs.failedToday} failed today`}
              series={series}
              color="hsl(var(--chart-3))"
              delay={0.1}
              to="/analytics"
            />
            <StatCard
              icon={Coins}
              label="Tokens · 30 days"
              value={<span className="font-mono tabular">{formatTokens(tokens30d, { compact: true, zero: true })}</span>}
              sub={`${formatUsd(cost30d)} spent · $${overview.costSavedEstUsd} saved`}
              series={series}
              color="hsl(var(--chart-4))"
              delay={0.15}
              to="/costs"
            />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[112px] rounded-xl" />)
        )}
      </div>

      {/* ── Live: what's running + the event stream ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <SectionCard
          className="glow-border border-transparent xl:col-span-2"
          title="Active runs"
          action={
            <div className="flex items-center gap-3">
              {inFlight > 0 && (
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-primary">
                  <span className="status-dot h-1.5 w-1.5" data-live="true" /> Live
                </span>
              )}
              <ViewAll to="/runs" />
            </div>
          }
        >
          <ActiveRuns />
        </SectionCard>

        <SectionCard title="Live activity" action={<ViewAll to="/runs" label="All runs" />}>
          <div className="-mx-1 h-[360px] overflow-y-auto pr-1 scrollbar-thin">
            {events ? <ActivityFeed events={events} /> : <Skeleton className="h-40" />}
          </div>
        </SectionCard>
      </div>

      {/* ── Trends + usage ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          {/* Execution Trends & Daily Throughput */}
          <SectionCard
            className="h-full"
            title="Execution trends"
            action={
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Time range selector */}
                <div className="flex items-center rounded-lg border border-border/60 bg-secondary/30 p-0.5">
                  {[7, 14, 30].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setTrendDays(d)}
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
                        trendDays === d
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {d}d
                    </button>
                  ))}
                </div>

                <ChartLegend
                  items={[
                    { label: "Completed", color: CHART.status.good },
                    { label: "Failed", color: CHART.status.bad },
                  ]}
                />

                <ViewAll to="/analytics" label="All analytics" />
              </div>
            }
          >
            {/* KPI Summary Tiles */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-4">
              <div className="rounded-lg border border-border/50 bg-secondary/20 p-2.5">
                <span className="text-[11px] font-medium text-muted-foreground">Total Runs</span>
                <p className="mt-1 text-lg font-semibold tracking-tight text-foreground truncate">
                  {trendTotalRuns}
                </p>
                <span className="text-[11px] text-muted-foreground">Past {trendDays} days</span>
              </div>

              <div className="rounded-lg border border-border/50 bg-secondary/20 p-2.5">
                <span className="text-[11px] font-medium text-muted-foreground">Success Rate</span>
                <p className="mt-1 text-lg font-semibold tracking-tight text-success truncate">
                  {trendSuccessRate !== null ? formatPercent(trendSuccessRate) : "—"}
                </p>
                <span className="text-[11px] text-muted-foreground truncate block">
                  {trendTotalFailed === 0 ? "100% reliable" : `${trendTotalFailed} failed`}
                </span>
              </div>

              <div className="rounded-lg border border-border/50 bg-secondary/20 p-2.5">
                <span className="text-[11px] font-medium text-muted-foreground">Daily Peak</span>
                <p className="mt-1 text-lg font-semibold tracking-tight text-foreground truncate">
                  {trendPeakDay} <span className="text-xs font-normal text-muted-foreground">runs</span>
                </p>
                <span className="text-[11px] text-muted-foreground truncate block">Highest day</span>
              </div>

              <div className="rounded-lg border border-border/50 bg-secondary/20 p-2.5">
                <span className="text-[11px] font-medium text-muted-foreground">Avg Duration</span>
                <p className="mt-1 text-lg font-semibold tracking-tight text-foreground truncate">
                  {trendAvgDuration !== null ? formatDuration(trendAvgDuration) : "—"}
                </p>
                <span className="text-[11px] text-muted-foreground truncate block">Per execution</span>
              </div>
            </div>

            {isLoadingTrends ? (
              <Skeleton className="h-48 w-full rounded-lg" />
            ) : trendTotalRuns === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border/60 text-center p-6">
                <BarChart2 className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm font-medium text-foreground">No executions recorded in this window</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Run agents or trigger workflows to populate performance trends.
                </p>
              </div>
            ) : (
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendPoints} barCategoryGap="25%">
                    <CartesianGrid stroke={CHART.grid} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={CHART.tick}
                      axisLine={CHART.axisLine}
                      tickLine={false}
                      tickFormatter={(d: string) => d.slice(5)}
                    />
                    <YAxis
                      tick={CHART.tick}
                      axisLine={false}
                      tickLine={false}
                      width={28}
                      allowDecimals={false}
                    />
                    <RechartsTooltip
                      cursor={{ fill: "hsl(var(--secondary) / 0.5)" }}
                      content={<ChartTooltip />}
                    />
                    <Bar dataKey="completed" name="Completed" stackId="jobs" fill={CHART.status.good} />
                    <Bar
                      dataKey="failed"
                      name="Failed"
                      stackId="jobs"
                      fill={CHART.status.bad}
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>
        </div>
        <SectionCard title="Agent usage" action={<ViewAll to="/analytics" label="Analytics" />}>
          {agentStats ? <UsageBars agents={agents} /> : <Skeleton className="h-48" />}
        </SectionCard>
      </div>

      {/* ── Recent runs + health ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          contentClassName="overflow-x-auto"
          title="Recent agent runs"
          action={<ViewAll to="/runs" />}
        >
          {recent ? <ExecutionsTable workflows={recent} /> : <Skeleton className="h-48" />}
        </SectionCard>
        <SectionCard
          title="System health"
          action={
            health ? (
              <span
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  health.api && health.db && health.redis ? "bg-success/15 text-success" : "bg-warning/15 text-warning",
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", health.api && health.db && health.redis ? "bg-success" : "bg-warning")} />
                {health.api && health.db && health.redis ? "Operational" : "Degraded"}
              </span>
            ) : null
          }
        >
          {health ? <SystemHealthPanel health={health} /> : <Skeleton className="h-32" />}
        </SectionCard>
      </div>

      {/* Projects */}
      <SectionCard title="Your projects" action={<ViewAll to="/projects" />}>
        {projects && projects.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No projects yet —{" "}
            <Link to="/projects" className="text-primary hover:underline">
              create one
            </Link>{" "}
            to start running agents.
          </p>
        )}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(projects ?? []).slice(0, 4).map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
          {!projects && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      </SectionCard>
    </div>
  );
}
