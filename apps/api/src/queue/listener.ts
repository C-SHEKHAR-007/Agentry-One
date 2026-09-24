import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { prisma } from "../db/client.js";
import { getQueueEvents } from "./queues.js";
import { publishJobEvent } from "./sse.js";
import { resolveArtifactPath } from "../modules/artifacts/storage.js";
import { handleWorkflowSettled } from "../modules/templates/service.js";
import { advanceOrCompleteWorkflow } from "../modules/workflows/service.js";

async function fileStats(storageKey: string): Promise<{ sizeBytes: bigint; checksum: string } | null> {
  if (storageKey.startsWith("azure://")) return null;
  // Worker-reported paths are only trusted inside ARTIFACTS_DIR.
  const path = resolveArtifactPath(storageKey);
  if (!path) return null;
  try {
    const info = await stat(path);
    const hash = createHash("sha256");
    await new Promise<void>((resolve, reject) => {
      createReadStream(path).on("data", (chunk) => hash.update(chunk)).on("end", resolve).on("error", reject);
    });
    return { sizeBytes: BigInt(info.size), checksum: hash.digest("hex") };
  } catch {
    return null; // artifact file missing/unreadable -- record the row without integrity metadata rather than fail the job
  }
}

interface ResultEnvelope {
  status: "completed" | "failed";
  artifacts: Array<{ kind: string; path: string; mimeType: string; metadata?: Record<string, unknown> }>;
  metrics?: Record<string, unknown>;
  error?: { code?: string; message?: string } | null;
}

const wiredQueues = new Set<string>();

/** QueueEvents is an EventEmitter: a rejected async listener becomes an
 * unhandled rejection, which terminates the Node process (and every open
 * request/SSE stream with it). Every handler goes through this. */
function safe<T extends { jobId: string }>(name: string, handler: (arg: T) => Promise<void>): (arg: T) => void {
  return (arg: T) => {
    handler(arg).catch((err) => {
      console.error(`[queue-listener] ${name} handler failed`, { jobId: arg.jobId, err });
    });
  };
}

function parseEnvelope(returnvalue: unknown): ResultEnvelope | { invalid: string } {
  let value: unknown = returnvalue;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return { invalid: "worker returned a non-JSON result" };
    }
  }
  const env = value as Partial<ResultEnvelope> | null;
  if (!env || typeof env !== "object") return { invalid: "worker returned an empty result" };
  if (env.status === "failed") return env as ResultEnvelope;
  if (!Array.isArray(env.artifacts)) return { invalid: "worker result is missing an artifacts array" };
  for (const a of env.artifacts) {
    if (!a || typeof a.path !== "string" || typeof a.kind !== "string" || typeof a.mimeType !== "string") {
      return { invalid: "worker result contains a malformed artifact entry" };
    }
  }
  return env as ResultEnvelope;
}

/** Atomically moves a job to a terminal status. Returns false if it was
 * already terminal -- a duplicate/late event (e.g. a stalled-job re-run, or
 * another API instance handling the same event) must not be applied twice. */
async function claimTerminal(jobId: string, status: "completed" | "failed"): Promise<boolean> {
  const { count } = await prisma.job.updateMany({
    where: { id: jobId, status: { notIn: ["completed", "failed"] } },
    data: { status },
  });
  return count === 1;
}

async function markJobFailed(jobId: string, failedReason: string): Promise<void> {
  const job = await prisma.job.findUnique({ where: { id: jobId }, include: { workflowStep: { include: { workflow: { include: { project: true } } } } } });
  if (!job) return;
  if (!(await claimTerminal(jobId, "failed"))) return;

  const latestRun = await prisma.jobRun.findFirst({ where: { jobId }, orderBy: { attemptNumber: "desc" } });
  if (latestRun) {
    await prisma.jobRun.update({
      where: { id: latestRun.id },
      data: { status: "failed", finishedAt: new Date(), error: { message: failedReason } },
    });
  }

  await prisma.workflowStep.update({ where: { id: job.workflowStepId }, data: { status: "failed" } });
  await prisma.workflow.update({
    where: { id: job.workflowStep.workflowId },
    data: { status: "failed" },
  });

  await prisma.event.create({ data: { jobId, type: "job.failed", payload: { failedReason } } });
  publishJobEvent(jobId, { type: "failed", error: failedReason });

  if (job.workflowStep.workflow.project.userId) {
    await prisma.notification.create({
      data: {
        userId: job.workflowStep.workflow.project.userId,
        type: "error",
        title: "Execution Failed",
        message: `Job ${jobId.slice(0,8)} failed: ${failedReason}`,
        link: `/workflows/${job.workflowStep.workflowId}`
      }
    });
  }

  await handleWorkflowSettled(job.workflowStep.workflowId, "failed");
}

