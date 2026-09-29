import { useMemo, useState, useLayoutEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { FolderKanban, Sparkles, Wand2 } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import { useProjectsQuery } from "../../projects/projects.api";
import { useSocialAccountsQuery } from "../../integrations/socialAccounts.api";
import { useWorkflowRunLive } from "../../runs/runs.api";
import { useCreateBriefMutation } from "../studio.api";
import { setDraft as setDraftAction, type StudioDraft } from "../studio.slice";
import { useWorkflowLibraryQuery } from "../../workflows/templates.api";
import { errorMessage } from "../../../services/http/errors";
import { planBrief } from "../../../lib/studioPlan";
import { PageHeader } from "../../../components/common/PageHeader";
import { Composer } from "../components/Composer";
import { RecentCreationsButton } from "../components/RecentCreations";
import { RunView } from "../components/RunView";
import { PipelineStrip } from "../components/PipelineStrip";
import { OrchestrationScene } from "../../../components/common/three/OrchestrationScene";
import { buttonVariants } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { EmptyState } from "../../../components/ui/empty-state";
import { Skeleton } from "../../../components/ui/skeleton";
import { cn } from "../../../lib/utils";

/** The results pane before anything is generated: the pipeline the current
 * brief will run (it updates as outputs are picked), over the orchestration
 * core. */
function EmptyCanvas({ plan, topic }: { plan: ReturnType<typeof planBrief>; topic: string }) {
  return (
    <Card glass className="glow-border relative flex min-h-[440px] flex-col overflow-hidden border-transparent text-center lg:h-[var(--studio-h,calc(100dvh-12.5rem))]">
      <div className="relative z-10 flex flex-col items-center gap-5 px-8 pt-10">
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
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]" /> you picked</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-dashed border-muted-foreground" /> added because another output needs it</span>
        </div>
      </div>
      {/* The orchestration core fills the space below the text, fading in at
          its top edge so the two read as one composition. */}
      <div className="pointer-events-none relative min-h-[180px] flex-1 [mask-image:linear-gradient(to_bottom,transparent,black_30%)]">
        <OrchestrationScene activity={plan.steps.length} nodes={Math.max(plan.steps.length, 4)} className="absolute inset-0" />
      </div>
    </Card>
  );
}

/** The height left for the composer and results pane: the page's scroll area
 * minus its padding and the header above the grid. Measured (and kept up to
 * date on resize) so the page fits exactly -- no scrollbar -- whatever the
 * window size or header wrapping; exposed as --studio-h. */
function useFitHeight() {
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const root = rootRef.current;
    const grid = gridRef.current;
    const main = root?.closest("main");
    if (!root || !grid || !main) return;
    const measure = () => {
      const cs = getComputedStyle(main);
      const available = main.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const above = grid.getBoundingClientRect().top - root.getBoundingClientRect().top;
      setHeight(Math.max(0, Math.floor(available - above)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(main);
    ro.observe(root.firstElementChild ?? root);
    return () => ro.disconnect();
  }, []);
  return { rootRef, gridRef, style: height ? ({ "--studio-h": `${height}px` } as React.CSSProperties) : undefined };
}

export function StudioPage() {
  const dispatch = useAppDispatch();
  const fit = useFitHeight();
  const [searchParams, setSearchParams] = useSearchParams();
  const runId = searchParams.get("run");
  const { data: projects = [], isLoading: projectsLoading } = useProjectsQuery();
  const [projectId, setProjectId] = useState("");
  const activeProjectId = projectId || projects[0]?.id || "";
  // The composer draft lives in the store and survives reloads (per browser).
  const draft = useAppSelector((st) => st.studio.draft);
  const setDraft = (d: StudioDraft) => dispatch(setDraftAction(d));

  const { data: accounts = [] } = useSocialAccountsQuery(activeProjectId, { skip: !activeProjectId });

  // The library refreshes via tags when a creation starts or finishes.
  const { data: library = [] } = useWorkflowLibraryQuery();
  // Studio creations are the workflows it generated ("Brief: …").
  const recent = useMemo(
    () =>
      library
        .filter((w) => w.name.startsWith("Brief:") && w.runs.length > 0)
        .sort((a, b) => new Date(b.runs[0].createdAt).getTime() - new Date(a.runs[0].createdAt).getTime())
        .slice(0, 50),
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

  const [createBrief, briefState] = useCreateBriefMutation();
  const generate = {
    isPending: briefState.isLoading,
    mutate: () => {
      const plan = planBrief(draft.roles, Boolean(draft.socialAccountId));
      const publishing = plan.steps.some((s) => s.role === "publish");
      createBrief({
        projectId: activeProjectId,
        body: {
          topic: draft.topic.trim(),
          tone: draft.tone.trim() || undefined,
          formats: draft.roles,
          socialAccountId: publishing ? draft.socialAccountId : undefined,
        },
      })
        .unwrap()
        .then((result) => {
          setRun(result.runId);
          toast.success("Generating your content");
        })
        .catch((err) => toast.error(errorMessage(err)));
    },
  };

  // Step starts/finishes are pushed (live activity); this short poll only
  // runs while generating, for in-step progress messages.
  const { data: run, isError: runMissing } = useWorkflowRunLive(runId ?? undefined, 3000);

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
    <div ref={fit.rootRef} style={fit.style}>
      <PageHeader
        title="Content Studio"
        description="Turn one idea into a caption, visual, voiceover and video — then publish it."
        actions={<RecentCreationsButton items={recent} activeRunId={runId} onOpen={setRun} />}
      />

      <div ref={fit.gridRef} className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[400px_minmax(0,1fr)]">
        <div className="min-w-0 lg:sticky lg:top-0">
          {projectsLoading ? (
            <Skeleton className="h-[560px] rounded-xl lg:h-[var(--studio-h,560px)]" />
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
            <RunView run={run} projectId={activeProjectId} accounts={accounts} onNew={() => setRun(null)} onOpen={setRun} />
          ) : (
            <EmptyCanvas plan={planBrief(draft.roles, Boolean(draft.socialAccountId))} topic={draft.topic} />
          )}
        </div>
      </div>
    </div>
  );
}
