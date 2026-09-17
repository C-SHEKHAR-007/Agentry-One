import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "../lib/utils";
import {
  Activity as ActivityIcon,
  ArrowRight,
  BarChart2,
  Bot,
  CheckCircle2,
  DollarSign,
  FolderKanban,
  Layers,
  Play,
  Plus,
  TrendingUp,
  Workflow as WorkflowIcon,
} from "lucide-react";
import { api } from "../api/client.js";
import { CHART, ChartLegend, ChartTooltip } from "../components/charts/chartTheme";
import {
  useAgentStats,
  useEvents,
  useProjects,
  useRecentWorkflows,
  useSasPreviewUrl,
  useStatsOverview,
  useSystemHealth,
} from "../api/queries";
import { formatDuration, formatPercent, greeting, timeAgo } from "../lib/format";
import { useAuth } from "../auth/AuthContext.js";
import { ActivityFeed } from "../components/ActivityFeed";
import { ExecutionsTable } from "../components/ExecutionsTable";
import { StatCard } from "../components/StatCard";
import { SystemHealthPanel } from "../components/SystemHealthPanel";
import { TopAgents } from "../components/TopAgents";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Donut } from "../components/ui/donut";
import { Skeleton } from "../components/ui/skeleton";
import type { Project } from "../api/types";

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
];

