import { PrismaClient } from "@prisma/client";
import { EventEmitter } from "node:events";

// artifacts.size_bytes is a Postgres bigint -> JS BigInt, which JSON.stringify
// rejects. Artifact sizes fit comfortably in a JS number (2^53 bytes = 8 PB),
// so serialize BigInt as number globally rather than special-casing routes.
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (this: bigint) {
  return Number(this);
};

const _prisma = new PrismaClient();

export const notificationEmitter = new EventEmitter();
notificationEmitter.setMaxListeners(100);

/** "Something happened" signal for live pages (GET /events/stream): emitted
 * for every recorded event except per-tick job.progress. Carries ids only;
 * subscribers refetch what they show, through their normal access checks. */
export interface ActivitySignal {
  type: string;
  workflowId: string | null;
  jobId: string | null;
}
export const activityEmitter = new EventEmitter();
activityEmitter.setMaxListeners(200);

export const prisma = _prisma.$extends({
  query: {
    event: {
      async create({ args, query }) {
        const result = await query(args);
        const e = result as { type?: string; workflowId?: string | null; jobId?: string | null };
        if (e?.type && e.type !== "job.progress") {
          activityEmitter.emit("activity", { type: e.type, workflowId: e.workflowId ?? null, jobId: e.jobId ?? null } satisfies ActivitySignal);
        }
        return result;
      },
    },
    notification: {
      async create({ args, query }) {
        const result = await query(args);
        if (result && typeof (result as any).userId === "string") {
          notificationEmitter.emit((result as any).userId, result);
        }
        return result;
      },
    },
  },
}) as unknown as typeof _prisma;
