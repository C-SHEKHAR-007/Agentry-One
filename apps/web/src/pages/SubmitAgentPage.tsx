import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { BookmarkPlus, Sparkles } from "lucide-react";
import { api } from "../api/client.js";
import type { Prompt } from "../api/types";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";

interface AgentDetail {
  id: string;
  name: string;
  manifest: {
    steps: Array<{
      inputSchema: { properties?: Record<string, { type?: string }> };
      requiresCapability?: string;
    }>;
  };
}

interface Project {
  id: string;
  name: string;
}

interface Workflow {
  id: string;
}

interface ProviderConfig {
  id: string;
  name: string;
  providerType: string;
  isDefault: boolean;
  status: string;
}

export function SubmitAgentPage() {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState("");
  const [providerConfigId, setProviderConfigId] = useState("");
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  const { data: agent } = useQuery({ queryKey: ["agent", agentId], queryFn: () => api.get<AgentDetail>(`/agents/${agentId}`) });
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: () => api.get<Project[]>("/projects") });
  const { data: prompts } = useQuery({
    queryKey: ["prompts", agentId],
    queryFn: () => api.get<Prompt[]>(`/prompts?agentId=${agentId}`),
    enabled: Boolean(agentId),
  });

  // The field a saved prompt targets: a string field literally named "prompt",
  // else the first string field in the schema.
  const promptField = useMemo(() => {
    const props = agent?.manifest.steps[0]?.inputSchema.properties ?? {};
    if (props.prompt?.type === "string") return "prompt";
    return Object.entries(props).find(([, v]) => v.type === "string")?.[0] ?? null;
  }, [agent]);

  const savePrompt = useMutation({
    mutationFn: (template: string) => {
      const key = window.prompt("Save prompt as (key):", "my-prompt");
      if (!key?.trim()) return Promise.reject(new Error("cancelled"));
      return api.post<Prompt>("/prompts", { agentId, key: key.trim(), template });
    },
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ["prompts", agentId] });
      toast.success(`Saved "${p.key}" v${p.version}`);
    },
    onError: (err) => {
      if (err.message !== "cancelled") toast.error(err.message);
    },
  });

  // Default to the most recent project so the form is immediately usable.
  useEffect(() => {
    if (!projectId && projects?.length) setProjectId(projects[0].id);
  }, [projects, projectId]);

  const requiredCapability = agent?.manifest.steps[0]?.requiresCapability;
  const { data: providers } = useQuery({
    queryKey: ["providers", requiredCapability],
    queryFn: () => api.get<ProviderConfig[]>(`/providers?capability=${requiredCapability}`),
    enabled: Boolean(requiredCapability),
  });
  const activeProviders = providers?.filter((p) => p.status === "active") ?? [];

  const submit = useMutation({
    mutationFn: (input: unknown) =>
      api.post<Workflow>(`/projects/${projectId}/workflows`, {
        agentId,
        input,
        providerConfigId: providerConfigId || undefined,
      }),
    onSuccess: (workflow) => {
      toast.success("Run started");
      navigate(`/workflows/${workflow.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  if (!agent) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14 max-w-md" />
        <Skeleton className="h-72 max-w-2xl" />
      </div>
    );
  }
  const schema = agent.manifest.steps[0].inputSchema;

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={`Run ${agent.name}`}
        description="Form generated automatically from this agent's input schema."
      />

      <Card glass>
        <CardContent className="space-y-5 pt-5">
          <div>
            <Label>Project</Label>
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Select a project...</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>

          {requiredCapability && activeProviders.length > 1 && (
            <div>
              <Label>Provider ({requiredCapability})</Label>
              <Select value={providerConfigId} onChange={(e) => setProviderConfigId(e.target.value)}>
                <option value="">Use default</option>
                {activeProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.providerType}){p.isDefault ? " - default" : ""}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {promptField && (prompts?.length || formData[promptField]) ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {prompts && prompts.length > 0 && (
                <Select
                  value=""
                  onChange={(e) => {
                    const p = prompts.find((x) => x.id === e.target.value);
                    if (p) {
                      setFormData((d) => ({ ...d, [promptField]: p.template }));
                      toast.success(`Inserted "${p.key}" v${p.version}`);
                    }
                  }}
                  className="h-8 w-56"
                >
                  <option value="">Insert saved prompt...</option>
                  {prompts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.key} v{p.version}
                    </option>
                  ))}
                </Select>
              )}
              {Boolean(formData[promptField]) && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => savePrompt.mutate(String(formData[promptField]))}
                >
                  <BookmarkPlus className="h-3.5 w-3.5" /> Save current prompt
                </Button>
              )}
            </div>
          ) : null}

          {projectId && (
            <Form
              schema={schema}
              validator={validator}
              formData={formData}
              onChange={({ formData }) => setFormData(formData ?? {})}
              onSubmit={({ formData }) => submit.mutate(formData)}
              className="rjsf-form"
            />
          )}
          {submit.isError && (
            <p className="text-sm text-destructive">{(submit.error as Error).message}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