// ── Project card with SAS cover image ────────────────────────────────────────
function ProjectCard({ project }: { project: Project }) {
  const { data: sas } = useSasPreviewUrl(!project.coverPreviewUrl && project.coverArtifactId ? project.coverArtifactId : undefined);
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
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary">
            <span className="text-4xl font-black text-white/20">{initial}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
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
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-card/80 bg-primary/20 text-[9px] font-bold text-primary"
              >
                {String.fromCharCode(65 + ((project.name.charCodeAt(i % project.name.length) ?? 65) % 26))}
              </span>
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground">
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
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3 min-w-0">
        <CardTitle className="text-sm font-semibold truncate pr-2">{title}</CardTitle>
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
export function DashboardPage() {
  const { user } = useAuth();
  const { data: overview } = useStatsOverview();
  const { data: agentStats } = useAgentStats();
  const { data: events } = useEvents(12);
  const { data: recent } = useRecentWorkflows(6);
  const { data: health } = useSystemHealth();
  const { data: projects } = useProjects();

  const [trendDays, setTrendDays] = useState<number>(14);
  const { data: trendSeries, isLoading: isLoadingTrends } = useQuery<{
    days: number;
    perDay: { date: string; completed: number; failed: number; avgDurationMs: number | null }[];
  }>({
    queryKey: ["stats", "series", trendDays],
    queryFn: () => api.get(`/stats/series?days=${trendDays}`),
  });

  const displayName = user?.firstName?.trim() || user?.email?.split("@")[0] || "there";
  const series = overview?.series.completedPerDay.map((d) => d.count) ?? [];
  const agents = agentStats?.agents ?? [];
  const totalJobs = agents.reduce((a, s) => a + s.runs, 0);

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
      {/* Page heading */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting()},{" "}
          <span className="bg-gradient-to-r from-primary via-violet-400 to-chart-3 bg-clip-text text-transparent">
            {displayName}
          </span>{" "}
          👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here's what's happening with your AI agents today.
        </p>
      </motion.div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overview ? (
          <>
            <StatCard
              icon={ActivityIcon}
              label="Active Jobs"
              value={overview.jobs.active}
              sub={`${overview.workflows.running} running`}
              series={series}
              color="hsl(var(--chart-1))"
              to="/executions?status=running"
            />
            <StatCard
              icon={CheckCircle2}
              label="Completed Today"
              value={overview.jobs.completedToday}
              sub={
                overview.jobs.completedYesterday > 0 ? (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <TrendingUp className="h-3 w-3" />
                    {overview.jobs.completedYesterday} yesterday
                  </span>
                ) : (
                  "first runs today?"
                )
              }
              series={series}
              color="hsl(var(--chart-2))"
              delay={0.05}
              to="/executions?status=completed"
            />
            <StatCard
              icon={Layers}
              label="Running Workflows"
              value={overview.workflows.running}
              sub={`${overview.workflows.awaitingReview} waiting for input`}
              series={series}
              color="hsl(var(--chart-3))"
              delay={0.1}
              to="/executions?status=running"
            />
            <StatCard
              icon={DollarSign}
              label="API Cost Saved"
              value={`$${overview.costSavedEstUsd}`}
              sub={
                <span className="flex items-center gap-1 text-emerald-400">
                  <TrendingUp className="h-3 w-3" />
                  Est. vs paid APIs
                </span>
              }
              series={series}
              color="hsl(var(--chart-4))"
              delay={0.15}
              to="/costs"
            />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[100px] rounded-xl" />)
        )}
      </div>

      {/* ── Main + Right rail ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 xl:col-span-2">

          {/* Recent Executions + Usage Overview side by side */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 items-stretch">
            <SectionCard
              className="lg:col-span-3 flex flex-col h-full"
              contentClassName="flex-1 flex flex-col justify-between overflow-x-auto"
              title="Recent Executions"
              action={<ViewAll to="/executions" />}
            >
              {recent ? <ExecutionsTable workflows={recent} /> : <Skeleton className="h-48" />}
            </SectionCard>

            <SectionCard
              className="lg:col-span-2 flex flex-col h-full"
              contentClassName="flex-1 flex flex-col justify-between"
              title="Usage Overview"
            >
              <div className="flex flex-col items-center justify-between h-full gap-4">
                <Donut
                  segments={agents.map((a, i) => ({
                    value: a.runs,
                    color: CHART_COLORS[i % CHART_COLORS.length],
                  }))}
                >
                  <p className="text-2xl font-bold">{totalJobs}</p>
                  <p className="text-[10px] text-muted-foreground">Total Jobs</p>
                </Donut>

                <div className="w-full flex-1 flex flex-col justify-between min-h-0">
                  {/* Scrollable Agent List */}
                  <div className="max-h-[135px] overflow-y-auto pr-1.5 scrollbar-thin space-y-1.5">
                    {agents.length === 0 && (
                      <p className="text-sm text-muted-foreground py-2 text-center">No jobs run yet.</p>
                    )}
                    {agents.map((a, i) => (
                      <Link
                        key={a.agentId}
                        to={`/agents/${a.agentId}`}
                        className="flex items-center gap-2 text-sm hover:text-primary transition-colors py-0.5 group"
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                        <span className="min-w-0 flex-1 truncate text-xs group-hover:underline">{a.name}</span>
                        <span className="text-xs text-muted-foreground">{Math.round(a.share * 100)}%</span>
                        <span className="w-10 text-right text-xs text-muted-foreground font-mono">{a.runs}</span>
                      </Link>
                    ))}
                  </div>

                  {/* Summary Metrics */}
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/60 pt-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Success Rate</p>
                      <p className="text-sm font-semibold">{formatPercent(overview?.successRate)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Avg. Duration</p>
                      <p className="text-sm font-semibold">{formatDuration(overview?.avgDurationMs)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>

          {/* Projects grid */}
          <SectionCard title="Your Projects" action={<ViewAll to="/projects" />}>
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
              {!projects &&
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-52 rounded-xl" />
                ))}
            </div>
          </SectionCard>

          {/* Execution Trends & Daily Throughput */}
          <SectionCard
            title="Execution Trends & Throughput"
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
              <div className="rounded-lg border border-border/50 bg-secondary/20 p-2.5">
                <span className="text-[11px] font-medium text-muted-foreground">Total Runs</span>
                <p className="mt-1 text-lg font-bold tracking-tight text-foreground">
                  {trendTotalRuns}
                </p>
                <span className="text-[10px] text-muted-foreground">Past {trendDays} days</span>
              </div>

              <div className="rounded-lg border border-border/50 bg-secondary/20 p-2.5">
                <span className="text-[11px] font-medium text-muted-foreground">Success Rate</span>
                <p className="mt-1 text-lg font-bold tracking-tight text-emerald-400">
                  {trendSuccessRate !== null ? formatPercent(trendSuccessRate) : "—"}
                </p>
                <span className="text-[10px] text-muted-foreground">
                  {trendTotalFailed === 0 ? "100% reliability" : `${trendTotalFailed} failed`}
                </span>
              </div>

              <div className="rounded-lg border border-border/50 bg-secondary/20 p-2.5">
                <span className="text-[11px] font-medium text-muted-foreground">Daily Peak</span>
                <p className="mt-1 text-lg font-bold tracking-tight text-foreground">
                  {trendPeakDay} <span className="text-xs font-normal text-muted-foreground">runs</span>
                </p>
                <span className="text-[10px] text-muted-foreground">Highest single day</span>
              </div>

              <div className="rounded-lg border border-border/50 bg-secondary/20 p-2.5">
                <span className="text-[11px] font-medium text-muted-foreground">Avg Duration</span>
                <p className="mt-1 text-lg font-bold tracking-tight text-foreground">
                  {trendAvgDuration !== null ? formatDuration(trendAvgDuration) : "—"}
                </p>
                <span className="text-[10px] text-muted-foreground">Per execution</span>
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

        {/* Right rail */}
        <div className="space-y-6">
          <SectionCard title="Live Activity" action={<ViewAll to="/executions" label="View all" />}>
            <div className="h-[320px] overflow-y-auto pr-1 scrollbar-thin">
              {events ? <ActivityFeed events={events} /> : <Skeleton className="h-40" />}
            </div>
          </SectionCard>

          <SectionCard title="Top Agents" action={<ViewAll to="/agents" />}>
            <TopAgents agents={agents} />
          </SectionCard>

          <SectionCard
            title="System Health"
            action={
              health ? (
                <span
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    health.api && health.db && health.redis
                      ? "bg-success/15 text-success"
                      : "bg-warning/15 text-warning",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      health.api && health.db && health.redis ? "bg-success" : "bg-warning",
                    )}
                  />
                  {health.api && health.db && health.redis ? "All systems operational" : "Degraded"}
                </span>
              ) : null
            }
          >
            {health ? <SystemHealthPanel health={health} /> : <Skeleton className="h-32" />}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
