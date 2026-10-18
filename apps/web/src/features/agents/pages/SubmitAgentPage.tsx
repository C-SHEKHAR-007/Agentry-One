import Form from "@rjsf/core";
import type { RJSFSchema } from "@rjsf/utils";
import { NotFoundPage } from "../../../components/common/NotFoundPage";
import { cspSafeValidator as validator } from "../../../lib/schemaValidator";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Play } from "lucide-react";
import { useAgentQuery } from "../agents.api";
import { useProjectsQuery } from "../../projects/projects.api";
import { useCreatePromptMutation, usePromptsQuery } from "../../prompts/prompts.api";
import { useProvidersQuery } from "../../providers/providers.api";
import { useStartAgentRunMutation } from "../../runs/agentRuns.api";
import { errorMessage } from "../../../services/http/errors";
import { buildUiSchema, promptFieldOf, type SchemaProperty } from "../../../lib/submitForm";
import { currentModelOf } from "../../../lib/providerModel";
import type { Prompt } from "../../../models/prompts";
import { PageHeader } from "../../../components/common/PageHeader";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { Skeleton } from "../../../components/ui/skeleton";
import { SUBMIT_WIDGETS, type SubmitFormContext } from "../components/submit/FormWidgets";
import { RunPreview } from "../components/submit/RunPreview";

export function SubmitAgentPage() {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState("");
  const [providerConfigId, setProviderConfigId] = useState("");
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  const { data: agent, isError: agentLoadFailed } = useAgentQuery(agentId ?? "", { skip: !agentId });
  const { data: projects } = useProjectsQuery();
  const { data: prompts } = usePromptsQuery(agentId ?? "", { skip: !agentId });

  const inputSchema = agent?.manifest.steps[0]?.inputSchema;
  const properties = inputSchema?.properties as Record<string, SchemaProperty> | undefined;
  const promptField = useMemo(() => promptFieldOf(properties), [properties]);
  const uiSchema = useMemo(() => buildUiSchema(properties, promptField), [properties, promptField]);

  const insertPrompt = (p: Prompt) => {
    if (!promptField) return;
    setFormData((d) => ({ ...d, [promptField]: p.template }));
    toast.success(`Inserted "${p.key}" v${p.version}`);
  };

  const [createPrompt] = useCreatePromptMutation();
  const savePrompt = (template: string) => {
    const key = window.prompt("Save prompt as (key):", "my-prompt");
    if (!key?.trim() || !agentId) return;
    createPrompt({ agentId, key: key.trim(), template })
      .unwrap()
      .then((p) => toast.success(`Saved "${p.key}" v${p.version}`))
      .catch((err) => toast.error(errorMessage(err)));
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
  const schema = useMemo(() => (inputSchema ? (structuredClone(inputSchema) as RJSFSchema) : undefined), [inputSchema]);
  const formContext: SubmitFormContext = { prompts, onInsertPrompt: insertPrompt, onSavePrompt: savePrompt };

  if (agentLoadFailed) return <NotFoundPage what="agent" />;
  if (!agent || !schema) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14 max-w-md" />
        <Skeleton className="h-72 max-w-2xl" />
      </div>
    );
  }

  const provider = activeProviders.find((p) => p.id === providerConfigId);
  const noProvider = Boolean(requiredCapability) && activeProviders.length === 0;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={`Run ${agent.name}`} description={agent.description} />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card glass>
          <CardContent className="space-y-5 pt-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="submit-project">Project</Label>
                <Select id="submit-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
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
                  <Label htmlFor="submit-provider">Provider ({requiredCapability})</Label>
                  {noProvider ? (
                    <div className="mt-1.5 rounded-lg border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
                      No active provider.{" "}
                      <Link to="/providers" className="font-semibold underline">
                        Register one →
                      </Link>
                    </div>
                  ) : (
                    <Select id="submit-provider" value={providerConfigId} onChange={(e) => setProviderConfigId(e.target.value)}>
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
            </div>

            {projectId ? (
              <Form
                schema={schema}
                uiSchema={uiSchema}
                widgets={SUBMIT_WIDGETS}
                formContext={formContext}
                validator={validator}
                formData={formData}
                onChange={({ formData }) => setFormData(formData ?? {})}
                onSubmit={({ formData }) => submit(formData ?? {})}
                className="rjsf-form"
              >
                <Button type="submit" className="mt-2" disabled={startState.isLoading || noProvider}>
                  <Play className="h-4 w-4" /> {startState.isLoading ? "Starting…" : "Run agent"}
                </Button>
              </Form>
            ) : (
              <p className="text-sm text-muted-foreground">Pick a project to fill in the inputs.</p>
            )}
            {startState.isError && <p className="text-sm text-destructive">{errorMessage(startState.error)}</p>}
          </CardContent>
        </Card>

        <div className="lg:sticky lg:top-0">
          <RunPreview
            agent={agent}
            projectName={projects?.find((p) => p.id === projectId)?.name}
            provider={provider}
            model={provider ? currentModelOf(provider) : undefined}
            noProvider={noProvider}
          />
        </div>
      </div>
    </div>
  );
}
