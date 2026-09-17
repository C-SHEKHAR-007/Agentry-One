import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Play, Plus, ExternalLink, MessageSquare } from "lucide-react";
import { api } from "../api/client.js";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Select } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Skeleton } from "../components/ui/skeleton";
import { Spinner } from "../components/ui/spinner";

type MappingValue = { kind: "literal" | "fromStep" } | { kind: "fromRunInput"; field: string };

interface TemplateDetail {
  id: string;
  projectId: string;
  name: string;
  steps: Array<{ inputMapping: Record<string, MappingValue> }>;
}

interface TemplateRun {
  id: string;
}

export function TemplateRunPage() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const { data: template } = useQuery({
    queryKey: ["template", templateId],
    queryFn: () => api.get<TemplateDetail>(`/templates/${templateId}`),
  });

  const runInputFields = useMemo(() => {
    const fields = new Set<string>();
    for (const step of template?.steps ?? []) {
      for (const mapping of Object.values(step.inputMapping)) {
        if (mapping.kind === "fromRunInput") fields.add((mapping as { field: string }).field);
      }
    }
    return Array.from(fields);
  }, [template]);

  const { data: socialAccounts } = useQuery({
    queryKey: ["socialAccounts", template?.projectId],
    queryFn: () =>
      api.get<Array<{ id: string; platform: string; handle?: string }>>(
        `/social-accounts?projectId=${template?.projectId}`,
      ),
    enabled: Boolean(template?.projectId),
  });

  const [values, setValues] = useState<Record<string, string>>({});
  const [cronExpr, setCronExpr] = useState<string>("0 9 * * 2"); // Default Tuesday 9am

  const run = useMutation({
    mutationFn: () => api.post<TemplateRun>(`/templates/${templateId}/run`, values),
    onSuccess: (run) => {
      toast.success("Template run started");
      navigate(`/template-runs/${run.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const schedule = useMutation({
    mutationFn: () => api.post(`/templates/${templateId}/schedule`, { cronExpr, runInputs: values }),
    onSuccess: () => {
      toast.success(`Workflow scheduled successfully (${cronExpr})`);
      navigate(`/builder`); // Go back to workflow list
    },
    onError: (err) => toast.error(err.message),
  });

  if (!template) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14 max-w-md" />
        <Skeleton className="h-48 max-w-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title={`Run: ${template.name}`}
        description="Provide the values this template needs at run time."
      />

      <Card glass>
        <CardContent className="space-y-4 pt-5">
          {runInputFields.length === 0 && (
            <p className="text-sm text-muted-foreground">
              This template needs no run-time input — every field is a literal or wired from an
              earlier step.
            </p>
          )}
          {runInputFields.map((field) => {
            const isSocial = field === "socialAccountId";
            const isLongText = ["prompt", "caption", "text", "brief", "post_idea", "topic", "content"].some((k) =>
              field.toLowerCase().includes(k),
            );

            if (isSocial) {
              return (
                <div key={field} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Target Social Account ({field})</Label>
                    <Link to="/integrations" className="text-xs text-primary hover:underline flex items-center gap-1">
                      Manage Accounts <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                  <Select
                    value={values[field] ?? ""}
                    onChange={(e) => setValues({ ...values, [field]: e.target.value })}
                  >
                    <option value="">Select connected social account...</option>
                    {(socialAccounts ?? []).map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.platform.toUpperCase()} — {acc.handle || acc.id.slice(0, 8)}
                      </option>
                    ))}
                  </Select>
                  {(!socialAccounts || socialAccounts.length === 0) && (
                    <p className="text-xs text-amber-500">
                      No social accounts connected in this project.{" "}
                      <Link to="/integrations" className="underline font-semibold">
                        Connect one in Integrations
                      </Link>
                    </p>
                  )}
                </div>
              );
            }

            if (isLongText) {
              return (
                <div key={field} className="space-y-1.5">
                  <Label className="capitalize">{field.replace(/([A-Z])/g, " $1")}</Label>
                  <Textarea
                    rows={3}
                    value={values[field] ?? ""}
                    placeholder={`Enter ${field}...`}
                    onChange={(e) => setValues({ ...values, [field]: e.target.value })}
                  />
                </div>
              );
            }

            return (
              <div key={field} className="space-y-1.5">
                <Label className="capitalize">{field.replace(/([A-Z])/g, " $1")}</Label>
                <Input
                  value={values[field] ?? ""}
                  placeholder={`Enter ${field}...`}
                  onChange={(e) => setValues({ ...values, [field]: e.target.value })}
                />
              </div>
            );
          })}

          <Button onClick={() => run.mutate()} disabled={run.isPending}>
            {run.isPending ? <Spinner className="mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            Run now
          </Button>
          {run.isError && <p className="text-sm text-destructive">{(run.error as Error).message}</p>}
        </CardContent>
      </Card>

      <Card glass>
        <CardContent className="space-y-4 pt-5">
          <h3 className="text-sm font-semibold">Or, Schedule on a Recurring Basis</h3>
          <p className="text-sm text-muted-foreground">Automatically trigger this workflow using a Cron expression.</p>
          
          <div>
            <Label>Cron Schedule Expression</Label>
            <Input
              value={cronExpr}
              onChange={(e) => setCronExpr(e.target.value)}
              placeholder="0 9 * * 2 (e.g. Tuesday at 9am)"
              className="font-mono text-sm"
            />
          </div>

          <Button variant="secondary" onClick={() => schedule.mutate()} disabled={schedule.isPending}>
            {schedule.isPending && <Spinner className="mr-2" />}
            Set Schedule
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
