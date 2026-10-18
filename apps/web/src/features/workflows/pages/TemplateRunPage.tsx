import { NotFoundPage } from "../../../components/common/NotFoundPage";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Play } from "lucide-react";
import { useSocialAccountsQuery } from "../../integrations/socialAccounts.api";
import { useRunTemplateMutation, useTemplateQuery } from "../templates.api";
import { errorMessage } from "../../../services/http/errors";
import { groupRunInputs } from "../../../lib/runInputs";
import { PageHeader } from "../../../components/common/PageHeader";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { Spinner } from "../../../components/ui/spinner";
import { StepInputGroup } from "../components/run/StepInputGroup";
import { ScheduleCard } from "../components/run/ScheduleCard";

export function TemplateRunPage() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const { data: template, isError: templateLoadFailed } = useTemplateQuery(templateId ?? "", { skip: !templateId });
  const groups = useMemo(() => groupRunInputs(template?.steps ?? []), [template]);
  const { data: socialAccounts } = useSocialAccountsQuery(template?.projectId ?? "", { skip: !template?.projectId });

  // What was typed (shown in the boxes) and what is sent (typed per the agent's schema).
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, unknown>>({});
  const onChange = (field: string, text: string, value: unknown) => {
    setRaw((r) => ({ ...r, [field]: text }));
    setValues((v) => {
      const next = { ...v };
      if (value === undefined) delete next[field];
      else next[field] = value;
      return next;
    });
  };

  const [runTemplate, runState] = useRunTemplateMutation();
  const run = () =>
    runTemplate({ templateId: templateId!, inputs: values })
      .unwrap()
      .then((r) => {
        toast.success("Workflow run started");
        navigate(`/template-runs/${r.id}`);
      })
      .catch((err) => toast.error(errorMessage(err)));

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
    <div className="mx-auto max-w-5xl">
      <PageHeader title={`Run: ${template.name}`} description={template.description || "Provide the values this workflow needs at run time."} />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card glass>
          <CardContent className="space-y-6 pt-5">
            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This workflow needs no run-time input — every field is a literal or wired from an earlier step.
              </p>
            ) : (
              groups.map((g) => <StepInputGroup key={g.stepOrder} group={g} raw={raw} onChange={onChange} socialAccounts={socialAccounts} />)
            )}

            <div className="flex items-center gap-3 border-t border-border pt-4">
              <Button onClick={run} disabled={runState.isLoading}>
                {runState.isLoading ? <Spinner className="mr-2" /> : <Play className="h-4 w-4" />}
                Run now
              </Button>
              <span className="text-xs text-muted-foreground">
                {template.steps.length} step{template.steps.length === 1 ? "" : "s"}
              </span>
            </div>
            {runState.isError && <p className="text-sm text-destructive">{errorMessage(runState.error)}</p>}
          </CardContent>
        </Card>

        <div className="lg:sticky lg:top-0">
          <ScheduleCard templateId={template.id} runInputs={values} />
        </div>
      </div>
    </div>
  );
}
