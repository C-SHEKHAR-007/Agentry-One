import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import type { Template } from "../../../models";
import { StatusBadge } from "../../../components/common/StatusBadge";
import { Button } from "../../../components/ui/button";

/** The project's saved workflows, each with Edit (its name) and Run. */
export function ProjectWorkflows({ templates, limit }: { templates?: Template[]; limit?: number }) {
  if (templates?.length === 0) {
    return <p className="text-sm text-muted-foreground">No workflows yet — compose reusable multi-step pipelines from your agents.</p>;
  }
  return (
    <div className="space-y-2">
      {(limit ? templates?.slice(0, limit) : templates)?.map((t) => (
        <div key={t.id} className="flex items-center justify-between rounded-md border border-border px-4 py-3 transition-colors hover:border-primary/40">
          <Link to={`/templates/${t.id}/edit`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary">
            {t.name}
          </Link>
          <div className="flex items-center gap-3">
            <StatusBadge status={t.status} />
            <Link to={`/templates/${t.id}/run`}>
              <Button size="sm" variant="secondary">
                <Play className="h-3.5 w-3.5" /> Run
              </Button>
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
