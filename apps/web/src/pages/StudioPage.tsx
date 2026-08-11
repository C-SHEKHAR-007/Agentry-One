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

interface Project {
  id: string;
  name: string;
}

type Role = "text" | "image" | "voice" | "video";

// A brief is generated into an ordinary Template (see apps/api/src/modules
// /contentBriefs/quickStart.ts) -- each generated step's role is just which
// built-in agent it runs, so it's derived from agentId rather than tracked
// as its own field.
const AGENT_TO_ROLE: Record<string, Role> = {
  "content-brief-writer": "text",
  "sketch-agent": "image",
  "voice-agent": "voice",
  "video-agent": "video",
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
}

const FORMAT_OPTIONS: { id: Role; label: string; icon: React.ElementType; hint: string }[] = [
  { id: "text", label: "Caption", icon: Type, hint: "A short caption drafted from your topic" },
  { id: "image", label: "Image", icon: ImageIcon, hint: "A generated image to go with it" },
  { id: "voice", label: "Voiceover", icon: Mic, hint: "Narrates the caption — needs Caption" },
  { id: "video", label: "Short video", icon: Clapperboard, hint: "Image + voiceover assembled into an MP4 — needs Image" },
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
    <Card glass>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="h-4 w-4 text-primary" />
          {meta.label}
        </CardTitle>
        <StatusBadge status={status === "pending" ? "queued" : status} />
      </CardHeader>
      <CardContent>
        {status !== "completed" && status !== "failed" && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {step ? "Generating…" : `Waiting on ${meta.hint.includes("needs") ? meta.hint.split("needs ")[1] : "a prior step"}…`}
          </div>
        )}
        {status === "failed" && <p className="py-4 text-sm text-destructive">This step failed. Check its workflow for details.</p>}
        {status === "completed" && primary && (
          <div className="space-y-2">
            {primary.mimeType.startsWith("image/") && (
              <img src={downloadUrl(primary.id)} alt="" className="w-full rounded-md border border-border" />
            )}
            {primary.mimeType.startsWith("audio/") && <audio controls src={downloadUrl(primary.id)} className="w-full" />}
            {primary.mimeType.startsWith("video/") && (
              <video controls src={downloadUrl(primary.id)} className="w-full rounded-md border border-border" />
            )}
            {primary.mimeType === "text/plain" && role === "text" && <CaptionPreview artifactId={primary.id} />}
            <a href={downloadUrl(primary.id)} download>
              <Button size="sm" variant="ghost">
                <Download className="h-3.5 w-3.5" /> Download
              </Button>
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CaptionPreview({ artifactId }: { artifactId: string }) {
  const { data: text } = useArtifactText(artifactId);
  return <p className="rounded-md border border-border bg-secondary/30 p-3 text-sm">{text ?? "…"}</p>;
}

function PublishPanel({ projectId, textStep }: { projectId: string; textStep: TemplateRunStep | undefined }) {
  const { data: artifacts } = useWorkflowArtifacts(textStep?.workflowId, textStep?.status === "completed");
  const textArtifact = artifacts?.find((a) => a.kind === "text");
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
        input: { socialAccountId, text: caption },
      }),
    onSuccess: () => toast.success("Publish job queued — check Executions for the post link."),
    onError: (err: Error) => toast.error(err.message),
  });

  if (!textArtifact) return null;

  return (
    <Card glass>
      <CardHeader>
        <CardTitle className="text-base">Publish</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Caption</Label>
          <Textarea
            value={caption}
            onChange={(e) => {
              setTouched(true);
              setCaption(e.target.value);
            }}
            rows={3}
          />
        </div>
        {(!accounts || accounts.length === 0) && (
          <p className="text-sm text-muted-foreground">
            No social accounts connected yet — connect one on the{" "}
            <a href="/integrations" className="text-primary hover:underline">Integrations</a> page.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {accounts?.map((acc) => (
            <Button
              key={acc.id}
              variant="outline"
              size="sm"
              disabled={publish.isPending || !caption.trim()}
              onClick={() => publish.mutate(acc.id)}
            >
              <Send className="h-3.5 w-3.5" />
              Post to {acc.platform} {acc.handle ? `(${acc.handle})` : ""}
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

  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("");
  const [formats, setFormats] = useState<Role[]>(["text", "image"]);
  const [runId, setRunId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);

  const toggleFormat = (id: Role) =>
    setFormats((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));

  const createBrief = useMutation({
    mutationFn: () =>
      api.post<{ templateId: string; runId: string }>(`/projects/${activeProjectId}/briefs`, {
        topic,
        tone: tone || undefined,
        formats,
      }),
    onSuccess: (result) => {
      setRunId(result.runId);
      setTemplateId(result.templateId);
      toast.success("Generating your content…");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { data: run } = useQuery({
    queryKey: ["template-run", runId],
    queryFn: () => api.get<TemplateRun>(`/template-runs/${runId}`),
    enabled: Boolean(runId),
    refetchInterval: (query) => (query.state.data?.status === "running" ? 2500 : false),
  });

  const stepByRole = (role: Role) => run?.steps.find((s) => AGENT_TO_ROLE[s.templateStep.agentId] === role);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Content Studio"
        description="Write a brief once — generate every format, then post it straight to your connected accounts."
      />

      <Card glass>
        <CardContent className="space-y-4 pt-5">
          {projects && projects.length > 1 && (
            <div className="max-w-xs">
              <Label>Project</Label>
              <Select value={activeProjectId} onChange={(e) => setProjectId(e.target.value)}>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <Label>What's this about?</Label>
            <Textarea
              placeholder="e.g. Launching our new cold-brew flavor this weekend"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <Label>Tone (optional)</Label>
            <Input placeholder="playful, professional, excited…" value={tone} onChange={(e) => setTone(e.target.value)} />
          </div>

          <div>
            <Label>Generate</Label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {FORMAT_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const checked = formats.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleFormat(opt.id)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center text-xs transition-colors ${
                      checked ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary/40"
                    }`}
                    title={opt.hint}
                  >
                    <Icon className="h-5 w-5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            onClick={() => createBrief.mutate()}
            disabled={createBrief.isPending || !topic.trim() || formats.length === 0 || !activeProjectId}
          >
            {createBrief.isPending ? <Spinner className="mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Generate
          </Button>
        </CardContent>
      </Card>

      {run && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {formats.map((role) => (
              <RoleCard key={role} role={role} step={stepByRole(role)} />
            ))}
          </div>
          <PublishPanel projectId={activeProjectId} textStep={stepByRole("text")} />
          {templateId && (
            <p className="text-center text-sm text-muted-foreground">
              This generation is saved as a reusable template —{" "}
              <Link to={`/templates/${templateId}/edit`} className="inline-flex items-center gap-1 text-primary hover:underline">
                <Layers className="h-3.5 w-3.5" /> open it in the Builder
              </Link>{" "}
              to edit, rerun with a new topic, or schedule it.
            </p>
          )}
        </>
      )}
    </div>
  );
}
