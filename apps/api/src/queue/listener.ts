import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { prisma } from "../db/client.js";
import { getQueue, getQueueEvents } from "./queues.js";
import { publishJobEvent } from "./sse.js";
import { resolveArtifactPath } from "../modules/artifacts/storage.js";
import { jobOutcomes, trackQueue } from "../http/metrics.js";
import { handleWorkflowSettled } from "../modules/templates/service.js";
import { advanceOrCompleteWorkflow } from "../modules/workflows/service.js";
import { classifyProgress, completionLine, parseUsage, priceAttempt, type LogLevel } from "./telemetry.js";

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

/** Appends a line to an attempt's log and relays it to live subscribers. */
async function writeLog(jobRunId: string, jobId: string, level: LogLevel, message: string): Promise<void> {
  if (!message.trim()) return;
  const row = await prisma.log.create({ data: { jobRunId, level, message } });
  publishJobEvent(jobId, { type: "log", jobRunId, level, message, createdAt: row.createdAt.toISOString() });
}

/** QueueEvents is an EventEmitter: a rejected async listener becomes an
 * unhandled rejection, which terminates the Node process (and every open
 * request/SSE stream with it). Every handler goes through this. */
// Events for one job must be applied in the order Redis delivered them
// (active -> progress -> active (retry) -> failed). Handlers are async, so
// without this a job's final "failed" could be written before its retry's
// "active" -- leaving a phantom "running" attempt. Chain per job id.
const jobChains = new Map<string, Promise<void>>();

