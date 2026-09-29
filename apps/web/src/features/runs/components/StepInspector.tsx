import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Eye } from "lucide-react";
import { useAdvanceAgentRunMutation, useAgentRunArtifactsQuery, useAgentRunQuery } from "../agentRuns.api";
import { errorMessage } from "../../../services/http/errors";
import type { RunDetail } from "../../../models";
import { failureHint } from "../../../lib/failureHints";
import { formatDuration, formatTokens, formatUsd, runCode } from "../../../lib/format";
import { cn } from "../../../lib/utils";
import { ArtifactPreview } from "../../../components/common/ArtifactPreview";
import { StatusBadge } from "../../../components/common/StatusBadge";
import { Button, buttonVariants } from "../../../components/ui/button";
import { Spinner } from "../../../components/ui/spinner";
import { Textarea } from "../../../components/ui/textarea";
import { RunLogs } from "./RunLogs";
import { useNow } from "../../../hooks/useNow";

type RunStep = RunDetail["steps"][number];

function Metric({ label, value, mono = true }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-md border border-border/50 bg-background/40 px-2.5 py-2">
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 truncate text-sm", mono && "font-mono tabular")}>{value}</dd>
    </div>
  );
}

/** Approve a human-review gate on this step's agent run. */
function ReviewGate({ workflowId }: { workflowId: string }) {
  const [notes, setNotes] = useState("");
  const { data: wf } = useAgentRunQuery(workflowId);
  const gate = wf?.steps?.find((s) => s.status === "awaiting_review");
  // Refreshes this agent run, its events and every workflow run (tags).
  const [advance, { isLoading: approving }] = useAdvanceAgentRunMutation();
  const approve = {
    isPending: approving,
    mutate: () =>
      gate &&
      advance({ workflowId, stepKey: gate.stepKey, notes })
        .unwrap()
        .then(() => {
          toast.success("Approved — the run continues with the next steps");
          setNotes("");
        })
        .catch((err) => toast.error(errorMessage(err))),
  };
  if (!gate) return null;
  return (
    <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
      <p className="flex items-center gap-2 text-xs font-semibold text-warning">
        <Eye className="h-3.5 w-3.5" /> Waiting for your review
      </p>
      <Textarea rows={2} placeholder="Optional notes for the next steps…" value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-background/80 text-xs" />
      <Button size="sm" className="w-full" onClick={() => approve.mutate()} disabled={approve.isPending}>
        {approve.isPending ? <Spinner className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Approve and continue
      </Button>
    </div>
  );
}

/** Right-hand execution inspector for the selected step: model, tokens,
 * latency, cost, attempts, live logs and outputs. */
export function StepInspector({ step, agentName }: { step: RunStep; agentName: string }) {
  const u = step.usage;
  const live = ["running", "queued", "pending"].includes(step.status) && Boolean(step.workflowId);
  // currentData: selecting another step never shows the previous step's outputs.
  const { currentData: artifacts } = useAgentRunArtifactsQuery(step.workflowId ?? "", {
    skip: !step.workflowId || !["completed", "awaiting_review"].includes(step.status),
  });
  const hint = step.status === "failed" ? failureHint(u.error) : null;
  const now = useNow(1000, step.status === "running");

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Step {step.templateStep.stepOrder + 1}</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <h2 className="truncate text-base font-semibold">{agentName}</h2>
          <StatusBadge status={step.status} size="sm" />
        </div>
        {step.workflowId && (
          <Link
            to={`/workflows/${step.workflowId}`}
            className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-primary"
          >
            {runCode(step.workflowId)} <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Metric label="Model" value={u.model ?? (step.status === "pending" ? "—" : live ? "reported when done" : "not reported")} />
        </div>
        <Metric
          label={step.status === "running" ? "Elapsed" : "Latency"}
          value={step.status === "running" && u.startedAt ? formatDuration(Math.max(0, now - new Date(u.startedAt).getTime())) : formatDuration(u.durationMs)}
        />
        <Metric label="Attempts" value={u.attempts || "—"} />
        <Metric label="Input" value={u.inputTokens ? `${formatTokens(u.inputTokens)} tok` : "—"} />
        <Metric label="Output" value={u.outputTokens ? `${formatTokens(u.outputTokens)} tok` : "—"} />
        <Metric label="Cost" value={u.attempts ? formatUsd(u.costUsd) : "—"} />
        <Metric label="Provider" value={u.providerType ?? "—"} />
      </dl>

      {step.status === "running" && u.progressMessage && (
        <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground/90">{u.progressMessage}</p>
      )}

      {step.status === "failed" && (
        <div className="space-y-1.5 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
          <p className="flex items-center gap-2 text-xs font-semibold text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" /> {hint?.title}
          </p>
          <p className="text-xs text-muted-foreground">{hint?.advice}</p>
          {u.error && <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-destructive/90">{u.error}</pre>}
          {hint?.action && (
            <Link to={hint.action.to} className={cn(buttonVariants({ size: "sm", variant: "secondary" }), "mt-1")}>
              {hint.action.label}
            </Link>
          )}
        </div>
      )}

      {step.status === "awaiting_review" && step.workflowId && <ReviewGate workflowId={step.workflowId} />}

      <RunLogs workflowId={step.workflowId} live={live} />

      {artifacts && artifacts.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Outputs ({artifacts.length})</p>
          {artifacts.map((a) => (
            <ArtifactPreview key={a.id} artifact={a} compact />
          ))}
        </div>
      )}
    </div>
  );
}
