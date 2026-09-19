import type { FastifyInstance } from "fastify";
import { prisma, notificationEmitter } from "../../db/client.js";
import { getDefaultUserId } from "../projects/defaultUser.js";

export async function notificationsRoutes(app: FastifyInstance) {
  // Helper to get the user ID
  const getUserId = (req: any) =>
    req.principal?.kind === "user" ? req.principal.user.id : getDefaultUserId();

  app.get("/notifications", async (req, reply) => {
    const userId = getUserId(req);
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return notifications;
  });

  app.get("/notifications/stream", async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const onNotification = (notification: any) => {
      reply.raw.write(`data: ${JSON.stringify(notification)}\n\n`);
    };

    notificationEmitter.on(userId, onNotification);

    req.raw.on("close", () => {
      notificationEmitter.off(userId, onNotification);
    });
  });

  app.post<{ Body: { type: string; title: string; message: string; link?: string } }>(
    "/notifications",
    async (req, reply) => {
      const userId = getUserId(req);
      const { type, title, message, link } = req.body;

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
