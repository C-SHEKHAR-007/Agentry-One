import { Link } from "react-router-dom";
import { Bot, ImageIcon, MoreHorizontal } from "lucide-react";
import type { RecentWorkflow } from "../api/types";
import { useSasPreviewUrl } from "../api/queries";
import { formatDuration, timeAgo } from "../lib/format";
import { StatusBadge } from "./StatusBadge";
import { EmptyState } from "./ui/empty-state";
import { PlayCircle } from "lucide-react";

/** Tiny component so the hook call is always at top level per item */
function ThumbImage({ artifactId }: { artifactId: string }) {
  const { data: sas } = useSasPreviewUrl(artifactId);
  if (!sas?.url) return <ImageIcon className="h-4 w-4 text-muted-foreground" />;
  return <img src={sas.url} alt="" className="h-full w-full object-cover" loading="lazy" />;
}

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
    <div className="w-full">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 text-left text-[10px] uppercase tracking-wider text-muted-foreground/60">
            <th className="pb-2.5 pr-3 font-semibold">Workflow</th>
            <th className="pb-2.5 pr-3 font-semibold hidden sm:table-cell">Agent</th>
            <th className="pb-2.5 pr-3 font-semibold">Status</th>
            <th className="pb-2.5 pr-3 font-semibold hidden md:table-cell">Duration</th>
            <th className="pb-2.5 font-semibold hidden md:table-cell">Started</th>
            <th className="pb-2.5 w-8" />
          </tr>
        </thead>
        <tbody>
          {workflows.map((w) => (
            <tr key={w.id} className="group border-b border-border/40 last:border-0 hover:bg-white/3 transition-colors">
              <td className="py-2.5 pr-4 pl-1">
                <Link to={`/workflows/${w.id}`} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-secondary">
                    {w.thumbArtifactId ? (
                      <ThumbImage artifactId={w.thumbArtifactId} />
                    ) : (
                      <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold group-hover:text-primary transition-colors">
                      {w.id.slice(0, 8)}
                    </span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {w.project.name}
                    </span>
                  </span>
                </Link>
              </td>
              <td className="py-2 pr-3 hidden sm:table-cell">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/15 text-primary">
                    <Bot className="h-3 w-3" />
                  </span>
                  <span className="truncate text-xs max-w-[100px]">
                    {w.agentName}
                    <span className="ml-1 opacity-50">v{w.agentVersion}</span>
                  </span>
                </span>
              </td>
              <td className="py-2 pr-3">
                <StatusBadge status={w.status} />
              </td>
              <td className="py-2 pr-3 text-xs text-muted-foreground hidden md:table-cell">{formatDuration(w.durationMs)}</td>
              <td className="py-2 text-xs text-muted-foreground hidden md:table-cell">{timeAgo(w.createdAt)}</td>
              <td className="py-2.5">
                <button className="invisible group-hover:visible rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
