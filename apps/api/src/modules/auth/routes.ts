import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client.js";
import crypto from "node:crypto";
import { devMocksEnabled, signState, verifyState } from "../../auth/oauthState.js";
import {
  createSession,
  destroySession,
  destroyUserSessions,
  hashPassword,
  SESSION_COOKIE,
  verifyPassword,
  verifyPasswordOrDummy,
} from "../../auth/session.js";
import { nonEmpty, parse, z } from "../../http/validate.js";

/** Brute-force protection for credential endpoints (per client IP). */
const AUTH_RATE_LIMIT = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };

const password = () => z.string().min(8, "password must be at least 8 characters").max(72, "password must be at most 72 characters");
const SetupBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  password: password(),
});
const LoginBody = z.object({ email: z.string().trim().toLowerCase().max(320), password: z.string().max(200) });
const ProfileBody = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  avatarUrl: z.string().url().max(1_000_000).or(z.literal("")).optional(), // may be a data: URL
  password: password().optional(),
  currentPassword: z.string().max(200).optional(),
});

const COOKIE_OPTS = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  // Secure by default in production; COOKIE_SECURE=false only for local
  // plain-HTTP testing of a production build.
  secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : process.env.NODE_ENV === "production",
  maxAge: 30 * 24 * 60 * 60,
};

/** Short-lived cookie binding a Google OAuth round-trip to the browser that
 * started it (login-CSRF protection): its value must match the nonce in the
 * signed `state`. */
const OAUTH_NONCE_COOKIE = "agentry_oauth_nonce";
const OAUTH_NONCE_OPTS = { ...COOKIE_OPTS, maxAge: 10 * 60 };

