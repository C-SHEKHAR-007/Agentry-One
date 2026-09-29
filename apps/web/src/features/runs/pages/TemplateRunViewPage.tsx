import { useMemo, useState } from "react";
import { NotFoundPage } from "../../../components/common/NotFoundPage";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Coins,
  ExternalLink,
  Eye,
  Keyboard,
  Layers,
  ListTree,
  Network,
  Pencil,
  RotateCw,
  Timer,
  Wallet,
} from "lucide-react";
import type { RunStepWorkflow } from "../../../models";
import { useAgentsQuery } from "../../agents/agents.api";
import { useAdvanceAgentRunMutation, useAgentRunQuery } from "../agentRuns.api";
import { useCancelWorkflowRunMutation, useWorkflowRunLive } from "../runs.api";
import { poll, useLiveInterval } from "../../../services/api/polling";
import { errorMessage } from "../../../services/http/errors";
import { RunGraph } from "../components/RunGraph";
import { StepInspector } from "../components/StepInspector";
import { useNow } from "../../../hooks/useNow";
import { formatDuration, formatTokens, formatUsd, runCode, timeAgo } from "../../../lib/format";
import { LIVE_STATUSES, statusStyle } from "../../../lib/status";
import { cn } from "../../../lib/utils";
import { StatusBadge } from "../../../components/common/StatusBadge";
import { ArtifactPreview } from "../../../components/common/ArtifactPreview";
import { Button, buttonVariants } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Textarea } from "../../../components/ui/textarea";
import { Skeleton } from "../../../components/ui/skeleton";
import { Spinner } from "../../../components/ui/spinner";
import { Badge } from "../../../components/ui/badge";

const AGENT_RUN_LIVE = ["running", "awaiting_review"] as const;

