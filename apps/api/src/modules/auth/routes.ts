import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client.js";
import {
  createSession,
  destroySession,
  hashPassword,
  SESSION_COOKIE,
  verifyPassword,
} from "../../auth/session.js";

const COOKIE_OPTS = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: 30 * 24 * 60 * 60,
};

async function needsSetup(): Promise<boolean> {
  // The pre-auth stub user has no passwordHash, so it doesn't block setup.
  const withPassword = await prisma.user.count({ where: { passwordHash: { not: null } } });
  return withPassword === 0;
}

export async function authRoutes(app: FastifyInstance) {
  app.get("/auth/setup-status", async () => ({ needsSetup: await needsSetup() }));

  app.post<{ Body: { email: string; name?: string; password: string } }>(
    "/auth/setup",
    async (req, reply) => {
      if (!(await needsSetup())) {
        return reply.code(409).send({ error: "setup already completed" });
      }
      const { email, name, password } = req.body;
      if (!email?.includes("@") || !password || password.length < 8) {
        return reply.code(400).send({ error: "valid email and a password of at least 8 characters are required" });
      }
      const user = await prisma.user.upsert({
        where: { email: email.toLowerCase() },
        create: {
          email: email.toLowerCase(),
          name: name ?? null,
          passwordHash: await hashPassword(password),
          role: "owner",
        },
        update: { name: name ?? null, passwordHash: await hashPassword(password), role: "owner" },
      });
      const { token } = await createSession(user.id);
      reply.setCookie(SESSION_COOKIE, token, COOKIE_OPTS);
      return reply
        .code(201)
        .send({ user: { id: user.id, email: user.email, name: user.name, firstName: user.firstName, lastName: user.lastName, avatarUrl: user.avatarUrl, role: user.role } });
    },
  );

  app.post<{ Body: { email: string; password: string } }>("/auth/login", async (req, reply) => {
    const { email, password } = req.body;
    const user = email
      ? await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
      : null;
    // Uniform 401 -- never reveal whether the email exists.
    if (!user?.passwordHash || !password || !(await verifyPassword(password, user.passwordHash))) {
      return reply.code(401).send({ error: "invalid email or password" });
    }
    const { token } = await createSession(user.id);
    reply.setCookie(SESSION_COOKIE, token, COOKIE_OPTS);
    return { user: { id: user.id, email: user.email, name: user.name, firstName: user.firstName, lastName: user.lastName, avatarUrl: user.avatarUrl, role: user.role } };
  });

  app.post("/auth/logout", async (req, reply) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (token) await destroySession(token);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return reply.code(204).send();
  });

  app.get("/auth/me", async (req, reply) => {
    const p = req.principal;
    if (p?.kind === "user") return { user: p.user, via: "session" };
    if (p?.kind === "apiKey") {
      return { user: { id: null, email: null, name: "API Key", firstName: "API", lastName: "Key", avatarUrl: null, role: "owner" }, via: "apiKey" };
    }
    return reply.code(401).send({ error: "unauthenticated" });
  });

  app.patch<{ Body: { firstName?: string; lastName?: string; name?: string; avatarUrl?: string; password?: string } }>(
    "/auth/profile",
    async (req, reply) => {
      const p = req.principal;
      if (p?.kind !== "user" || !p.user.id) {
        return reply.code(401).send({ error: "must be logged in as a session user to update profile" });
      }
      const { firstName, lastName, name, avatarUrl, password } = req.body;
      if (password && password.length < 8) {
        return reply.code(400).send({ error: "password must be at least 8 characters" });
      }
      const currentUser = await prisma.user.findUnique({ where: { id: p.user.id } });
      if (!currentUser) return reply.code(404).send({ error: "user_not_found" });

      const newFirst = firstName !== undefined ? firstName : currentUser.firstName;
      const newLast = lastName !== undefined ? lastName : currentUser.lastName;
      const computedName =
        name !== undefined ? name : `${newFirst || ""} ${newLast || ""}`.trim() || currentUser.name;

      const updated = await prisma.user.update({
        where: { id: p.user.id },
        data: {
          ...(firstName !== undefined ? { firstName } : {}),
          ...(lastName !== undefined ? { lastName } : {}),
          ...(name !== undefined || firstName !== undefined || lastName !== undefined ? { name: computedName } : {}),
          ...(avatarUrl !== undefined ? { avatarUrl } : {}),
          ...(password ? { passwordHash: await hashPassword(password) } : {}),
        },
      });
      return {
        user: {
          id: updated.id,
          email: updated.email,
          name: updated.name,
          firstName: updated.firstName,
          lastName: updated.lastName,
          avatarUrl: updated.avatarUrl,
          role: updated.role,
        },
      };
    },
  );
}
