import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

/** Plain connection options for BullMQ's Queue/QueueEvents/Worker constructors.
 * BullMQ bundles its own `ioredis` copy, so we deliberately don't share a
 * client instance across the two packages -- passing a URL string keeps
 * their independent ioredis types from colliding. */
export const bullmqConnection = { url: REDIS_URL };

let healthCheckClient: Redis | null = null;

/** Our own ioredis client, used only for health/stat pings -- not shared with
 * BullMQ. Fails fast (no offline queue, one retry) so /health reports 503
 * during a Redis outage instead of hanging until the probe times out. */
export function getRedisConnection(): Redis {
  if (!healthCheckClient) {
    healthCheckClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 3000,
      lazyConnect: false,
    });
    healthCheckClient.on("error", () => {
      /* reported via /health; avoid unhandled 'error' event crashes */
    });
  }
  return healthCheckClient;
}

export async function closeRedisConnection(): Promise<void> {
  await healthCheckClient?.quit().catch(() => healthCheckClient?.disconnect());
  healthCheckClient = null;
}
