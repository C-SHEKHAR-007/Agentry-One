import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Bot, RefreshCw, Workflow as WorkflowIcon } from "lucide-react";
import { useReapStaleRunsMutation, useRecentAgentRuns } from "../agentRuns.api";
import { useWorkflowRuns } from "../runs.api";
import { errorMessage } from "../../../services/http/errors";
import type { RunSummary } from "../../../models";
import { ExecutionsTable } from "../../../components/common/ExecutionsTable";
import { PageHeader } from "../../../components/common/PageHeader";
import { StatusBadge } from "../../../components/common/StatusBadge";
import { StepChain } from "../../../components/common/StepChain";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { EmptyState } from "../../../components/ui/empty-state";
import { Select } from "../../../components/ui/select";
import { Skeleton } from "../../../components/ui/skeleton";
import { runCode, timeAgo } from "../../../lib/format";
import { cn } from "../../../lib/utils";

const STATUSES = ["all", "running", "completed", "failed", "cancelled", "awaiting_review"] as const;
type RunType = "workflows" | "agents";

function WorkflowRunsTable({ runs }: { runs: RunSummary[] }) {
  if (runs.length === 0) {
    return (
      <EmptyState
        icon={WorkflowIcon}
        title="No workflow runs"
        description="Run a multi-step workflow and each run shows up here with its steps."
        className="py-8"
      />
    );
  }
  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border/60 text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="py-3 pl-1 pr-4 font-medium">Workflow</th>
            <th className="hidden py-3 pr-3 font-medium lg:table-cell">Steps</th>
            <th className="py-3 pr-3 font-medium">Status</th>
            <th className="hidden py-3 pr-1 text-right font-medium md:table-cell">Started</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="group border-b border-border/40 transition-colors last:border-0 hover:bg-muted/40">
              <td className="py-3 pl-1 pr-4">
                <Link to={`/template-runs/${r.id}`} className="block min-w-0">
                  <span className="block truncate text-sm font-medium transition-colors group-hover:text-primary">{r.template.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    <span className="font-mono">{runCode(r.id)}</span> · {r.project.name}
                  </span>
                </Link>
              </td>
              <td className="hidden max-w-[34rem] py-3 pr-3 lg:table-cell">
                <div className="overflow-x-auto pb-0.5 scrollbar-thin">
                  <StepChain steps={r.steps} wrap={false} />
                </div>
              </td>
              <td className="py-3 pr-3">
                <StatusBadge status={r.status} />
              </td>
              <td className="hidden py-3 pr-1 text-right text-xs text-muted-foreground md:table-cell">{timeAgo(r.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Every execution: workflow runs (multi-step, with their step chain) and
 * the individual agent runs they're made of. */
export function ExecutionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const type: RunType = searchParams.get("type") === "agents" ? "agents" : searchParams.get("type") === "workflows" ? "workflows" : searchParams.get("status") ? "agents" : "workflows";
  const urlStatus = searchParams.get("status");
  const status = urlStatus && STATUSES.includes(urlStatus as (typeof STATUSES)[number]) ? urlStatus : "all";

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setSearchParams(next, { replace: true });
  };

  const { data: workflows, isLoading } = useRecentAgentRuns(50, status === "all" ? undefined : status);
  const { data: runs, isLoading: runsLoading } = useWorkflowRuns(status, 50);

  const [reap, { isLoading: reaping }] = useReapStaleRunsMutation();
  const reapMutation = {
    isPending: reaping,
    mutate: () =>
      reap()
        .unwrap()
        .then((res) => (res.reaped > 0 ? toast.success(`Cleaned up ${res.reaped} stale runs`) : toast.info("No stale runs found")))
        .catch((err) => toast.error(errorMessage(err))),
  };

  return (
    <div>
      <PageHeader
        title="Runs"
        description="Every execution across your projects — workflows and the agent runs inside them."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => reapMutation.mutate()} disabled={reapMutation.isPending}>
              <RefreshCw className={`h-4 w-4 ${reapMutation.isPending ? "animate-spin" : ""}`} />
              Reconcile stale
            </Button>
            <Select value={status} onChange={(e) => update({ status: e.target.value === "all" ? null : e.target.value })} className="w-44" aria-label="Filter by status">
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "All statuses" : s === "awaiting_review" ? "Needs review" : s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      <div className="mb-4 flex w-full items-center gap-1 rounded-lg border border-border/60 bg-muted/30 p-0.5 sm:w-fit" role="tablist" aria-label="Run type">
        {(
          [
            ["workflows", "Workflow runs", WorkflowIcon, runs?.length],
            ["agents", "Agent runs", Bot, workflows?.length],
          ] as const
        ).map(([t, label, Icon, n]) => (
          <button
            key={t}
            role="tab"
            aria-selected={type === t}
            onClick={() => update({ type: t })}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:flex-none",
              type === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
            {n !== undefined && <span className="font-mono text-[11px] text-muted-foreground">{n}</span>}
          </button>
        ))}
      </div>

      <Card glass>
        <CardContent className="pt-5">
          {type === "workflows" ? (
            runsLoading ? <Skeleton className="h-64" /> : <WorkflowRunsTable runs={runs ?? []} />
          ) : isLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <ExecutionsTable workflows={workflows ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
