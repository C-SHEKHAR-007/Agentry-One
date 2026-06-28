import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Play } from "lucide-react";
import { api } from "../api/client.js";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Skeleton } from "../components/ui/skeleton";
import { Spinner } from "../components/ui/spinner";

type MappingValue = { kind: "literal" | "fromStep" } | { kind: "fromRunInput"; field: string };

interface TemplateDetail {
  id: string;
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

  const [values, setValues] = useState<Record<string, string>>({});

  const run = useMutation({
    mutationFn: () => api.post<TemplateRun>(`/templates/${templateId}/run`, values),
    onSuccess: (run) => {
      toast.success("Template run started");
      navigate(`/template-runs/${run.id}`);
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
    <div className="max-w-2xl">
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
          {runInputFields.map((field) => (
            <div key={field}>
              <Label>{field}</Label>
              <Input
                value={values[field] ?? ""}
                onChange={(e) => setValues({ ...values, [field]: e.target.value })}
              />
            </div>
          ))}

          <Button onClick={() => run.mutate()} disabled={run.isPending}>
            {run.isPending ? <Spinner /> : <Play className="h-4 w-4" />}
            Run template
          </Button>
          {run.isError && <p className="text-sm text-destructive">{(run.error as Error).message}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
