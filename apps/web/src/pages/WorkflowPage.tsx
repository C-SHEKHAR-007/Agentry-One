import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Bot,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  Eye,
  FolderKanban,
  Layers,
  Loader2,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { api, sseUrl } from "../api/client";
import type { JobRun, Workflow, WorkflowEvent, WorkflowStep } from "../api/types";
import { attemptError, failureHint } from "../lib/failureHints";
import { formatDuration, formatTokens, formatUsd, timeAgo } from "../lib/format";
import { RunLogs } from "../components/runs/RunLogs";
import { cn } from "../lib/utils";
import { ArtifactPreview } from "../components/ArtifactPreview";
import { Button, buttonVariants } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Skeleton } from "../components/ui/skeleton";
import { Textarea } from "../components/ui/textarea";
import { NotFoundPage } from "./NotFoundPage";

const LIVE = ["running", "queued", "pending", "cancelling"];

const STATUS: Record<string, { label: string; pill: string; icon: typeof Check }> = {
  completed: { label: "Completed", pill: "bg-success/15 text-success", icon: CheckCircle2 },
  failed: { label: "Failed", pill: "bg-destructive/15 text-destructive", icon: XCircle },
  running: { label: "Running", pill: "bg-primary/15 text-primary", icon: Loader2 },
  queued: { label: "Queued", pill: "bg-secondary text-muted-foreground", icon: Clock },
  pending: { label: "Queued", pill: "bg-secondary text-muted-foreground", icon: Clock },
  awaiting_review: { label: "Needs review", pill: "bg-warning/15 text-warning", icon: Eye },
  cancelling: { label: "Cancelling", pill: "bg-secondary text-muted-foreground", icon: Loader2 },
  cancelled: { label: "Cancelled", pill: "bg-secondary text-muted-foreground", icon: Ban },
};
const statusOf = (s: string) => STATUS[s] ?? { label: s, pill: "bg-secondary text-muted-foreground", icon: Circle };

function runDuration(runs: JobRun[] | undefined): number | null {
  const started = (runs ?? []).map((r) => r.startedAt).filter(Boolean).map((d) => new Date(d!).getTime());
  const finished = (runs ?? []).map((r) => r.finishedAt).filter(Boolean).map((d) => new Date(d!).getTime());
  if (!started.length || !finished.length) return null;
  const ms = Math.max(...finished) - Math.min(...started);
  return ms >= 0 ? ms : null;
}

function useElapsed(since: string | undefined, active: boolean): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return since ? now - new Date(since).getTime() : null;
}

