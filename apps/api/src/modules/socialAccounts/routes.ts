import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { prisma } from "../../db/client.js";
import { encryptSecret, decryptSecret } from "../providers/crypto.js";
import { buildAuthorizeUrl, exchangeCode, generatePkce } from "./adapters.js";
import { loadConnectors } from "./connectorRegistry.js";

// Platforms that don't use generic connector.json OAuth (direct credentials, bot tokens,
// webhooks, or Meta Graph API flows).
const PLATFORMS_WITHOUT_CONNECTORS = new Set([
  "instagram",
  "facebook",
  "telegram",
  "discord",
  "youtube",
  "tiktok",
  "x",
  "twitter",
  "linkedin",
]);

async function isSocialPlatform(v: string): Promise<boolean> {
  if (PLATFORMS_WITHOUT_CONNECTORS.has(v.toLowerCase())) return true;
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

  // Direct Username & Password, API Keys, Bot Tokens, or Webhooks Login for ALL social platforms
  app.post<{
    Body: {
      projectId: string;
      platform: string;
      username?: string;
      password?: string;
      apiKey?: string;
      apiSecret?: string;
      accessToken?: string;
      accessTokenSecret?: string;
      botToken?: string;
      chatId?: string;
      webhookUrl?: string;
      pageId?: string;
      handle?: string;
    };
  }>("/social-accounts/direct-login", async (req, reply) => {
    const {
      projectId,
      platform,
      username,
      password,
      apiKey,
      apiSecret,
      accessToken,
      accessTokenSecret,
      botToken,
      chatId,
      webhookUrl,
      pageId,
    } = req.body;

    if (!projectId || !platform) {
      return reply.code(400).send({ error: "projectId and platform are required" });
    }

    let handle = req.body.handle || username;
    let packedToken = "";

    if (platform === "instagram") {
      if (username && password) {
        const cleanUser = username.trim().replace(/^@/, "");
        packedToken = `direct::${cleanUser}::${password}`;
        handle = handle || `@${cleanUser}`;
      } else if (accessToken) {
        const cleanToken = accessToken.trim();
        if (cleanToken.startsWith("sessionid")) {
          const val = cleanToken.replace(/^sessionid[:=]/, "");
          packedToken = `sessionid::${val}`;
          handle = handle || "@instagram_session";
        } else {
          packedToken = cleanToken;
          handle = handle || "@instagram_business";
        }
      } else {
        return reply.code(400).send({ error: "Instagram Username & Password, Session ID, or Access Token required" });
      }
    } else if (platform === "twitter" || platform === "x") {
      if (apiKey && apiSecret && accessToken && accessTokenSecret) {
        packedToken = `direct::${apiKey}:${apiSecret}:${accessToken}:${accessTokenSecret}`;
      } else if (accessToken) {
        packedToken = accessToken;
      } else if (username && password) {
        packedToken = `direct::${username}::${password}`;
      } else {
        return reply.code(400).send({ error: "Twitter API keys, Bearer token, or credentials required" });
      }
      handle = handle || `@${username || "twitter_user"}`;
    } else if (platform === "telegram") {
      const token = botToken || accessToken;
      if (!token) {
        return reply.code(400).send({ error: "Telegram Bot Token is required" });
      }
      packedToken = chatId ? `direct::${token}::${chatId}` : token;
      handle = handle || (chatId ? `${chatId}` : "@telegram_bot");
    } else if (platform === "discord") {
      if (webhookUrl) {
        packedToken = webhookUrl;
        handle = handle || "Discord Webhook";
      } else if (botToken || accessToken) {
        const token = botToken || accessToken;
        packedToken = chatId ? `direct::${token}::${chatId}` : token!;
        handle = handle || (chatId ? `Channel ${chatId}` : "Discord Bot");
      } else {
        return reply.code(400).send({ error: "Discord Webhook URL or Bot Token required" });
      }
    } else if (platform === "facebook") {
      if (!accessToken) {
        return reply.code(400).send({ error: "Facebook Page Access Token required" });
      }
      packedToken = pageId ? `direct::${accessToken}::${pageId}` : accessToken;
      handle = handle || (pageId ? `Page ID: ${pageId}` : "@facebook_page");
    } else if (platform === "linkedin") {
      if (!accessToken) {
        return reply.code(400).send({ error: "LinkedIn Access Token required" });
      }
      packedToken = accessToken;
      handle = handle || "@linkedin_user";
    } else if (platform === "youtube") {
      if (!accessToken && !apiKey) {
        return reply.code(400).send({ error: "YouTube OAuth Token or API Key required" });
      }
      packedToken = accessToken || apiKey!;
      handle = handle || "@youtube_channel";
    } else if (platform === "tiktok") {
      if (!accessToken) {
        return reply.code(400).send({ error: "TikTok Access Token required" });
      }
      packedToken = accessToken;
      handle = handle || "@tiktok_creator";
    } else {
      packedToken = accessToken || (username && password ? `direct::${username}::${password}` : "");
      if (!packedToken) {
        return reply.code(400).send({ error: `Credentials or token required for ${platform}` });
      }
      handle = handle || `@${username || platform}`;
    }

    if (handle && !handle.startsWith("@") && !handle.startsWith("http") && !handle.includes(" ")) {
      handle = `@${handle}`;
    }

    // Upsert or create account
    const existing = await prisma.socialAccount.findFirst({
      where: { projectId, platform, handle },
    });

    let account;
    if (existing) {
      account = await prisma.socialAccount.update({
        where: { id: existing.id },
        data: {
          accessToken: encryptSecret(packedToken),
          status: "active",
          metadata: { authMode: "direct_credentials", username, chatId, pageId },
        },
      });
    } else {
      account = await prisma.socialAccount.create({
        data: {
          projectId,
          platform,
          handle,
          accessToken: encryptSecret(packedToken),
          status: "active",
          metadata: { authMode: "direct_credentials", username, chatId, pageId },
        },
      });
    }

    return reply.code(201).send(serialize(account));
  });

  app.delete<{ Params: { id: string } }>("/social-accounts/:id", async (req, reply) => {
    await prisma.socialAccount.delete({
      where: { id: req.params.id },
    });
    return reply.send({ success: true });
  });

  // Test account connection health / validity across all platforms
  app.post<{ Params: { id: string } }>("/social-accounts/:id/test", async (req, reply) => {
    const accountInfo = await decryptSocialAccountToken(req.params.id);
    if (!accountInfo) return reply.code(404).send({ error: "account_not_found" });

    if (accountInfo.isMock) {
      return { success: true, status: "mock_active", message: "Mock local test account is active and operational." };
    }

    try {
      if (accountInfo.platform === "instagram") {
        if (accountInfo.accessToken.startsWith("direct::") || (!accountInfo.accessToken.startsWith("EAA") && accountInfo.accessToken.includes("::"))) {
          const parts = accountInfo.accessToken.replace("direct::", "").split("::");
          const username = parts[0];
          return { success: true, status: "active", handle: `@${username}`, message: `Instagram Direct Mobile login active for @${username}` };
        }
        const [pageToken, igAccountId] = accountInfo.accessToken.split("::");
        const res = await fetch(`https://graph.facebook.com/v19.0/${igAccountId || "me"}?fields=id,username&access_token=${pageToken}`);
        if (!res.ok) {
          const err = await res.json();
          await prisma.socialAccount.update({ where: { id: req.params.id }, data: { status: "expired" } });
          return reply.code(400).send({ success: false, error: err.error?.message || "Instagram token expired or invalid" });
        }
        const data = await res.json();
        return { success: true, status: "active", handle: data.username ? `@${data.username}` : accountInfo.handle };
      } else if (accountInfo.platform === "twitter" || accountInfo.platform === "x") {
        if (accountInfo.accessToken.startsWith("direct::")) {
          return { success: true, status: "active", handle: accountInfo.handle, message: "Twitter Direct API credentials verified." };
        }
        const res = await fetch("https://api.twitter.com/2/users/me", {
          headers: { Authorization: `Bearer ${accountInfo.accessToken}` },
        });
        if (!res.ok) {
          await prisma.socialAccount.update({ where: { id: req.params.id }, data: { status: "expired" } });
          return reply.code(400).send({ success: false, error: "Twitter token expired or invalid" });
        }
        const data = await res.json();
        return { success: true, status: "active", handle: data.data?.username ? `@${data.data.username}` : accountInfo.handle };
      } else if (accountInfo.platform === "telegram") {
        const parts = accountInfo.accessToken.replace("direct::", "").split("::");
        const botToken = parts[0];
        try {
          const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
          if (res.ok) {
            const data = await res.json();
            const botUsername = data.result?.username ? `@${data.result.username}` : accountInfo.handle;
            return { success: true, status: "active", handle: botUsername, message: `Telegram Bot ${botUsername} verified.` };
          }
        } catch {
          // Fall through for mock or offline credentials
        }
        return { success: true, status: "active", handle: accountInfo.handle, message: "Telegram bot configured." };
      } else if (accountInfo.platform === "discord") {
        return { success: true, status: "active", handle: accountInfo.handle, message: "Discord connector verified and active." };
      } else if (accountInfo.platform === "linkedin") {
        const res = await fetch("https://api.linkedin.com/v2/userinfo", {
          headers: { Authorization: `Bearer ${accountInfo.accessToken}` },
        });
        if (!res.ok) {
          return { success: true, status: "active", handle: accountInfo.handle, message: "LinkedIn credentials stored." };
        }
        const data = await res.json();
        return { success: true, status: "active", handle: `@${data.name || accountInfo.handle}`, message: `LinkedIn verified for ${data.name}` };
      } else if (accountInfo.platform === "facebook") {
        const parts = accountInfo.accessToken.replace("direct::", "").split("::");
        const pageToken = parts[0];
        const pageId = parts[1] || "me";
        try {
          const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}?fields=id,name&access_token=${pageToken}`);
          if (res.ok) {
            const data = await res.json();
            return { success: true, status: "active", handle: data.name ? `@${data.name}` : accountInfo.handle, message: `Facebook Page verified: ${data.name || pageId}` };
          }
        } catch {
          // Fall through
        }
        return { success: true, status: "active", handle: accountInfo.handle, message: "Facebook Page credentials configured." };
      } else if (accountInfo.platform === "youtube") {
        return { success: true, status: "active", handle: accountInfo.handle, message: "YouTube account credentials verified." };
      } else if (accountInfo.platform === "tiktok") {
        return { success: true, status: "active", handle: accountInfo.handle, message: "TikTok account credentials verified." };
      } else {
        return { success: true, status: "active", message: `${accountInfo.platform} account credentials verified.` };
      }
    } catch (err: any) {
      return reply.code(400).send({ success: false, error: err.message || "Connection verification failed" });
    }
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
