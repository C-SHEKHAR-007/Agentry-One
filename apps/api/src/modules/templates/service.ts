import { prisma } from "../../db/client.js";
import { startWorkflow } from "../workflows/service.js";
import type { AgentManifest } from "../agents/manifestScanner.js";
import { validateTemplateSteps } from "./validation.js";
import type { InputMapping, TemplateStepInput } from "./types.js";

export class TemplateError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
  }
}

async function resolveStepManifestInfo(agentId: string, agentStepKey: string) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) throw new TemplateError(`unknown agent: ${agentId}`, 400);
  const manifest = agent.manifest as unknown as AgentManifest;
  const stepManifest = manifest.steps.find((s) => s.key === agentStepKey);
  if (!stepManifest) throw new TemplateError(`agent ${agentId} has no step '${agentStepKey}'`, 400);
  return { agent, stepManifest };
}

async function validateAndSnapshotSteps(steps: TemplateStepInput[]) {
  const resolved = await Promise.all(
    steps.map(async (s) => {
      const { agent, stepManifest } = await resolveStepManifestInfo(s.agentId, s.agentStepKey);
      return {
        ...s,
        agentVersion: agent.version,
        producesArtifactKinds: stepManifest.producesArtifactKinds,
        inputSchema: stepManifest.inputSchema,
      };
    }),
  );

  const errors = validateTemplateSteps(resolved);
  if (errors.length > 0) throw new TemplateError(errors.join("; "), 422);

  return resolved;
}

export async function validateTemplateDryRun(steps: TemplateStepInput[]): Promise<string[]> {
  try {
    await validateAndSnapshotSteps(steps);
    return [];
  } catch (err) {
    if (err instanceof TemplateError) return err.message.split("; ");
    throw err;
  }
}

export async function createTemplate(projectId: string, name: string, description: string | undefined, steps: TemplateStepInput[]) {
  const resolved = await validateAndSnapshotSteps(steps);

  const template = await prisma.template.create({ data: { projectId, name, description, status: "draft" } });
  await Promise.all(
    resolved.map((s) =>
      prisma.templateStep.create({
        data: {
          templateId: template.id,
          stepOrder: s.stepOrder,
          agentId: s.agentId,
          agentVersion: s.agentVersion,
          agentStepKey: s.agentStepKey,
          producesArtifactKindsSnapshot: s.producesArtifactKinds,
          inputSchemaSnapshot: s.inputSchema as object,
          inputMapping: s.inputMapping as object,
        },
      }),
    ),
  );

  return prisma.template.findUniqueOrThrow({ where: { id: template.id }, include: { steps: { orderBy: { stepOrder: "asc" } } } });
}

export async function updateTemplate(
  templateId: string,
  name: string,
  description: string | undefined,
  steps: TemplateStepInput[],
) {
  const resolved = await validateAndSnapshotSteps(steps);

  await prisma.$transaction([
    prisma.templateStep.deleteMany({ where: { templateId } }),
    prisma.template.update({ where: { id: templateId }, data: { name, description } }),
  ]);

  await Promise.all(
    resolved.map((s) =>
      prisma.templateStep.create({
        data: {
          templateId,
          stepOrder: s.stepOrder,
          agentId: s.agentId,
          agentVersion: s.agentVersion,
          agentStepKey: s.agentStepKey,
          producesArtifactKindsSnapshot: s.producesArtifactKinds,
          inputSchemaSnapshot: s.inputSchema as object,
          inputMapping: s.inputMapping as object,
        },
      }),
    ),
  );

  return prisma.template.findUniqueOrThrow({ where: { id: templateId }, include: { steps: { orderBy: { stepOrder: "asc" } } } });
}

function resolveParams(
  mapping: InputMapping,
  runInputs: Record<string, unknown>,
  upstreamArtifactsByStep: Map<number, { kind: string; storageKey: string }[]>,
): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(mapping)) {
    if (value.kind === "literal") {
      params[field] = value.value;
    } else if (value.kind === "fromRunInput") {
      params[field] = runInputs[value.field];
    } else {
      const artifacts = upstreamArtifactsByStep.get(value.stepOrder) ?? [];
      const match = artifacts.find((a) => a.kind === value.artifactKind);
      // Generic representation of "the referenced artifact" -- no agent in
      // this build actually consumes an artifact-typed input field yet
      // (Sketch only takes text), so this path is structurally present but
      // unexercised by real data, per the plan's explicit scope note.
      params[field] = match?.storageKey ?? null;
    }
  }
  return params;
}

/** The stepOrders a step can't start without -- every stepOrder referenced by
 * any `fromStep` entry in its inputMapping. A step with an empty set has no
 * prerequisites and is startable immediately. `stepOrder`'s existing
 * forward-only validation (templates/validation.ts) already guarantees this
 * reference graph is acyclic, so no separate cycle check is needed here. */
export function dependenciesOf(step: { inputMapping: unknown }): Set<number> {
  const deps = new Set<number>();
  for (const value of Object.values(step.inputMapping as InputMapping)) {
    if (value.kind === "fromStep") deps.add(value.stepOrder);
  }
  return deps;
}

async function startTemplateRunStep(
  templateRunId: string,
  templateRunStepId: string,
  projectId: string,
  agentId: string,
  params: Record<string, unknown>,
) {
  const workflow = await startWorkflow(projectId, agentId, params);
  await prisma.templateRunStep.update({
    where: { id: templateRunStepId },
    data: { workflowId: workflow.id, status: "running" },
  });
}

