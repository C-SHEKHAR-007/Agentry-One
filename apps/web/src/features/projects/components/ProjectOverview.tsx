import { Activity, CheckCircle2, Images, Workflow } from "lucide-react";
import type { ArtifactListItem, Project, Template } from "../../../models";
import { formatPercent, timeAgo } from "../../../lib/format";
import { ArtifactCard } from "../../../components/common/ArtifactCard";
import { StatCard } from "../../../components/common/StatCard";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { NO_ACTIVITY } from "./ProjectCard";
import { ProjectWorkflows } from "./ProjectWorkflows";

/** Stats for the last 30 days and the project's top workflows. */
export function ProjectOverview({
  project: p,
  templates,
  recentArtifacts,
  onTab,
}: {
  project: Project;
  templates?: Template[];
  recentArtifacts?: ArtifactListItem[];
  onTab: (tab: string) => void;
}) {
  const a = p.activity ?? NO_ACTIVITY;
  const settled = a.completed30d + a.failed30d;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Activity} label="Runs · 30 days" value={a.runs30d} sub={p.lastActivityAt ? `Last active ${timeAgo(p.lastActivityAt)}` : "No runs yet"} series={a.daily} />
        <StatCard
          icon={CheckCircle2}
          label="Success rate"
          value={formatPercent(a.successRate)}
          sub={settled ? `${a.completed30d} completed · ${a.failed30d} failed` : "Nothing finished yet"}
          color="hsl(var(--chart-2))"
          delay={0.05}
        />
        <StatCard icon={Images} label="Artifacts" value={p.counts.artifacts} sub="All time" color="hsl(var(--chart-3))" delay={0.1} />
        <StatCard icon={Workflow} label="Workflows" value={p.counts.templates} sub={`${p.counts.workflows} agent runs all time`} color="hsl(var(--chart-4))" delay={0.15} />
      </div>

      <Card glass>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Workflows</CardTitle>
          {(templates?.length ?? 0) > 3 && (
            <Button size="sm" variant="ghost" onClick={() => onTab("workflows")}>
              View all {templates?.length}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <ProjectWorkflows templates={templates} limit={3} />
        </CardContent>
      </Card>

      {recentArtifacts && recentArtifacts.length > 0 && (
        <Card glass>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Recent artifacts</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => onTab("artifacts")}>
              View all {p.counts.artifacts}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {recentArtifacts.slice(0, 4).map((a, i) => (
                <ArtifactCard key={a.id} artifact={a} index={i} onPreview={() => onTab("artifacts")} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
