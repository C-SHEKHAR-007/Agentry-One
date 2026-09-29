import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { FolderKanban, Sparkles, Wand2 } from "lucide-react";
import { api } from "../api/client";
import { useProjects } from "../api/queries";
import { planBrief } from "../lib/studioPlan";
import { PageHeader } from "../components/PageHeader";
import { Composer, type ComposerState, type SocialAccount } from "../components/studio/Composer";
import { RecentCreations, type LibraryWorkflow } from "../components/studio/RecentCreations";
import { RunView, type TemplateRun } from "../components/studio/RunView";
import { PipelineStrip } from "../components/studio/PipelineStrip";
import { LIVE_RUN_STATUSES } from "../components/studio/roles";
import { OrchestrationScene } from "../components/three/OrchestrationScene";
import { buttonVariants } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { EmptyState } from "../components/ui/empty-state";
import { Skeleton } from "../components/ui/skeleton";
import { cn } from "../lib/utils";

const DRAFT_KEY = "agentry.studio.draft";

function loadDraft(): ComposerState {
  const fallback: ComposerState = { topic: "", tone: "", roles: ["search", "text", "image"], socialAccountId: "" };
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null");
    return saved && typeof saved.topic === "string" ? { ...fallback, ...saved, socialAccountId: "" } : fallback;
  } catch {
    return fallback;
  }
}

/** The results pane before anything is generated: the pipeline the current
 * brief will run (it updates as outputs are picked), over the orchestration
 * core. */
