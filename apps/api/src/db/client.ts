import { PrismaClient } from "@prisma/client";

// artifacts.size_bytes is a Postgres bigint -> JS BigInt, which JSON.stringify
// rejects. Artifact sizes fit comfortably in a JS number (2^53 bytes = 8 PB),
// so serialize BigInt as number globally rather than special-casing routes.
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (this: bigint) {
  return Number(this);
};

export const prisma = new PrismaClient();