type GoogleState = { nonce: string; redirectUri: string; mock?: boolean };

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

  app.post("/auth/setup", AUTH_RATE_LIMIT, async (req, reply) => {
    const { email, firstName, lastName, password } = parse(SetupBody, req.body);
    const passwordHash = await hashPassword(password);
    // Serialize concurrent setup calls (advisory lock) so two requests racing
    // through the "no owner yet" check can't both create an owner, and never
    // overwrite an existing account's password or role.
    const user = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(727274)`;
      const owners = await tx.user.count({ where: { role: "owner", email: { not: "local@agentry.dev" } } });
      if (owners > 0) return "done" as const;
      if (await tx.user.findUnique({ where: { email } })) return "exists" as const;
      return tx.user.create({
        data: { email, firstName: firstName ?? null, lastName: lastName ?? null, passwordHash, role: "owner" },
      });
    });
    if (user === "done") return reply.code(409).send({ error: "setup already completed" });
    if (user === "exists") return reply.code(409).send({ error: "an account with this email already exists" });

    const { token } = await createSession(user.id);
    reply.setCookie(SESSION_COOKIE, token, COOKIE_OPTS);
    return reply
      .code(201)
      .send({ user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, avatarUrl: user.avatarUrl, role: user.role } });
  });

  app.post("/auth/login", AUTH_RATE_LIMIT, async (req, reply) => {
    const { email, password } = parse(LoginBody, req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    // Uniform 401 and uniform cost -- never reveal whether the email exists.
    if (!(await verifyPasswordOrDummy(password, user?.passwordHash)) || !user) {
      return reply.code(401).send({ error: "invalid email or password" });
    }
    const { token } = await createSession(user.id);
    reply.setCookie(SESSION_COOKIE, token, COOKIE_OPTS);
    return { user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, avatarUrl: user.avatarUrl, role: user.role } };
  });

  app.get("/auth/google", AUTH_RATE_LIMIT, async (req, reply) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = getRedirectUri(req);
    const nonce = crypto.randomBytes(16).toString("base64url");

    if (!clientId || !clientSecret) {
      if (!devMocksEnabled()) {
        return reply.redirect(`${new URL(redirectUri).origin}/login?error=${encodeURIComponent("Google login is not configured.")}`);
      }
      req.log.info("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured. Using simulated Google Auth fallback (AGENTRY_DEV_MOCKS).");
      reply.setCookie(OAUTH_NONCE_COOKIE, nonce, OAUTH_NONCE_OPTS);
      const state = signState({ nonce, redirectUri, mock: true } satisfies GoogleState);
      return reply.redirect(`${redirectUri}?dev_mock=true&state=${encodeURIComponent(state)}`);
    }

    reply.setCookie(OAUTH_NONCE_COOKIE, nonce, OAUTH_NONCE_OPTS);
    const googleAuthUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        access_type: "offline",
        prompt: "select_account",
        state: signState({ nonce, redirectUri } satisfies GoogleState),
      }).toString();

    return reply.redirect(googleAuthUrl);
  });

  app.get<{ Querystring: { code?: string; state?: string; error?: string; dev_mock?: string } }>(
    "/auth/google/callback",
    AUTH_RATE_LIMIT,
    async (req, reply) => {
      const { code, error, dev_mock } = req.query;
      const state = verifyState<GoogleState>(req.query.state);
      const nonceCookie = req.cookies?.[OAUTH_NONCE_COOKIE];
      reply.clearCookie(OAUTH_NONCE_COOKIE, { path: "/" });

      // Only redirect back to an origin we computed ourselves (carried inside
      // the signed state), never to one supplied in the request.
      const redirectBase = new URL(state?.redirectUri ?? getRedirectUri(req)).origin;

      if (!state || !nonceCookie || nonceCookie !== state.nonce) {
        req.log.warn("Google Auth callback rejected: invalid or expired state");
        return reply.redirect(`${redirectBase}/login?error=${encodeURIComponent("Login session expired. Please try again.")}`);
      }

      if (error) {
        req.log.warn({ error }, "Google Auth callback error");
        return reply.redirect(`${redirectBase}/login?error=${encodeURIComponent("Google login failed or was cancelled.")}`);
      }

      let email: string;
      let firstName: string | null = null;
      let lastName: string | null = null;
      let avatarUrl: string | null = null;

      if (dev_mock === "true" && state.mock && devMocksEnabled()) {
        email = "google.dev@agentry.dev";
        firstName = "Google";
        lastName = "Developer";
        avatarUrl = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=256&auto=format&fit=crop&q=80";
      } else if (code && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        try {
          const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              code,
              client_id: process.env.GOOGLE_CLIENT_ID,
              client_secret: process.env.GOOGLE_CLIENT_SECRET,
              redirect_uri: state.redirectUri,
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
          if (googleUser.email_verified !== true) {
            throw new Error("Your Google account email is not verified.");
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

  app.patch("/auth/profile", AUTH_RATE_LIMIT, async (req, reply) => {
    const p = req.principal;
    if (p?.kind !== "user" || !p.user.id) {
      return reply.code(401).send({ error: "must be logged in as a session user to update profile" });
    }
    const { firstName, lastName, avatarUrl, password, currentPassword } = parse(ProfileBody, req.body);
    const currentUser = await prisma.user.findUnique({ where: { id: p.user.id } });
    if (!currentUser) return reply.code(404).send({ error: "user_not_found" });

    if (password) {
      // A stolen session must not be enough to take the account over.
      // (Google-only accounts have no password yet and may set one.)
      if (currentUser.passwordHash && !(currentPassword && (await verifyPassword(currentPassword, currentUser.passwordHash)))) {
        return reply.code(403).send({ error: "current password is incorrect" });
      }
    }

    const updated = await prisma.user.update({
      where: { id: p.user.id },
      data: {
        ...(firstName !== undefined ? { firstName } : {}),
        ...(lastName !== undefined ? { lastName } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl || null } : {}),
        ...(password ? { passwordHash: await hashPassword(password) } : {}),
      },
    });
    // Changing the password signs out every other session.
    if (password) await destroyUserSessions(updated.id, req.cookies?.[SESSION_COOKIE]);
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
  });
}