export function WorkflowPage() {
  const { workflowId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<{ percent?: number; message?: string }>({});
  const [reviewNotes, setReviewNotes] = useState("");

  const { data: workflow, isError: loadFailed } = useQuery({
    queryKey: ["workflow", workflowId],
    queryFn: () => api.get<Workflow>(`/workflows/${workflowId}`),
    refetchInterval: (q) => (LIVE.includes(q.state.data?.status ?? "") ? 3000 : false),
  });
  const { data: events = [] } = useQuery({
    queryKey: ["workflow-events", workflowId],
    queryFn: () => api.get<WorkflowEvent[]>(`/workflows/${workflowId}/events`),
    refetchInterval: LIVE.includes(workflow?.status ?? "") ? 5000 : false,
  });

  const steps = workflow?.steps ?? [];
  const activeStep = steps.find((s) => s.status === "running" || s.status === "queued");
  const activeJobId = activeStep?.job?.id;
  const awaitingStep = steps.find((s) => s.status === "awaiting_review");
  const isLive = LIVE.includes(workflow?.status ?? "");

  // Live progress for the running job (server-sent events).
  useEffect(() => {
    if (!activeJobId) return;
    const source = new EventSource(sseUrl(activeJobId));
    source.onmessage = (event) => {
      let payload: { type?: string; percent?: number; message?: string };
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (payload.type === "progress") setProgress({ percent: payload.percent, message: payload.message });
      if (payload.type === "log") queryClient.invalidateQueries({ queryKey: ["workflow-logs", workflowId] });
      if (payload.type === "completed" || payload.type === "failed") {
        queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
        queryClient.invalidateQueries({ queryKey: ["workflow-events", workflowId] });
        source.close();
      }
    };
    return () => source.close();
  }, [activeJobId, workflowId, queryClient]);

  const elapsed = useElapsed(workflow?.createdAt, isLive);

  const cancel = useMutation({
    mutationFn: () => api.post(`/workflows/${workflowId}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
      toast.success("Cancelling…");
    },
    onError: (err) => toast.error(err.message),
  });

  const approve = useMutation({
    mutationFn: () => api.post(`/workflows/${workflowId}/steps/${awaitingStep?.stepKey}/advance`, { notes: reviewNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
      queryClient.invalidateQueries({ queryKey: ["workflow-events", workflowId] });
      toast.success("Approved — continuing");
      setReviewNotes("");
    },
    onError: (err) => toast.error(err.message),
  });

  const rerun = useMutation({
    mutationFn: () => api.post<{ id: string }>(`/projects/${workflow!.projectId}/workflows`, { agentId: workflow!.agentId, input: workflow!.inputParams }),
    onSuccess: (wf) => {
      toast.success("Started a new run with the same inputs");
      navigate(`/workflows/${wf.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const failure = useMemo(() => {
    if (workflow?.status !== "failed") return null;
    const failedStep = steps.find((s) => s.status === "failed") ?? steps[steps.length - 1];
    const runs = failedStep?.job?.runs ?? [];
    const lastFailed = [...runs].reverse().find((r) => r.status === "failed");
    const eventReason = [...events].reverse().find((e) => e.type === "job.failed")?.payload as { failedReason?: string } | undefined;
    const message = attemptError(lastFailed?.error) ?? eventReason?.failedReason ?? null;
    return { step: failedStep, message, attempts: runs.length, hint: failureHint(message) };
  }, [workflow?.status, steps, events]);

  if (loadFailed) return <NotFoundPage what="run" />;
  if (!workflow) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  // A run is "running" from the moment it's created, but until a worker picks
  // up its first attempt it's really just queued -- say so.
  const waitingForWorker =
    workflow.status === "running" && activeStep?.status === "queued" && !(activeStep.job?.runs?.length ?? 0);
  const displayStatus = waitingForWorker ? "queued" : workflow.status;
  const st = statusOf(displayStatus);
  const StatusIcon = st.icon;
  const agentName = workflow.agent?.name ?? workflow.agentId;
  const artifacts = steps.flatMap((s) => s.artifacts ?? []);
  const duration = isLive ? elapsed : runDuration(steps.flatMap((s) => s.job?.runs ?? []));
  const allRuns = steps.flatMap((s) => s.job?.runs ?? []);
  const usage = {
    model: [...allRuns].reverse().find((r) => r.model)?.model ?? steps.find((s) => s.job?.providerModel)?.job?.providerModel ?? null,
    input: allRuns.reduce((n, r) => n + (r.inputTokens ?? 0), 0),
    output: allRuns.reduce((n, r) => n + (r.outputTokens ?? 0), 0),
    tokens: allRuns.reduce((n, r) => n + (r.inputTokens ?? 0) + (r.outputTokens ?? 0), 0),
    cost: allRuns.some((r) => r.costUsd != null) ? allRuns.reduce((n, r) => n + (r.costUsd ?? 0), 0) : null,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Link
              to="/runs"
              aria-label="Back to executions"
              title="Back to executions"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="truncate text-lg font-semibold tracking-tight">{agentName}</h1>
            <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", st.pill)}>
              <StatusIcon className={cn("h-3 w-3", (displayStatus === "running" || displayStatus === "cancelling") && "animate-spin")} />
              {st.label}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pl-9 text-xs text-muted-foreground">
            <CopyId id={workflow.id} />
            <span title={new Date(workflow.createdAt).toLocaleString()}>Started {timeAgo(workflow.createdAt)}</span>
            {duration != null && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {formatDuration(duration)}
                {isLive && " so far"}
              </span>
            )}
            {workflow.project && (
              <Link to={`/projects/${workflow.project.id}`} className="flex items-center gap-1 hover:text-foreground">
                <FolderKanban className="h-3 w-3" /> {workflow.project.name}
              </Link>
            )}
            {workflow.templateRun && (
              <Link to={`/template-runs/${workflow.templateRun.id}`} className="flex items-center gap-1 hover:text-foreground">
                <Layers className="h-3 w-3" /> Part of “{workflow.templateRun.templateName}”
              </Link>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 pl-9 lg:pl-0">
          <Link to={`/agents/${workflow.agentId}`} className={buttonVariants({ size: "sm", variant: "secondary" })}>
            <Bot className="h-3.5 w-3.5" /> Agent
          </Link>
          {isLive ? (
            <Button size="sm" variant="secondary" onClick={() => cancel.mutate()} disabled={cancel.isPending || workflow.status === "cancelling"}>
              <Ban className="h-3.5 w-3.5" /> Cancel
            </Button>
          ) : (
            !workflow.templateRun && (
              <Button size="sm" onClick={() => rerun.mutate()} disabled={rerun.isPending} title="Start a new run with the same inputs">
                <RotateCcw className="h-3.5 w-3.5" /> Run again
              </Button>
            )
          )}
        </div>
      </div>

      {/* Why it failed */}
      {failure && (
        <Card className="border-destructive/40 bg-destructive/[0.06] p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <h2 className="text-sm font-semibold">{failure.hint.title}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{failure.hint.advice}</p>
              </div>
              {failure.message && <ErrorBlock message={failure.message} />}
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                {failure.hint.action && (
                  <Link to={failure.hint.action.to} className={buttonVariants({ size: "sm" })}>
                    {failure.hint.action.label}
                  </Link>
                )}
                {!workflow.templateRun && (
                  <Button size="sm" variant="secondary" onClick={() => rerun.mutate()} disabled={rerun.isPending}>
                    <RotateCcw className="h-3.5 w-3.5" /> Run again
                  </Button>
                )}
                {failure.attempts > 1 && <span className="text-xs text-muted-foreground">Failed after {failure.attempts} attempts</span>}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Live progress */}
      {isLive && workflow.status !== "cancelling" && (
        <Card glass className="p-4">
          <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              {progress.message || (activeStep?.status === "queued" ? "Waiting for a worker to pick this up…" : "Working…")}
            </span>
            {progress.percent != null && <span className="font-mono text-xs text-primary">{progress.percent}%</span>}
          </div>
          <Progress value={progress.percent} indeterminate={progress.percent == null} />
        </Card>
      )}

      {/* Human review */}
      {workflow.status === "awaiting_review" && awaitingStep && (
        <Card className="border-warning/40 bg-warning/[0.06] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-warning">
                <Eye className="h-4 w-4" /> Waiting for your review
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Step <code className="text-foreground">{awaitingStep.stepKey}</code> finished. Check its output below, then approve to continue or reject to stop the run.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="secondary" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
                <Ban className="h-3.5 w-3.5" /> Reject
              </Button>
              <Button size="sm" onClick={() => approve.mutate()} disabled={approve.isPending}>
                <Check className="h-3.5 w-3.5" /> {approve.isPending ? "Approving…" : "Approve"}
              </Button>
            </div>
          </div>
          <Textarea
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            placeholder="Optional notes for the next step…"
            rows={2}
            className="mt-3 text-xs"
          />
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <Section title="Output" meta={artifacts.length ? `${artifacts.length} ${artifacts.length === 1 ? "item" : "items"}` : undefined}>
            {artifacts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/70 py-8 text-center text-sm text-muted-foreground">
                {isLive ? "The output will appear here when the run finishes." : workflow.status === "failed" ? "Nothing was produced — the run failed." : "This run produced no output."}
              </p>
            ) : (
              <div className={cn("grid gap-4", artifacts.length > 1 && "sm:grid-cols-2")}>
                {artifacts.map((a) => (
                  <div
                    key={a.id}
                    // A lone image/video would otherwise fill the column edge to edge.
                    className={cn(artifacts.length === 1 && /^(image|video)\//.test(a.mimeType) && "mx-auto w-full max-w-md")}
                  >
                    <ArtifactPreview artifact={a} />
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title={steps.length > 1 ? "Steps" : "Attempts"}>
            <ol className="space-y-3">
              {steps.map((s) => (
                <StepRow key={s.id} step={s} showKey={steps.length > 1} shownError={failure?.message ?? null} />
              ))}
            </ol>
          </Section>

          <Section title="Logs" meta={isLive ? "streaming" : undefined}>
            <RunLogs workflowId={workflow.id} live={isLive} header={false} emptyText="This run has no log lines (runs from before logging was added won't)." />
          </Section>

          <Section title="Activity">
            <Activity workflow={workflow} events={events} />
          </Section>
        </div>

        <div className="min-w-0 space-y-5">
          <Section title="Inputs">
            <Inputs params={workflow.inputParams} />
          </Section>
          <Section title="Details">
            <dl className="space-y-2 text-xs">
              <Detail label="Agent">
                <Link to={`/agents/${workflow.agentId}`} className="text-primary hover:underline">
                  {agentName}
                </Link>{" "}
                <span className="text-muted-foreground">v{workflow.agentVersion}</span>
              </Detail>
              {usage.model && (
                <Detail label="Model">
                  <code className="font-mono">{usage.model}</code>
                </Detail>
              )}
              {usage.tokens > 0 && (
                <Detail label="Tokens">
                  <span className="font-mono tabular">
                    {formatTokens(usage.tokens)} <span className="text-muted-foreground">({formatTokens(usage.input, { zero: true })} in · {formatTokens(usage.output, { zero: true })} out)</span>
                  </span>
                </Detail>
              )}
              {usage.cost !== null && (
                <Detail label="Cost">
                  <span className="font-mono tabular">{formatUsd(usage.cost)}</span>
                </Detail>
              )}
              {steps.find((s) => s.job?.providerType)?.job?.providerType && (
                <Detail label="Provider">
                  <code>{steps.find((s) => s.job?.providerType)!.job!.providerType}</code>
                </Detail>
              )}
              {workflow.project && (
                <Detail label="Project">
                  <Link to={`/projects/${workflow.project.id}`} className="hover:underline">
                    {workflow.project.name}
                  </Link>
                </Detail>
              )}
              <Detail label="Started">{new Date(workflow.createdAt).toLocaleString()}</Detail>
              <Detail label="Run ID">
                <CopyId id={workflow.id} full />
              </Detail>
            </dl>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return (
    <Card glass className="p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
        {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
      </div>
      {children}
    </Card>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right">{children}</dd>
    </div>
  );
}

function CopyId({ id, full = false }: { id: string; full?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Copy run ID"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(id);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          toast.error("Couldn't access the clipboard");
        }
      }}
      className="inline-flex items-center gap-1 font-mono hover:text-foreground"
    >
      {full ? id.slice(0, 18) + "…" : `#${id.slice(0, 8)}`}
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function ErrorBlock({ message }: { message: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md border border-destructive/20 bg-background/60 p-2.5 pr-9 font-mono text-[11px] leading-relaxed text-foreground/90">
        {message}
      </pre>
      <Button
        size="icon"
        variant="ghost"
        className="absolute right-1 top-1 h-7 w-7"
        aria-label="Copy error"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(message);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          } catch {
            toast.error("Couldn't access the clipboard");
          }
        }}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

function StepRow({ step, showKey, shownError }: { step: WorkflowStep; showKey: boolean; shownError: string | null }) {
  const runs = step.job?.runs ?? [];
  const st = statusOf(step.status);
  const Icon = st.icon;
  return (
    <li className="rounded-lg border border-border/70">
      {showKey && (
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
          <Icon className={cn("h-3.5 w-3.5", step.status === "running" && "animate-spin", st.pill.split(" ").find((c) => c.startsWith("text-")))} />
          <code className="text-xs font-semibold">{step.stepKey}</code>
          <span className="text-xs text-muted-foreground">{st.label}</span>
          {step.humanGate && <span className="ml-auto text-[11px] text-muted-foreground">review required</span>}
        </div>
      )}
      {runs.length === 0 ? (
        <p className="px-3 py-2.5 text-xs text-muted-foreground">{step.status === "pending" ? "Not started yet." : "Waiting for a worker…"}</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {runs.map((r) => {
            const rs = statusOf(r.status);
            const RIcon = rs.icon;
            const ms = r.startedAt && r.finishedAt ? new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime() : null;
            const err = attemptError(r.error);
            return (
              <li key={r.id} className="px-3 py-2">
                <div className="flex items-center gap-2 text-xs">
                  <RIcon className={cn("h-3.5 w-3.5 shrink-0", r.status === "running" && "animate-spin", rs.pill.split(" ").find((c) => c.startsWith("text-")))} />
                  <span className="font-medium">Attempt {r.attemptNumber}</span>
                  <span className="text-muted-foreground">{rs.label}</span>
                  <span className="ml-auto flex items-center gap-3 text-muted-foreground">
                    {r.startedAt && <span title={new Date(r.startedAt).toLocaleString()}>{new Date(r.startedAt).toLocaleTimeString()}</span>}
                    {(r.inputTokens ?? 0) + (r.outputTokens ?? 0) > 0 && (
                      <span className="font-mono tabular">{formatTokens((r.inputTokens ?? 0) + (r.outputTokens ?? 0))} tok</span>
                    )}
                    {ms != null && <span className="font-mono tabular">{formatDuration(ms)}</span>}
                  </span>
                </div>
                {err &&
                  (err === shownError ? (
                    <p className="mt-1 pl-5 text-[11px] text-muted-foreground">Same error as shown above.</p>
                  ) : (
                    <p className="mt-1 line-clamp-2 pl-5 font-mono text-[11px] text-destructive/90" title={err}>
                      {err}
                    </p>
                  ))}
                {r.status === "running" && r.progressMessage && <p className="mt-1 pl-5 text-[11px] text-muted-foreground">{r.progressMessage}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function Inputs({ params }: { params: Record<string, unknown> }) {
  const entries = Object.entries(params ?? {});
  if (entries.length === 0) return <p className="text-xs text-muted-foreground">No inputs.</p>;
  return (
    <dl className="space-y-3">
      {entries.map(([k, v]) => {
        const isText = typeof v === "string";
        const long = isText && ((v as string).length > 60 || (v as string).includes("\n"));
        return (
          <div key={k} className="min-w-0">
            <dt className="text-[11px] text-muted-foreground">{k}</dt>
            <dd className="mt-0.5 text-sm">
              {v === null || v === undefined || v === "" ? (
                <span className="text-muted-foreground">—</span>
              ) : typeof v === "object" ? (
                <pre className="overflow-x-auto rounded bg-muted/40 p-2 font-mono text-[11px]">{JSON.stringify(v, null, 2)}</pre>
              ) : long ? (
                <p className="whitespace-pre-wrap break-words leading-relaxed">{String(v)}</p>
              ) : (
                <span className={cn("break-words", !isText && "font-mono")}>{String(v)}</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function Activity({ workflow, events }: { workflow: Workflow; events: WorkflowEvent[] }) {
  const rows = useMemo(() => {
    const out: Array<{ id: string; label: string; at: string; tone: string }> = [{ id: "start", label: "Run started", at: workflow.createdAt, tone: "bg-primary" }];
    for (const s of workflow.steps ?? []) for (const a of s.artifacts ?? []) out.push({ id: a.id, label: `Saved ${a.kind} output`, at: a.createdAt ?? workflow.updatedAt, tone: "bg-chart-2" });
    for (const s of workflow.steps ?? [])
      for (const r of s.job?.runs ?? []) if (r.startedAt && r.attemptNumber > 1) out.push({ id: `retry-${r.id}`, label: `Retried (attempt ${r.attemptNumber})`, at: r.startedAt, tone: "bg-warning" });
    const labels: Record<string, [string, string]> = {
      "workflow.completed": ["Completed", "bg-success"],
      "workflow.failed": ["Failed", "bg-destructive"],
      "job.failed": ["Failed", "bg-destructive"],
      "workflow.cancelled": ["Cancelled", "bg-muted-foreground"],
      "workflow.awaiting_review": ["Paused for review", "bg-warning"],
      "job.completed": ["Agent finished", "bg-success"],
    };
    for (const e of events) {
      const l = labels[e.type];
      if (l) out.push({ id: e.id, label: l[0], at: e.createdAt, tone: l[1] });
    }
    return out.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }, [workflow, events]);

  return (
    <ol className="relative space-y-2.5 before:absolute before:bottom-2 before:left-[3px] before:top-2 before:w-px before:bg-border">
      {rows.map((r) => (
        <li key={r.id} className="relative flex items-baseline gap-3 pl-4 text-xs">
          <span className={cn("absolute left-0 top-1.5 h-[7px] w-[7px] rounded-full", r.tone)} />
          <span className="flex-1">{r.label}</span>
          <span className="shrink-0 tabular-nums text-muted-foreground" title={new Date(r.at).toLocaleString()}>
            {new Date(r.at).toLocaleTimeString()}
          </span>
        </li>
      ))}
    </ol>
  );
}
