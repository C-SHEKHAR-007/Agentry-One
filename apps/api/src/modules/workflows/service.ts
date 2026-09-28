import { prisma } from "../../db/client.js";
import { getQueue } from "../../queue/queues.js";
import { wireQueueListeners } from "../../queue/listener.js";
import { resolveProvider } from "../providers/resolve.js";
import { decryptSocialAccountToken } from "../socialAccounts/routes.js";
import type { AgentManifest, AgentStepManifest } from "../agents/manifestScanner.js";
import { validateStepInput } from "./inputValidation.js";

export class WorkflowError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
  }
}

async function enqueueStepJob(params: {
  workflowId: string;
  workflowStepId: string;
  agentId: string;
  agentVersion: string;
  agentManifest: any;
  step: AgentStepManifest;
  queueName: string;
  params: unknown;
  projectId: string;
  providerConfigId?: string;
  attempts?: number;
  backoffMs?: number;
}) {
  let providerContext = null;
  if (params.step.requiresCapability) {
    providerContext = await resolveProvider(params.step.requiresCapability, {
      projectId: params.projectId,
      explicitProviderConfigId: params.providerConfigId,
    });
    if (!providerContext) {
      // Rejected before any job runs -- not failed partway through a worker
      // run three minutes in (see docs/03-agent-sdk-contract.md).
      throw new WorkflowError(
        `no provider configured for required capability '${params.step.requiresCapability}'`,
        422,
      );
    }
  }

  // Validated (and scoped to this project) at enqueue time so a bad account
  // is a 422 now, not a failure inside the worker later.
  let socialAuth = null;
  if (params.step.requiresSocialAccount) {
    const socialAccountId = (params.params as { socialAccountId?: string } | null)?.socialAccountId;
    if (!socialAccountId) {
      throw new WorkflowError("socialAccountId is required for this step", 422);
    }
    socialAuth = await decryptSocialAccountToken(socialAccountId, params.projectId);
    if (!socialAuth) {
      throw new WorkflowError(`no active social account '${socialAccountId}' is connected to this project`, 422);
    }
  }

  const job = await prisma.job.create({
    data: {
      workflowStepId: params.workflowStepId,
      params: params.params as object,
      status: "queued",
      providerConfigId: providerContext?.providerConfigId ?? null,
      providerType: providerContext?.providerType ?? null,
    },
  });

  await prisma.job.update({ where: { id: job.id }, data: { queueJobId: job.id } });

  wireQueueListeners(params.queueName);
  const queue = getQueue(params.queueName);
  await queue.add(
    params.step.key,
    {
      jobId: job.id,
      workflowId: params.workflowId,
      stepKey: params.step.key,
      agentId: params.agentId,
      agentVersion: params.agentVersion,
      agentManifest: params.agentManifest,
      params: params.params,
      inputArtifactRefs: [],
      // No secrets in the queue payload: Redis is unauthenticated in most
      // deployments and persists to disk, and a job stuck in "waiting" would
      // hold plaintext keys indefinitely. Workers fetch the decrypted values
      // at run time from GET /internal/jobs/:id/secrets (API-key only, and
      // only while the job is live) -- see python/sdk/agent_job.py.
      providerContext: providerContext ? { ...providerContext, apiKey: null, hasApiKey: Boolean(providerContext.apiKey) } : null,
      socialAuth: socialAuth ? { platform: socialAuth.platform, handle: socialAuth.handle, isMock: socialAuth.isMock, hasAccessToken: true } : null,
      stepManifest: params.step,
    },
    {
      jobId: job.id,
      attempts: params.attempts ?? 1,
      backoff: params.backoffMs ? { type: "exponential", delay: params.backoffMs } : undefined,
      // Postgres (jobs/job_runs/events tables) is the durable history.
      removeOnComplete: true,
      removeOnFail: true,
    },
  );

  return job;
}

