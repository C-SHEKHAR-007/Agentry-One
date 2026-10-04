import type { FastifyInstance } from "fastify";
import { prisma, notificationEmitter } from "../../db/client.js";
import { getDefaultUserId } from "../projects/defaultUser.js";
import { openSse } from "../../http/sse.js";
import { nonEmpty, parse, z } from "../../http/validate.js";
import { NEWEST_FIRST, pageQuery, toPage } from "../../http/paging.js";

const NotificationBody = z.object({
  type: z.enum(["info", "success", "warning", "error"]),
  title: nonEmpty(200),
  message: nonEmpty(2000),
  // In-app paths only -- never an external or javascript: URL.
  link: z.string().max(500).regex(/^\/(?!\/)/, "must be an in-app path").optional(),
});

export async function notificationsRoutes(app: FastifyInstance) {
  // Helper to get the user ID
  const getUserId = (req: any) =>
    req.principal?.kind === "user" ? req.principal.user.id : getDefaultUserId();

  // Newest first: the latest 100, or pages of `limit` with ?paged=1.
  app.get<{ Querystring: { limit?: string; paged?: string; cursor?: string } }>("/notifications", async (req) => {
    const userId = getUserId(req);
    const page = pageQuery(req.query);
    const limit = page.paged ? Math.min(Number(req.query.limit ?? 30) || 30, 100) : 100;
    const rows = await prisma.notification.findMany({
      where: { userId, ...page.where },
      orderBy: NEWEST_FIRST,
      take: page.take(limit),
    });
    const { items, nextCursor } = toPage(rows, limit);
    return page.paged ? { items, nextCursor } : items;
  });

  app.get("/notifications/stream", async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });

    const stream = openSse(req, reply);
    const onNotification = (notification: unknown) => stream.send(notification);
    notificationEmitter.on(userId, onNotification);
    stream.onClose(() => notificationEmitter.off(userId, onNotification));
  });

  app.post(
    "/notifications",
    async (req, reply) => {
      const userId = getUserId(req);
      const { type, title, message, link } = parse(NotificationBody, req.body);

      const notification = await prisma.notification.create({
        data: {
          userId,
          type,
          title,
          message,
          link,
        },
      });

      return reply.code(201).send(notification);
    }
  );

  app.patch<{ Params: { id: string } }>("/notifications/:id/read", async (req, reply) => {
    const userId = getUserId(req);
    const { id } = req.params;

    const notification = await prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });

    return { success: true, updatedCount: notification.count };
  });

  app.post("/notifications/mark-all-read", async (req, reply) => {
    const userId = getUserId(req);

    const notifications = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    return { success: true, updatedCount: notifications.count };
  });

  app.delete<{ Params: { id: string } }>("/notifications/:id", async (req, reply) => {
    const userId = getUserId(req);
    const { id } = req.params;

    const notification = await prisma.notification.deleteMany({
      where: { id, userId },
    });

    return reply.code(204).send();
  });
}
