import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { prisma } from "../db/client.js";
import { getQueueEvents } from "./queues.js";
import { publishJobEvent } from "./sse.js";
import { handleWorkflowSettled } from "../modules/templates/service.js";
import { advanceOrCompleteWorkflow } from "../modules/workflows/service.js";

async function fileStats(path: string): Promise<{ sizeBytes: bigint; checksum: string } | null> {
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

/** Attaches QueueEvents listeners for one BullMQ queue, persisting progress/
 * completion/failure back to Postgres and relaying to any SSE subscribers.
 * Safe to call more than once per queueName -- guarded by `wiredQueues` so
 * listeners are attached exactly once even though this is called both at
 * server boot and on every workflow submission. */
export function wireQueueListeners(queueName: string): void {
  if (wiredQueues.has(queueName)) return;
  wiredQueues.add(queueName);

  const events = getQueueEvents(queueName);

  events.on("active", async ({ jobId }) => {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return;
    const attemptNumber = (await prisma.jobRun.count({ where: { jobId } })) + 1;
    await prisma.jobRun.create({
      data: { jobId, attemptNumber, status: "running", startedAt: new Date() },
    });
    await prisma.workflowStep.update({ where: { id: job.workflowStepId }, data: { status: "running" } });
  });

  events.on("progress", async ({ jobId, data }) => {
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
  });

  events.on("completed", async ({ jobId, returnvalue }) => {
    const result = (typeof returnvalue === "string" ? JSON.parse(returnvalue) : returnvalue) as ResultEnvelope;

    const job = await prisma.job.findUnique({ where: { id: jobId }, include: { workflowStep: { include: { workflow: true } } } });
    if (!job) return;

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

    await prisma.job.update({ where: { id: jobId }, data: { status: "completed" } });

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
      publishJobEvent(jobId, { type: "completed" });
      await handleWorkflowSettled(step.workflowId, "awaiting_review");
    } else {
      await prisma.workflowStep.update({ where: { id: step.id }, data: { status: "completed" } });
      publishJobEvent(jobId, { type: "completed" });
      await advanceOrCompleteWorkflow(step.workflowId, step.id);
    }
  });

  events.on("failed", async ({ jobId, failedReason }) => {
    const job = await prisma.job.findUnique({ where: { id: jobId }, include: { workflowStep: true } });
    if (!job) return;

    const latestRun = await prisma.jobRun.findFirst({ where: { jobId }, orderBy: { attemptNumber: "desc" } });
    if (latestRun) {
      await prisma.jobRun.update({
        where: { id: latestRun.id },
        data: { status: "failed", finishedAt: new Date(), error: { message: failedReason } },
      });
    }

    await prisma.job.update({ where: { id: jobId }, data: { status: "failed" } });
    await prisma.workflowStep.update({ where: { id: job.workflowStepId }, data: { status: "failed" } });
    await prisma.workflow.update({
      where: { id: job.workflowStep.workflowId },
      data: { status: "failed" },
    });

    await prisma.event.create({ data: { jobId, type: "job.failed", payload: { failedReason } } });
    publishJobEvent(jobId, { type: "failed", error: failedReason });

    await handleWorkflowSettled(job.workflowStep.workflowId, "failed");
  });
}