function safe<T extends { jobId: string }>(name: string, handler: (arg: T) => Promise<void>): (arg: T) => void {
  return (arg: T) => {
    const prev = jobChains.get(arg.jobId) ?? Promise.resolve();
    const next = prev
      .then(() => handler(arg))
      .catch((err) => {
        console.error(`[queue-listener] ${name} handler failed`, { jobId: arg.jobId, err });
      });
    jobChains.set(arg.jobId, next);
    // Drop finished chains so the map doesn't grow with every job ever run.
    void next.finally(() => {
      if (jobChains.get(arg.jobId) === next) jobChains.delete(arg.jobId);
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

/** Some BullMQ clients JSON-encode the failure reason ('"boom"'); unwrap it. */
function cleanReason(reason: string | null | undefined): string {
  const r = (reason ?? "").trim();
  if (r.length >= 2 && r.startsWith('"') && r.endsWith('"')) {
    try {
      const parsed = JSON.parse(r);
      if (typeof parsed === "string") return parsed;
    } catch {
      /* not JSON -- keep as is */
    }
  }
  return r;
}

async function markJobFailed(jobId: string, rawReason: string, queueName: string): Promise<void> {
  const failedReason = cleanReason(rawReason) || "The job failed without a reason";
  const job = await prisma.job.findUnique({ where: { id: jobId }, include: { workflowStep: { include: { workflow: { include: { project: true } } } } } });
  if (!job) return;
  if (!(await claimTerminal(jobId, "failed"))) return;
  jobOutcomes.inc({ queue: queueName, outcome: "failed" });

  const latestRun = await prisma.jobRun.findFirst({ where: { jobId }, orderBy: { attemptNumber: "desc" } });
  if (latestRun) {
    await prisma.jobRun.update({
      where: { id: latestRun.id },
      data: { status: "failed", finishedAt: new Date(), error: { message: failedReason }, model: latestRun.model ?? job.providerModel },
    });
    await writeLog(latestRun.id, jobId, "error", failedReason);
  }

  await prisma.workflowStep.update({ where: { id: job.workflowStepId }, data: { status: "failed" } });
  await prisma.workflow.update({
    where: { id: job.workflowStep.workflowId },
    data: { status: "failed" },
  });

  await prisma.event.create({
    data: {
      jobId,
      workflowId: job.workflowStep.workflowId,
      type: "job.failed",
      payload: { failedReason, attemptNumber: latestRun?.attemptNumber ?? null },
    },
  });
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
  trackQueue(queueName);

  const events = getQueueEvents(queueName);

  const onActive = safe("active", async ({ jobId, previousReason }: { jobId: string; previousReason: Promise<string | null> }) => {
    const job = await prisma.job.findUnique({ where: { id: jobId }, include: { workflowStep: { select: { workflowId: true } } } });
    if (!job) return;
    // A new attempt starting means any earlier attempt still marked running
    // was retried (QueueEvents emits no per-attempt "failed" event). Close it
    // with the reason BullMQ recorded, so history never shows an attempt
    // "running" forever.
    const open = await prisma.jobRun.findMany({ where: { jobId, status: "running" }, select: { id: true } });
    if (open.length > 0) {
      const reason = cleanReason(await previousReason) || "Attempt failed and was retried";
      await prisma.jobRun.updateMany({
        where: { jobId, status: "running" },
        data: { status: "failed", finishedAt: new Date(), error: { message: reason }, model: job.providerModel },
      });
      for (const run of open) await writeLog(run.id, jobId, "error", reason);
    }
    const attemptNumber = (await prisma.jobRun.count({ where: { jobId } })) + 1;
    const run = await prisma.jobRun.create({
      data: { jobId, attemptNumber, status: "running", startedAt: new Date(), model: job.providerModel },
    });
    await prisma.workflowStep.update({ where: { id: job.workflowStepId }, data: { status: "running" } });
    await prisma.event.create({
      data: { jobId, workflowId: job.workflowStep.workflowId, type: "job.started", payload: { attemptNumber, model: job.providerModel } },
    });
    publishJobEvent(jobId, { type: "started", attemptNumber });
    await writeLog(
      run.id,
      jobId,
      "info",
      `Attempt ${attemptNumber} started${attemptNumber > 1 ? " (retry)" : ""}${job.providerModel ? ` on ${job.providerModel}` : ""}`,
    );
  });
  events.on("active", ({ jobId }: { jobId: string }) => {
    // Read the previous attempt's failure reason *now*, as the event arrives:
    // by the time this job's queued handlers get to it, the job may already
    // have failed again and been removed from Redis.
    const previousReason = getQueue(queueName)
      .getJob(jobId)
      .then((j) => j?.failedReason || null)
      .catch(() => null);
    onActive({ jobId, previousReason });
  });

  events.on("progress", safe("progress", async ({ jobId, data }: { jobId: string; data: unknown }) => {
    const update = classifyProgress(data);
    const latestRun = await prisma.jobRun.findFirst({ where: { jobId }, orderBy: { attemptNumber: "desc" } });
    if (update.kind === "log") {
      if (latestRun) await writeLog(latestRun.id, jobId, update.level, update.message);
      return;
    }
    if (update.kind === "usage") {
      if (latestRun) {
        await prisma.jobRun.update({
          where: { id: latestRun.id },
          data: { model: update.usage.model ?? latestRun.model, inputTokens: update.usage.inputTokens, outputTokens: update.usage.outputTokens },
        });
      }
      return;
    }
    const progress = { percent: update.percent, message: update.message };
    if (latestRun) {
      await prisma.jobRun.update({
        where: { id: latestRun.id },
        data: { progressPercent: progress.percent, progressMessage: progress.message },
      });
      // Progress messages double as the attempt's log ("Encoding with ffmpeg...").
      if (progress.message && progress.message !== latestRun.progressMessage) {
        await writeLog(latestRun.id, jobId, "info", progress.message);
      }
    }
    await prisma.event.create({ data: { jobId, type: "job.progress", payload: progress as object } });
    publishJobEvent(jobId, { type: "progress", percent: progress.percent, message: progress.message });
  }));

  events.on("completed", safe("completed", async ({ jobId, returnvalue }: { jobId: string; returnvalue: unknown }) => {
    const parsed = parseEnvelope(returnvalue);
    if ("invalid" in parsed) {
      await markJobFailed(jobId, parsed.invalid, queueName);
      return;
    }
    const result = parsed;
    // The SDK runner returns (rather than throws) a failed envelope for some
    // errors, which BullMQ records as a *completion* -- route it to failure.
    if (result.status === "failed") {
      await markJobFailed(jobId, result.error?.message || "worker reported failure", queueName);
      return;
    }

    const job = await prisma.job.findUnique({ where: { id: jobId }, include: { workflowStep: { include: { workflow: { include: { project: true } } } } } });
    if (!job) return;
    if (!(await claimTerminal(jobId, "completed"))) return;
    jobOutcomes.inc({ queue: queueName, outcome: "completed" });

    const usage = parseUsage((result.metrics as { usage?: unknown } | undefined)?.usage);
    const model = usage?.model ?? job.providerModel;
    const costUsd = await priceAttempt(job, model, usage);
    const finishedAt = new Date();
    const latestRun = await prisma.jobRun.findFirst({ where: { jobId }, orderBy: { attemptNumber: "desc" } });
    const durationMs = latestRun?.startedAt ? finishedAt.getTime() - latestRun.startedAt.getTime() : null;
    if (latestRun) {
      await prisma.jobRun.update({
        where: { id: latestRun.id },
        data: {
          status: "completed",
          finishedAt,
          progressPercent: 100,
          model,
          inputTokens: usage?.inputTokens ?? null,
          outputTokens: usage?.outputTokens ?? null,
          costUsd,
        },
      });
      await writeLog(latestRun.id, jobId, "info", completionLine(durationMs, usage ? { ...usage, model } : model ? { model, inputTokens: null, outputTokens: null } : null, result.artifacts.length));
    }
    await prisma.event.create({
      data: {
        jobId,
        workflowId: job.workflowStep.workflowId,
        type: "job.completed",
        payload: {
          attemptNumber: latestRun?.attemptNumber ?? null,
          durationMs,
          model,
          inputTokens: usage?.inputTokens ?? null,
          outputTokens: usage?.outputTokens ?? null,
          costUsd,
          artifacts: result.artifacts.length,
        },
      },
    });

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
    await markJobFailed(jobId, failedReason, queueName);
  }));
}
