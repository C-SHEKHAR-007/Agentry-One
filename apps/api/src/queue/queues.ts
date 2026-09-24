import { Queue, QueueEvents } from "bullmq";
import { bullmqConnection } from "./connection.js";

const queues = new Map<string, Queue>();
const queueEvents = new Map<string, QueueEvents>();

export function getQueue(queueName: string): Queue {
  let q = queues.get(queueName);
  if (!q) {
    q = new Queue(queueName, { connection: bullmqConnection });
    queues.set(queueName, q);
  }
  return q;
}

export function getQueueEvents(queueName: string): QueueEvents {
  let qe = queueEvents.get(queueName);
  if (!qe) {
    qe = new QueueEvents(queueName, { connection: bullmqConnection });
    queueEvents.set(queueName, qe);
  }
  return qe;
}

/** Closes every Queue/QueueEvents this process opened (graceful shutdown). */
export async function closeQueues(): Promise<void> {
  await Promise.allSettled([...queues.values(), ...queueEvents.values()].map((q) => q.close()));
}
