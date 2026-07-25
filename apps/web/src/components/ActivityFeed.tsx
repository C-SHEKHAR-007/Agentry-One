import { Link } from "react-router-dom";
import {
  CheckCircle2,
  XCircle,
  Eye,
  Ban,
  AlertTriangle,
  Play,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { EventItem } from "../api/types";
import { timeAgo } from "../lib/format";
import { EmptyState } from "./ui/empty-state";
import { Activity } from "lucide-react";
import { cn } from "../lib/utils";

interface EventMeta {
  icon: LucideIcon;
  bg: string;
  iconColor: string;
  label: string;
  dot: string;
}

const EVENT_META: Record<string, EventMeta> = {
  "workflow.completed": {
    icon: CheckCircle2,
    bg: "bg-success/15",
    iconColor: "text-success",
    label: "Workflow completed",
    dot: "bg-success",
  },
  "workflow.failed": {
    icon: XCircle,
    bg: "bg-destructive/15",
    iconColor: "text-destructive",
    label: "Job failed",
    dot: "bg-destructive",
  },
  "workflow.awaiting_review": {
    icon: Eye,
    bg: "bg-warning/15",
    iconColor: "text-warning",
    label: "Awaiting review",
    dot: "bg-warning",
  },
  "workflow.cancelled": {
    icon: Ban,
    bg: "bg-muted",
    iconColor: "text-muted-foreground",
    label: "Workflow cancelled",
    dot: "bg-muted-foreground",
  },
  "job.failed": {
    icon: AlertTriangle,
    bg: "bg-destructive/15",
    iconColor: "text-destructive",
    label: "Job failed",
    dot: "bg-destructive",
  },
  "workflow.started": {
    icon: Play,
    bg: "bg-primary/15",
    iconColor: "text-primary",
    label: "Workflow started",
    dot: "bg-primary",
  },
  "provider.changed": {
    icon: Settings,
    bg: "bg-chart-3/15",
    iconColor: "text-chart-3",
    label: "Provider changed",
    dot: "bg-chart-3",
  },
};

export function ActivityFeed({ events }: { events: EventItem[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No activity yet"
        description="Run an agent and its progress will show up here."
        className="py-6"
      />
    );
  }

  return (
    <ol className="space-y-1">
      {events.map((e) => {
        const meta: EventMeta = EVENT_META[e.type] ?? {
          icon: Activity,
          bg: "bg-muted",
          iconColor: "text-muted-foreground",
          label: e.type,
          dot: "bg-muted-foreground",
        };
        const Icon = meta.icon;
        const subtitle = [e.agentId, e.projectName].filter(Boolean).join(" · ") || "—";

        const body = (
          <div className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/5">
            {/* Colored indicator dot */}
            <span className={cn("h-2 w-2 shrink-0 rounded-full", meta.dot)} />
            {/* Icon square */}
            <span className={cn("inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", meta.bg)}>
              <Icon className={cn("h-3.5 w-3.5", meta.iconColor)} />
            </span>
            {/* Text */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium leading-snug">{meta.label}</p>
              <p className="truncate text-[10px] text-muted-foreground leading-snug">{subtitle}</p>
            </div>
            {/* Time */}
            <span className="shrink-0 text-[10px] text-muted-foreground whitespace-nowrap">
              {timeAgo(e.createdAt)}
            </span>
          </div>
        );

        return (
          <li key={e.id}>
            {e.workflowId ? (
              <Link to={`/workflows/${e.workflowId}`} className="block">
                {body}
              </Link>
            ) : (
              <div>{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
