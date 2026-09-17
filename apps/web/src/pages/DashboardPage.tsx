import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { cn } from "../lib/utils";
import {
  Activity as ActivityIcon,
  ArrowRight,
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
import type { Agent, Project } from "../api/types";

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
  const { data: allAgents, isLoading: isLoadingAgents } = useQuery<Agent[]>({
    queryKey: ["agents"],
    queryFn: () => api.get<Agent[]>("/agents"),
  });

  const displayName = user?.firstName?.trim() || user?.email?.split("@")[0] || "there";
  const series = overview?.series.completedPerDay.map((d) => d.count) ?? [];
  const agents = agentStats?.agents ?? [];
  const totalJobs = agents.reduce((a, s) => a + s.runs, 0);

  const topFiveAgents = useMemo(() => {
    if (!allAgents) return [];
    const runsMap = new Map((agents || []).map((s) => [s.agentId, s.runs]));
    return [...allAgents]
      .sort((a, b) => {
        const runsA = runsMap.get(a.id) ?? 0;
        const runsB = runsMap.get(b.id) ?? 0;
        if (runsB !== runsA) return runsB - runsA;
        const isCustomA = a.id.startsWith("custom-") ? 1 : 0;
        const isCustomB = b.id.startsWith("custom-") ? 1 : 0;
        if (isCustomB !== isCustomA) return isCustomB - isCustomA;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 5);
  }, [allAgents, agents]);

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
              to="/cost-monitor"
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

          {/* Top 5 AI Agents & Skills */}
          <SectionCard
            title="Top AI Agents & Skills"
            action={
              <div className="flex items-center gap-2.5">
                <Link to="/agents/create-skill">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10">
                    <Plus className="h-3.5 w-3.5" /> Create Agent
                  </Button>
                </Link>
                <ViewAll to="/agents" label={`View all (${allAgents?.length ?? 0})`} />
              </div>
            }
          >
            {isLoadingAgents ? (
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 rounded-xl" />
                ))}
              </div>
            ) : topFiveAgents.length > 0 ? (
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {topFiveAgents.map((agent) => {
                  const runs = (agents || []).find((s) => s.agentId === agent.id)?.runs ?? 0;
                  const isCustom = agent.id.startsWith("custom-");

                  return (
                    <div
                      key={agent.id}
                      className="group relative flex flex-col justify-between rounded-xl border border-border/60 bg-card/60 p-4 transition-all duration-200 hover:border-primary/40 hover:bg-card/90 hover:shadow-md hover:shadow-primary/5"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span
                            className={cn(
                              "inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm shrink-0",
                              isCustom
                                ? "bg-violet-500/15 text-violet-400 border border-violet-500/20"
                                : "bg-primary/15 text-primary border border-primary/20",
                            )}
                          >
                            <Bot className="h-4 w-4" />
                          </span>
                          <Badge
                            variant={isCustom ? "default" : "outline"}
                            className={cn(
                              "text-[10px] px-1.5 py-0",
                              isCustom && "bg-violet-500/20 text-violet-300 border-violet-500/30 hover:bg-violet-500/20",
                            )}
                          >
                            {isCustom ? "Custom Skill" : "Built-in"}
                          </Badge>
                        </div>

                        <Link to={`/agents/${agent.id}`} className="block">
                          <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                            {agent.name}
                          </h4>
                        </Link>
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {agent.description || "Specialized AI workflow agent."}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between pt-2.5 border-t border-border/40">
                        <span className="text-[11px] text-muted-foreground">
                          {runs > 0 ? `${runs} runs` : "Ready"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Link to={`/agents/${agent.id}`}>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground">
                              Details
                            </Button>
                          </Link>
                          <Link to={`/agents/${agent.id}/submit`}>
                            <Button size="sm" className="h-7 px-2.5 text-xs gap-1">
                              <Play className="h-3 w-3 fill-current" /> Run
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
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
                  <Link to="/agents/create-skill">
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" /> Create Agent
                    </Button>
                  </Link>
                </div>
              </Card>
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
