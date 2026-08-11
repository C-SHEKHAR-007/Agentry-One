import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { prisma } from "../../db/client.js";
import { encryptSecret, decryptSecret } from "../providers/crypto.js";
import { buildAuthorizeUrl, exchangeCode, generatePkce } from "./adapters.js";
import { loadConnectors } from "./connectorRegistry.js";

// "instagram" is connectable (mock-only for now -- Meta's Facebook-Login-for-
// -Business flow doesn't fit the generic OAuth2 connector shape, see
// social-connectors/README or the content-studio plan's Phase 3 note) even
// though it has no social-connectors/instagram/connector.json.
const PLATFORMS_WITHOUT_CONNECTORS = new Set(["instagram"]);

async function isSocialPlatform(v: string): Promise<boolean> {
  if (PLATFORMS_WITHOUT_CONNECTORS.has(v)) return true;
  return (await loadConnectors()).has(v);
}

function serialize(account: { accessToken: string; refreshToken: string | null; [k: string]: unknown }) {
  // Tokens are write-only from the API's perspective -- never re-exposed once stored.
  const { accessToken, refreshToken, ...rest } = account;
  return { ...rest, connected: true };
}

function getRedirectUri(req: any): string {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:4000";
  const proto = req.headers["x-forwarded-proto"] || "http";
  return `${proto}://${host}/social-accounts/oauth/callback`;
}

/** Decrypts a SocialAccount's stored token for use inside the API process
 * only (e.g. resolving publish context at enqueue time) -- never returned
 * over HTTP. Mirrors provider-secret handling in providers/resolve.ts. */
export async function decryptSocialAccountToken(accountId: string): Promise<{
  accessToken: string;
  refreshToken: string | null;
  platform: string;
  handle: string | null;
  isMock: boolean;
} | null> {
  const account = await prisma.socialAccount.findUnique({ where: { id: accountId } });
  if (!account) return null;
  return {
    accessToken: decryptSecret(account.accessToken),
    refreshToken: account.refreshToken ? decryptSecret(account.refreshToken) : null,
    platform: account.platform,
    handle: account.handle,
    isMock: account.status === "mock",
  };
}

export async function socialAccountsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { projectId: string } }>("/social-accounts", async (req) => {
    const { projectId } = req.query;
    const accounts = await prisma.socialAccount.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    return accounts.map(serialize);
  });

  // Manual token entry (paste an already-issued token) -- still goes through
  // the same encryption path as the OAuth flow below.
  app.post<{ Body: { projectId: string; platform: string; handle?: string; accessToken: string; refreshToken?: string } }>(
    "/social-accounts",
    async (req, reply) => {
      const { projectId, platform, handle, accessToken, refreshToken } = req.body;
      if (!projectId || !platform || !accessToken) {
        return reply.code(400).send({ error: "projectId, platform, and accessToken are required" });
      }

      const account = await prisma.socialAccount.create({
        data: {
          projectId,
          platform,
          handle,
          accessToken: encryptSecret(accessToken),
          refreshToken: refreshToken ? encryptSecret(refreshToken) : null,
          status: "active",
        },
      });
      return reply.code(201).send(serialize(account));
    },
  );

  app.delete<{ Params: { id: string } }>("/social-accounts/:id", async (req, reply) => {
    await prisma.socialAccount.delete({
      where: { id: req.params.id },
    });
    return reply.send({ success: true });
  });

  // OAuth 2.0 Flow routes

  app.get<{ Querystring: { platform: string; projectId: string } }>(
    "/social-accounts/oauth/authorize",
    async (req, reply) => {
      const { platform, projectId } = req.query;
      if (!(await isSocialPlatform(platform))) {
        return reply.code(400).send({ error: `unsupported platform: ${platform}` });
      }

      const redirectUri = getRedirectUri(req);
      const { verifier, challenge } = generatePkce();
      const state = Buffer.from(JSON.stringify({ platform, projectId, verifier, redirectUri })).toString("base64url");

      const authorizeUrl = await buildAuthorizeUrl(platform, redirectUri, state, challenge);
      if (!authorizeUrl) {
        req.log.info(`no app credentials configured for ${platform}. Using local dev-mock connect flow.`);
        return reply.redirect(`${redirectUri}?dev_mock=true&state=${state}`);
      }

      return reply.redirect(authorizeUrl);
    },
  );

  app.get<{ Querystring: { code?: string; state: string; error?: string; dev_mock?: string } }>(
    "/social-accounts/oauth/callback",
    async (req, reply) => {
      const { code, state, error, dev_mock } = req.query;
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

      let decodedState: { platform: string; projectId: string; verifier: string; redirectUri: string };
      try {
        decodedState = JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
      } catch {
        return reply.redirect(`${frontendUrl}/integrations?error=oauth_failed`);
      }
      const { platform, projectId, verifier, redirectUri } = decodedState;

      if (error) {
        req.log.warn({ error, platform }, "social OAuth callback error");
        return reply.redirect(`${frontendUrl}/integrations?error=${encodeURIComponent(error)}`);
      }

      try {
        let accessToken: string;
        let refreshToken: string | null;
        let handle: string | null;
        let status: "active" | "mock";

        if (dev_mock === "true") {
          // Local dev fallback when no platform app credentials are configured --
          // same intent as the /auth/google dev_mock path. Clearly tagged (status:
          // "mock") so the publisher knows to simulate rather than call a real API.
          accessToken = `dev_mock_${platform}_${crypto.randomUUID()}`;
          refreshToken = null;
          handle = `@dev_${platform}`;
          status = "mock";
        } else {
          if (!code) throw new Error("missing authorization code");
          const exchanged = await exchangeCode(platform, code, redirectUri, verifier);
          accessToken = exchanged.accessToken;
          refreshToken = exchanged.refreshToken;
          handle = exchanged.handle;
          status = "active";
        }

        await prisma.socialAccount.create({
          data: {
            projectId,
            platform,
            handle,
            accessToken: encryptSecret(accessToken),
            refreshToken: refreshToken ? encryptSecret(refreshToken) : null,
            status,
          },
        });

        return reply.redirect(`${frontendUrl}/integrations`);
      } catch (err) {
        req.log.error({ err, platform }, "social OAuth exchange failed");
        return reply.redirect(`${frontendUrl}/integrations?error=oauth_failed`);
      }
    },
  );
}
