import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity as ActivityIcon,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  FolderKanban,
  ImageIcon,
  Layers,
  Plus,
  Workflow as WorkflowIcon,
} from "lucide-react";
import {
  useAgentStats,
  useEvents,
  useProjects,
  useRecentWorkflows,
  useStatsOverview,
  useSystemHealth,
} from "../api/queries";
import { downloadUrl } from "../api/client";
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

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
];

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card glass>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ViewAll({ to }: { to: string }) {
  return (
    <Link to={to} className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary">
      View all <ArrowRight className="h-3 w-3" />
    </Link>
  );
}

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
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-semibold tracking-tight">
          {greeting()},{" "}
          <span className="bg-gradient-to-r from-primary to-chart-3 bg-clip-text text-transparent">
            Shekhar
          </span>{" "}
          👋
        </h1>
        <p className="mt-1 text-muted-foreground">
          Here's what's happening with your AI agents today.
        </p>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overview ? (
          <>
            <StatCard
              icon={ActivityIcon}
              label="Active Jobs"
              value={overview.jobs.active}
              sub={`${overview.workflows.running} workflow${overview.workflows.running === 1 ? "" : "s"} running`}
              series={series}
              color="hsl(var(--chart-1))"
            />
            <StatCard
              icon={CheckCircle2}
              label="Completed Today"
              value={overview.jobs.completedToday}
              sub={
                overview.jobs.completedYesterday > 0
                  ? `${overview.jobs.completedYesterday} yesterday`
                  : "first runs today?"
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
              sub="est. vs. paid APIs"
              series={series}
              color="hsl(var(--chart-4))"
              delay={0.15}
            />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[110px]" />)
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 xl:col-span-2">
          <SectionCard title="Recent Executions" action={<ViewAll to="/executions" />}>
            {recent ? <ExecutionsTable workflows={recent} /> : <Skeleton className="h-48" />}
          </SectionCard>

          <SectionCard title="Usage Overview">
            <div className="flex flex-col items-center gap-8 sm:flex-row">
              <Donut
                segments={agents.map((a, i) => ({
                  value: a.runs,
                  color: CHART_COLORS[i % CHART_COLORS.length],
                }))}
              >
                <p className="text-2xl font-semibold">{totalJobs}</p>
                <p className="text-xs text-muted-foreground">Total Jobs</p>
              </Donut>
              <div className="w-full flex-1 space-y-2">
                {agents.length === 0 && (
                  <p className="text-sm text-muted-foreground">No jobs run yet.</p>
                )}
                {agents.map((a, i) => (
                  <div key={a.agentId} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <span className="min-w-0 flex-1 truncate">{a.name}</span>
                    <span className="text-muted-foreground">{Math.round(a.share * 100)}%</span>
                    <span className="w-12 text-right text-muted-foreground">{a.runs}</span>
                  </div>
                ))}
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
                  <span className="text-muted-foreground">Success Rate</span>
                  <span className="font-medium">{formatPercent(overview?.successRate)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Avg. Duration</span>
                  <span className="font-medium">{formatDuration(overview?.avgDurationMs)}</span>
                </div>
              </div>
            </div>
          </SectionCard>

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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(projects ?? []).slice(0, 4).map((p) => (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  className="group overflow-hidden rounded-lg border border-border transition-colors hover:border-primary/50"
                >
                  <div className="flex h-28 items-center justify-center bg-gradient-to-br from-secondary to-secondary/40">
                    {p.coverArtifactId ? (
                      <img
                        src={downloadUrl(p.coverArtifactId)}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <FolderKanban className="h-8 w-8 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate font-medium group-hover:text-primary">{p.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {p.counts.workflows} workflows · {p.counts.artifacts} artifacts
                      {p.lastActivityAt ? ` · ${timeAgo(p.lastActivityAt)}` : ""}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </SectionCard>

          {/* CTA banner */}
          <Card glass className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
            <div>
              <p className="font-medium">Build your own agent</p>
              <p className="text-sm text-muted-foreground">
                Drop a manifest under <code className="text-xs">agents/</code> and it appears here
                automatically — no platform changes needed.
              </p>
            </div>
            <Link to="/agents">
              <Button>
                <Plus className="h-4 w-4" /> Create Agent
              </Button>
            </Link>
          </Card>
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          <SectionCard title="Live Activity">
            {events ? <ActivityFeed events={events} /> : <Skeleton className="h-40" />}
          </SectionCard>

          <SectionCard title="Top Agents" action={<ViewAll to="/agents" />}>
            <TopAgents agents={agents} />
          </SectionCard>

          <SectionCard title="System Health">
            {health ? <SystemHealthPanel health={health} /> : <Skeleton className="h-32" />}
          </SectionCard>
        </div>
      </div>

      {/* quick actions for small screens */}
      <div className="fixed bottom-4 right-4 sm:hidden">
        <Link to="/agents">
          <Button size="lg" className="rounded-full shadow-lg">
            <WorkflowIcon className="h-4 w-4" /> Run Agent
          </Button>
        </Link>
      </div>
    </div>
  );
}
