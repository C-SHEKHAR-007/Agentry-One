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
  const activeOwners = await prisma.user.count({
    where: { role: "owner", email: { not: "local@agentry.dev" } },
  });
  return activeOwners === 0;
}

function getRedirectUri(req: any): string {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }
  if (req.headers.referer) {
    try {
      const origin = new URL(req.headers.referer).origin;
      if (!origin.includes("google.com")) {
        return `${origin}/api/auth/google/callback`;
      }
    } catch {}
  }
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:5173";
  const proto = req.headers["x-forwarded-proto"] || "http";
  return `${proto}://${host}/api/auth/google/callback`;
}

export async function authRoutes(app: FastifyInstance) {
  app.get("/auth/setup-status", async () => ({ needsSetup: await needsSetup() }));

  app.post<{ Body: { email: string; firstName?: string; lastName?: string; password: string } }>(
    "/auth/setup",
    async (req, reply) => {
      if (!(await needsSetup())) {
        return reply.code(409).send({ error: "setup already completed" });
      }
      const { email, firstName, lastName, password } = req.body;
      if (!email?.includes("@") || !password || password.length < 8) {
        return reply.code(400).send({ error: "valid email and a password of at least 8 characters are required" });
      }
      const user = await prisma.user.upsert({
        where: { email: email.toLowerCase() },
        create: {
          email: email.toLowerCase(),
          firstName: firstName ?? null,
          lastName: lastName ?? null,
          passwordHash: await hashPassword(password),
          role: "owner",
        },
        update: { firstName: firstName ?? null, lastName: lastName ?? null, passwordHash: await hashPassword(password), role: "owner" },
      });
      const { token } = await createSession(user.id);
      reply.setCookie(SESSION_COOKIE, token, COOKIE_OPTS);
      return reply
        .code(201)
        .send({ user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, avatarUrl: user.avatarUrl, role: user.role } });
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
    return { user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, avatarUrl: user.avatarUrl, role: user.role } };
  });

  app.get("/auth/google", async (req, reply) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = getRedirectUri(req);

    if (!clientId || !clientSecret) {
      req.log.info("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured. Using simulated Google Auth fallback.");
      return reply.redirect(`${redirectUri}?dev_mock=true`);
    }

    const googleAuthUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        access_type: "offline",
        prompt: "select_account",
        state: redirectUri,
      }).toString();

    return reply.redirect(googleAuthUrl);
  });

  app.get<{ Querystring: { code?: string; state?: string; error?: string; dev_mock?: string } }>(
    "/auth/google/callback",
    async (req, reply) => {
      const { code, state, error, dev_mock } = req.query;
      let targetOrigin = "";
      try {
        if (state) targetOrigin = new URL(state).origin;
        else if (req.headers.referer && !req.headers.referer.includes("google.com")) {
          targetOrigin = new URL(req.headers.referer).origin;
        }
      } catch {}
      const redirectBase = targetOrigin || "";

      if (error) {
        req.log.warn({ error }, "Google Auth callback error");
        return reply.redirect(`${redirectBase}/login?error=${encodeURIComponent("Google login failed or was cancelled.")}`);
      }

      let email: string;
      let firstName: string | null = null;
      let lastName: string | null = null;
      let avatarUrl: string | null = null;

      if (dev_mock === "true" || !process.env.GOOGLE_CLIENT_ID) {
        email = "google.dev@agentry.dev";
        firstName = "Google";
        lastName = "Developer";
        avatarUrl = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=256&auto=format&fit=crop&q=80";
      } else if (code) {
        try {
          const redirectUri = state || getRedirectUri(req);
          const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              code,
              client_id: process.env.GOOGLE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_CLIENT_SECRET!,
              redirect_uri: redirectUri,
              grant_type: "authorization_code",
            }),
          });
          const tokenData = await tokenRes.json();
          if (!tokenRes.ok || !tokenData.access_token) {
            throw new Error(tokenData.error_description || tokenData.error || "Failed to exchange authorization code");
          }

          const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
          });
          const googleUser = await userInfoRes.json();
          if (!userInfoRes.ok || !googleUser.email) {
            throw new Error("Failed to retrieve user profile from Google");
          }

          email = googleUser.email;
          firstName = googleUser.given_name || null;
          lastName = googleUser.family_name || null;
          avatarUrl = googleUser.picture || null;
        } catch (err) {
          req.log.error({ err }, "Google OAuth exchange failed");
          return reply.redirect(`${redirectBase}/login?error=${encodeURIComponent((err as Error).message || "Google authentication failed.")}`);
        }
      } else {
        return reply.redirect(`${redirectBase}/login?error=${encodeURIComponent("Invalid callback parameters.")}`);
      }

      let user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (!user) {
        const activeOwners = await prisma.user.count({
          where: { role: "owner", email: { not: "local@agentry.dev" } },
        });
        user = await prisma.user.create({
          data: {
            email: email.toLowerCase(),
            firstName,
            lastName,
            avatarUrl,
            role: activeOwners === 0 ? "owner" : "member",
            passwordHash: null,
          },
        });
      } else {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            ...(user.firstName ? {} : { firstName }),
            ...(user.lastName ? {} : { lastName }),
            ...(user.avatarUrl ? {} : { avatarUrl }),
          },
        });
      }

      const { token } = await createSession(user.id);
      reply.setCookie(SESSION_COOKIE, token, COOKIE_OPTS);
      return reply.redirect(`${redirectBase}/`);
    },
  );

  app.post("/auth/logout", async (req, reply) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (token) await destroySession(token);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return reply.code(204).send();
  });

  app.get("/auth/me", async (req, reply) => {
    const p = req.principal;
    if (p?.kind === "user") return { user: p.user, via: "session" };
    return reply.code(401).send({ error: "unauthenticated" });
  });

  app.patch<{ Body: { firstName?: string; lastName?: string; avatarUrl?: string; password?: string } }>(
    "/auth/profile",
    async (req, reply) => {
      const p = req.principal;
      if (p?.kind !== "user" || !p.user.id) {
        return reply.code(401).send({ error: "must be logged in as a session user to update profile" });
      }
      const { firstName, lastName, avatarUrl, password } = req.body;
      if (password && password.length < 8) {
        return reply.code(400).send({ error: "password must be at least 8 characters" });
      }
      const currentUser = await prisma.user.findUnique({ where: { id: p.user.id } });
      if (!currentUser) return reply.code(404).send({ error: "user_not_found" });

      const updated = await prisma.user.update({
        where: { id: p.user.id },
        data: {
          ...(firstName !== undefined ? { firstName } : {}),
          ...(lastName !== undefined ? { lastName } : {}),
          ...(avatarUrl !== undefined ? { avatarUrl } : {}),
          ...(password ? { passwordHash: await hashPassword(password) } : {}),
        },
      });
      return {
        user: {
          id: updated.id,
          email: updated.email,
          firstName: updated.firstName,
          lastName: updated.lastName,
          avatarUrl: updated.avatarUrl,
          role: updated.role,
        },
      };
    },
  );
}
