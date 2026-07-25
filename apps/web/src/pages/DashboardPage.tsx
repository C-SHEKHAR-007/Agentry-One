import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "../lib/utils";
import {
  Activity as ActivityIcon,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  FolderKanban,
  Layers,
  Plus,
  TrendingUp,
  Workflow as WorkflowIcon,
} from "lucide-react";
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
import { ActivityFeed } from "../components/ActivityFeed";
import { ExecutionsTable } from "../components/ExecutionsTable";
import { StatCard } from "../components/StatCard";
import { SystemHealthPanel } from "../components/SystemHealthPanel";
import { TopAgents } from "../components/TopAgents";
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

  const gradients = [
    "from-violet-900 via-purple-800 to-indigo-900",
    "from-emerald-900 via-teal-800 to-cyan-900",
    "from-rose-900 via-pink-800 to-fuchsia-900",
    "from-amber-900 via-orange-800 to-red-900",
  ];
  const gradient = gradients[project.name.charCodeAt(0) % gradients.length];

  return (
    <Link
      to={`/projects/${project.id}`}
      className="group overflow-hidden rounded-xl border border-border/60 transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 block"
    >
      {/* Cover image */}
      <div className="relative h-36 overflow-hidden">
        {url ? (
          <img
            src={url}
            alt={project.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className={`h-full w-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
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
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card glass className={className}>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
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
  const { data: overview } = useStatsOverview();
  const { data: agentStats } = useAgentStats();
  const { data: events } = useEvents(12);
  const { data: recent } = useRecentWorkflows(6);
  const { data: health } = useSystemHealth();
  const { data: projects } = useProjects();

  const series = overview?.series.completedPerDay.map((d) => d.count) ?? [];
  const agents = agentStats?.agents ?? [];
  const totalJobs = agents.reduce((a, s) => a + s.runs, 0);

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting()},{" "}
          <span className="bg-gradient-to-r from-primary via-violet-400 to-chart-3 bg-clip-text text-transparent">
            Shekhar
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
            />
            <StatCard
              icon={Layers}
              label="Running Workflows"
              value={overview.workflows.running}
              sub={`${overview.workflows.awaitingReview} waiting for input`}
              series={series}
              color="hsl(var(--chart-3))"
              delay={0.1}
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
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <SectionCard
              className="lg:col-span-3"
              title="Recent Executions"
              action={<ViewAll to="/executions" />}
            >
              {recent ? <ExecutionsTable workflows={recent} /> : <Skeleton className="h-48" />}
            </SectionCard>

            <SectionCard className="lg:col-span-2" title="Usage Overview">
              <div className="flex flex-col items-center gap-6">
                <Donut
                  segments={agents.map((a, i) => ({
                    value: a.runs,
                    color: CHART_COLORS[i % CHART_COLORS.length],
                  }))}
                >
                  <p className="text-2xl font-bold">{totalJobs}</p>
                  <p className="text-[10px] text-muted-foreground">Total Jobs</p>
                </Donut>
                <div className="w-full space-y-2">
                  {agents.length === 0 && (
                    <p className="text-sm text-muted-foreground">No jobs run yet.</p>
                  )}
                  {agents.map((a, i) => (
                    <div key={a.agentId} className="flex items-center gap-2 text-sm">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span className="min-w-0 flex-1 truncate text-xs">{a.name}</span>
                      <span className="text-xs text-muted-foreground">{Math.round(a.share * 100)}%</span>
                      <span className="w-10 text-right text-xs text-muted-foreground">{a.runs}</span>
                    </div>
                  ))}
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

          {/* CTA banner */}
          <Card
            glass
            className="flex flex-col items-start justify-between gap-4 overflow-hidden p-0 sm:flex-row sm:items-center"
          >
            <div className="flex flex-1 items-center gap-4 p-5">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                <WorkflowIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold">Create your first custom agent</p>
                <p className="text-sm text-muted-foreground">
                  Build powerful AI agents tailored to your needs.
                </p>
              </div>
            </div>
            <div className="px-5 pb-5 sm:pb-0 sm:pr-6">
              <Link to="/agents">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" /> Create Agent
                </Button>
              </Link>
            </div>
          </Card>
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
