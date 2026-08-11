import { getQueue } from "../../queue/queues.js";
import { prisma } from "../../db/client.js";
import { Worker } from "bullmq";
import { bullmqConnection } from "../../queue/connection.js";
import { runTemplate } from "./service.js";

const SCHEDULER_QUEUE_NAME = "agentry.scheduler";

export async function addSchedule(templateId: string, cronExpr: string, runInputs: any) {
  const schedule = await prisma.workflowSchedule.create({
    data: {
      templateId,
      cronExpr,
      isActive: true,
    }
  });

  const queue = getQueue(SCHEDULER_QUEUE_NAME);
  await queue.add(
    "run-template",
    { templateId, scheduleId: schedule.id, runInputs },
    { 
      repeat: { pattern: cronExpr },
      jobId: `schedule-${schedule.id}` 
    }
  );

  return schedule;
}

export async function removeSchedule(scheduleId: string) {
  const schedule = await prisma.workflowSchedule.findUnique({ where: { id: scheduleId } });
  if (!schedule) return;

  const queue = getQueue(SCHEDULER_QUEUE_NAME);
  await queue.removeRepeatableByKey(`schedule-${schedule.id}`);
  
  await prisma.workflowSchedule.delete({ where: { id: scheduleId } });
}

export function startSchedulerWorker() {
  const worker = new Worker(
    SCHEDULER_QUEUE_NAME,
    async (job) => {
      const { templateId, runInputs } = job.data;
      console.log(`[Scheduler] Triggering scheduled template run for ${templateId}`);
      try {
        await runTemplate(templateId, runInputs);
      } catch (err) {
        console.error(`[Scheduler] Failed to run template ${templateId}`, err);
        throw err;
      }
    },
    { connection: bullmqConnection }
  );

  worker.on("failed", (job, err) => {
    console.error(`[Scheduler] Job ${job?.id} failed with ${err.message}`);
  });

  return worker;
}