export async function startWorkflow(
  projectId: string,
  agentId: string,
  input: unknown,
  opts: { providerConfigId?: string } = {},
) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) throw new WorkflowError(`unknown agent: ${agentId}`, 404);

  const manifest = agent.manifest as unknown as AgentManifest;
  if (manifest.steps.length === 0) throw new WorkflowError(`agent ${agentId} has no steps`, 500);

  // Reject bad input now (422) rather than minutes later inside a worker.
  // Applies schema defaults, so `input` may gain default-valued fields.
  const inputErrors = validateStepInput(agentId, manifest.steps[0], input);
  if (inputErrors) throw new WorkflowError(`invalid input: ${inputErrors}`, 422);

  const workflow = await prisma.workflow.create({
    data: {
      projectId,
      agentId,
      agentVersion: agent.version,
      status: "running",
      inputParams: input as object,
    },
  });

  try {
    const stepRows = await Promise.all(
      manifest.steps.map((step, index) =>
        prisma.workflowStep.create({
          data: {
            workflowId: workflow.id,
            stepKey: step.key,
            sequence: index,
            humanGate: Boolean(step.humanGate ?? false),
            status: index === 0 ? "queued" : "pending",
          },
        }),
      ),
    );

    const firstStep = manifest.steps[0];
    await enqueueStepJob({
      workflowId: workflow.id,
      workflowStepId: stepRows[0].id,
      agentId,
      agentVersion: agent.version,
      agentManifest: manifest,
      step: firstStep,
      queueName: manifest.entrypoint.queueName,
      params: input,
      projectId,
      providerConfigId: opts.providerConfigId,
      attempts: manifest.attempts,
      backoffMs: manifest.backoff?.delayMs,
    });

    return workflow;
  } catch (err) {
    await prisma.workflow.update({
      where: { id: workflow.id },
      data: { status: "failed" },
    });
    await prisma.event.create({
      data: {
        workflowId: workflow.id,
        type: "workflow.failed",
        payload: { error: (err as Error).message },
      },
    });
    throw err;
  }
}

export async function advanceOrCompleteWorkflow(
  workflowId: string,
  completedStepId: string,
  nextStepParams?: unknown,
): Promise<{ nextJob?: any; status: "running" | "completed" }> {
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: { agent: true, project: true },
  });
  if (!workflow) throw new WorkflowError("workflow_not_found", 404);

  const nextStep = await prisma.workflowStep.findFirst({
    where: { workflowId, status: "pending" },
    orderBy: { sequence: "asc" },
  });

  if (!nextStep) {
    await prisma.workflow.update({ where: { id: workflowId }, data: { status: "completed" } });
    await prisma.event.create({
      data: {
        workflowId,
        type: "workflow.completed",
        payload: {},
      },
    });
    if (workflow.project?.userId) {
      await prisma.notification.create({
        data: {
          userId: workflow.project.userId,
          type: "success",
          title: "Workflow Completed",
          message: `Workflow ${workflowId.slice(0, 8)} finished successfully.`,
          link: `/workflows/${workflowId}`
        }
      });
    }

    try {
      const { handleWorkflowSettled } = await import("../templates/service.js");
      await handleWorkflowSettled(workflowId, "completed");
    } catch {}
    return { status: "completed" };
  }

  // Next step exists -- prepare and enqueue it
  const manifest = workflow.agent.manifest as unknown as AgentManifest;
  const stepManifest = manifest.steps.find((s) => s.key === nextStep.stepKey);
  if (!stepManifest) {
    throw new WorkflowError(`step ${nextStep.stepKey} not found in agent manifest`, 500);
  }

  // Gather upstream artifacts from all completed steps in this workflow
  const priorArtifacts = await prisma.artifact.findMany({
    where: { workflowStep: { workflowId } },
  });

  // Merge workflow inputParams, upstream artifact references, and nextStepParams
  const mergedParams: Record<string, unknown> = {
    ...((workflow.inputParams as Record<string, unknown>) ?? {}),
    ...((nextStepParams as Record<string, unknown>) ?? {}),
  };

  // Auto-wire artifacts consumed by the next step if not already explicitly provided
  for (const kind of stepManifest.consumesArtifactKinds ?? []) {
    const matchingArtifact = priorArtifacts.find((a) => a.kind === kind);
    if (matchingArtifact) {
      if (kind === "image" && !mergedParams.imagePath) mergedParams.imagePath = matchingArtifact.storageKey;
      if (kind === "audio" && !mergedParams.audioPath) mergedParams.audioPath = matchingArtifact.storageKey;
      if (kind === "text" && !mergedParams.text && !mergedParams.caption) {
        mergedParams.text = matchingArtifact.storageKey;
        mergedParams.caption = matchingArtifact.storageKey;
      }
      if ((kind === "image" || kind === "video") && !mergedParams.mediaUrl) {
        mergedParams.mediaUrl = matchingArtifact.storageKey;
      }
    }
  }

  const job = await enqueueStepJob({
    workflowId,
    workflowStepId: nextStep.id,
    agentId: workflow.agentId,
    agentVersion: workflow.agentVersion,
    agentManifest: manifest,
    step: stepManifest,
    queueName: manifest.entrypoint.queueName,
    params: mergedParams,
    projectId: workflow.projectId,
    attempts: manifest.attempts,
    backoffMs: manifest.backoff?.delayMs,
  });

  await prisma.workflowStep.update({ where: { id: nextStep.id }, data: { status: "queued" } });
  await prisma.workflow.update({ where: { id: workflowId }, data: { status: "running" } });

  return { nextJob: job, status: "running" };
}

