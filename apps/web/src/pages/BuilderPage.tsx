import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, FolderKanban, Play, Plus, Search, Trash2, Workflow, Zap } from "lucide-react";
import type { WorkflowSummary } from "../models";
import { useAgentManifests } from "../features/agents/agents.api";
import { useProjectsQuery } from "../features/projects/projects.api";
import {
  templatesApi,
  useDeleteTemplateMutation,
  useDuplicateTemplateMutation,
  useWorkflowLibraryQuery,
} from "../features/workflows/templates.api";
import { poll } from "../services/api/polling";
import { errorMessage } from "../services/http/errors";
import { PageHeader } from "../components/PageHeader";
import { Button, buttonVariants } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { EmptyState } from "../components/ui/empty-state";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { RUNNING, WorkflowCard } from "../features/workflows/components/WorkflowCard";
import { StatTile } from "../features/workflows/components/StatTile";
import { NewWorkflowDialog } from "../features/workflows/components/NewWorkflowDialog";

type SortKey = "updated" | "lastRun" | "runs" | "name";

export function BuilderPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const projectFilter = searchParams.get("project") ?? "";
  const [sort, setSort] = useState<SortKey>("updated");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<WorkflowSummary | null>(null);

  const { data: projects = [] } = useProjectsQuery();
  // Keep last-run badges fresh: every 5s while something is running, else 30s.
  const cached = templatesApi.endpoints.workflowLibrary.useQueryState(undefined);
  const anyRunning = (cached.data ?? []).some((w) => RUNNING.includes(w.runs[0]?.status ?? ""));
  const { data: workflows, isLoading, isError, refetch } = useWorkflowLibraryQuery(undefined, poll(anyRunning ? 5000 : 30_000));

  // Agent manifests give each step its icon and name (shared cache with the editor).
  const agentIds = useMemo(() => [...new Set((workflows ?? []).flatMap((w) => w.steps.map((s) => s.agentId)).filter(Boolean))], [workflows]);
  const manifests = useAgentManifests(agentIds);

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

  const [duplicateTemplate, duplicateState] = useDuplicateTemplateMutation();
  const duplicate = {
    isPending: duplicateState.isLoading,
    mutate: (w: WorkflowSummary) =>
      duplicateTemplate(w)
        .unwrap()
        .then((created) =>
          toast.success("Workflow duplicated", {
            action: { label: "Open", onClick: () => navigate(`/templates/${created.id}/edit`) },
          }),
        )
        .catch((err) => toast.error(errorMessage(err))),
  };

  const [deleteTemplate, deleteState] = useDeleteTemplateMutation();
  const remove = {
    isPending: deleteState.isLoading,
    mutate: (w: WorkflowSummary) =>
      deleteTemplate(w.id)
        .unwrap()
        .then(() => {
          toast.success(`Deleted “${w.name}”`);
          setConfirmDelete(null);
        })
        .catch((err) => toast.error(errorMessage(err))),
  };

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
