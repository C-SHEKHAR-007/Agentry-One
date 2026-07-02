import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Ban,
  Bot,
  CheckCircle2,
  Download,
  Eye,
  FileArchive,
  Flag,
  ImagePlus,
  Rocket,
  XCircle,
} from "lucide-react";
import { api, downloadUrl, sseUrl } from "../api/client.js";
import type { Workflow, WorkflowEvent } from "../api/types";
import { formatBytes, timeAgo } from "../lib/format";
import { PageHeader } from "../components/PageHeader";
import { RunProgress } from "../components/RunProgress";
import { StatusBadge } from "../components/StatusBadge";
import { StepTimeline } from "../components/StepTimeline";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";

interface TimelineEntry {
  id: string;
  label: string;
  at: string;
  icon: React.ElementType;
  color: string;
}

function buildTimeline(workflow: Workflow, events: WorkflowEvent[]): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    {
      id: "queued",
      label: "Workflow queued",
      at: workflow.createdAt,
      icon: Rocket,
      color: "text-primary",
    },
  ];

  for (const s of workflow.steps ?? []) {
    for (const a of s.artifacts ?? []) {
      entries.push({
        id: `artifact-${a.id}`,
        label: `Artifact saved · ${a.kind}`,
        at: a.createdAt,
        icon: ImagePlus,
        color: "text-chart-2",
      });
    }
  }

  for (const e of events) {
    if (e.type === "job.progress") continue; // one row per tick — too noisy
    const map: Record<string, { label: string; icon: React.ElementType; color: string }> = {
      "workflow.completed": { label: "Workflow completed", icon: CheckCircle2, color: "text-success" },
      "workflow.failed": { label: "Workflow failed", icon: XCircle, color: "text-destructive" },
      "workflow.cancelled": { label: "Workflow cancelled", icon: Ban, color: "text-muted-foreground" },
      "workflow.awaiting_review": { label: "Awaiting review", icon: Eye, color: "text-warning" },
      "job.failed": { label: "Job attempt failed", icon: XCircle, color: "text-destructive" },
    };
    const meta = map[e.type] ?? { label: e.type, icon: Flag, color: "text-muted-foreground" };
    entries.push({ id: e.id, label: meta.label, at: e.createdAt, icon: meta.icon, color: meta.color });
  }

  return entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export function WorkflowPage() {
  const { workflowId } = useParams();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<{ percent?: number; message?: string }>({});

  const { data: workflow } = useQuery({
    queryKey: ["workflow", workflowId],
    queryFn: () => api.get<Workflow>(`/workflows/${workflowId}`),
    refetchInterval: (query) =>
      query.state.data?.status === "running" || query.state.data?.status === "cancelling"
        ? 3000
        : false,
  });

  const { data: events } = useQuery({
    queryKey: ["workflow-events", workflowId],
    queryFn: () => api.get<WorkflowEvent[]>(`/workflows/${workflowId}/events`),
    refetchInterval: workflow?.status === "running" ? 5000 : false,
  });

  const activeJobId = workflow?.steps?.find(
    (s) => s.status === "running" || s.status === "queued",
  )?.job?.id;

  useEffect(() => {
    if (!activeJobId) return;
    const source = new EventSource(sseUrl(activeJobId));
    source.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === "progress") setProgress({ percent: payload.percent, message: payload.message });
      if (payload.type === "completed" || payload.type === "failed") {
        queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
        queryClient.invalidateQueries({ queryKey: ["workflow-events", workflowId] });
        source.close();
      }
    };
    return () => source.close();
  }, [activeJobId, workflowId, queryClient]);

  const cancelWorkflow = useMutation({
    mutationFn: () => api.post(`/workflows/${workflowId}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
      toast.success("Cancellation requested");
    },
    onError: (err) => toast.error(err.message),
  });

  if (!workflow) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const allArtifacts = (workflow.steps ?? []).flatMap((s) => s.artifacts ?? []);
  const isActive = workflow.status === "running" || workflow.status === "cancelling";
  const timeline = buildTimeline(workflow, events ?? []);

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <Bot className="h-6 w-6 text-primary" />
            {workflow.agentId}
            <StatusBadge status={workflow.status} />
          </span>
        }
        description={`Run ${workflow.id.slice(0, 8)} · started ${timeAgo(workflow.createdAt)}`}
        actions={
          isActive && (
            <Button
              variant="outline"
              onClick={() => cancelWorkflow.mutate()}
              disabled={cancelWorkflow.isPending}
            >
              <Ban className="h-4 w-4" /> Cancel
            </Button>
          )
        }
      />

      {workflow.status === "running" && (
        <Card glass className="p-5">
          <RunProgress percent={progress.percent} message={progress.message} />
        </Card>
      )}

      {workflow.status === "awaiting_review" && (
        <Card className="border-warning/40 bg-warning/10 p-4 text-sm text-warning">
          This workflow is awaiting your review (human-gated step).
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Output */}
          <Card glass>
            <CardHeader>
              <CardTitle className="text-base">Output</CardTitle>
            </CardHeader>
            <CardContent>
              {allArtifacts.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {isActive ? "The result will appear here when the run finishes." : "No artifacts produced."}
                </p>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {allArtifacts.map((a) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    className="overflow-hidden rounded-lg border border-border"
                  >
                    {a.mimeType.startsWith("image/") ? (
                      <img src={downloadUrl(a.id)} alt={a.kind} className="w-full" />
                    ) : (
                      <div className="flex items-center gap-2 p-4">
                        <FileArchive className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm">{a.kind}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t border-border px-3 py-2">
                      <span className="text-xs text-muted-foreground">
                        {a.kind} · {formatBytes(a.sizeBytes)}
                      </span>
                      <a href={downloadUrl(a.id)} download>
                        <Button size="sm" variant="ghost">
                          <Download className="h-3.5 w-3.5" /> Download
                        </Button>
                      </a>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card glass>
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-0">
                {timeline.map((t, i) => {
                  const Icon = t.icon;
                  const last = i === timeline.length - 1;
                  return (
                    <li key={t.id} className="relative flex gap-3 pb-5 last:pb-0">
                      {!last && (
                        <span className="absolute left-[9px] top-6 h-full w-px bg-border" aria-hidden />
                      )}
                      <span className={`relative z-10 mt-0.5 shrink-0 bg-card ${t.color}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                        <p className="text-sm">{t.label}</p>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {new Date(t.at).toLocaleTimeString()}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </div>

        {/* Steps rail */}
        <div className="space-y-6">
          <Card glass>
            <CardHeader>
              <CardTitle className="text-base">Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <StepTimeline steps={workflow.steps ?? []} />
            </CardContent>
          </Card>

          <Card glass>
            <CardHeader>
              <CardTitle className="text-base">Input</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                {Object.entries(workflow.inputParams ?? {}).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt>
                    <dd className="mt-0.5 break-words">{String(v)}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-muted-foreground">
                Agent {workflow.agentId} v{workflow.agentVersion} ·{" "}
                <Link to={`/agents/${workflow.agentId}`} className="text-primary hover:underline">
                  view agent
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
