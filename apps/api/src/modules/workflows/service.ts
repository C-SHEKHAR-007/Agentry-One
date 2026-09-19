import { prisma } from "../../db/client.js";
import { getQueue } from "../../queue/queues.js";
import { wireQueueListeners } from "../../queue/listener.js";
import { resolveProvider } from "../providers/resolve.js";
import { decryptSocialAccountToken } from "../socialAccounts/routes.js";
import type { AgentManifest, AgentStepManifest } from "../agents/manifestScanner.js";

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
  projectId?: string;
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

  // Same rationale as provider secrets above: decrypt once in Node, hand the
  // worker a ready-to-use token in the (short-lived, removeOnComplete) job
  // payload, so the Python worker never queries Postgres.
  let socialAuth = null;
  if (params.step.requiresSocialAccount) {
    const socialAccountId = (params.params as { socialAccountId?: string } | null)?.socialAccountId;
    if (!socialAccountId) {
      throw new WorkflowError("socialAccountId is required for this step", 422);
    }
    socialAuth = await decryptSocialAccountToken(socialAccountId);
    if (!socialAuth) {
      throw new WorkflowError(`no connected social account found for id '${socialAccountId}'`, 422);
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
      providerContext,
      socialAuth,
      stepManifest: params.step,
    },
    {
      jobId: job.id,
      attempts: params.attempts ?? 1,
      backoff: params.backoffMs ? { type: "exponential", delay: params.backoffMs } : undefined,
      // Decrypted provider secrets transit through this payload in Redis for
      // the job's lifetime (the alternative would mean workers querying
      // Postgres, reopening the boundary ADR-0001 closed). Mitigation:
      // remove the job -- payload included -- as soon as it settles, so the
      // plaintext exposure window is exactly the job's active lifetime.
      // Postgres (jobs/job_runs/events tables) remains the durable history.
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

    if (wf.steps.length === 0) {
      shouldReap = true;
      reason = "Execution initialized without steps";
    } else if (wf.steps.some((s) => !s.job) && wf.createdAt < tenMinutesAgo) {
      shouldReap = true;
      reason = "Step job failed to enqueue or was orphaned";
    } else if (wf.createdAt < tenMinutesAgo) {
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
              if (state === "active" || state === "waiting" || state === "delayed") {
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

