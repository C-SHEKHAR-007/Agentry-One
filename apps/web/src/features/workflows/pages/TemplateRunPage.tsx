import { NotFoundPage } from "../../../components/common/NotFoundPage";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Play, ExternalLink, Trash2 } from "lucide-react";
import { useSocialAccountsQuery } from "../../integrations/socialAccounts.api";
import {
  useAddScheduleMutation,
  useDeleteScheduleMutation,
  useRunTemplateMutation,
  useSchedulesQuery,
  useTemplateQuery } from "../templates.api";
import { errorMessage } from "../../../services/http/errors";
import { PageHeader } from "../../../components/common/PageHeader";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { Select } from "../../../components/ui/select";
import { Label } from "../../../components/ui/label";
import { Skeleton } from "../../../components/ui/skeleton";
import { Spinner } from "../../../components/ui/spinner";

export function TemplateRunPage() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const { data: template, isError: templateLoadFailed } = useTemplateQuery(templateId ?? "", { skip: !templateId });

  const runInputFields = useMemo(() => {
    const fields = new Set<string>();
    for (const step of template?.steps ?? []) {
      for (const mapping of Object.values(step.inputMapping)) {
        if (mapping.kind === "fromRunInput") fields.add(mapping.field);
      }
    }
    return Array.from(fields);
  }, [template]);

  const { data: socialAccounts } = useSocialAccountsQuery(template?.projectId ?? "", { skip: !template?.projectId });

  const [values, setValues] = useState<Record<string, string>>({});
  const [cronExpr, setCronExpr] = useState<string>("0 9 * * 2"); // Default Tuesday 9am

  const [runTemplate, runState] = useRunTemplateMutation();
  const run = {
    isPending: runState.isLoading,
    isError: runState.isError,
    error: runState.error,
    mutate: () =>
      runTemplate({ templateId: templateId!, inputs: values })
        .unwrap()
        .then((r) => {
          toast.success("Template run started");
          navigate(`/template-runs/${r.id}`);
        })
        .catch((err) => toast.error(errorMessage(err))),
  };

  const { data: schedules } = useSchedulesQuery(templateId ?? "", { skip: !templateId });

  const [addSchedule, addState] = useAddScheduleMutation();
  const schedule = {
    isPending: addState.isLoading,
    mutate: () =>
      addSchedule({ templateId: templateId!, cronExpr, runInputs: values })
        .unwrap()
        .then(() => toast.success(`Workflow scheduled (${cronExpr})`))
        .catch((err) => toast.error(errorMessage(err))),
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [removeSchedule, removeState] = useDeleteScheduleMutation();
  const deleteSchedule = {
    isPending: removeState.isLoading,
    mutate: (id: string) =>
      removeSchedule({ scheduleId: id, templateId: templateId! })
        .unwrap()
        .then(() => {
          toast.success("Schedule removed");
          setConfirmDeleteId(null);
        })
        .catch((err) => toast.error(errorMessage(err))),
  };

  if (templateLoadFailed) return <NotFoundPage what="template" />;
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
                    <p className="text-xs text-warning">
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
          {run.isError && <p className="text-sm text-destructive">{errorMessage(run.error)}</p>}
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

          <Button variant="secondary" onClick={() => schedule.mutate()} disabled={schedule.isPending || !cronExpr.trim()}>
            {schedule.isPending && <Spinner className="mr-2" />}
            Set Schedule
          </Button>

          {schedules && schedules.length > 0 && (
            <div className="space-y-2 pt-2">
              <Label>Active schedules</Label>
              {schedules.map((sch) => (
                <div key={sch.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                  <code className="text-sm">{sch.cronExpr}</code>
                  {confirmDeleteId === sch.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Stop this schedule?</span>
                      <Button size="sm" variant="destructive" disabled={deleteSchedule.isPending} onClick={() => deleteSchedule.mutate(sch.id)}>
                        Remove
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                        Keep
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" aria-label="Remove schedule" onClick={() => setConfirmDeleteId(sch.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
