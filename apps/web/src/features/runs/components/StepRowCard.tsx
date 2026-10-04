import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, Eye, Recycle } from "lucide-react";
import type { RunStepWorkflow } from "../../../models";
import { useAdvanceAgentRunMutation, useAgentRunQuery } from "../agentRuns.api";
import { poll, useLiveInterval } from "../../../services/api/polling";
import { errorMessage } from "../../../services/http/errors";
import { StatusBadge } from "../../../components/common/StatusBadge";
import { ArtifactPreview } from "../../../components/common/ArtifactPreview";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Textarea } from "../../../components/ui/textarea";
import { Spinner } from "../../../components/ui/spinner";
import { Badge } from "../../../components/ui/badge";

const AGENT_RUN_LIVE = ["running", "awaiting_review"] as const;

/** Marks a step whose output a retry took from the earlier run. */
export function ReusedChip() {
  return (
    <span title="Reused from the earlier run; this step didn't run again" className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      <Recycle className="h-3 w-3" /> Reused
    </span>
  );
}

export function StepRowCard({ step, agentName }: { step: RunStepWorkflow; agentName: string }) {
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
              {step.reusedFromStepId && <ReusedChip />}
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
