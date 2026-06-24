import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

/** Plain connection options for BullMQ's Queue/QueueEvents/Worker constructors.
 * BullMQ bundles its own `ioredis` copy, so we deliberately don't share a
 * client instance across the two packages -- passing a URL string keeps
 * their independent ioredis types from colliding. */
export const bullmqConnection = { url: REDIS_URL };

let healthCheckClient: Redis | null = null;

/** Our own ioredis client, used only for the /health ping -- not shared with BullMQ. */
export function getRedisConnection(): Redis {
  if (!healthCheckClient) {
    healthCheckClient = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  }
  return healthCheckClient;
}