function StepRowCard({ step, agentName }: { step: RunStepWorkflow; agentName: string }) {
  const [reviewNotes, setReviewNotes] = useState("");

  // The step's agent run, polled every 2s while running or awaiting review.
  const cached = useAgentRunQuery(step.workflowId ?? "", { skip: !step.workflowId });
  const interval = useLiveInterval(cached.data?.status, AGENT_RUN_LIVE, 2000);
  const { data: workflow } = useAgentRunQuery(step.workflowId ?? "", { skip: !step.workflowId, ...poll(interval) });

  const awaitingWfStep = workflow?.steps?.find((s) => s.status === "awaiting_review");

  // Refreshes this agent run and the workflow run (tags).
  const [advance, { isLoading: advancing }] = useAdvanceAgentRunMutation();
  const advanceStepMutation = {
    isPending: advancing,
    mutate: () =>
      step.workflowId &&
      awaitingWfStep &&
      advance({ workflowId: step.workflowId, stepKey: awaitingWfStep.stepKey, notes: reviewNotes })
        .unwrap()
        .then(() => {
          toast.success(`Step approved! Pipeline continuing to next stage.`);
          setReviewNotes("");
        })
        .catch((err) => toast.error(errorMessage(err))),
  };

  const allArtifacts = workflow?.steps?.flatMap((s) => s.artifacts || []) || [];

  return (
    <Card glass className="overflow-hidden transition-all hover:border-primary/40">
      <div className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-semibold text-primary">
            {step.templateStep.stepOrder + 1}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{agentName}</p>
              <Badge variant="outline" className="text-[11px] font-mono">
                {step.templateStep.agentId}
              </Badge>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={step.status} />
              {workflow?.status && workflow.status !== step.status && (
                <span className="text-xs text-muted-foreground">({workflow.status})</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {step.workflowId && (
            <Link to={`/workflows/${step.workflowId}`}>
              <Button size="sm" variant="ghost" className="h-8 text-xs gap-1">
                <ExternalLink className="h-3.5 w-3.5" /> Details
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Inline Human Review Banner & Action */}
      {awaitingWfStep && (
        <div className="border-t border-warning/30 bg-warning/10 p-4 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-warning font-semibold text-xs">
            <Eye className="h-4 w-4" />
            <span>Human Review Required — Review generated output below before continuing</span>
          </div>

          <div className="space-y-1.5">
            <Textarea
              rows={2}
              placeholder="Add optional reviewer feedback or guidance notes..."
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              className="text-xs bg-background/80"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              onClick={() => advanceStepMutation.mutate()}
              disabled={advanceStepMutation.isPending}
              className="bg-warning text-warning-foreground hover:bg-warning/90 text-xs h-8 px-4"
            >
              {advanceStepMutation.isPending ? (
                <Spinner className="h-3.5 w-3.5 mr-1" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              )}
              Approve Step &amp; Continue Pipeline
            </Button>
          </div>
        </div>
      )}

      {/* Artifact Previews */}
      {allArtifacts.length > 0 && (
        <div className="border-t border-border/40 p-4 bg-muted/10 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Produced Artifacts ({allArtifacts.length})</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {allArtifacts.map((art) => (
              <ArtifactPreview key={art.id} artifact={art} compact />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

type View = "graph" | "steps" | "inputs";

function Tile({ icon: Icon, label, value, sub }: { icon: typeof Layers; label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <Card glass className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="truncate font-mono text-base font-semibold tabular">{value}</p>
        {sub && <p className="truncate text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </Card>
  );
}

export function TemplateRunViewPage() {
  const { runId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = (searchParams.get("view") as View) || "graph";
  const [selected, setSelected] = useState<number | null>(null);

  const { data: run, isError: runLoadFailed } = useWorkflowRunLive(runId);
  const { data: agents } = useAgentsQuery();
  const agentNames = useMemo(() => new Map((agents ?? []).map((a) => [a.id, a.name])), [agents]);

  const [cancelRun, { isLoading: cancelling }] = useCancelWorkflowRunMutation();
  const cancel = {
    isPending: cancelling,
    mutate: () =>
      runId &&
      cancelRun(runId)
        .unwrap()
        .then(() => toast.success("Cancelling — steps already running will finish, nothing new starts"))
        .catch((err) => toast.error(errorMessage(err))),
  };

  const live = LIVE_STATUSES.includes(run?.status ?? "");
  const now = useNow(1000, live);

  if (runLoadFailed) return <NotFoundPage what="workflow run" />;
  if (!run) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 max-w-xl" />
        <div className="grid gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
        <Skeleton className="h-[520px]" />
      </div>
    );
  }

  const steps = [...run.steps].sort((a, b) => a.templateStep.stepOrder - b.templateStep.stepOrder);
  const nameOf = (s: (typeof steps)[number]) => s.workflow?.agentName ?? agentNames.get(s.templateStep.agentId) ?? s.templateStep.agentId;
  const focus =
    selected ??
    (steps.find((s) => s.status === "awaiting_review") ??
      steps.find((s) => s.status === "running") ??
      steps.find((s) => s.status === "failed") ??
      steps[steps.length - 1])?.templateStep.stepOrder ??
    null;
  const focused = steps.find((s) => s.templateStep.stepOrder === focus);
  const done = steps.filter((s) => s.status === "completed").length;
  const elapsed = live ? now - new Date(run.createdAt).getTime() : run.totals.durationMs;
  const hasAwaiting = run.status === "awaiting_review" || steps.some((s) => s.status === "awaiting_review");
  const setView = (v: View) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v === "graph") next.delete("view");
        else next.set("view", v);
        return next;
      },
      { replace: true },
    );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Link
              to="/runs?type=workflows"
              aria-label="Back to runs"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="truncate text-lg font-semibold tracking-tight">{run.template.name}</h1>
            <StatusBadge status={run.status} className="ml-1" />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pl-9 text-xs text-muted-foreground">
            <button
              type="button"
              title="Copy run id"
              className="font-mono transition-colors hover:text-foreground"
              onClick={() => {
                navigator.clipboard?.writeText(run.id).then(() => toast.success("Run id copied"), () => {});
              }}
            >
              {runCode(run.id)}
            </button>
            <span>Started {timeAgo(run.createdAt)}</span>
            <span>{steps.length} steps</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pl-9 lg:pl-0">
          {["running", "pending", "awaiting_review"].includes(run.status) && (
            <Button variant="secondary" size="sm" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
              <Ban className="h-3.5 w-3.5" /> Cancel
            </Button>
          )}
          <Link to={`/templates/${run.template.id}/edit`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
            <Pencil className="h-3.5 w-3.5" /> Edit workflow
          </Link>
          <Link to={`/templates/${run.template.id}/run`} className={buttonVariants({ size: "sm" })}>
            <RotateCw className="h-3.5 w-3.5" /> Run again
          </Link>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={Layers} label="Steps" value={`${done}/${steps.length}`} sub={live ? "in progress" : run.status === "completed" ? "all done" : statusStyle(run.status).label} />
        <Tile icon={Timer} label={live ? "Elapsed" : "Duration"} value={formatDuration(elapsed)} sub={live ? "live" : undefined} />
        <Tile
          icon={Coins}
          label="Tokens"
          value={formatTokens(run.totals.inputTokens + run.totals.outputTokens, { zero: true })}
          sub={`${formatTokens(run.totals.inputTokens, { zero: true })} in · ${formatTokens(run.totals.outputTokens, { zero: true })} out`}
        />
        <Tile icon={Wallet} label="Cost" value={formatUsd(run.totals.costUsd)} sub="at configured per-job prices" />
      </div>

      {hasAwaiting && (
        <div className="flex items-center gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          <Eye className="h-4 w-4 shrink-0" />
          <span>A step is waiting for your review. Select it to check the output and approve.</span>
        </div>
      )}

      {/* View switch */}
      <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 p-0.5 sm:w-fit" role="tablist">
        {(
          [
            ["graph", "Graph", Network],
            ["steps", "Steps", ListTree],
            ["inputs", "Inputs", Keyboard],
          ] as const
        ).map(([v, label, Icon]) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:flex-none",
              view === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {view === "graph" && (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card glass className="glow-border relative h-[440px] overflow-hidden border-transparent sm:h-[560px]">
            <RunGraph run={run} agentNames={agentNames} selected={focus} onSelect={setSelected} />
            <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-3 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur">
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-success" /> done</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-primary" /> running</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded border-t border-dashed border-muted-foreground" /> waiting</span>
            </div>
          </Card>
          <Card glass className="p-4 xl:sticky xl:top-0">
            {focused ? <StepInspector step={focused} agentName={nameOf(focused)} /> : <p className="text-sm text-muted-foreground">Select a step.</p>}
          </Card>
        </div>
      )}

      {view === "steps" && (
        <div className="space-y-3">
          {steps.map((step) => (
            <StepRowCard
              key={step.id}
              step={step}
              agentName={nameOf(step)}
            />
          ))}
        </div>
      )}

      {view === "inputs" && (
        <Card glass className="p-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Run inputs</p>
          {Object.keys(run.runInputs ?? {}).length === 0 ? (
            <p className="text-sm text-muted-foreground">This run didn't ask for any inputs.</p>
          ) : (
            <dl className="divide-y divide-border/60">
              {Object.entries(run.runInputs).map(([k, v]) => (
                <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[180px_minmax(0,1fr)]">
                  <dt className="font-mono text-xs text-muted-foreground">{k}</dt>
                  <dd className="whitespace-pre-wrap break-words text-sm">{typeof v === "string" ? v : JSON.stringify(v, null, 2)}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
      )}
    </div>
  );
}
