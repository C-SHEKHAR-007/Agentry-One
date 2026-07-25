import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ExternalLink, Layers } from "lucide-react";
import { api } from "../api/client.js";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";

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

export function TemplateRunViewPage() {
  const { runId } = useParams();
  const { data: run } = useQuery({
    queryKey: ["template-run", runId],
    queryFn: () => api.get<TemplateRun>(`/template-runs/${runId}`),
    refetchInterval: (query) => (query.state.data?.status === "running" ? 3000 : false),
  });

  if (!run) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14 max-w-md" />
        <Skeleton className="h-48 max-w-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Layers className="h-6 w-6 text-primary" />
            Template run
            <StatusBadge status={run.status} />
          </span>
        }
        description={`Run ${run.id.slice(0, 8)} — each step runs its agent's workflow to completion, then hands off.`}
      />

      {run.status === "awaiting_review" && (
        <Card className="mb-4 border-warning/40 bg-warning/10 p-4 text-sm text-warning">
          A step in this run is awaiting your review — open it below to continue.
        </Card>
      )}

      <div className="grid gap-3">
        {run.steps
          .sort((a, b) => a.templateStep.stepOrder - b.templateStep.stepOrder)
          .map((step) => (
            <Card key={step.id} className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium">
                  Step {step.templateStep.stepOrder} · {step.templateStep.agentId}
                </p>
                <div className="mt-1">
                  <StatusBadge status={step.status} />
                </div>
              </div>
              {step.workflowId && (
                <Link to={`/workflows/${step.workflowId}`}>
                  <Button size="sm" variant="secondary">
                    <ExternalLink className="h-3.5 w-3.5" /> View workflow
                  </Button>
                </Link>
              )}
            </Card>
          ))}
      </div>
    </div>
  );
}
