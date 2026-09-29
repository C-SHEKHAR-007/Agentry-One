import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Heart,
  Layers,
  MessageCircle,
  Network,
  Plus,
  RotateCw,
  Send,
  Sparkles,
} from "lucide-react";
import { api, downloadUrl } from "../../api/client";
import type { RunDetail } from "../../api/types";
import { useNow } from "../../hooks/useNow";
import { failureHint } from "../../lib/failureHints";
import { formatDuration, formatTokens, formatUsd, timeAgo } from "../../lib/format";
import { AGENT_TO_ROLE, ROLE_ORDER, type Role } from "../../lib/studioPlan";
import { cn } from "../../lib/utils";
import { Button, buttonVariants } from "../ui/button";
import { Card } from "../ui/card";
import { Label } from "../ui/label";
import { Select } from "../ui/select";
import { Textarea } from "../ui/textarea";
import type { SocialAccount } from "./Composer";
import { PipelineStrip } from "./PipelineStrip";
import { LIVE_RUN_STATUSES, ROLES } from "./roles";

/** A Content Studio creation is a workflow run (GET /template-runs/:id). */
export type TemplateRun = RunDetail;
type RunStep = RunDetail["steps"][number];

interface Artifact {
  id: string;
  kind: string;
  mimeType: string;
  storageKey: string;
  previewUrl: string | null;
  downloadUrl: string | null;
}

function useStepArtifacts(step: RunStep | undefined) {
  return useQuery({
    queryKey: ["workflow-artifacts", step?.workflowId],
    queryFn: () => api.get<Artifact[]>(`/workflows/${step!.workflowId}/artifacts`),
    enabled: Boolean(step?.workflowId) && step?.status === "completed",
  });
}

function useArtifactText(artifactId: string | undefined) {
  return useQuery({
    queryKey: ["artifact-text", artifactId],
    queryFn: async () => {
      const res = await fetch(downloadUrl(artifactId!));
      if (!res.ok) throw new Error(`Couldn't load text (HTTP ${res.status})`);
      return res.text();
    },
    enabled: Boolean(artifactId),
  });
}

/** Azure artifacts carry short-lived https SAS URLs; everything else is
 * served by the API itself (through the app's /api proxy, with the session). */
function mediaUrls(a: Artifact | undefined) {
  if (!a) return { src: undefined, file: undefined };
  return {
    src: a.previewUrl?.startsWith("https://") ? a.previewUrl : downloadUrl(a.id),
    file: a.downloadUrl?.startsWith("https://") ? a.downloadUrl : `${downloadUrl(a.id)}?disposition=attachment`,
  };
}

type StepState = "done" | "running" | "review" | "failed" | "waiting" | "skipped";

function stateOf(step: RunStep | undefined, runLive: boolean): StepState {
  const s = step?.status ?? "pending";
  if (s === "completed") return "done";
  if (s === "failed") return "failed";
  if (s === "awaiting_review") return "review";
  if (!runLive) return "skipped";
  return step?.workflowId ? "running" : "waiting";
}

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

  const again = useMutation({
    mutationFn: () => api.post<{ id: string }>(`/templates/${run.templateId}/run`, run.runInputs ?? {}),
    onSuccess: (next) => {
      toast.success("Generating again with the same brief");
      onOpen(next.id);
    },
    onError: (err: Error) => toast.error(err.message),
  });

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

