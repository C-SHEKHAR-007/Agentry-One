import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CircleDashed,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Layers,
  Loader2,
  MinusCircle,
  Plus,
  Send,
} from "lucide-react";
import { api, downloadUrl } from "../../api/client";
import { AGENT_TO_ROLE, ROLE_ORDER, type Role } from "../../lib/studioPlan";
import { timeAgo } from "../../lib/format";
import { cn } from "../../lib/utils";
import { Button, buttonVariants } from "../ui/button";
import { Card } from "../ui/card";
import { Label } from "../ui/label";
import { Select } from "../ui/select";
import { Textarea } from "../ui/textarea";
import type { SocialAccount } from "./Composer";
import { LIVE_RUN_STATUSES, ROLES } from "./roles";

export interface TemplateRunStep {
  id: string;
  status: string;
  workflowId: string | null;
  templateStep: { stepOrder: number; agentId: string };
}

export interface TemplateRun {
  id: string;
  templateId: string;
  status: string;
  createdAt: string;
  runInputs: Record<string, unknown>;
  steps: TemplateRunStep[];
}

interface Artifact {
  id: string;
  kind: string;
  mimeType: string;
  storageKey: string;
  previewUrl: string | null;
  downloadUrl: string | null;
}

function useStepArtifacts(step: TemplateRunStep | undefined) {
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

type StepState = "done" | "running" | "review" | "failed" | "waiting" | "skipped";

function stateOf(step: TemplateRunStep | undefined, runLive: boolean): StepState {
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
}: {
  run: TemplateRun;
  projectId: string;
  accounts: SocialAccount[];
  onNew: () => void;
}) {
  const live = LIVE_RUN_STATUSES.includes(run.status);
  const byRole = new Map<Role, TemplateRunStep>();
  for (const s of run.steps) {
    const role = AGENT_TO_ROLE[s.templateStep.agentId];
    if (role) byRole.set(role, s);
  }
  const roles = ROLE_ORDER.filter((r) => byRole.has(r));
  const done = roles.filter((r) => byRole.get(r)?.status === "completed").length;
  const topic = String(run.runInputs?.topic ?? "Your content");

  return (
    <div className="space-y-4">
      <Card glass className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <RunStatusPill status={run.status} />
            <h2 className="mt-1.5 line-clamp-2 text-base font-semibold leading-snug">{topic}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Started {timeAgo(run.createdAt)} · {done} of {roles.length} done
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link to={`/templates/${run.templateId}/edit`} className={buttonVariants({ size: "sm", variant: "secondary" })} title="Customise, schedule or re-run this pipeline">
              <Layers className="h-3.5 w-3.5" /> Open workflow
            </Link>
            <Button size="sm" variant="secondary" onClick={onNew}>
              <Plus className="h-3.5 w-3.5" /> New
            </Button>
          </div>
        </div>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={done} aria-valuemax={roles.length}>
          <div
            className={cn("h-full rounded-full transition-all", run.status === "failed" ? "bg-destructive" : "bg-primary")}
            style={{ width: `${roles.length ? (done / roles.length) * 100 : 0}%` }}
          />
        </div>

        <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {roles.map((r) => {
            const state = stateOf(byRole.get(r), live);
            return (
              <li key={r} className="flex items-center gap-1.5 text-xs">
                <StepIcon state={state} />
                <span className={cn(state === "done" ? "text-foreground" : "text-muted-foreground")}>{ROLES[r].short}</span>
              </li>
            );
          })}
        </ol>

        {run.status === "awaiting_review" && (
          <p className="mt-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
            A step is waiting for your approval.{" "}
            <Link to={`/template-runs/${run.id}`} className="font-medium underline">
              Review and continue
            </Link>
          </p>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {roles
          .filter((r) => r !== "publish")
          .map((r) => (
            <OutputCard key={r} role={r} step={byRole.get(r)} runLive={live} runId={run.id} wide={r === "search" || r === "video"} />
          ))}
      </div>

      {byRole.has("publish") ? (
        <PublishedCard step={byRole.get("publish")!} runLive={live} runId={run.id} />
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
  const m = map[status] ?? { label: "Generating", cls: "bg-primary/15 text-primary" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold", m.cls)}>
      {LIVE_RUN_STATUSES.includes(status) && status !== "awaiting_review" && <Loader2 className="h-3 w-3 animate-spin" />}
      {m.label}
    </span>
  );
}

function StepIcon({ state }: { state: StepState }) {
  if (state === "done") return <Check className="h-3.5 w-3.5 text-success" />;
  if (state === "running") return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
  if (state === "failed") return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
  if (state === "review") return <Eye className="h-3.5 w-3.5 text-warning" />;
  if (state === "skipped") return <MinusCircle className="h-3.5 w-3.5 text-muted-foreground/60" />;
  return <CircleDashed className="h-3.5 w-3.5 text-muted-foreground/60" />;
}

function OutputCard({ role, step, runLive, runId, wide }: { role: Role; step?: TemplateRunStep; runLive: boolean; runId: string; wide: boolean }) {
  const meta = ROLES[role];
  const Icon = meta.icon;
  const state = stateOf(step, runLive);
  const { data: artifacts, isError } = useStepArtifacts(step);
  const primary = artifacts?.[0];
  // Azure artifacts come with short-lived https SAS URLs; everything else is
  // served by the API itself (through the app's /api proxy, with the session).
  const src = primary ? (primary.previewUrl?.startsWith("https://") ? primary.previewUrl : downloadUrl(primary.id)) : undefined;
  const fileHref = primary
    ? primary.downloadUrl?.startsWith("https://")
      ? primary.downloadUrl
      : `${downloadUrl(primary.id)}?disposition=attachment`
    : undefined;

  return (
    <Card glass className={cn("flex min-w-0 flex-col overflow-hidden", wide && "xl:col-span-2")}>
      <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h3 className="flex-1 text-sm font-semibold">{meta.label}</h3>
        <StepIcon state={state} />
      </div>

      <div className="flex-1 p-4">
        {state === "waiting" && <Placeholder text="Waiting for the previous step…" />}
        {state === "running" && <Placeholder text={meta.working} spinning />}
        {state === "skipped" && <Placeholder text="Didn't run — the pipeline stopped before this step." />}
        {state === "review" && (
          <Placeholder text="Waiting for your approval.">
            <Link to={`/template-runs/${runId}`} className="text-primary hover:underline">
              Review
            </Link>
          </Placeholder>
        )}
        {state === "failed" && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
            <span>
              This step failed.{" "}
              {step?.workflowId && (
                <Link to={`/workflows/${step.workflowId}`} className="font-medium underline">
                  See what happened
                </Link>
              )}
            </span>
          </div>
        )}
        {state === "done" && !primary && (isError ? <Placeholder text="Couldn't load the output." /> : <Placeholder text="Loading…" spinning />)}

        {state === "done" && primary && (
          <div className="space-y-3">
            {primary.mimeType.startsWith("image/") && src && (
              <a href={src} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-border bg-muted/30">
                <img src={src} alt={`Generated visual`} className="mx-auto max-h-80 w-full object-contain" />
              </a>
            )}
            {primary.mimeType.startsWith("audio/") && src && <audio controls src={src} className="w-full" />}
            {primary.mimeType.startsWith("video/") && src && <video controls src={src} className="max-h-[420px] w-full rounded-lg border border-border bg-black" />}
            {primary.mimeType.startsWith("text/") && <TextOutput artifactId={primary.id} collapsible={role === "search"} />}
            <div className="flex justify-end">
              <a href={fileHref} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <Download className="h-3.5 w-3.5" /> Download
              </a>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function Placeholder({ text, spinning, children }: { text: string; spinning?: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-[88px] items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 px-4 text-center text-xs text-muted-foreground">
      {spinning && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />}
      <span>
        {text} {children}
      </span>
    </div>
  );
}

function TextOutput({ artifactId, collapsible }: { artifactId: string; collapsible: boolean }) {
  const { data: text, isError, error } = useArtifactText(artifactId);
  const [expanded, setExpanded] = useState(!collapsible);
  const [copied, setCopied] = useState(false);

  if (isError) return <p className="text-xs text-destructive">{(error as Error).message}</p>;
  if (text === undefined) return <Placeholder text="Loading…" spinning />;

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
          "whitespace-pre-wrap break-words rounded-lg border border-border/70 bg-muted/40 p-3 pr-10 font-sans text-[13px] leading-relaxed text-foreground",
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

/** Publishing step that was part of the pipeline (auto-publish). */
function PublishedCard({ step, runLive, runId }: { step: TemplateRunStep; runLive: boolean; runId: string }) {
  return <OutputCard role="publish" step={step} runLive={runLive} runId={runId} wide />;
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
  textStep?: TemplateRunStep;
  imageStep?: TemplateRunStep;
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
              className="text-[13px] leading-relaxed"
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