export async function advanceStep(workflowId: string, stepKey: string, input: unknown) {
  const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!workflow) throw new WorkflowError("workflow_not_found", 404);

  const step = await prisma.workflowStep.findFirst({ where: { workflowId, stepKey } });
  if (!step) throw new WorkflowError("step_not_found", 404);
  if (step.status !== "awaiting_review") {
    throw new WorkflowError(`step ${stepKey} is not awaiting_review (status: ${step.status})`, 422);
  }

  // Mark the reviewed step as completed
  await prisma.workflowStep.update({ where: { id: step.id }, data: { status: "completed" } });

  // Advance to the next step or complete workflow
  const result = await advanceOrCompleteWorkflow(workflowId, step.id, input);
  return result.nextJob ?? null;
}

export async function reapStaleWorkflows(): Promise<number> {
  const runningWorkflows = await prisma.workflow.findMany({
    where: { status: { in: ["running", "cancelling"] } },
    include: {
      project: true,
      steps: {
        include: { job: true },
      },
    },
  });

  let reaped = 0;
  const now = Date.now();
  const tenMinutesAgo = new Date(now - 10 * 60 * 1000);

  for (const wf of runningWorkflows) {
    let shouldReap = false;
    let reason = "";
    // Judge staleness by the most recent activity, not creation time: a
    // healthy multi-step workflow can easily be older than the threshold.
    const lastActivity = new Date(
      Math.max(wf.updatedAt.getTime(), ...wf.steps.map((s) => s.updatedAt.getTime())),
    );
    const idle = lastActivity < tenMinutesAgo;

    if (wf.steps.length === 0) {
      shouldReap = true;
      reason = "Execution initialized without steps";
    } else if (idle && wf.steps.some((s) => ["queued", "running"].includes(s.status) && !s.job)) {
      // Later steps are legitimately "pending" with no job until the prior
      // step finishes -- only a step that should be executing yet has no job
      // is orphaned.
      shouldReap = true;
      reason = "Step job failed to enqueue or was orphaned";
    } else if (idle) {
      let activeInQueue = false;
      try {
        const agent = await prisma.agent.findUnique({ where: { id: wf.agentId } });
        const manifest = agent?.manifest as any;
        if (manifest?.entrypoint?.queueName) {
          const queue = getQueue(manifest.entrypoint.queueName);
          for (const s of wf.steps) {
            if (s.job?.id) {
              const bJob = await queue.getJob(s.job.id);
              const state = bJob ? await bJob.getState() : null;
              if (state && ["active", "waiting", "delayed", "prioritized", "waiting-children"].includes(state)) {
                activeInQueue = true;
                break;
              }
            }
          }
        }
      } catch {
        // queue inspection failure
      }

      if (!activeInQueue) {
        shouldReap = true;
        reason = "Execution timed out or worker process was terminated";
      }
    }

    if (shouldReap) {
      await prisma.workflow.update({
        where: { id: wf.id },
        data: { status: "failed" },
      });
      for (const s of wf.steps) {
        if (["running", "queued", "pending"].includes(s.status)) {
          await prisma.workflowStep.update({
            where: { id: s.id },
            data: { status: "failed" },
          });
        }
      }
      await prisma.event.create({
        data: {
          workflowId: wf.id,
          type: "workflow.failed",
          payload: { reason },
        },
      });
      if (wf.project?.userId) {
        await prisma.notification.create({
          data: {
            userId: wf.project.userId,
            type: "error",
            title: "Workflow Timed Out",
            message: `Workflow ${wf.id.slice(0, 8)} timed out: ${reason}`,
            link: `/workflows/${wf.id}`
          }
        });
      }

      try {
        const { handleWorkflowSettled } = await import("../templates/service.js");
        await handleWorkflowSettled(wf.id, "failed");
      } catch {}
      reaped++;
    }
  }

  return reaped;
}

