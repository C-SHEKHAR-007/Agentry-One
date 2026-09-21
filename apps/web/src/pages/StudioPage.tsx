import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Sparkles,
  Type,
  Image as ImageIcon,
  Mic,
  Clapperboard,
  Send,
  Download,
  Loader2,
  Layers,
  Search,
  CheckCircle2,
  Share2,
  ExternalLink,
  Bot,
  Flame,
  Copy,
} from "lucide-react";
import { api, downloadUrl } from "../api/client.js";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { Spinner } from "../components/ui/spinner";
import { Badge } from "../components/ui/badge";

interface Project {
  id: string;
  name: string;
}

type Role = "search" | "text" | "image" | "voice" | "video" | "publish";

const AGENT_TO_ROLE: Record<string, Role> = {
  "web-search-agent": "search",
  "content-brief-writer": "text",
  "sketch-agent": "image",
  "voice-agent": "voice",
  "video-agent": "video",
  "social-publisher": "publish",
};

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

interface WorkflowArtifact {
  id: string;
  kind: string;
  mimeType: string;
  sizeBytes: number | null;
}

interface SocialAccount {
  id: string;
  platform: string;
  handle: string | null;
  status: string;
}

const FORMAT_OPTIONS: { id: Role; label: string; icon: React.ElementType; hint: string; badge: string }[] = [
  { id: "search", label: "Web Search & Trends", icon: Search, hint: "Scrapes live web & social trends for viral angles", badge: "Live Intel" },
  { id: "text", label: "Instagram Caption & Prompt", icon: Type, hint: "Drafts viral caption, hashtags & image prompt", badge: "Copy & Prompt" },
  { id: "image", label: "Visual / Reel Image", icon: ImageIcon, hint: "Synthesizes high-res visual from image prompt", badge: "AI Visual" },
  { id: "voice", label: "Voiceover Narration", icon: Mic, hint: "Narrates the caption via text-to-speech", badge: "TTS Audio" },
  { id: "video", label: "Short Video / Reel", icon: Clapperboard, hint: "Assembles visual + audio + caption overlay into MP4", badge: "Reel MP4" },
  { id: "publish", label: "Auto-Publish to Instagram", icon: Send, hint: "Publishes post directly to connected social account", badge: "Auto-Post" },
];

function useWorkflowArtifacts(workflowId: string | undefined | null, enabled: boolean) {
  return useQuery({
    queryKey: ["workflow-artifacts", workflowId],
    queryFn: () => api.get<WorkflowArtifact[]>(`/workflows/${workflowId}/artifacts`),
    enabled: Boolean(workflowId) && enabled,
  });
}

function useArtifactText(artifactId: string | undefined) {
  return useQuery({
    queryKey: ["artifact-text", artifactId],
    queryFn: () => fetch(downloadUrl(artifactId!)).then((r) => r.text()),
    enabled: Boolean(artifactId),
  });
}

