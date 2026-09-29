import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  Copy,
  FolderKanban,
  Keyboard,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
  Workflow,
  Zap,
} from "lucide-react";
import { api } from "../api/client";
import { useProjects } from "../api/queries";
import type { InputMappingValue } from "../api/types";
import type { AgentManifestDetail } from "../hooks/useTemplateDraft";
import { describeCron } from "../lib/cron";
import { timeAgo } from "../lib/format";
import { runInputsOf } from "../lib/workflowGraph";
import { cn } from "../lib/utils";
import { PageHeader } from "../components/PageHeader";
import { stepIcon } from "../components/builder/stepVisuals";
import { Button, buttonVariants } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { EmptyState } from "../components/ui/empty-state";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";

interface WorkflowSummary {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  project: { id: string; name: string };
  steps: Array<{ stepOrder: number; agentId: string; inputMapping: Record<string, InputMappingValue> }>;
  runs: Array<{ id: string; status: string; createdAt: string; updatedAt: string }>;
  schedules: Array<{ id: string; cronExpr: string }>;
  runCount: number;
}

type SortKey = "updated" | "lastRun" | "runs" | "name";

const RUNNING = ["pending", "running", "awaiting_review", "cancelling"];

function runTone(status: string): { dot: string; label: string } {
  if (status === "completed") return { dot: "bg-success", label: "Succeeded" };
  if (status === "failed") return { dot: "bg-destructive", label: "Failed" };
  if (status === "awaiting_review") return { dot: "bg-warning", label: "Waiting for review" };
  if (RUNNING.includes(status)) return { dot: "bg-primary animate-pulse", label: "Running" };
  if (status === "cancelled") return { dot: "bg-muted-foreground", label: "Cancelled" };
  return { dot: "bg-muted-foreground", label: status };
}

