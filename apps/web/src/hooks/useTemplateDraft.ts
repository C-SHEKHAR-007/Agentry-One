import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../api/client";
import type { InputMappingValue } from "../api/types";
import { validateTemplateSteps } from "../lib/templateValidation";

export interface StepDraft {
  stepOrder: number;
  agentId: string;
  agentStepKey: string;
  inputMapping: Record<string, InputMappingValue>;
}

interface AgentSummary {
  id: string;
  name: string;
  description?: string;
}

/** The subset of JSON Schema the editor renders fields from. */
export interface FieldSchema {
  type?: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
}

export interface AgentManifestDetail {
  id: string;
  name: string;
  description?: string;
  manifest: {
    steps: Array<{
      key: string;
      name?: string;
      requiresCapability?: string;
      requiresSocialAccount?: boolean;
      producesArtifactKinds: string[];
      consumesArtifactKinds?: string[];
      inputSchema: { properties?: Record<string, FieldSchema>; required?: string[] };
    }>;
  };
}

interface TemplateDetail {
  id: string;
  projectId: string;
  name: string;
  steps: StepDraft[];
}

export function emptyStep(order: number): StepDraft {
  return { stepOrder: order, agentId: "", agentStepKey: "generate", inputMapping: {} };
}

/** Single source of truth for the template editor -- both the form view and
 * the canvas view bind to this hook's state and helpers. */
export function useTemplateDraft(templateId: string | undefined, projectIdFromQuery: string) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = templateId === undefined;

  const { data: agents } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.get<AgentSummary[]>("/agents"),
  });
  const { data: existing, isError: loadFailed } = useQuery({
    queryKey: ["template", templateId],
    queryFn: () => api.get<TemplateDetail>(`/templates/${templateId}`),
    enabled: !isNew,
  });

  const [name, setName] = useState("");
  const [steps, setSteps] = useState<StepDraft[]>([emptyStep(0)]);
  const [serverErrors, setServerErrors] = useState<string[]>([]);

  // What's on the server -- the draft is "dirty" when it differs.
  const [baseline, setBaseline] = useState(() => JSON.stringify({ name: "", steps: [emptyStep(0)] }));

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setSteps(existing.steps.map((s) => ({ ...s })));
      setBaseline(JSON.stringify({ name: existing.name, steps: existing.steps }));
    }
  }, [existing]);

  const isDirty = JSON.stringify({ name, steps }) !== baseline;

  // Warn before closing the tab or reloading with unsaved edits.
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  // Manifest cache for every agent referenced by any step -- powers field
  // lists, producesArtifactKinds, and live validation.
  const agentIds = useMemo(
    () => [...new Set(steps.map((s) => s.agentId).filter(Boolean))],
    [steps],
  );
  const manifestQueries = useQueries({
    queries: agentIds.map((id) => ({
      queryKey: ["agent", id],
      queryFn: () => api.get<AgentManifestDetail>(`/agents/${id}`),
    })),
  });
  const manifestsById = useMemo(() => {
    const map = new Map<string, AgentManifestDetail>();
    for (const q of manifestQueries) if (q.data) map.set(q.data.id, q.data);
    return map;
  }, [manifestQueries]);

  const producesFor = (step: StepDraft): string[] => {
    const agent = manifestsById.get(step.agentId);
    const ms =
      agent?.manifest.steps.find((s) => s.key === step.agentStepKey) ?? agent?.manifest.steps[0];
    return ms?.producesArtifactKinds ?? [];
  };

  const liveErrors = useMemo(
    () =>
      validateTemplateSteps(
        steps.map((s) => ({
          stepOrder: s.stepOrder,
          inputMapping: s.inputMapping,
          producesArtifactKinds: producesFor(s),
        })),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [steps, manifestsById],
  );

  const targetProjectId = isNew ? projectIdFromQuery : existing?.projectId;

  const save = useMutation({
    mutationFn: async () => {
      const body = { name, steps };
      if (isNew) return api.post<TemplateDetail>(`/projects/${projectIdFromQuery}/templates`, body);
      return api.put<TemplateDetail>(`/templates/${templateId}`, body);
    },
    onSuccess: (template) => {
      setServerErrors([]);
      setBaseline(JSON.stringify({ name, steps }));
      // Workflow lists (library, project page) show names and steps.
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Workflow saved");
      if (isNew) navigate(`/templates/${template.id}/edit`, { replace: true });
    },
    onError: (err: Error) => setServerErrors(err.message.split("; ")),
  });

  function updateStep(index: number, patch: Partial<StepDraft>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function updateMapping(index: number, field: string, value: InputMappingValue) {
    setSteps((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, inputMapping: { ...s.inputMapping, [field]: value } } : s,
      ),
    );
  }

  /** Appends a step and returns its stepOrder. */
  function addStep(): number {
    const order = steps.length;
    setSteps((prev) => [...prev, emptyStep(prev.length)]);
    return order;
  }

  /** Remove a step and renumber; fromStep refs to later steps follow their
   * target. Refs to the removed step are pointed at -1 (no such step) so they
   * surface as errors -- keeping the old number would silently rewire them to
   * whichever step now has that number. */
  function removeStep(index: number) {
    setSteps((prev) => {
      const removedOrder = prev[index]?.stepOrder;
      const kept = prev.filter((_, i) => i !== index);
      const orderMap = new Map(kept.map((s, i) => [s.stepOrder, i]));
      return kept.map((s, i) => ({
        ...s,
        stepOrder: i,
        inputMapping: Object.fromEntries(
          Object.entries(s.inputMapping).map(([field, v]) => {
            if (v.kind !== "fromStep") return [field, v];
            if (v.stepOrder === removedOrder) return [field, { ...v, stepOrder: -1 }]; // dangling -> flagged
            return [field, { ...v, stepOrder: orderMap.get(v.stepOrder) ?? v.stepOrder }];
          }),
        ),
      }));
    });
  }

  return {
    isNew,
    agents: agents ?? [],
    manifestsById,
    name,
    setName,
    steps,
    updateStep,
    updateMapping,
    addStep,
    removeStep,
    liveErrors,
    serverErrors,
    isDirty,
    existingLoaded: isNew || Boolean(existing),
    loadFailed,
    save,
    targetProjectId,
    templateId,
    producesFor,
  };
}

export type TemplateDraft = ReturnType<typeof useTemplateDraft>;