function RunStatusPill({ status }: { status: string }) {
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

/** model · 2.4s · 1,284 tokens under an output. */
function StepMeta({ step, className }: { step?: RunStep; className?: string }) {
  if (!step || step.status !== "completed") return null;
  const u = step.usage;
  const tokens = u.inputTokens + u.outputTokens;
  const parts = [u.model, u.durationMs != null ? formatDuration(u.durationMs) : null, tokens > 0 ? `${formatTokens(tokens)} tokens` : null].filter(Boolean);
  if (parts.length === 0) return null;
  return <p className={cn("truncate font-mono text-[11px] text-muted-foreground/90", className)}>{parts.join(" · ")}</p>;
}

/** What the step is doing right now, with a placeholder shaped like its
 * output (an image frame, text lines, a waveform, a video frame). */
function Working({ role, step }: { role: Role; step?: RunStep }) {
  const now = useNow(1000);
  const since = step?.usage.startedAt ? now - new Date(step.usage.startedAt).getTime() : null;
  const shape =
    role === "image" ? (
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted/60">
        <span className="absolute inset-0 animate-sweep bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
      </div>
    ) : role === "video" ? (
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted/60">
        <span className="absolute inset-0 animate-sweep bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
      </div>
    ) : role === "voice" ? (
      <div className="flex h-14 items-center justify-center gap-1 rounded-lg bg-muted/50">
        {Array.from({ length: 28 }).map((_, i) => (
          <span key={i} className="w-1 animate-pulse rounded-full bg-primary/50" style={{ height: `${20 + ((i * 37) % 60)}%`, animationDelay: `${(i % 7) * 120}ms` }} />
        ))}
      </div>
    ) : (
      <div className="space-y-2 rounded-lg bg-muted/40 p-3">
        {[92, 78, 85, 60].map((w, i) => (
          <div key={i} className="relative h-2.5 overflow-hidden rounded bg-muted" style={{ width: `${w}%` }}>
            <span className="absolute inset-0 animate-sweep bg-gradient-to-r from-transparent via-primary/25 to-transparent" style={{ animationDelay: `${i * 150}ms` }} />
          </div>
        ))}
      </div>
    );
  return (
    <div className="space-y-2.5">
      {shape}
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="status-dot h-1.5 w-1.5 text-primary" data-live="true" />
        <span className="min-w-0 flex-1 truncate">{step?.usage.progressMessage ?? ROLES[role].working}</span>
        {since !== null && <span className="font-mono tabular">{formatDuration(since)}</span>}
      </p>
    </div>
  );
}

function Failed({ step }: { step?: RunStep }) {
  const hint = failureHint(step?.usage.error);
  return (
    <div className="space-y-1.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs">
      <p className="flex items-center gap-1.5 font-semibold text-destructive">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {hint.title}
      </p>
      <p className="text-muted-foreground">{hint.advice}</p>
      {step?.usage.error && <p className="line-clamp-3 font-mono text-[11px] text-destructive/90" title={step.usage.error}>{step.usage.error}</p>}
      <div className="flex flex-wrap gap-3 pt-0.5">
        {hint.action && (
          <Link to={hint.action.to} className="font-medium text-foreground underline-offset-2 hover:underline">
            {hint.action.label}
          </Link>
        )}
        {step?.workflowId && (
          <Link to={`/workflows/${step.workflowId}`} className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-2 hover:underline">
            See what happened <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

function Placeholder({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-[88px] items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 px-4 text-center text-xs text-muted-foreground">
      <span>
        {text} {children}
      </span>
    </div>
  );
}

/** Any non-finished state of a step, or null when it has output to show. */
function StepStatusBody({ role, step, state, runId }: { role: Role; step?: RunStep; state: StepState; runId: string }) {
  if (state === "waiting") return <Placeholder text="Waiting for the previous step…" />;
  if (state === "running") return <Working role={role} step={step} />;
  if (state === "skipped") return <Placeholder text="Didn't run — the pipeline stopped before this step." />;
  if (state === "failed") return <Failed step={step} />;
  if (state === "review")
    return (
      <Placeholder text="Waiting for your approval.">
        <Link to={`/template-runs/${runId}`} className="text-primary hover:underline">
          Review
        </Link>
      </Placeholder>
    );
  return null;
}

function StateIcon({ state }: { state: StepState }) {
  if (state === "done") return <Check className="h-3.5 w-3.5 text-success" />;
  if (state === "running") return <span className="status-dot h-2 w-2 text-primary" data-live="true" />;
  if (state === "failed") return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
  if (state === "review") return <Eye className="h-3.5 w-3.5 text-warning" />;
  return <span className="h-2 w-2 rounded-full border border-muted-foreground/50" />;
}

/** The caption and visual together, laid out the way the post will look. */
function PostPreview({ textStep, imageStep, runLive, runId }: { textStep?: RunStep; imageStep?: RunStep; runLive: boolean; runId: string }) {
  const { data: textArtifacts } = useStepArtifacts(textStep);
  const { data: imageArtifacts } = useStepArtifacts(imageStep);
  const text = textArtifacts?.find((a) => a.mimeType.startsWith("text/")) ?? textArtifacts?.[0];
  const image = imageArtifacts?.find((a) => a.mimeType.startsWith("image/")) ?? imageArtifacts?.[0];
  const { data: caption } = useArtifactText(text?.id);
  const textState = stateOf(textStep, runLive);
  const imageState = stateOf(imageStep, runLive);
  const img = mediaUrls(image);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!caption) return;
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't access the clipboard");
    }
  };

  return (
    <Card glass className="overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <h3 className="flex-1 text-sm font-semibold">Post preview</h3>
        {textStep && <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><StateIcon state={textState} /> Caption</span>}
        {imageStep && <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><StateIcon state={imageState} /> Visual</span>}
      </div>
      <div className={cn("grid gap-0", imageStep && textStep && "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]")}>
        {imageStep && (
          <section aria-label="Visual" className="border-border/60 p-4 md:border-r">
            <h4 className="sr-only">Visual</h4>
            {imageState === "done" && img.src ? (
              <a href={img.src} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-lg border border-border bg-muted/30">
                <img src={img.src} alt="Generated visual" className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              </a>
            ) : imageState === "done" ? (
              <Placeholder text="Loading…" />
            ) : (
              <StepStatusBody role="image" step={imageStep} state={imageState} runId={runId} />
            )}
            <div className="mt-2 flex items-center justify-between gap-2">
              <StepMeta step={imageStep} />
              {img.file && (
                <a href={img.file} className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
              )}
            </div>
          </section>
        )}
        {textStep && (
          <section aria-label="Caption & copy" className="flex flex-col p-4">
            <h4 className="sr-only">Caption & copy</h4>
            {textState === "done" && caption !== undefined ? (
              <div className="flex flex-1 flex-col rounded-lg border border-border/70 bg-background/40">
                <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">A</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold">Your brand</span>
                    <span className="block text-[11px] text-muted-foreground">Preview</span>
                  </span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={copy} aria-label="Copy caption">
                    {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                <p className="flex-1 whitespace-pre-wrap break-words p-3 text-sm leading-relaxed">
                  {caption.split(/(\s+)/).map((w, i) => (/^#\w/.test(w) ? <span key={i} className="font-medium text-primary">{w}</span> : w))}
                </p>
                <div className="flex items-center gap-4 border-t border-border/60 px-3 py-2 text-muted-foreground">
                  <Heart className="h-4 w-4" />
                  <MessageCircle className="h-4 w-4" />
                  <Send className="h-4 w-4" />
                  <span className="ml-auto font-mono text-[11px]">{caption.length} chars</span>
                </div>
              </div>
            ) : textState === "done" ? (
              <Placeholder text="Loading…" />
            ) : (
              <StepStatusBody role="text" step={textStep} state={textState} runId={runId} />
            )}
            <div className="mt-2 flex items-center justify-between gap-2">
              <StepMeta step={textStep} />
              {text && (
                <a href={mediaUrls(text).file} className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
              )}
            </div>
          </section>
        )}
      </div>
    </Card>
  );
}

function OutputCard({ role, step, runLive, runId, wide }: { role: Role; step?: RunStep; runLive: boolean; runId: string; wide: boolean }) {
  const meta = ROLES[role];
  const Icon = meta.icon;
  const state = stateOf(step, runLive);
  const { data: artifacts, isError } = useStepArtifacts(step);
  const primary = artifacts?.[0];
  const { src, file } = mediaUrls(primary);

  return (
    <Card glass className={cn("flex min-w-0 flex-col overflow-hidden", wide && "xl:col-span-2")}>
      <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h3 className="flex-1 text-sm font-semibold">{meta.label}</h3>
        <StateIcon state={state} />
      </div>

      <div className="flex-1 p-4">
        <StepStatusBody role={role} step={step} state={state} runId={runId} />
        {state === "done" && !primary && <Placeholder text={isError ? "Couldn't load the output." : "Loading…"} />}

        {state === "done" && primary && (
          <div className="space-y-3">
            {primary.mimeType.startsWith("image/") && src && (
              <a href={src} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-border bg-muted/30">
                <img src={src} alt="Generated visual" className="mx-auto max-h-80 w-full object-contain" />
              </a>
            )}
            {primary.mimeType.startsWith("audio/") && src && <audio controls src={src} className="w-full" />}
            {primary.mimeType.startsWith("video/") && src && <video controls src={src} className="mx-auto max-h-[460px] w-full rounded-lg border border-border bg-black" />}
            {primary.mimeType.startsWith("text/") && <TextOutput artifactId={primary.id} collapsible={role === "search"} />}
            <div className="flex items-center justify-between gap-2">
              <StepMeta step={step} />
              <a href={file} className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <Download className="h-3.5 w-3.5" /> Download
              </a>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function TextOutput({ artifactId, collapsible }: { artifactId: string; collapsible: boolean }) {
  const { data: text, isError, error } = useArtifactText(artifactId);
  const [expanded, setExpanded] = useState(!collapsible);
  const [copied, setCopied] = useState(false);

  if (isError) return <p className="text-xs text-destructive">{(error as Error).message}</p>;
  if (text === undefined) return <Placeholder text="Loading…" />;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't access the clipboard");
    }
  };

  return (
    <div className="relative">
      <pre
        className={cn(
          "whitespace-pre-wrap break-words rounded-lg border border-border/70 bg-muted/40 p-3 pr-10 font-sans text-sm leading-relaxed text-foreground",
          !expanded && "max-h-40 overflow-hidden [mask-image:linear-gradient(to_bottom,black_70%,transparent)]",
        )}
      >
        {text}
      </pre>
      <Button size="icon" variant="ghost" className="absolute right-1.5 top-1.5 h-7 w-7" onClick={copy} aria-label="Copy text">
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
      {collapsible && (
        <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-1.5 flex items-center gap-1 text-xs text-primary hover:underline">
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
          {expanded ? "Show less" : "Show all"}
        </button>
      )}
    </div>
  );
}

/** Manual publish: review the caption, then post to a connected account. */
function PublishPanel({
  projectId,
  accounts,
  textStep,
  imageStep,
}: {
  projectId: string;
  accounts: SocialAccount[];
  textStep?: RunStep;
  imageStep?: RunStep;
}) {
  const { data: textArtifacts } = useStepArtifacts(textStep);
  const { data: imageArtifacts } = useStepArtifacts(imageStep);
  const textArtifact = textArtifacts?.find((a) => a.kind === "text");
  const imageArtifact = imageArtifacts?.find((a) => a.kind === "image");
  const { data: generated } = useArtifactText(textArtifact?.id);

  const [caption, setCaption] = useState("");
  const [touched, setTouched] = useState(false);
  const [attachImage, setAttachImage] = useState(true);
  const [accountId, setAccountId] = useState("");
  const [dispatched, setDispatched] = useState<string | null>(null);

  useEffect(() => {
    if (!touched && generated) setCaption(generated);
  }, [generated, touched]);
  useEffect(() => {
    if (!accountId && accounts.length === 1) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const publish = useMutation({
    mutationFn: () =>
      api.post<{ id: string }>(`/projects/${projectId}/workflows`, {
        agentId: "social-publisher",
        input: {
          socialAccountId: accountId,
          text: caption,
          // The storage key is an artifact reference the publisher resolves
          // itself (local artifact or Azure blob) -- no browser-only URL.
          ...(attachImage && imageArtifact ? { mediaUrl: imageArtifact.storageKey } : {}),
        },
      }),
    onSuccess: (wf) => {
      setDispatched(wf.id);
      toast.success("Publishing started");
    },
    onError: (err) => toast.error(err.message),
  });

  if (!textArtifact && !imageArtifact) return null;

  return (
    <Card glass className="p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Send className="h-3.5 w-3.5" />
        </span>
        <div>
          <h3 className="text-sm font-semibold">Publish</h3>
          <p className="text-[11px] text-muted-foreground">Review the caption, then post it to a connected account.</p>
        </div>
      </div>

      {dispatched ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2.5 text-xs text-success">
          <span className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" /> Publishing started.
          </span>
          <span className="flex gap-3">
            <Link to={`/workflows/${dispatched}`} className="inline-flex items-center gap-1 font-medium underline">
              Track it <ExternalLink className="h-3 w-3" />
            </Link>
            <button type="button" className="underline" onClick={() => setDispatched(null)}>
              Publish again
            </button>
          </span>
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (accountId && caption.trim()) publish.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="publish-caption" className="text-xs">
              Caption
            </Label>
            <Textarea
              id="publish-caption"
              value={caption}
              onChange={(e) => {
                setTouched(true);
                setCaption(e.target.value);
              }}
              rows={4}
              className="text-sm leading-relaxed"
            />
          </div>
          {imageArtifact && (
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={attachImage} onChange={(e) => setAttachImage(e.target.checked)} className="accent-[hsl(var(--primary))]" />
              Attach the generated visual
            </label>
          )}
          {accounts.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              <Link to="/integrations" className="text-primary hover:underline">
                Connect a social account
              </Link>{" "}
              to publish from here.
            </p>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select aria-label="Publish to" value={accountId} onChange={(e) => setAccountId(e.target.value)} className="h-9 sm:max-w-xs">
                <option value="">Choose an account…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.platform} {a.handle ? `· ${a.handle}` : ""}
                  </option>
                ))}
              </Select>
              <Button type="submit" disabled={!accountId || !caption.trim() || publish.isPending}>
                <Send className="h-4 w-4" /> Publish
              </Button>
            </div>
          )}
        </form>
      )}
    </Card>
  );
}
