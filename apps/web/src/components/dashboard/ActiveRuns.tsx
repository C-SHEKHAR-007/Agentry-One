import { Link } from "react-router-dom";
import { ArrowRight, Bot, Workflow as WorkflowIcon, Zap } from "lucide-react";
import { useRecentWorkflows, useWorkflowRuns } from "../../api/queries";
import type { RecentWorkflow, RunSummary } from "../../api/types";
import { formatDuration, runCode } from "../../lib/format";
import { cn } from "../../lib/utils";
import { useNow } from "../../hooks/useNow";
import { StatusBadge } from "../StatusBadge";
import { buttonVariants } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { StepChain } from "./StepChain";

function Elapsed({ since }: { since: string }) {
  const now = useNow(1000);
  return <span className="font-mono tabular">{formatDuration(Math.max(0, now - new Date(since).getTime()))}</span>;
}

function WorkflowRunRow({ run }: { run: RunSummary }) {
  const done = run.steps.filter((s) => s.status === "completed").length;
  const pct = run.steps.length ? (done / run.steps.length) * 100 : 0;
  return (
    <li className="group relative overflow-hidden rounded-lg border border-border/60 bg-card/50 p-3.5 transition-colors hover:border-primary/40">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StatusBadge status={run.status} size="sm" />
        <Link to={`/template-runs/${run.id}`} className="min-w-0 flex-1 truncate text-sm font-semibold hover:text-primary">
          {run.template.name}
        </Link>
        <span className="font-mono text-[11px] text-muted-foreground">{runCode(run.id)}</span>
      </div>
      <StepChain steps={run.steps} className="mt-3" />
      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <WorkflowIcon className="h-3 w-3" /> {run.project.name}
        </span>
        <span className="font-mono tabular">
          {done}/{run.steps.length} steps
        </span>
        <span className="ml-auto flex items-center gap-1">
          Running for <Elapsed since={run.createdAt} />
        </span>
        <Link
          to={`/template-runs/${run.id}`}
          className="flex items-center gap-1 font-medium text-foreground/80 transition-colors hover:text-primary"
        >
          View run <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {/* Progress rail along the bottom edge, with a light sweep while live. */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-border/40">
        <div className="relative h-full overflow-hidden bg-primary transition-[width] duration-700" style={{ width: `${Math.max(pct, 4)}%` }}>
          <span className="absolute inset-y-0 w-1/3 animate-sweep bg-gradient-to-r from-transparent via-white/70 to-transparent" />
        </div>
      </div>
    </li>
  );
}

function AgentRunRow({ wf }: { wf: RecentWorkflow }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/50 px-3.5 py-2.5 transition-colors hover:border-primary/40">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Bot className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <Link to={`/workflows/${wf.id}`} className="block truncate text-sm font-medium hover:text-primary">
          {wf.agentName}
        </Link>
        <p className="truncate text-[11px] text-muted-foreground">
          <span className="font-mono">{runCode(wf.id)}</span> · {wf.project.name}
        </p>
      </div>
      <span className="text-xs text-muted-foreground">
        <Elapsed since={wf.createdAt} />
      </span>
      <StatusBadge status={wf.status} size="sm" />
    </li>
  );
}

/** What's executing right now: workflow runs with their live step chain,
 * then single-agent runs that aren't part of a workflow. */
export function ActiveRuns() {
  const { data: runs } = useWorkflowRuns("active", 4);
  const { data: running } = useRecentWorkflows(12, "running");
  const inRuns = new Set((runs ?? []).flatMap((r) => r.steps.map((s) => s.workflowId).filter(Boolean)));
  const agentRuns = (running ?? []).filter((w) => !inRuns.has(w.id)).slice(0, 4);
  const loading = !runs || !running;
  const empty = !loading && runs.length === 0 && agentRuns.length === 0;

  return (
    <div className="min-w-0">
      {loading ? (
        <div className="space-y-2.5">
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
      ) : empty ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/70 px-6 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Zap className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Nothing is running right now</p>
            <p className="mt-1 text-xs text-muted-foreground">Start a workflow and watch each agent pick up its step here, live.</p>
          </div>
          <Link to="/builder" className={cn(buttonVariants({ size: "sm" }))}>
            Run a workflow
          </Link>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {runs.map((r) => (
            <WorkflowRunRow key={r.id} run={r} />
          ))}
          {agentRuns.map((w) => (
            <AgentRunRow key={w.id} wf={w} />
          ))}
        </ul>
      )}
    </div>
  );
}
