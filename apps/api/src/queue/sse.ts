import { EventEmitter } from "node:events";

/** In-process pub/sub keyed by our Job row id, so the SSE route can relay
 * BullMQ QueueEvents to the browser without polling. Single-process only --
 * fine for this build's single api replica. */
const emitter = new EventEmitter();
emitter.setMaxListeners(100);

export interface JobSseEvent {
  type: "progress" | "completed" | "failed";
  percent?: number;
  message?: string;
  error?: unknown;
}

export function publishJobEvent(jobId: string, event: JobSseEvent): void {
  emitter.emit(jobId, event);
}

export function subscribeJobEvents(jobId: string, onEvent: (event: JobSseEvent) => void): () => void {
  emitter.on(jobId, onEvent);
  return () => emitter.off(jobId, onEvent);
}
