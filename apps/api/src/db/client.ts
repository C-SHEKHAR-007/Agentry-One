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

export const prisma = _prisma.$extends({
  query: {
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
