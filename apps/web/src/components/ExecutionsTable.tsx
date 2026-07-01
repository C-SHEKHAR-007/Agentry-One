import { Link } from "react-router-dom";
import { Bot, ImageIcon } from "lucide-react";
import type { RecentWorkflow } from "../api/types";
import { downloadUrl } from "../api/client";
import { formatDuration, timeAgo } from "../lib/format";
import { StatusBadge } from "./StatusBadge";
import { EmptyState } from "./ui/empty-state";
import { PlayCircle } from "lucide-react";

export function ExecutionsTable({ workflows }: { workflows: RecentWorkflow[] }) {
  if (workflows.length === 0) {
    return (
      <EmptyState
        icon={PlayCircle}
        title="No executions yet"
        description="Submit an agent run and it will appear here."
        className="py-8"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">Workflow</th>
            <th className="pb-2 pr-4 font-medium">Agent</th>
            <th className="pb-2 pr-4 font-medium">Status</th>
            <th className="pb-2 pr-4 font-medium">Duration</th>
            <th className="pb-2 font-medium">Started</th>
          </tr>
        </thead>
        <tbody>
          {workflows.map((w) => (
            <tr key={w.id} className="group border-b border-border/60 last:border-0">
              <td className="py-2.5 pr-4">
                <Link to={`/workflows/${w.id}`} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-secondary">
                    {w.thumbArtifactId ? (
                      <img
                        src={downloadUrl(w.thumbArtifactId)}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium group-hover:text-primary">
                      {w.id.slice(0, 8)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {w.project.name}
                    </span>
                  </span>
                </Link>
              </td>
              <td className="py-2.5 pr-4">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Bot className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {w.agentName}
                    <span className="ml-1 text-xs opacity-60">v{w.agentVersion}</span>
                  </span>
                </span>
              </td>
              <td className="py-2.5 pr-4">
                <StatusBadge status={w.status} />
              </td>
              <td className="py-2.5 pr-4 text-muted-foreground">{formatDuration(w.durationMs)}</td>
              <td className="py-2.5 text-muted-foreground">{timeAgo(w.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
