import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Layers, Network, Plus, RotateCw, Sparkles } from "lucide-react";
import type { RunDetail, SocialAccount } from "../../../models";
import { useRunTemplateMutation } from "../../workflows/templates.api";
import { errorMessage } from "../../../services/http/errors";
import { useNow } from "../../../hooks/useNow";
import { formatDuration, formatTokens, formatUsd, timeAgo } from "../../../lib/format";
import { AGENT_TO_ROLE, ROLE_ORDER, type Role } from "../../../lib/studioPlan";
import { cn } from "../../../lib/utils";
import { Button, buttonVariants } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { PipelineStrip } from "./PipelineStrip";
import { LIVE_RUN_STATUSES } from "./roles";
import { OutputCard } from "./run/OutputCard";
import { PostPreview } from "./run/PostPreview";
import { PublishPanel } from "./run/PublishPanel";
import { type RunStep } from "./run/shared";

/** A Content Studio creation is a workflow run (GET /template-runs/:id). */
export type TemplateRun = RunDetail;

export function RunView({
  run,
  projectId,
  accounts,
  onNew,
  onOpen,
}: {
  run: TemplateRun;
  projectId: string;
  accounts: SocialAccount[];
  onNew: () => void;
  /** Opens another creation (used by Run again). */
  onOpen: (runId: string) => void;
}) {
  const live = LIVE_RUN_STATUSES.includes(run.status);
  const now = useNow(1000, live);
  const byRole = new Map<Role, RunStep>();
  for (const s of run.steps) {
    const role = AGENT_TO_ROLE[s.templateStep.agentId];
    if (role) byRole.set(role, s);
  }
  const roles = ROLE_ORDER.filter((r) => byRole.has(r));
  const done = roles.filter((r) => byRole.get(r)?.status === "completed").length;
  const topic = String(run.runInputs?.topic ?? "Your content");
  const tokens = (run.totals?.inputTokens ?? 0) + (run.totals?.outputTokens ?? 0);
  const elapsed = live ? now - new Date(run.createdAt).getTime() : run.totals?.durationMs ?? null;

  const [runTemplate, againState] = useRunTemplateMutation();
  const again = {
    isPending: againState.isLoading,
    mutate: () =>
      runTemplate({ templateId: run.templateId, inputs: run.runInputs ?? {} })
        .unwrap()
        .then((next) => {
          toast.success("Generating again with the same brief");
          onOpen(next.id);
        })
        .catch((err) => toast.error(errorMessage(err))),
  };

  const hasPost = byRole.has("text") || byRole.has("image");
  const others = roles.filter((r) => r !== "publish" && r !== "text" && r !== "image");
  // The deliverables first: video, then voiceover, research last (it's input).
  const order: Role[] = ["video", "voice", "search"];
  others.sort((a, b) => order.indexOf(a) - order.indexOf(b));

  return (
    <div className="space-y-4">
      <Card glass className="glow-border relative overflow-hidden border-transparent p-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_90%_at_100%_0%,hsl(var(--primary)/0.12),transparent_70%)]" />
        <div className="relative flex flex-col gap-3 2xl:flex-row 2xl:items-start 2xl:justify-between">
          <div className="min-w-0">
            <RunStatusPill status={run.status} />
            <h2 className="mt-2 line-clamp-2 text-lg font-semibold leading-snug">{topic}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span>
                Started {timeAgo(run.createdAt)} · {done} of {roles.length} done
              </span>
              {elapsed !== null && <span className="font-mono tabular">{formatDuration(elapsed)}</span>}
              {tokens > 0 && <span className="font-mono tabular">{formatTokens(tokens)} tokens</span>}
              {(run.totals?.costUsd ?? 0) > 0 && <span className="font-mono tabular">{formatUsd(run.totals.costUsd)}</span>}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link to={`/template-runs/${run.id}`} className={buttonVariants({ size: "sm", variant: "secondary" })} title="See the run as a graph, with logs">
              <Network className="h-3.5 w-3.5" /> Run details
            </Link>
            <Link to={`/templates/${run.templateId}/edit`} className={buttonVariants({ size: "sm", variant: "secondary" })} title="Customise, schedule or re-run this pipeline">
              <Layers className="h-3.5 w-3.5" /> Open workflow
            </Link>
            {!live && (
              <Button size="sm" variant="secondary" onClick={() => again.mutate()} disabled={again.isPending}>
                <RotateCw className={cn("h-3.5 w-3.5", again.isPending && "animate-spin")} /> Run again
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={onNew}>
              <Plus className="h-3.5 w-3.5" /> New
            </Button>
          </div>
        </div>

        <div className="relative mt-5 overflow-x-auto pb-1 scrollbar-thin">
          <PipelineStrip size="lg" steps={roles.map((r) => ({ role: r, status: byRole.get(r)?.status ?? "pending" }))} />
        </div>

        {run.status === "awaiting_review" && (
          <p className="relative mt-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
            A step is waiting for your approval.{" "}
            <Link to={`/template-runs/${run.id}`} className="font-medium underline">
              Review and continue
            </Link>
          </p>
        )}
      </Card>

      {hasPost && <PostPreview textStep={byRole.get("text")} imageStep={byRole.get("image")} runLive={live} runId={run.id} />}

      <div className="grid items-start gap-4 xl:grid-cols-2">
        {others.map((r) => (
          <OutputCard key={r} role={r} step={byRole.get(r)} runLive={live} runId={run.id} wide={r === "video" || r === "search"} />
        ))}
      </div>

      {byRole.has("publish") ? (
        <OutputCard role="publish" step={byRole.get("publish")!} runLive={live} runId={run.id} wide />
      ) : (
        <PublishPanel projectId={projectId} accounts={accounts} textStep={byRole.get("text")} imageStep={byRole.get("image")} />
      )}
    </div>
  );
}

export function RunStatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    completed: { label: "Ready", cls: "bg-success/15 text-success" },
    failed: { label: "Something failed", cls: "bg-destructive/15 text-destructive" },
    awaiting_review: { label: "Needs review", cls: "bg-warning/15 text-warning" },
    cancelled: { label: "Cancelled", cls: "bg-secondary text-muted-foreground" },
  };
  const m = map[status] ?? { label: "Generating", cls: "bg-primary/15 text-primary animate-status-glow" };
  const live = LIVE_RUN_STATUSES.includes(status) && status !== "awaiting_review";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", m.cls)}>
      {live ? <span className="status-dot h-1.5 w-1.5" data-live="true" /> : status === "completed" ? <Sparkles className="h-3 w-3" /> : null}
      {m.label}
    </span>
  );
}
