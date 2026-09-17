import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ExternalLink,
  Layers,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Eye,
  Send,
  Sparkles,
  ArrowRight,
  Share2,
} from "lucide-react";
import { api } from "../api/client.js";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { ArtifactPreview, type ArtifactItem } from "../components/ArtifactPreview";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Textarea } from "../components/ui/textarea";
import { Skeleton } from "../components/ui/skeleton";
import { Spinner } from "../components/ui/spinner";
import { Badge } from "../components/ui/badge";

interface WorkflowStep {
  id: string;
  stepKey: string;
  status: string;
  artifacts?: ArtifactItem[];
}

interface WorkflowDetail {
  id: string;
  status: string;
  steps: WorkflowStep[];
}

interface TemplateRunStep {
  id: string;
  status: string;
  workflowId: string | null;
  templateStep: { stepOrder: number; agentId: string };
}

interface TemplateRun {
  id: string;
  status: string;
  steps: TemplateRunStep[];
}

function StepRowCard({ step, onStepUpdated }: { step: TemplateRunStep; onStepUpdated: () => void }) {
  const queryClient = useQueryClient();
  const [reviewNotes, setReviewNotes] = useState("");

  const { data: workflow } = useQuery({
    queryKey: ["workflow-detail", step.workflowId],
    queryFn: () => api.get<WorkflowDetail>(`/workflows/${step.workflowId}`),
    enabled: Boolean(step.workflowId),
    refetchInterval: (query) =>
      query.state.data?.status === "running" || query.state.data?.status === "awaiting_review" ? 2000 : false,
  });

  const awaitingWfStep = workflow?.steps?.find((s) => s.status === "awaiting_review");

  const advanceStepMutation = useMutation({
    mutationFn: () =>
      api.post(`/workflows/${step.workflowId}/steps/${awaitingWfStep?.stepKey}/advance`, {
        notes: reviewNotes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["template-run"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-detail", step.workflowId] });
      toast.success(`Step approved! Pipeline continuing to next stage.`);
      setReviewNotes("");
      onStepUpdated();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const allArtifacts = workflow?.steps?.flatMap((s) => s.artifacts || []) || [];

  return (
    <Card className="overflow-hidden transition-all border-border/70 hover:border-primary/40 bg-card/60 backdrop-blur-sm">
      <div className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-semibold text-primary">
            {step.templateStep.stepOrder}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground capitalize">
                {step.templateStep.agentId.replace(/-/g, " ")}
              </p>
              <Badge variant="outline" className="text-[10px] font-mono">
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

export function TemplateRunViewPage() {
  const { runId } = useParams();
  const queryClient = useQueryClient();

  const { data: run, refetch } = useQuery({
    queryKey: ["template-run", runId],
    queryFn: () => api.get<TemplateRun>(`/template-runs/${runId}`),
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "running" || s === "pending" || s === "awaiting_review" ? 2500 : false;
    },
  });

  if (!run) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-14 max-w-md" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const isCompleted = run.status === "completed";
  const hasAwaiting = run.status === "awaiting_review" || run.steps.some((s) => s.status === "awaiting_review");

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Layers className="h-6 w-6 text-primary" />
            Template Pipeline Run
            <StatusBadge status={run.status} />
          </span>
        }
        description={`Run ID: ${run.id} — Steps execute sequentially with automated artifact chaining and human review gates.`}
      />

      {isCompleted && (
        <Card className="border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-400 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>All pipeline steps completed successfully! Artifacts have been generated and published.</span>
          </div>
        </Card>
      )}

      {hasAwaiting && (
        <Card className="border-warning/40 bg-warning/10 p-4 text-warning flex items-center gap-2.5 text-sm">
          <Eye className="h-5 w-5 shrink-0" />
          <span>A step in this pipeline is awaiting review. Review the generated output and approve below to proceed.</span>
        </Card>
      )}

      <div className="space-y-3">
        {run.steps
          .sort((a, b) => a.templateStep.stepOrder - b.templateStep.stepOrder)
          .map((step) => (
            <StepRowCard
              key={step.id}
              step={step}
              onStepUpdated={() => {
                refetch();
                queryClient.invalidateQueries({ queryKey: ["template-run", runId] });
              }}
            />
          ))}
      </div>
    </div>
  );
}
