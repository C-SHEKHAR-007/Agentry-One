import { Fragment, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarClock,
  ChevronRight,
  Copy,
  FolderKanban,
  Keyboard,
  MoreHorizontal,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import type { AgentManifestDetail, WorkflowSummary } from "../../../models";
import { describeCron } from "../../../lib/cron";
import { timeAgo } from "../../../lib/format";
import { runInputsOf } from "../../../lib/workflowGraph";
import { cn } from "../../../lib/utils";
import { stepIcon } from "../../../components/common/graph/stepVisuals";
import { Button, buttonVariants } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";

export const RUNNING = ["pending", "running", "awaiting_review", "cancelling"];

function runTone(status: string): { dot: string; label: string } {
  if (status === "completed") return { dot: "bg-success", label: "Succeeded" };
  if (status === "failed") return { dot: "bg-destructive", label: "Failed" };
  if (status === "awaiting_review") return { dot: "bg-warning", label: "Waiting for review" };
  if (RUNNING.includes(status)) return { dot: "bg-primary animate-pulse", label: "Running" };
  if (status === "cancelled") return { dot: "bg-muted-foreground", label: "Cancelled" };
  return { dot: "bg-muted-foreground", label: status };
}

export function WorkflowCard({
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
