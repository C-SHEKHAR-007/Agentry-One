import { useMemo, useState } from "react";
import { History, Search } from "lucide-react";
import { AGENT_TO_ROLE, briefTopic, ROLE_ORDER, type Role } from "../../../lib/studioPlan";
import { timeAgo } from "../../../lib/format";
import { statusStyle, TONE } from "../../../lib/status";
import { cn } from "../../../lib/utils";
import { StatusDot } from "../../../components/common/StatusBadge";
import { Button } from "../../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { ROLES } from "./roles";

export interface LibraryWorkflow {
  id: string;
  name: string;
  project: { id: string; name: string };
  steps: Array<{ agentId: string }>;
  runs: Array<{ id: string; status: string; createdAt: string }>;
}

function rolesOf(w: LibraryWorkflow): Role[] {
  const set = new Set(w.steps.map((s) => AGENT_TO_ROLE[s.agentId]).filter(Boolean));
  return ROLE_ORDER.filter((r) => set.has(r));
}

/**
 * "Recent" in the Studio header: opens earlier creations (their latest run,
 * newest first) in a searchable dialog; picking one opens it on the page.
 */
export function RecentCreationsButton({
  items,
  activeRunId,
  onOpen,
}: {
  items: LibraryWorkflow[];
  activeRunId: string | null;
  onOpen: (runId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((w) => `${briefTopic(w.name)} ${w.project.name}`.toLowerCase().includes(q)) : items;
  }, [items, query]);
  const live = items.filter((w) => statusStyle(w.runs[0]?.status).live).length;

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} disabled={items.length === 0} title={items.length === 0 ? "Nothing generated yet" : undefined}>
        <History className="h-4 w-4" />
        Recent
        {items.length > 0 && <span className="rounded-full bg-background/60 px-1.5 font-mono text-[11px] text-muted-foreground">{items.length}</span>}
        {live > 0 && <span className="status-dot h-1.5 w-1.5 text-primary" data-live="true" aria-label={`${live} generating`} />}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setQuery("");
        }}
      >
        <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
          <div className="border-b border-border px-5 pb-4 pt-5">
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" /> Recent creations
            </DialogTitle>
            <DialogDescription className="mt-1">Open an earlier creation to see its outputs, publish it or run it again.</DialogDescription>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by topic or project…"
                aria-label="Search recent creations"
                className="h-9 w-full rounded-md border border-input bg-transparent pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <ul className="max-h-[min(60vh,28rem)] overflow-y-auto p-2 scrollbar-thin">
            {shown.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted-foreground">No creations match “{query}”.</li>}
            {shown.map((w) => {
              const run = w.runs[0];
              const st = statusStyle(run?.status);
              const active = run?.id === activeRunId;
              return (
                <li key={w.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!run) return;
                      onOpen(run.id);
                      setOpen(false);
                      setQuery("");
                    }}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/60",
                      active && "bg-primary/10",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium group-hover:text-primary">{briefTopic(w.name)}</span>
                      <span className="mt-1 flex items-center gap-1">
                        {rolesOf(w).map((r) => {
                          const Icon = ROLES[r].icon;
                          return (
                            <span key={r} title={ROLES[r].short} className="flex h-5 w-5 items-center justify-center rounded bg-secondary text-muted-foreground">
                              <Icon className="h-3 w-3" aria-label={ROLES[r].short} />
                            </span>
                          );
                        })}
                        <span className="ml-1.5 truncate text-[11px] text-muted-foreground">{w.project.name}</span>
                      </span>
                    </span>
                    <span className={cn("flex shrink-0 flex-col items-end gap-0.5 text-[11px]", TONE[st.tone].text)}>
                      <span className="flex items-center gap-1.5">
                        <StatusDot status={run?.status ?? "pending"} className="h-1.5 w-1.5" />
                        {st.label}
                      </span>
                      <span className="text-muted-foreground">{run ? timeAgo(run.createdAt) : "not run"}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