export function BuilderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const projectFilter = searchParams.get("project") ?? "";
  const [sort, setSort] = useState<SortKey>("updated");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<WorkflowSummary | null>(null);

  const { data: projects = [] } = useProjects();
  const {
    data: workflows,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["templates", "library"],
    queryFn: () => api.get<WorkflowSummary[]>("/templates"),
    // Keep last-run badges fresh while something is running.
    refetchInterval: (q) => (q.state.data?.some((w) => RUNNING.includes(w.runs[0]?.status ?? "")) ? 5000 : 30_000),
  });

  // Agent manifests give each step its icon and name (shared cache with the editor).
  const agentIds = useMemo(() => [...new Set((workflows ?? []).flatMap((w) => w.steps.map((s) => s.agentId)).filter(Boolean))], [workflows]);
  const manifestQueries = useQueries({
    queries: agentIds.map((id) => ({
      queryKey: ["agent", id],
      queryFn: () => api.get<AgentManifestDetail>(`/agents/${id}`),
      staleTime: 5 * 60_000,
    })),
  });
  const manifests = useMemo(() => {
    const m = new Map<string, AgentManifestDetail>();
    for (const q of manifestQueries) if (q.data) m.set(q.data.id, q.data);
    return m;
  }, [manifestQueries]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (workflows ?? []).filter(
      (w) =>
        (!projectFilter || w.project.id === projectFilter) &&
        (!q ||
          w.name.toLowerCase().includes(q) ||
          w.project.name.toLowerCase().includes(q) ||
          w.steps.some((s) => (manifests.get(s.agentId)?.name ?? s.agentId).toLowerCase().includes(q))),
    );
    const lastRun = (w: WorkflowSummary) => (w.runs[0] ? new Date(w.runs[0].createdAt).getTime() : 0);
    return list.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "runs") return b.runCount - a.runCount;
      if (sort === "lastRun") return lastRun(b) - lastRun(a);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [workflows, query, projectFilter, sort, manifests]);

  const stats = useMemo(() => {
    const all = workflows ?? [];
    return {
      total: all.length,
      scheduled: all.filter((w) => w.schedules.length > 0).length,
      running: all.filter((w) => RUNNING.includes(w.runs[0]?.status ?? "")).length,
      failing: all.filter((w) => w.runs[0]?.status === "failed").length,
    };
  }, [workflows]);

  const startNew = () => {
    if (projects.length === 1) navigate(`/templates/new?projectId=${projects[0].id}`);
    else setPickerOpen(true);
  };

  // ?new=1 (e.g. from the command palette) jumps straight into creating one.
  const wantsNew = searchParams.get("new") === "1";
  useEffect(() => {
    if (!wantsNew || projects.length === 0) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("new");
        return next;
      },
      { replace: true },
    );
    startNew();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsNew, projects.length]);

  const duplicate = useMutation({
    mutationFn: async (w: WorkflowSummary) => {
      const full = await api.get<{ steps: Array<{ stepOrder: number; agentId: string; agentStepKey: string; inputMapping: unknown }> }>(
        `/templates/${w.id}`,
      );
      return api.post<{ id: string }>(`/projects/${w.project.id}/templates`, {
        name: `Copy of ${w.name}`.slice(0, 200),
        description: w.description ?? undefined,
        steps: full.steps.map(({ stepOrder, agentId, agentStepKey, inputMapping }) => ({ stepOrder, agentId, agentStepKey, inputMapping })),
      });
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Workflow duplicated", {
        action: { label: "Open", onClick: () => navigate(`/templates/${created.id}/edit`) },
      });
    },
    onError: (err) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (w: WorkflowSummary) => api.delete(`/templates/${w.id}`),
    onSuccess: (_, w) => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast.success(`Deleted “${w.name}”`);
      setConfirmDelete(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const setProjectFilter = (id: string) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set("project", id);
        else next.delete("project");
        return next;
      },
      { replace: true },
    );

  return (
    <div>
      <PageHeader
        title="Workflows"
        description="Reusable multi-step pipelines — each step runs an agent and can pass its output to the next."
        actions={
          <Button onClick={startNew} disabled={projects.length === 0} title={projects.length === 0 ? "Create a project first" : undefined}>
            <Plus className="h-4 w-4" /> New workflow
          </Button>
        }
      />

      {isError ? (
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load workflows"
          description="The workflow library is unavailable right now."
          action={
            <Button variant="secondary" onClick={() => refetch()}>
              Try again
            </Button>
          }
        />
      ) : isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : (workflows ?? []).length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="No workflows yet"
          description={
            projects.length === 0
              ? "Create a project first, then chain agents into a reusable workflow."
              : "Chain agents into a pipeline you can run on demand or on a schedule."
          }
          action={
            projects.length === 0 ? (
              <Link to="/projects" className={buttonVariants()}>
                <FolderKanban className="h-4 w-4" /> Go to projects
              </Link>
            ) : (
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={startNew}>
                  <Plus className="h-4 w-4" /> New workflow
                </Button>
                <Link to="/studio" className={buttonVariants({ variant: "secondary" })}>
                  <Zap className="h-4 w-4" /> Generate one in Content Studio
                </Link>
              </div>
            )
          }
        />
      ) : (
        <>
          {/* Stats + toolbar */}
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Workflows" value={stats.total} icon={Workflow} />
            <StatTile label="Scheduled" value={stats.scheduled} icon={CalendarClock} />
            <StatTile label="Running now" value={stats.running} icon={Play} tone={stats.running ? "primary" : undefined} />
            <StatTile label="Last run failed" value={stats.failing} icon={AlertTriangle} tone={stats.failing ? "destructive" : undefined} />
          </div>

          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, project or agent…"
                aria-label="Search workflows"
                className="pl-9"
              />
            </div>
            <div className="flex gap-3">
              <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} aria-label="Filter by project" className="w-full md:w-48">
                <option value="">All projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort workflows" className="w-full md:w-44">
                <option value="updated">Recently edited</option>
                <option value="lastRun">Recently run</option>
                <option value="runs">Most runs</option>
                <option value="name">Name A–Z</option>
              </Select>
            </div>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No workflows match"
              description="Try a different search or project."
              action={
                <Button
                  variant="ghost"
                  onClick={() => {
                    setQuery("");
                    setProjectFilter("");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((w) => (
                <WorkflowCard
                  key={w.id}
                  workflow={w}
                  manifests={manifests}
                  showProject={!projectFilter}
                  onDuplicate={() => duplicate.mutate(w)}
                  onDelete={() => setConfirmDelete(w)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <NewWorkflowDialog open={pickerOpen} onOpenChange={setPickerOpen} projects={projects} defaultProject={projectFilter} />

      <Dialog open={Boolean(confirmDelete)} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete workflow?</DialogTitle>
            <DialogDescription>
              “{confirmDelete?.name}” and its run history will be deleted
              {confirmDelete?.schedules.length ? ", and its schedules will stop" : ""}. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={remove.isPending} onClick={() => confirmDelete && remove.mutate(confirmDelete)}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "primary" | "destructive";
}) {
  return (
    <Card glass className="flex items-center gap-3 px-4 py-3">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          tone === "destructive" ? "bg-destructive/15 text-destructive" : tone === "primary" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xl font-semibold tabular-nums leading-tight">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}

function WorkflowCard({
  workflow: w,
  manifests,
  showProject,
  onDuplicate,
  onDelete,
}: {
  workflow: WorkflowSummary;
  manifests: Map<string, AgentManifestDetail>;
  showProject: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const runInputs = runInputsOf(w.steps.map((s) => ({ ...s, agentStepKey: "" })));
  const last = w.runs[0];
  const tone = last ? runTone(last.status) : null;
  const shownSteps = w.steps.slice(0, 6);

  return (
    <Card glass className="group flex min-w-0 flex-col transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <Link to={`/templates/${w.id}/edit`} className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary">{w.name}</h3>
          {showProject && (
            <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <FolderKanban className="h-3 w-3 shrink-0" /> {w.project.name}
            </p>
          )}
        </Link>
        <CardMenu onDuplicate={onDuplicate} onDelete={onDelete} editHref={`/templates/${w.id}/edit`} name={w.name} />
      </div>

      {/* Mini pipeline */}
      <Link to={`/templates/${w.id}/edit`} className="mx-4 rounded-lg border border-border/60 bg-muted/30 px-3 py-3" aria-label={`Open ${w.name} in the editor`}>
        <div className="flex flex-wrap items-center gap-1">
          {shownSteps.map((s, i) => {
            const agent = manifests.get(s.agentId);
            const Icon = stepIcon(s.agentId, agent);
            return (
              <Fragment key={s.stepOrder}>
                {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />}
                <span
                  title={`Step ${s.stepOrder + 1} · ${agent?.name ?? s.agentId}`}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-card text-primary"
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
              </Fragment>
            );
          })}
          {w.steps.length > shownSteps.length && <span className="ml-1 text-xs text-muted-foreground">+{w.steps.length - shownSteps.length}</span>}
        </div>
        <p className="mt-2 truncate text-xs text-muted-foreground">
          {w.steps.length} {w.steps.length === 1 ? "step" : "steps"} ·{" "}
          {w.steps.map((s) => manifests.get(s.agentId)?.name ?? s.agentId).join(" → ")}
        </p>
      </Link>

      <div className="flex flex-1 flex-col gap-2 px-4 pt-3 text-xs text-muted-foreground">
        {runInputs.length > 0 && (
          <p className="flex items-center gap-1.5 truncate">
            <Keyboard className="h-3.5 w-3.5 shrink-0" /> Asks for {runInputs.map((r) => r.name).join(", ")}
          </p>
        )}
        {w.schedules.length > 0 && (
          <p className="flex items-center gap-1.5 truncate">
            <CalendarClock className="h-3.5 w-3.5 shrink-0" /> {w.schedules.map((s) => describeCron(s.cronExpr)).join(" · ")}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-3">
        <div className="min-w-0">
          {last && tone ? (
            <Link to={`/template-runs/${last.id}`} className="flex items-center gap-2 text-xs hover:text-foreground">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", tone.dot)} />
              <span className="truncate">
                <span className="font-medium text-foreground">{tone.label}</span>
                <span className="text-muted-foreground"> · {timeAgo(last.createdAt)}</span>
              </span>
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground">Never run</span>
          )}
          {w.runs.length > 1 && (
            <div className="mt-1.5 flex items-center gap-1" aria-label="Recent runs">
              {[...w.runs].reverse().map((r) => (
                <span key={r.id} title={`${runTone(r.status).label} · ${timeAgo(r.createdAt)}`} className={cn("h-1.5 w-3 rounded-full", runTone(r.status).dot.replace(" animate-pulse", ""))} />
              ))}
              <span className="ml-1 text-[11px] text-muted-foreground tabular-nums">{w.runCount} runs</span>
            </div>
          )}
        </div>
        <div className="ml-auto flex shrink-0 gap-2">
          <Link to={`/templates/${w.id}/edit`} className={buttonVariants({ size: "sm", variant: "secondary" })}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Link>
          <Link to={`/templates/${w.id}/run`} className={buttonVariants({ size: "sm" })}>
            <Play className="h-3.5 w-3.5" /> Run
          </Link>
        </div>
      </div>
    </Card>
  );
}

function CardMenu({ onDuplicate, onDelete, editHref, name }: { onDuplicate: () => void; onDelete: () => void; editHref: string; name: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const item = "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-secondary";
  return (
    <div ref={ref} className="relative shrink-0">
      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Actions for ${name}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-border bg-popover p-1 shadow-xl">
          <Link role="menuitem" to={editHref} className={item}>
            <Pencil className="h-4 w-4" /> Edit
          </Link>
          <button
            role="menuitem"
            type="button"
            className={item}
            onClick={() => {
              setOpen(false);
              onDuplicate();
            }}
          >
            <Copy className="h-4 w-4" /> Duplicate
          </button>
          <button
            role="menuitem"
            type="button"
            className={cn(item, "text-destructive")}
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

function NewWorkflowDialog({
  open,
  onOpenChange,
  projects,
  defaultProject,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Array<{ id: string; name: string }>;
  defaultProject: string;
}) {
  const navigate = useNavigate();
  const [picked, setPicked] = useState(defaultProject);
  useEffect(() => {
    if (open) setPicked(defaultProject);
  }, [open, defaultProject]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New workflow</DialogTitle>
          <DialogDescription>Workflows belong to a project, which holds their runs and connected accounts.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (picked) navigate(`/templates/new?projectId=${picked}`);
          }}
          className="mt-4 space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="new-workflow-project">Project</Label>
            <Select id="new-workflow-project" value={picked} onChange={(e) => setPicked(e.target.value)} required>
              <option value="">Choose a project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Link to="/studio" className="text-xs text-muted-foreground hover:text-foreground">
              Or generate one in Content Studio →
            </Link>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!picked}>
                Continue
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

