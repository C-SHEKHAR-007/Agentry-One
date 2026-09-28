import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Check, CircleDot, Keyboard, LayoutGrid, ListOrdered, Play, Save, X } from "lucide-react";
import { useTemplateDraft } from "../hooks/useTemplateDraft";
import { runInputsOf } from "../lib/workflowGraph";
import { WorkflowCanvas } from "../components/builder/WorkflowCanvas";
import { TemplateFormView } from "../components/builder/TemplateFormView";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { Spinner } from "../components/ui/spinner";
import { cn } from "../lib/utils";
import { NotFoundPage } from "./NotFoundPage";

export function TemplateEditPage() {
  const { templateId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectId = searchParams.get("projectId") ?? "";
  // An explicit ?view= wins; otherwise phones get the form (the canvas needs room).
  const requestedView = searchParams.get("view");
  const [isNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  const view = requestedView === "form" || requestedView === "canvas" ? requestedView : isNarrow ? "form" : "canvas";
  const [dismissedServerErrors, setDismissedServerErrors] = useState(false);

  const draft = useTemplateDraft(templateId, projectId);

  const setView = (v: "canvas" | "form") => {
    const next = new URLSearchParams(searchParams);
    next.set("view", v);
    setSearchParams(next, { replace: true });
  };

  if (draft.loadFailed) return <NotFoundPage what="workflow" />;

  const runInputs = runInputsOf(draft.steps);
  // Save-blocking problems: what the server would reject (bad step
  // references) plus steps that don't have an agent yet.
  const blockingErrors = draft.liveErrors.length + draft.steps.filter((s) => !s.agentId).length;
  const canSave = Boolean(draft.targetProjectId && draft.name.trim()) && blockingErrors === 0 && !draft.save.isPending;
  const saveHint = !draft.targetProjectId
    ? "Open this editor from a project to save"
    : !draft.name.trim()
      ? "Give the workflow a name"
      : blockingErrors
        ? "Fix the highlighted steps to save"
        : undefined;
  const serverErrors = dismissedServerErrors ? [] : draft.serverErrors;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
          <Link
            to="/builder"
            aria-label="Back to workflows"
            title="Back to workflows"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          {draft.existingLoaded ? (
            <input
              value={draft.name}
              onChange={(e) => draft.setName(e.target.value)}
              placeholder="Untitled workflow"
              aria-label="Workflow name"
              className="block w-full min-w-0 max-w-xl truncate rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-lg font-semibold tracking-tight outline-none transition-colors placeholder:text-muted-foreground/50 hover:border-border focus:border-ring"
            />
          ) : (
            <Skeleton className="h-7 w-80 max-w-full" />
          )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-9 text-xs text-muted-foreground">
            <span>
              {draft.steps.length} {draft.steps.length === 1 ? "step" : "steps"}
            </span>
            {runInputs.length > 0 && (
              <span className="flex items-center gap-1">
                <Keyboard className="h-3 w-3" /> asks for {runInputs.map((i) => i.name).join(", ")}
              </span>
            )}
            <SaveState isNew={draft.isNew} dirty={draft.isDirty} saving={draft.save.isPending} errors={blockingErrors} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Editor view" className="flex rounded-lg border border-border bg-card/50 p-0.5">
            {(
              [
                ["canvas", "Canvas", LayoutGrid],
                ["form", "Form", ListOrdered],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                role="tab"
                aria-selected={view === id}
                onClick={() => setView(id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  view === id ? "bg-secondary text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
          {!draft.isNew && (
            <Button
              variant="secondary"
              onClick={() => navigate(`/templates/${templateId}/run`)}
              disabled={draft.isDirty}
              title={draft.isDirty ? "Save your changes before running" : undefined}
            >
              <Play className="h-4 w-4" /> Run
            </Button>
          )}
          <Button
            onClick={() => {
              setDismissedServerErrors(false);
              draft.save.mutate();
            }}
            disabled={!canSave || (!draft.isDirty && !draft.isNew)}
            title={saveHint}
          >
            {draft.save.isPending ? <Spinner /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>

      {serverErrors.length > 0 && (
        <div role="alert" className="mb-3 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1 space-y-0.5">
            <p className="font-medium">The server rejected this workflow:</p>
            {serverErrors.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
          <button type="button" aria-label="Dismiss" onClick={() => setDismissedServerErrors(true)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {!draft.existingLoaded ? (
        <Skeleton className="h-[calc(100dvh-11.5rem)] min-h-[520px] rounded-xl" />
      ) : view === "canvas" ? (
        <div className="h-[calc(100dvh-11.5rem)] min-h-[520px]">
          <WorkflowCanvas draft={draft} />
        </div>
      ) : (
        <TemplateFormView draft={draft} />
      )}
    </div>
  );
}

function SaveState({ isNew, dirty, saving, errors }: { isNew: boolean; dirty: boolean; saving: boolean; errors: number }) {
  if (saving) return <span className="flex items-center gap-1">Saving…</span>;
  if (errors > 0)
    return (
      <span className="flex items-center gap-1 text-destructive">
        <AlertTriangle className="h-3 w-3" /> {errors} {errors === 1 ? "problem" : "problems"} to fix
      </span>
    );
  if (isNew) return <span className="flex items-center gap-1 text-warning"><CircleDot className="h-3 w-3" /> Not saved yet</span>;
  if (dirty)
    return (
      <span className="flex items-center gap-1 text-warning">
        <CircleDot className="h-3 w-3" /> Unsaved changes
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-success">
      <Check className="h-3 w-3" /> All changes saved
    </span>
  );
}
