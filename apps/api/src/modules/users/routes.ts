import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client.js";
import { requireOwner } from "../../auth/apiKey.js";
import { hashPassword } from "../../auth/session.js";

const PUBLIC_FIELDS = {
  id: true,
  email: true,
  name: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  role: true,
  createdAt: true,
} as const;

/** How many login-capable owners exist -- the lockout guard. */
async function passwordedOwnerCount(): Promise<number> {
  return prisma.user.count({ where: { role: "owner", passwordHash: { not: null } } });
}

export async function usersRoutes(app: FastifyInstance) {
  app.get("/users", async (req, reply) => {
    if (!requireOwner(req, reply)) return;
    return prisma.user.findMany({ select: PUBLIC_FIELDS, orderBy: { createdAt: "asc" } });
  });

  app.post<{ Body: { email: string; name?: string; firstName?: string; lastName?: string; avatarUrl?: string; password: string; role?: string } }>(
    "/users",
    async (req, reply) => {
      if (!requireOwner(req, reply)) return;
      const { email, name, firstName, lastName, avatarUrl, password, role } = req.body;
      if (!email?.includes("@") || !password || password.length < 8) {
        return reply.code(400).send({ error: "valid email and a password of at least 8 characters are required" });
      }
      if (role && role !== "owner" && role !== "member") {
        return reply.code(400).send({ error: "role must be 'owner' or 'member'" });
      }
      const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (existing) return reply.code(409).send({ error: "a user with this email already exists" });

      const computedName =
        name !== undefined
          ? name
          : `${firstName || ""} ${lastName || ""}`.trim() || null;

      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          name: computedName,
          firstName: firstName ?? null,
          lastName: lastName ?? null,
          avatarUrl: avatarUrl ?? null,
          passwordHash: await hashPassword(password),
          role: role ?? "member",
        },
        select: PUBLIC_FIELDS,
      });
      return reply.code(201).send(user);
    },
  );

  app.patch<{ Params: { id: string }; Body: { name?: string; firstName?: string; lastName?: string; avatarUrl?: string; role?: string; password?: string } }>(
    "/users/:id",
    async (req, reply) => {
      if (!requireOwner(req, reply)) return;
      const target = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!target) return reply.code(404).send({ error: "user_not_found" });

      const { name, firstName, lastName, avatarUrl, role, password } = req.body;
      if (role && role !== "owner" && role !== "member") {
        return reply.code(400).send({ error: "role must be 'owner' or 'member'" });
      }
      if (
        role === "member" &&
        target.role === "owner" &&
        target.passwordHash &&
        (await passwordedOwnerCount()) <= 1
      ) {
        return reply.code(409).send({ error: "cannot demote the last owner" });
      }
      if (password && password.length < 8) {
        return reply.code(400).send({ error: "password must be at least 8 characters" });
      }

      const newFirst = firstName !== undefined ? firstName : target.firstName;
      const newLast = lastName !== undefined ? lastName : target.lastName;
      const computedName =
        name !== undefined ? name : `${newFirst || ""} ${newLast || ""}`.trim() || target.name;

      return prisma.user.update({
        where: { id: target.id },
        data: {
          ...(firstName !== undefined ? { firstName } : {}),
          ...(lastName !== undefined ? { lastName } : {}),
          ...(name !== undefined || firstName !== undefined || lastName !== undefined ? { name: computedName } : {}),
          ...(avatarUrl !== undefined ? { avatarUrl } : {}),
          ...(role ? { role } : {}),
          ...(password ? { passwordHash: await hashPassword(password) } : {}),
        },
        select: PUBLIC_FIELDS,
      });
    },
  );

  app.delete<{ Params: { id: string } }>("/users/:id", async (req, reply) => {
    if (!requireOwner(req, reply)) return;
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return reply.code(404).send({ error: "user_not_found" });

    const p = req.principal;
    if (p?.kind === "user" && p.user.id === target.id) {
      return reply.code(409).send({ error: "you cannot delete your own account" });
    }
    if (target.role === "owner" && target.passwordHash && (await passwordedOwnerCount()) <= 1) {
      return reply.code(409).send({ error: "cannot delete the last owner" });
    }

    // Projects reference users; reassign to the stub default user rather than
    // cascading a teammate's projects away.
    const { getDefaultUserId } = await import("../projects/defaultUser.js");
    await prisma.project.updateMany({
      where: { userId: target.id },
      data: { userId: getDefaultUserId() },
    });
    await prisma.user.delete({ where: { id: target.id } });
    return reply.code(204).send();
  });
}
