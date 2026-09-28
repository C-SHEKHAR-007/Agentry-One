import type { FastifyReply, FastifyRequest } from "fastify";

const HEARTBEAT_MS = 15_000;

export interface SseStream {
  send(data: unknown): void;
  close(): void;
  onClose(fn: () => void): void;
}

/** Opens a server-sent-events stream on a request. Hijacks the reply so
 * Fastify doesn't also try to send a response, sends a comment heartbeat so
 * idle-timeout proxies keep the connection, and runs cleanup exactly once on
 * either side closing. */
export function openSse(req: FastifyRequest, reply: FastifyReply): SseStream {
  reply.hijack();
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // disable nginx response buffering
  });
  reply.raw.write(": connected\n\n");

  const cleanups: Array<() => void> = [];
  let closed = false;
  const heartbeat = setInterval(() => reply.raw.write(": ping\n\n"), HEARTBEAT_MS);

  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    for (const fn of cleanups) fn();
    reply.raw.end();
  };
  req.raw.on("close", close);

  return {
    send(data) {
      if (!closed) reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    },
    close,
    onClose(fn) {
      cleanups.push(fn);
    },
  };
}