function EmptyCanvas({ plan, topic }: { plan: ReturnType<typeof planBrief>; topic: string }) {
  return (
    <Card glass className="glow-border relative flex min-h-[440px] flex-col items-center justify-center overflow-hidden border-transparent p-8 text-center">
      {/* The core sits low and dim so the text above it stays readable. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[-18%] top-[30%] opacity-40">
        <OrchestrationScene activity={plan.steps.length} nodes={Math.max(plan.steps.length, 4)} className="h-full w-full" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_45%,hsl(var(--card)/0.85),transparent_75%)]" />
      <div className="relative flex flex-col items-center gap-5">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary shadow-[0_0_30px_hsl(var(--primary)/0.35)]">
          <Wand2 className="h-6 w-6" />
        </span>
        <div>
          <h2 className="text-base font-semibold">Your content will appear here</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {topic.trim()
              ? "Ready when you are — these agents will take it from research to a finished post."
              : "Describe an idea, pick what you want made, and the agents take it from research to a finished post."}
          </p>
        </div>
        {plan.steps.length > 0 && (
          <div className="rounded-xl border border-border/60 bg-background/60 px-5 py-4 backdrop-blur">
            <PipelineStrip size="lg" steps={plan.steps.map((s) => ({ role: s.role, auto: s.reason.kind === "required" }))} />
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]" /> you picked</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-dashed border-muted-foreground" /> added because another output needs it</span>
        </div>
      </div>
    </Card>
  );
}

export function StudioPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const runId = searchParams.get("run");
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const [projectId, setProjectId] = useState("");
  const activeProjectId = projectId || projects[0]?.id || "";
  // The composer draft survives reloads (per browser).
  const [draft, setDraft] = useState<ComposerState>(loadDraft);
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ topic: draft.topic, tone: draft.tone, roles: draft.roles }));
    } catch {
      /* storage unavailable: drafts just won't persist */
    }
  }, [draft.topic, draft.tone, draft.roles]);

  const { data: accounts = [] } = useQuery({
    queryKey: ["socialAccounts", activeProjectId],
    queryFn: () => api.get<SocialAccount[]>(`/social-accounts?projectId=${activeProjectId}`),
    enabled: Boolean(activeProjectId),
  });

  const { data: library = [] } = useQuery({
    queryKey: ["templates", "library"],
    queryFn: () => api.get<LibraryWorkflow[]>("/templates"),
  });
  // Studio creations are the workflows it generated ("Brief: …").
  const recent = useMemo(
    () =>
      library
        .filter((w) => w.name.startsWith("Brief:") && w.runs.length > 0)
        .sort((a, b) => new Date(b.runs[0].createdAt).getTime() - new Date(a.runs[0].createdAt).getTime())
        .slice(0, 8),
    [library],
  );

  const setRun = (id: string | null) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set("run", id);
        else next.delete("run");
        return next;
      },
      { replace: false },
    );

  const generate = useMutation({
    mutationFn: () => {
      const plan = planBrief(draft.roles, Boolean(draft.socialAccountId));
      const publishing = plan.steps.some((s) => s.role === "publish");
      return api.post<{ templateId: string; runId: string }>(`/projects/${activeProjectId}/briefs`, {
        topic: draft.topic.trim(),
        tone: draft.tone.trim() || undefined,
        formats: draft.roles,
        socialAccountId: publishing ? draft.socialAccountId : undefined,
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setRun(result.runId);
      toast.success("Generating your content");
    },
    onError: (err) => toast.error(err.message),
  });

  const {
    data: run,
    isError: runMissing,
  } = useQuery({
    queryKey: ["template-run", runId],
    queryFn: () => api.get<TemplateRun>(`/template-runs/${runId}`),
    enabled: Boolean(runId),
    // Step starts/finishes are pushed (useLiveActivity); this short poll only
    // runs while generating, for in-step progress messages.
    refetchInterval: (q) => (LIVE_RUN_STATUSES.includes(q.state.data?.status ?? "running") ? 3000 : false),
  });

  // When a run finishes, refresh the library so "Recent creations" is current.
  const runStatus = run?.status;
  useEffect(() => {
    if (runStatus && !LIVE_RUN_STATUSES.includes(runStatus)) queryClient.invalidateQueries({ queryKey: ["templates", "library"] });
  }, [runStatus, queryClient]);

  if (!projectsLoading && projects.length === 0) {
    return (
      <div>
        <PageHeader title="Content Studio" description="Turn one idea into a caption, visual, voiceover and video." />
        <EmptyState
          icon={FolderKanban}
          title="Create a project first"
          description="Studio creations are saved to a project, along with their runs and connected accounts."
          action={
            <Link to="/projects" className={buttonVariants()}>
              Go to projects
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Content Studio" description="Turn one idea into a caption, visual, voiceover and video — then publish it." />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[400px_minmax(0,1fr)]">
        <div className="min-w-0 lg:sticky lg:top-0">
          {projectsLoading ? (
            <Skeleton className="h-[560px] rounded-xl" />
          ) : (
            <Composer
              value={draft}
              onChange={setDraft}
              projects={projects}
              projectId={activeProjectId}
              onProjectChange={setProjectId}
              accounts={accounts}
              onGenerate={() => generate.mutate()}
              generating={generate.isPending}
            />
          )}
        </div>

        {/* On phones an open creation comes first; the composer follows it. */}
        <div className={cn("min-w-0 space-y-4", runId && "order-first lg:order-none")}>
          {runId && runMissing ? (
            <EmptyState
              icon={Sparkles}
              title="This creation isn't available"
              description="It may have been deleted, or it belongs to another project."
              action={
                <button type="button" onClick={() => setRun(null)} className={buttonVariants({ variant: "secondary" })}>
                  Start something new
                </button>
              }
            />
          ) : runId && !run ? (
            <div className="space-y-4">
              <Skeleton className="h-40 rounded-xl" />
              <div className="grid gap-4 xl:grid-cols-2">
                <Skeleton className="h-56 rounded-xl" />
                <Skeleton className="h-56 rounded-xl" />
              </div>
            </div>
          ) : run ? (
            <>
              <RunView run={run} projectId={activeProjectId} accounts={accounts} onNew={() => setRun(null)} onOpen={setRun} />
              <RecentCreations items={recent} activeRunId={runId} onOpen={setRun} />
            </>
          ) : (
            <>
              <EmptyCanvas plan={planBrief(draft.roles, Boolean(draft.socialAccountId))} topic={draft.topic} />
              <RecentCreations items={recent} activeRunId={runId} onOpen={setRun} layout="grid" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
