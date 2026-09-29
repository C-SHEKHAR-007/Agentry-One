import { History } from "lucide-react";
import { AGENT_TO_ROLE, briefTopic, ROLE_ORDER, type Role } from "../../lib/studioPlan";
import { timeAgo } from "../../lib/format";
import { statusStyle, TONE } from "../../lib/status";
import { cn } from "../../lib/utils";
import { StatusDot } from "../StatusBadge";
import { Card } from "../ui/card";
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

/** Earlier Studio creations (their latest run), newest first: a compact list
 * beside an open creation, or a card gallery on the empty canvas. */
export function RecentCreations({
  items,
  activeRunId,
  onOpen,
  layout = "list",
}: {
  items: LibraryWorkflow[];
  activeRunId: string | null;
  onOpen: (runId: string) => void;
  layout?: "list" | "grid";
}) {
  if (items.length === 0) return null;
  const title = (
    <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      <History className="h-3.5 w-3.5" /> Recent creations
    </h3>
  );

  if (layout === "grid") {
    return (
      <section>
        {title}
        <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {items.map((w) => {
            const run = w.runs[0];
            const st = statusStyle(run?.status);
            return (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => run && onOpen(run.id)}
                  className="group flex h-full w-full flex-col gap-3 rounded-xl border border-border/70 bg-card/60 p-3.5 text-left backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_8px_30px_-12px_hsl(var(--primary)/0.35)]"
                >
                  <span className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-primary">{briefTopic(w.name)}</span>
                  <span className="mt-auto flex items-center gap-1.5">
                    {rolesOf(w).map((r) => {
                      const Icon = ROLES[r].icon;
                      return (
                        <span key={r} title={ROLES[r].short} className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                          <Icon className="h-3 w-3" aria-label={ROLES[r].short} />
                        </span>
                      );
                    })}
                    <span className={cn("ml-auto flex items-center gap-1.5 text-[11px]", TONE[st.tone].text)}>
                      <StatusDot status={run?.status ?? "pending"} className="h-1.5 w-1.5" />
                      {run ? timeAgo(run.createdAt) : "not run"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  return (
    <Card glass className="p-4">
      {title}
      <ul className="space-y-0.5">
        {items.map((w) => {
          const run = w.runs[0];
          const active = run?.id === activeRunId;
          return (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => run && onOpen(run.id)}
                aria-current={active ? "true" : undefined}
                className={cn("flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-secondary/50", active && "bg-secondary/60")}
              >
                <StatusDot status={run?.status ?? "pending"} className="h-2 w-2" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{briefTopic(w.name)}</span>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    {rolesOf(w).map((r) => {
                      const Icon = ROLES[r].icon;
                      return <Icon key={r} className="h-3 w-3" aria-label={ROLES[r].short} />;
                    })}
                    <span className="ml-1">{run ? timeAgo(run.createdAt) : "not run"}</span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
