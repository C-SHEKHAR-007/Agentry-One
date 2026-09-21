import { Link } from "react-router-dom";
import { Bot, ImageIcon, MoreHorizontal, Ban, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "../api/client";
import type { RecentWorkflow } from "../api/types";
import { useSasPreviewUrl } from "../api/queries";
import { formatDuration, timeAgo } from "../lib/format";
import { StatusBadge } from "./StatusBadge";
import { EmptyState } from "./ui/empty-state";
import { PlayCircle } from "lucide-react";

/** Tiny component so the hook call is always at top level per item */
function ThumbImage({ artifactId, previewUrl }: { artifactId?: string | null; previewUrl?: string | null }) {
  const { data: sas } = useSasPreviewUrl(!previewUrl && artifactId ? artifactId : undefined);
  const url = previewUrl || sas?.url;
  if (!url) return <ImageIcon className="h-4 w-4 text-muted-foreground" />;
  return <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />;
}

export function ExecutionsTable({ workflows }: { workflows: RecentWorkflow[] }) {
  const queryClient = useQueryClient();

  const cancelMutation = useMutation({
    mutationFn: (workflowId: string) => api.post(`/workflows/${workflowId}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recent-workflows"] });
      toast.success("Execution cancelled");
    },
    onError: (err: Error) => toast.error(err.message),
  });

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
    <div className="w-full overflow-x-auto min-w-0">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border/60 text-muted-foreground">
            <th className="py-3 pr-4 pl-1 font-medium">Execution</th>
            <th className="py-3 pr-3 font-medium hidden sm:table-cell">Agent</th>
            <th className="py-3 pr-3 font-medium">Status</th>
            <th className="py-3 pr-3 font-medium hidden md:table-cell">Duration</th>
            <th className="py-3 pr-1 font-medium text-right hidden md:table-cell">Age</th>
            <th className="py-3 pr-2 text-right font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {workflows.map((w) => (
            <tr key={w.id} className="group border-b border-border/40 last:border-0 hover:bg-white/3 transition-colors">
              <td className="py-2.5 pr-4 pl-1">
                <Link to={`/workflows/${w.id}`} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-secondary">
                    {w.thumbPreviewUrl || w.thumbArtifactId ? (
                      <ThumbImage artifactId={w.thumbArtifactId} previewUrl={w.thumbPreviewUrl} />
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
                  <span className="truncate text-xs max-w-[120px] sm:max-w-none">
                    {w.agentName}
                    <span className="ml-1 opacity-50">v{w.agentVersion}</span>
                  </span>
                </span>
              </td>
              <td className="py-2 pr-3">
                <StatusBadge status={w.status} />
              </td>
              <td className="py-2 pr-3 text-xs text-muted-foreground hidden md:table-cell">{formatDuration(w.durationMs)}</td>
              <td className="py-2 pr-1 text-right text-xs text-muted-foreground hidden md:table-cell">{timeAgo(w.createdAt)}</td>
              <td className="py-2.5 pr-2 text-right">
                {w.status === "running" || w.status === "cancelling" ? (
                  <button
                    onClick={() => cancelMutation.mutate(w.id)}
                    disabled={cancelMutation.isPending}
                    title="Cancel execution"
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Ban className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Cancel</span>
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
