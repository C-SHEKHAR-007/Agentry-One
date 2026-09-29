import { History } from "lucide-react";
import { AGENT_TO_ROLE, briefTopic } from "../../lib/studioPlan";
import { timeAgo } from "../../lib/format";
import { cn } from "../../lib/utils";
import { Card } from "../ui/card";
import { LIVE_RUN_STATUSES, ROLES } from "./roles";

export interface LibraryWorkflow {
  id: string;
  name: string;
  project: { id: string; name: string };
  steps: Array<{ agentId: string }>;
  runs: Array<{ id: string; status: string; createdAt: string }>;
}

function dot(status: string) {
  if (status === "completed") return "bg-success";
  if (status === "failed") return "bg-destructive";
  if (status === "awaiting_review") return "bg-warning";
  if (LIVE_RUN_STATUSES.includes(status)) return "bg-primary animate-pulse";
  return "bg-muted-foreground";
}

/** Earlier Studio creations (their latest run), newest first. */
export function RecentCreations({
  items,
  activeRunId,
  onOpen,
}: {
  items: LibraryWorkflow[];
  activeRunId: string | null;
  onOpen: (runId: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <Card glass className="p-4">
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <History className="h-3.5 w-3.5" /> Recent creations
      </h3>
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
                <span className={cn("h-2 w-2 shrink-0 rounded-full", dot(run?.status ?? ""))} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{briefTopic(w.name)}</span>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    {w.steps
                      .map((s) => AGENT_TO_ROLE[s.agentId])
                      .filter(Boolean)
                      .map((r) => {
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