/** Attaches QueueEvents listeners for one BullMQ queue, persisting progress/
 * completion/failure back to Postgres and relaying to any SSE subscribers.
 * Safe to call more than once per queueName -- guarded by `wiredQueues` so
 * listeners are attached exactly once even though this is called both at
 * server boot and on every workflow submission. */
export function wireQueueListeners(queueName: string): void {
  if (wiredQueues.has(queueName)) return;
  wiredQueues.add(queueName);

  const events = getQueueEvents(queueName);

  events.on("active", safe("active", async ({ jobId }: { jobId: string }) => {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return;
    const attemptNumber = (await prisma.jobRun.count({ where: { jobId } })) + 1;
    await prisma.jobRun.create({
      data: { jobId, attemptNumber, status: "running", startedAt: new Date() },
    });
    await prisma.workflowStep.update({ where: { id: job.workflowStepId }, data: { status: "running" } });
  }));

  events.on("progress", safe("progress", async ({ jobId, data }: { jobId: string; data: unknown }) => {
    const progress = data as { percent?: number; message?: string };
    const latestRun = await prisma.jobRun.findFirst({ where: { jobId }, orderBy: { attemptNumber: "desc" } });
    if (latestRun) {
      await prisma.jobRun.update({
        where: { id: latestRun.id },
        data: { progressPercent: progress.percent, progressMessage: progress.message },
      });
    }
    await prisma.event.create({ data: { jobId, type: "job.progress", payload: progress as object } });
    publishJobEvent(jobId, { type: "progress", percent: progress.percent, message: progress.message });
  }));

  events.on("completed", safe("completed", async ({ jobId, returnvalue }: { jobId: string; returnvalue: unknown }) => {
    const parsed = parseEnvelope(returnvalue);
    if ("invalid" in parsed) {
      await markJobFailed(jobId, parsed.invalid);
      return;
    }
    const result = parsed;
    // The SDK runner returns (rather than throws) a failed envelope for some
    // errors, which BullMQ records as a *completion* -- route it to failure.
    if (result.status === "failed") {
      await markJobFailed(jobId, result.error?.message || "worker reported failure");
      return;
    }

    const job = await prisma.job.findUnique({ where: { id: jobId }, include: { workflowStep: { include: { workflow: { include: { project: true } } } } } });
    if (!job) return;
    if (!(await claimTerminal(jobId, "completed"))) return;

    const latestRun = await prisma.jobRun.findFirst({ where: { jobId }, orderBy: { attemptNumber: "desc" } });
    if (latestRun) {
      await prisma.jobRun.update({ where: { id: latestRun.id }, data: { status: "completed", finishedAt: new Date(), progressPercent: 100 } });
    }

    for (const artifact of result.artifacts) {
      const stats = await fileStats(artifact.path);
      await prisma.artifact.create({
        data: {
          workflowStepId: job.workflowStepId,
          kind: artifact.kind,
          mimeType: artifact.mimeType,
          storageKey: artifact.path,
          sizeBytes: stats?.sizeBytes,
          checksum: stats?.checksum,
          metadata: (artifact.metadata ?? {}) as object,
        },
      });
    }

    const step = job.workflowStep;
    const wasCancelling = step.workflow.status === "cancelling" || step.workflow.status === "cancelled";

    if (wasCancelling) {
      await prisma.workflowStep.update({ where: { id: step.id }, data: { status: "completed" } });
      await prisma.workflow.update({ where: { id: step.workflowId }, data: { status: "cancelled" } });
      await prisma.event.create({
        data: { jobId, workflowId: step.workflowId, type: "workflow.cancelled", payload: result as object },
      });
      publishJobEvent(jobId, { type: "completed" });
      return;
    }

    if (step.humanGate) {
      await prisma.workflowStep.update({ where: { id: step.id }, data: { status: "awaiting_review" } });
      await prisma.workflow.update({ where: { id: step.workflowId }, data: { status: "awaiting_review" } });
      await prisma.event.create({
        data: { jobId, workflowId: step.workflowId, type: "workflow.awaiting_review", payload: result as object },
      });
      
      if (job.workflowStep.workflow.project.userId) {
        await prisma.notification.create({
          data: {
            userId: job.workflowStep.workflow.project.userId,
            type: "info",
            title: "Workflow Paused",
            message: `Workflow ${step.workflowId.slice(0, 8)} is awaiting human review.`,
            link: `/workflows/${step.workflowId}`
          }
        });
      }

      publishJobEvent(jobId, { type: "completed" });
      await handleWorkflowSettled(step.workflowId, "awaiting_review");
    } else {
      await prisma.workflowStep.update({ where: { id: step.id }, data: { status: "completed" } });
      publishJobEvent(jobId, { type: "completed" });
      await advanceOrCompleteWorkflow(step.workflowId, step.id);
    }
  }));

  events.on("failed", safe("failed", async ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
    await markJobFailed(jobId, failedReason);
  }));
}
