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
        .send({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
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
    return { user: { id: user.id, email: user.email, name: user.name, role: user.role } };
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
      return { user: { id: null, email: null, name: "API Key", role: "owner" }, via: "apiKey" };
    }
    return reply.code(401).send({ error: "unauthenticated" });
  });
}
