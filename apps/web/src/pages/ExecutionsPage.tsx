import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { api } from "../api/client";
import { useRecentWorkflows } from "../api/queries";
import { ExecutionsTable } from "../components/ExecutionsTable";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";

const STATUSES = ["all", "running", "completed", "failed", "cancelled", "awaiting_review"] as const;

export function ExecutionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlStatus = searchParams.get("status");
  const initialStatus = urlStatus && STATUSES.includes(urlStatus as any) ? urlStatus : "all";
  const [status, setStatus] = useState<string>(initialStatus);

  useEffect(() => {
    const s = searchParams.get("status");
    if (s && STATUSES.includes(s as any)) {
      setStatus(s);
    } else if (!s) {
      setStatus("all");
    }
  }, [searchParams]);

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    const next = new URLSearchParams(searchParams);
    if (newStatus === "all") {
      next.delete("status");
    } else {
      next.set("status", newStatus);
    }
    setSearchParams(next, { replace: true });
  };

  const queryClient = useQueryClient();
  const { data: workflows, isLoading } = useRecentWorkflows(
    50,
    status === "all" ? undefined : status,
  );

  const reapMutation = useMutation({
    mutationFn: () => api.post<{ reaped: number }>("/workflows/reap-stale"),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["recent-workflows"] });
      if (res.reaped > 0) {
        toast.success(`Cleaned up ${res.reaped} stale executions`);
      } else {
        toast.info("No stale executions found");
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div>
      <PageHeader
        title="Executions"
        description="Recent workflow runs across all projects."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => reapMutation.mutate()}
              disabled={reapMutation.isPending}
              className="text-xs flex items-center gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${reapMutation.isPending ? "animate-spin" : ""}`} />
              Reconcile Stale
            </Button>
            <Select value={status} onChange={(e) => handleStatusChange(e.target.value)} className="w-44">
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "All statuses" : s.replace("_", " ")}
                </option>
              ))}
            </Select>
          </div>
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