function RoleCard({ role, step }: { role: Role; step: TemplateRunStep | undefined }) {
  const meta = FORMAT_OPTIONS.find((f) => f.id === role)!;
  const Icon = meta.icon;
  const status = step?.status ?? "pending";
  const { data: artifacts } = useWorkflowArtifacts(step?.workflowId, status === "completed");
  const primary = artifacts?.[0];

  return (
    <Card glass className="overflow-hidden border-border/70 shadow-md">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-3 bg-secondary/20">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          {meta.label}
        </CardTitle>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] hidden sm:inline-flex">{meta.badge}</Badge>
          <StatusBadge status={status === "pending" ? "queued" : status} />
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {status !== "completed" && status !== "failed" && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            {step ? "Agent executing in worker pipeline…" : `Waiting on prior step in workflow…`}
          </div>
        )}

        {status === "failed" && (
          <p className="py-4 text-sm text-destructive font-medium">This pipeline step failed. Check executions log.</p>
        )}

        {status === "completed" && primary && (
          <div className="space-y-3">
            {primary.mimeType.startsWith("image/") && (
              <div className="relative group rounded-lg overflow-hidden border border-border">
                <img src={downloadUrl(primary.id)} alt="Generated Visual" className="w-full object-cover max-h-72" />
              </div>
            )}

            {primary.mimeType.startsWith("audio/") && (
              <div className="p-2 rounded-lg bg-secondary/30 border border-border">
                <audio controls src={downloadUrl(primary.id)} className="w-full" />
              </div>
            )}

            {primary.mimeType.startsWith("video/") && (
              <video controls src={downloadUrl(primary.id)} className="w-full rounded-lg border border-border max-h-80" />
            )}

            {primary.mimeType === "text/plain" && (
              <TextArtifactView artifactId={primary.id} isSearch={role === "search"} />
            )}

            <div className="flex items-center justify-between pt-1 text-xs">
              <a href={downloadUrl(primary.id)} download className="inline-flex items-center gap-1 text-primary hover:underline">
                <Download className="h-3.5 w-3.5" /> Download Artifact
              </a>
              <span className="text-muted-foreground font-mono text-[11px]">{primary.kind}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TextArtifactView({ artifactId, isSearch }: { artifactId: string; isSearch?: boolean }) {
  const { data: text } = useArtifactText(artifactId);

  const copyToClipboard = () => {
    if (text) {
      navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard!");
    }
  };

  if (!text) return <p className="text-sm text-muted-foreground">Loading artifact...</p>;

  return (
    <div className="relative group">
      <button
        onClick={copyToClipboard}
        className="absolute top-2 right-2 p-1.5 rounded bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        title="Copy text"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
      <pre className="rounded-lg border border-border/70 bg-secondary/30 p-3 text-xs font-sans whitespace-pre-wrap max-h-56 overflow-y-auto leading-relaxed text-foreground">
        {text}
      </pre>
    </div>
  );
}

function PublishPanel({ projectId, textStep, imageStep }: { projectId: string; textStep?: TemplateRunStep; imageStep?: TemplateRunStep }) {
  const { data: textArtifacts } = useWorkflowArtifacts(textStep?.workflowId, textStep?.status === "completed");
  const { data: imageArtifacts } = useWorkflowArtifacts(imageStep?.workflowId, imageStep?.status === "completed");
  
  const textArtifact = textArtifacts?.find((a) => a.kind === "text");
  const imageArtifact = imageArtifacts?.find((a) => a.kind === "image");
  
  const { data: fetchedCaption } = useArtifactText(textArtifact?.id);

  const [caption, setCaption] = useState("");
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched && fetchedCaption) setCaption(fetchedCaption);
  }, [fetchedCaption, touched]);

  const { data: accounts } = useQuery({
    queryKey: ["socialAccounts", projectId],
    queryFn: () => api.get<SocialAccount[]>(`/social-accounts?projectId=${projectId}`),
    enabled: Boolean(projectId),
  });

  const publish = useMutation({
    mutationFn: (socialAccountId: string) =>
      api.post(`/projects/${projectId}/workflows`, {
        agentId: "social-publisher",
        input: {
          socialAccountId,
          text: caption,
          mediaUrl: imageArtifact ? downloadUrl(imageArtifact.id) : undefined,
        },
      }),
    onSuccess: () => toast.success("Publish job dispatched to Instagram / Social network! Check Executions for status."),
    onError: (err: Error) => toast.error(err.message),
  });

  if (!textArtifact && !imageArtifact) return null;

  return (
    <Card glass className="border-primary/40 shadow-xl">
      <CardHeader className="bg-primary/5 pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Send className="h-4 w-4 text-primary" /> One-Click Social Media Publisher
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Review your generated caption and visual asset, then publish directly to your connected accounts.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div>
          <Label className="text-xs">Final Caption & Hashtags</Label>
          <Textarea
            value={caption}
            onChange={(e) => {
              setTouched(true);
              setCaption(e.target.value);
            }}
            rows={4}
            className="text-sm font-sans"
          />
        </div>

        {(!accounts || accounts.length === 0) && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center justify-between">
            <span>No social accounts connected yet.</span>
            <Link to="/integrations" className="font-semibold text-primary hover:underline">
              Connect Instagram Account &rarr;
            </Link>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {accounts?.map((acc) => (
            <Button
              key={acc.id}
              variant="default"
              size="sm"
              disabled={publish.isPending || !caption.trim()}
              onClick={() => publish.mutate(acc.id)}
              className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
            >
              <Send className="h-3.5 w-3.5" />
              Publish to {acc.platform.toUpperCase()} {acc.handle ? `(${acc.handle})` : ""}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function StudioPage() {
  const [projectId, setProjectId] = useState("");
  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.get<Project[]>("/projects"),
  });
  const activeProjectId = projectId || projects?.[0]?.id || "";

  const { data: accounts } = useQuery({
    queryKey: ["socialAccounts", activeProjectId],
    queryFn: () => api.get<SocialAccount[]>(`/social-accounts?projectId=${activeProjectId}`),
    enabled: Boolean(activeProjectId),
  });

  const [topic, setTopic] = useState("AI Agents in 2025: Autonomous workflows that work for creators");
  const [tone, setTone] = useState("viral, energetic, value-driven with emojis");
  const [selectedSocialAccountId, setSelectedSocialAccountId] = useState("");
  const [formats, setFormats] = useState<Role[]>(["search", "text", "image"]);
  const [runId, setRunId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);

  const toggleFormat = (id: Role) =>
    setFormats((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));

  const createWorkflow = useMutation({
    mutationFn: () =>
      api.post<{ templateId: string; runId: string }>(`/projects/${activeProjectId}/briefs`, {
        topic,
        tone: tone || undefined,
        formats,
        socialAccountId: selectedSocialAccountId || undefined,
      }),
    onSuccess: (result) => {
      setRunId(result.runId);
      setTemplateId(result.templateId);
      toast.success("Multi-agent workflow launched!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { data: run } = useQuery({
    queryKey: ["template-run", runId],
    queryFn: () => api.get<TemplateRun>(`/template-runs/${runId}`),
    enabled: Boolean(runId),
    refetchInterval: (query) => (query.state.data?.status === "running" ? 2000 : false),
  });

  const stepByRole = (role: Role) => run?.steps.find((s) => AGENT_TO_ROLE[s.templateStep.agentId] === role);

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-12">
      <PageHeader
        title="Multi-Modal Content Studio"
        description="Compose end-to-end multi-agent pipelines: Search web trends -> Generate viral hooks & captions -> Synthesize visuals & reels -> Publish straight to Instagram & social networks."
      />

      {/* Main Workflow Configurator */}
      <Card glass className="border-primary/20 shadow-xl">
        <CardContent className="space-y-5 pt-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            {projects && projects.length > 1 && (
              <div className="w-full sm:max-w-xs">
                <Label className="text-xs">Project</Label>
                <Select value={activeProjectId} onChange={(e) => setProjectId(e.target.value)}>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </div>
            )}

            {accounts && accounts.length > 0 && (
              <div className="w-full sm:max-w-xs">
                <Label className="text-xs">Connected Social Account (For Auto-Publish)</Label>
                <Select value={selectedSocialAccountId} onChange={(e) => setSelectedSocialAccountId(e.target.value)}>
                  <option value="">Manual publish review</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.platform.toUpperCase()} {acc.handle ? `(${acc.handle})` : ""}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          <div>
            <Label className="text-sm font-semibold flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-orange-500" /> Niche, Topic or Campaign Concept
            </Label>
            <Textarea
              placeholder="e.g. 5 hidden AI tools for creators that save 10 hours a week"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={2}
              className="mt-1 font-medium"
            />
          </div>

          <div>
            <Label className="text-xs">Tone & Style Guidelines (Optional)</Label>
            <Input
              placeholder="e.g. punchy, viral Instagram hook, professional insights, aesthetic cyberpunk..."
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="mt-1 text-sm"
            />
          </div>

          {/* Pipeline Step Selector */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Multi-Agent Pipeline Steps:
            </Label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 mt-2">
              {FORMAT_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const checked = formats.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleFormat(opt.id)}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all h-full ${
                      checked
                        ? "border-primary bg-primary/10 text-primary shadow-sm font-semibold"
                        : "border-border text-muted-foreground hover:bg-secondary/40"
                    }`}
                    title={opt.hint}
                  >
                    <Icon className={`h-5 w-5 ${checked ? "text-primary scale-110" : ""}`} />
                    <span className="text-xs leading-tight">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            size="lg"
            onClick={() => createWorkflow.mutate()}
            disabled={createWorkflow.isPending || !topic.trim() || formats.length === 0 || !activeProjectId}
            className="w-full sm:w-auto shadow-lg bg-gradient-to-r from-primary to-accent hover:opacity-95"
          >
            {createWorkflow.isPending ? <Spinner className="mr-2" /> : <Sparkles className="h-5 w-5 mr-2" />}
            Execute Multi-Agent Workflow Pipeline
          </Button>
        </CardContent>
      </Card>

      {/* Live Pipeline Execution Output */}
      {run && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" /> Active Workflow Execution
            </h3>
            <StatusBadge status={run.status} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {formats
              .filter((role) => role !== "publish")
              .map((role) => (
                <RoleCard key={role} role={role} step={stepByRole(role)} />
              ))}
          </div>

          <PublishPanel
            projectId={activeProjectId}
            textStep={stepByRole("text")}
            imageStep={stepByRole("image")}
          />

          {templateId && (
            <p className="text-center text-sm text-muted-foreground pt-2">
              This workflow is saved dynamically in the database —{" "}
              <Link to={`/templates/${templateId}/edit`} className="inline-flex items-center gap-1 text-primary hover:underline font-medium">
                <Layers className="h-3.5 w-3.5" /> Open in Workflow Builder
              </Link>{" "}
              to customize steps, adjust input mappings, or set automated cron schedules.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

