import cronParser from "cron-parser";
import { Worker } from "bullmq";
import { getQueue } from "../../queue/queues.js";
import { prisma } from "../../db/client.js";
import { bullmqConnection } from "../../queue/connection.js";
import { runTemplate } from "./service.js";

const SCHEDULER_QUEUE_NAME = "agentry.scheduler";
/** Minimum spacing between runs -- every run can fan out into paid provider
 * calls and public social posts, so sub-minute schedules are refused. */
const MIN_INTERVAL_MS = 60_000;

export class ScheduleError extends Error {
  statusCode = 400;
}

const schedulerId = (scheduleId: string) => `schedule-${scheduleId}`;

export function validateCron(cronExpr: string): void {
  let interval;
  try {
    interval = cronParser.parseExpression(cronExpr);
  } catch (err) {
    throw new ScheduleError(`invalid cron expression: ${(err as Error).message}`);
  }
  const first = interval.next().getTime();
  const second = interval.next().getTime();
  if (second - first < MIN_INTERVAL_MS) {
    throw new ScheduleError("schedules may not run more often than once per minute");
  }
}

export async function addSchedule(templateId: string, cronExpr: string, runInputs: unknown) {
  validateCron(cronExpr);
  const schedule = await prisma.workflowSchedule.create({
    data: { templateId, cronExpr, isActive: true },
  });

  try {
    // A job scheduler is addressed by an id we choose, so it can be removed
    // reliably later (a repeatable job's key is derived internally by BullMQ
    // and was never the jobId, which is why deleted schedules kept firing).
    await getQueue(SCHEDULER_QUEUE_NAME).upsertJobScheduler(
      schedulerId(schedule.id),
      { pattern: cronExpr },
      { name: "run-template", data: { templateId, scheduleId: schedule.id, runInputs } },
    );
  } catch (err) {
    await prisma.workflowSchedule.delete({ where: { id: schedule.id } });
    throw err;
  }

  return schedule;
}

export async function removeSchedule(scheduleId: string): Promise<void> {
  const queue = getQueue(SCHEDULER_QUEUE_NAME);
  await queue.removeJobScheduler(schedulerId(scheduleId));
  // Schedules created before the job-scheduler API used repeatable jobs whose
  // key BullMQ derived itself; find and remove those by their jobId.
  for (const r of await queue.getRepeatableJobs()) {
    if (r.id === schedulerId(scheduleId)) await queue.removeRepeatableByKey(r.key);
  }
  await prisma.workflowSchedule.deleteMany({ where: { id: scheduleId } });
}

export function startSchedulerWorker() {
  const worker = new Worker(
    SCHEDULER_QUEUE_NAME,
    async (job) => {
      const { templateId, scheduleId, runInputs } = job.data as {
        templateId: string;
        scheduleId?: string;
        runInputs: Record<string, unknown>;
      };
      // The DB row is the source of truth: a deleted or paused schedule must
      // never run, even if its Redis trigger outlived it.
      const schedule = scheduleId
        ? await prisma.workflowSchedule.findUnique({ where: { id: scheduleId } })
        : null;
      if (!schedule || !schedule.isActive) {
        console.warn(`[Scheduler] Skipping run for missing/inactive schedule ${scheduleId}; removing its trigger`);
        if (scheduleId) await removeSchedule(scheduleId).catch(() => {});
        return;
      }
      console.log(`[Scheduler] Triggering scheduled template run for ${templateId}`);
      await runTemplate(templateId, runInputs);
    },
    { connection: bullmqConnection },
  );

  worker.on("failed", (job, err) => {
    console.error(`[Scheduler] Job ${job?.id} failed with ${err.message}`);
  });

  return worker;
}