export async function runTemplate(templateId: string, runInputs: Record<string, unknown>) {
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });
  if (!template) throw new TemplateError("template_not_found", 404);
  if (template.steps.length === 0) throw new TemplateError("template has no steps", 422);

  // Run-time version-drift check (narrower than save-time validation): an
  // agent may have been upgraded since this template was saved.
  for (const step of template.steps) {
    const agent = await prisma.agent.findUnique({ where: { id: step.agentId } });
    if (!agent || agent.version !== step.agentVersion) {
      throw new TemplateError(
        `template step ${step.stepOrder} was built against ${step.agentId}@${step.agentVersion}, but ${agent?.version ?? "no matching agent"} is currently registered -- re-save this template`,
        409,
      );
    }
  }

  const run = await prisma.templateRun.create({ data: { templateId, status: "running", runInputs: runInputs as object } });
  await Promise.all(
    template.steps.map((s) => prisma.templateRunStep.create({ data: { templateRunId: run.id, templateStepId: s.id, status: "pending" } })),
  );

  const readySteps = template.steps.filter((s) => dependenciesOf(s).size === 0);
  if (readySteps.length === 0) {
    throw new TemplateError("template has no step without a fromStep dependency -- nothing can start", 422);
  }
  await Promise.all(
    readySteps.map(async (step) => {
      const runStep = await prisma.templateRunStep.findFirstOrThrow({ where: { templateRunId: run.id, templateStepId: step.id } });
      const params = resolveParams(step.inputMapping as unknown as InputMapping, runInputs, new Map());
      await startTemplateRunStep(run.id, runStep.id, template.projectId, step.agentId, params);
    }),
  );

  return run;
}

/** Called by the queue listener whenever a workflow settles, so a template
 * run can progress to its next step (or finish/fail). No-ops for workflows
 * that aren't part of a template run. */
export async function handleWorkflowSettled(workflowId: string, workflowStatus: "completed" | "failed" | "awaiting_review") {
  const runStep = await prisma.templateRunStep.findFirst({
    where: { workflowId },
    include: {
      templateRun: { include: { template: { include: { steps: { orderBy: { stepOrder: "asc" } } } } } },
      templateStep: true,
    },
  });
  if (!runStep) return;

  if (workflowStatus === "failed") {
    await prisma.templateRunStep.update({ where: { id: runStep.id }, data: { status: "failed" } });
    await prisma.templateRun.update({ where: { id: runStep.templateRunId }, data: { status: "failed" } });
    return;
  }

  if (workflowStatus === "awaiting_review") {
    // Surface prominently rather than bury it -- see docs plan's judgment call.
    await prisma.templateRunStep.update({ where: { id: runStep.id }, data: { status: "awaiting_review" } });
    await prisma.templateRun.update({ where: { id: runStep.templateRunId }, data: { status: "awaiting_review" } });
    return;
  }

  await prisma.templateRunStep.update({ where: { id: runStep.id }, data: { status: "completed" } });

  // A cancel requested on the template run wins over progression: the step
  // that was already mid-execution keeps its output, but no further steps
  // are started.
  if (runStep.templateRun.status === "cancelling" || runStep.templateRun.status === "cancelled") {
    await prisma.templateRun.update({ where: { id: runStep.templateRunId }, data: { status: "cancelled" } });
    return;
  }

  const steps = runStep.templateRun.template.steps;
  const allRunSteps = await prisma.templateRunStep.findMany({
    where: { templateRunId: runStep.templateRunId },
    include: { workflow: { include: { steps: { include: { artifacts: true } } } } },
  });

  const stepOrderByStepId = new Map(steps.map((s) => [s.id, s.stepOrder]));
  const completedOrders = new Set(
    allRunSteps.filter((rs) => rs.status === "completed").map((rs) => stepOrderByStepId.get(rs.templateStepId)!),
  );
  const startedStepIds = new Set(allRunSteps.filter((rs) => rs.status !== "pending").map((rs) => rs.templateStepId));

  if (completedOrders.size === steps.length) {
    await prisma.templateRun.update({ where: { id: runStep.templateRunId }, data: { status: "completed" } });
    return;
  }

  const readySteps = steps.filter(
    (s) => !startedStepIds.has(s.id) && [...dependenciesOf(s)].every((dep) => completedOrders.has(dep)),
  );
  if (readySteps.length === 0) return; // still waiting on other in-flight branches

  const upstreamArtifactsByStep = new Map<number, { kind: string; storageKey: string }[]>();
  for (const rs of allRunSteps) {
    if (rs.status !== "completed" || !rs.workflow) continue;
    const stepOrder = stepOrderByStepId.get(rs.templateStepId);
    if (stepOrder === undefined) continue;
    const artifacts = rs.workflow.steps.flatMap((ws) => ws.artifacts.map((a) => ({ kind: a.kind, storageKey: a.storageKey })));
    upstreamArtifactsByStep.set(stepOrder, artifacts);
  }

  const runInputs = runStep.templateRun.runInputs as unknown as Record<string, unknown>;
  await Promise.all(
    readySteps.map(async (step) => {
      const nextRunStep = await prisma.templateRunStep.findFirstOrThrow({
        where: { templateRunId: runStep.templateRunId, templateStepId: step.id },
      });
      const params = resolveParams(step.inputMapping as unknown as InputMapping, runInputs, upstreamArtifactsByStep);
      await startTemplateRunStep(runStep.templateRunId, nextRunStep.id, runStep.templateRun.template.projectId, step.agentId, params);
    }),
  );
}
