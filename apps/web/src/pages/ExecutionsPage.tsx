import { useState } from "react";
import { useRecentWorkflows } from "../api/queries";
import { ExecutionsTable } from "../components/ExecutionsTable";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent } from "../components/ui/card";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";

const STATUSES = ["all", "running", "completed", "failed", "cancelled", "awaiting_review"] as const;

export function ExecutionsPage() {
  const [status, setStatus] = useState<string>("all");
  const { data: workflows, isLoading } = useRecentWorkflows(
    50,
    status === "all" ? undefined : status,
  );

  return (
    <div>
      <PageHeader
        title="Executions"
        description="Recent workflow runs across all projects."
        actions={
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All statuses" : s.replace("_", " ")}
              </option>
            ))}
          </Select>
        }
      />
      <Card glass>
        <CardContent className="pt-5">
          {isLoading ? <Skeleton className="h-64" /> : <ExecutionsTable workflows={workflows ?? []} />}
        </CardContent>
      </Card>
    </div>
  );
}
