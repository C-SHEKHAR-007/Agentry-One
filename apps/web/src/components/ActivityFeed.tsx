import { Link } from "react-router-dom";
import {
  CheckCircle2,
  XCircle,
  Eye,
  Ban,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import type { EventItem } from "../api/types";
import { timeAgo } from "../lib/format";
import { EmptyState } from "./ui/empty-state";
import { Activity } from "lucide-react";

const EVENT_META: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  "workflow.completed": { icon: CheckCircle2, color: "text-success", label: "Workflow completed" },
  "workflow.failed": { icon: XCircle, color: "text-destructive", label: "Workflow failed" },
  "workflow.awaiting_review": { icon: Eye, color: "text-warning", label: "Awaiting review" },
  "workflow.cancelled": { icon: Ban, color: "text-muted-foreground", label: "Workflow cancelled" },
  "job.failed": { icon: AlertTriangle, color: "text-destructive", label: "Job failed" },
};

export function ActivityFeed({ events }: { events: EventItem[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No activity yet"
        description="Run an agent and its progress will show up here."
        className="py-8"
      />
    );
  }

  return (
    <ol className="relative space-y-4">
      {events.map((e) => {
        const meta = EVENT_META[e.type] ?? {
          icon: Activity,
          color: "text-muted-foreground",
          label: e.type,
        };
        const Icon = meta.icon;
        const body = (
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 shrink-0 ${meta.color}`}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{meta.label}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[e.agentId, e.projectName].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(e.createdAt)}</span>
          </div>
        );
        return (
          <li key={e.id}>
            {e.workflowId ? (
              <Link
                to={`/workflows/${e.workflowId}`}
                className="-mx-2 block rounded-md px-2 py-1 transition-colors hover:bg-secondary/50"
              >
                {body}
              </Link>
            ) : (
              <div className="px-0 py-1">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
