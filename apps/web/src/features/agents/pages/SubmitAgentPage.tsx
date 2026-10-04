import Form from "@rjsf/core";
import type { RJSFSchema } from "@rjsf/utils";
import { NotFoundPage } from "../../../components/common/NotFoundPage";
import { cspSafeValidator as validator } from "../../../lib/schemaValidator";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { BookmarkPlus, Sparkles } from "lucide-react";
import { useAgentQuery } from "../agents.api";
import { useProjectsQuery } from "../../projects/projects.api";
import { useCreatePromptMutation, usePromptsQuery } from "../../prompts/prompts.api";
import { useProvidersQuery } from "../../providers/providers.api";
import { useStartAgentRunMutation } from "../../runs/agentRuns.api";
import { errorMessage } from "../../../services/http/errors";
import { PageHeader } from "../../../components/common/PageHeader";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { Skeleton } from "../../../components/ui/skeleton";

export function SubmitAgentPage() {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState("");
  const [providerConfigId, setProviderConfigId] = useState("");
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  const { data: agent, isError: agentLoadFailed } = useAgentQuery(agentId ?? "", { skip: !agentId });
  const { data: projects } = useProjectsQuery();
  const { data: prompts } = usePromptsQuery(agentId ?? "", { skip: !agentId });

  // The field a saved prompt targets: a string field literally named "prompt",
  // else the first string field in the schema.
  const promptField = useMemo(() => {
    const props = agent?.manifest.steps[0]?.inputSchema.properties ?? {};
    if (props.prompt?.type === "string") return "prompt";
    return Object.entries(props).find(([, v]) => v.type === "string")?.[0] ?? null;
  }, [agent]);

  const [createPrompt] = useCreatePromptMutation();
  const savePrompt = {
    mutate: (template: string) => {
      const key = window.prompt("Save prompt as (key):", "my-prompt");
      if (!key?.trim() || !agentId) return;
      createPrompt({ agentId, key: key.trim(), template })
        .unwrap()
        .then((p) => toast.success(`Saved "${p.key}" v${p.version}`))
        .catch((err) => toast.error(errorMessage(err)));
    },
  };

  // "Use in run" from the prompt library links here with ?prompt=<id>:
  // pre-fill the prompt field with that saved prompt, once.
  const [searchParams] = useSearchParams();
  const requestedPromptId = searchParams.get("prompt");
  const appliedPromptRef = useRef<string | null>(null);
  useEffect(() => {
    if (!requestedPromptId || !promptField || !prompts || appliedPromptRef.current === requestedPromptId) return;
    const p = prompts.find((x) => x.id === requestedPromptId);
    if (!p) return;
    appliedPromptRef.current = requestedPromptId;
    setFormData((d) => ({ ...d, [promptField]: p.template }));
    toast.success(`Inserted "${p.key}" v${p.version}`);
  }, [requestedPromptId, promptField, prompts]);

  // Default to the most recent project so the form is immediately usable.
  useEffect(() => {
    if (!projectId && projects?.length) setProjectId(projects[0].id);
  }, [projects, projectId]);

  const requiredCapability = agent?.manifest.steps[0]?.requiresCapability;
  const { data: providers } = useProvidersQuery(requiredCapability ?? "", { skip: !requiredCapability });
  const activeProviders = useMemo(() => providers?.filter((p) => p.status === "active") ?? [], [providers]);

  // Auto-select default provider or only active provider so submissions never fail with 422
  useEffect(() => {
    if (!providerConfigId && activeProviders.length > 0) {
      const defaultProvider = activeProviders.find((p) => p.isDefault);
      if (defaultProvider) {
        setProviderConfigId(defaultProvider.id);
      } else if (activeProviders.length === 1) {
        setProviderConfigId(activeProviders[0].id);
      }
    }
  }, [activeProviders, providerConfigId]);

  const [startRun, startState] = useStartAgentRunMutation();
  const submit = (input: Record<string, unknown>) => {
    if (!agentId) return;
    startRun({ projectId, agentId, input, providerConfigId: providerConfigId || undefined })
      .unwrap()
      .then((workflow) => {
        toast.success("Run started");
        navigate(`/workflows/${workflow.id}`);
      })
      .catch((err) => toast.error(errorMessage(err)));
  };

  // rjsf's validator annotates the schema it's given; cached API data is
  // frozen, so hand it a copy.
  const inputSchema = agent?.manifest.steps[0]?.inputSchema;
  const schema = useMemo(() => (inputSchema ? (structuredClone(inputSchema) as RJSFSchema) : undefined), [inputSchema]);

  if (agentLoadFailed) return <NotFoundPage what="agent" />;
  if (!agent || !schema) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14 max-w-md" />
        <Skeleton className="h-72 max-w-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
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

          {requiredCapability && (
            <div>
              <Label>AI Provider / Model ({requiredCapability})</Label>
              {activeProviders.length === 0 ? (
                <div className="mt-1.5 flex items-center justify-between rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
                  <span>No active provider configured for capability "{requiredCapability}".</span>
                  <Link to="/providers" className="font-semibold underline ml-2 hover:text-warning-foreground">
                    Register Provider →
                  </Link>
                </div>
              ) : (
                <Select value={providerConfigId} onChange={(e) => setProviderConfigId(e.target.value)}>
                  <option value="">Use system default provider</option>
                  {activeProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.providerType}){p.isDefault ? " — default" : ""}
                    </option>
                  ))}
                </Select>
              )}
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
              onSubmit={({ formData }) => submit(formData ?? {})}
              className="rjsf-form"
            />
          )}
          {startState.isError && <p className="text-sm text-destructive">{errorMessage(startState.error)}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
