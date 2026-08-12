import crypto from "node:crypto";
import { loadConnectors, type ConnectorConfig } from "./connectorRegistry.js";

export interface PlatformCredentials {
  clientId: string;
  clientSecret: string;
}

function getCredentials(config: ConnectorConfig): PlatformCredentials | null {
  const clientId = process.env[config.credentialsEnv.clientId];
  const clientSecret = process.env[config.credentialsEnv.clientSecret];
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

function getByPath(obj: unknown, dottedPath: string): unknown {
  return dottedPath.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

/** PKCE is required by some platforms' OAuth2 apps (e.g. X); harmless to
 * generate unconditionally, connectors that don't use it just ignore it. */
export function generatePkce() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/** Returns null when no connector is registered for this platform, or no app
 * credentials are configured for it -- callers should fall back to the local
 * dev-mock flow (same pattern as /auth/google when GOOGLE_CLIENT_ID is unset).
 * Fully data-driven from social-connectors/<platform>/connector.json --
 * no per-platform branching here. */
export async function buildAuthorizeUrl(
  platform: string,
  redirectUri: string,
  state: string,
  pkceChallenge: string,
): Promise<string | null> {
  if (platform === "instagram") return buildInstagramAuthorizeUrl(redirectUri, state);

  const config = (await loadConnectors()).get(platform);
  if (!config) return null;
  const creds = getCredentials(config);
  if (!creds) return null;

  const params: Record<string, string> = {
    response_type: "code",
    client_id: creds.clientId,
    redirect_uri: redirectUri,
    scope: config.oauth.scopes.join(" "),
    state,
  };
  if (config.oauth.usesPkce) {
    params.code_challenge = pkceChallenge;
    params.code_challenge_method = "S256";
  }

  return `${config.oauth.authorizeUrl}?${new URLSearchParams(params).toString()}`;
}

export interface ExchangedToken {
  accessToken: string;
  refreshToken: string | null;
  handle: string | null;
}

// Instagram doesn't fit the generic connector.json shape (see
// social-connectors/README / the content-studio plan's Phase 3 note): it
// logs in via Facebook, needs a short-lived -> long-lived token exchange,
// and posting needs the Instagram Business/Creator Account id looked up
// through a linked Facebook Page -- not a single userinfo GET. Handled here
// as a deliberate, documented special case instead of forcing it into the
// generic engine.
const INSTAGRAM_GRAPH_VERSION = "v19.0";
const INSTAGRAM_SCOPES = "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement";

function getInstagramCredentials(): PlatformCredentials | null {
  const clientId = process.env.INSTAGRAM_CLIENT_ID;
  const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

function buildInstagramAuthorizeUrl(redirectUri: string, state: string): string | null {
  const creds = getInstagramCredentials();
  if (!creds) return null;
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: redirectUri,
    scope: INSTAGRAM_SCOPES,
    response_type: "code",
    state,
  });
  return `https://www.facebook.com/${INSTAGRAM_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

async function exchangeInstagramCode(code: string, redirectUri: string): Promise<ExchangedToken> {
  const creds = getInstagramCredentials();
  if (!creds) throw new Error("no app credentials configured for instagram");

  const shortRes = await fetch(
    `https://graph.facebook.com/${INSTAGRAM_GRAPH_VERSION}/oauth/access_token?` +
      new URLSearchParams({ client_id: creds.clientId, client_secret: creds.clientSecret, redirect_uri: redirectUri, code }),
  );
  const shortData = await shortRes.json();
  if (!shortRes.ok || !shortData.access_token) {
    throw new Error(shortData.error?.message || "instagram token exchange failed");
  }

  // Short-lived (~1-2hr) -> long-lived (~60 day) user token. Falls back to
  // the short-lived token if this leg fails -- still usable immediately.
  const longRes = await fetch(
    `https://graph.facebook.com/${INSTAGRAM_GRAPH_VERSION}/oauth/access_token?` +
      new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        fb_exchange_token: shortData.access_token,
      }),
  );
  const longData = await longRes.json();
  const userToken = longRes.ok && longData.access_token ? longData.access_token : shortData.access_token;

  // Find a Facebook Page (each with its own page access token) that has a
  // linked Instagram Business/Creator account -- that's the account this
  // connection will post as.
  const pagesRes = await fetch(
    `https://graph.facebook.com/${INSTAGRAM_GRAPH_VERSION}/me/accounts?access_token=${encodeURIComponent(userToken)}`,
  );
  const pagesData = await pagesRes.json();
  if (!pagesRes.ok) throw new Error(pagesData.error?.message || "failed to list Facebook Pages");

  for (const page of pagesData.data ?? []) {
    const igRes = await fetch(
      `https://graph.facebook.com/${INSTAGRAM_GRAPH_VERSION}/${page.id}?fields=instagram_business_account&access_token=${encodeURIComponent(page.access_token)}`,
    );
    const igData = await igRes.json();
    const igAccountId: string | undefined = igData?.instagram_business_account?.id;
    if (!igAccountId) continue;

    let handle: string | null = null;
    try {
      const profileRes = await fetch(
        `https://graph.facebook.com/${INSTAGRAM_GRAPH_VERSION}/${igAccountId}?fields=username&access_token=${encodeURIComponent(page.access_token)}`,
      );
      const profile = await profileRes.json();
      handle = profile?.username ? `@${profile.username}` : null;
    } catch {
      // Non-fatal.
    }

    // SocialAccount has no per-platform metadata column, so the linked IG
    // Business Account id rides along packed into the stored token itself
    // (encrypted the same way the token is) -- split back apart in
    // social-connectors/instagram/publish.py.
    return { accessToken: `${page.access_token}::${igAccountId}`, refreshToken: null, handle };
  }

  throw new Error(
    "no Facebook Page with a linked Instagram Business/Creator account was found -- " +
      "link the Instagram account to a Facebook Page first (Instagram app: Settings > Linked Accounts)",
  );
}

async function fetchHandle(config: ConnectorConfig, accessToken: string): Promise<string | null> {
  if (!config.oauth.userinfoUrl) return null;
  try {
    const res = await fetch(config.oauth.userinfoUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await res.json();
    const raw = config.oauth.handlePath ? getByPath(data, config.oauth.handlePath) : undefined;
    return typeof raw === "string" ? `${config.oauth.handlePrefix ?? ""}${raw}` : null;
  } catch {
    return null; // Non-fatal -- the account is still usable for posting without a display handle.
  }
}

export async function exchangeCode(
  platform: string,
  code: string,
  redirectUri: string,
  pkceVerifier: string,
): Promise<ExchangedToken> {
  if (platform === "instagram") return exchangeInstagramCode(code, redirectUri);

  const config = (await loadConnectors()).get(platform);
  if (!config) throw new Error(`no connector registered for platform '${platform}'`);
  const creds = getCredentials(config);
  if (!creds) throw new Error(`no app credentials configured for ${platform}`);

  const bodyParams: Record<string, string> = {
    code,
    grant_type: "authorization_code",
    client_id: creds.clientId,
    redirect_uri: redirectUri,
  };
  if (config.oauth.usesPkce) bodyParams.code_verifier = pkceVerifier;

  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (config.oauth.tokenAuthStyle === "basic-header") {
    headers.Authorization = `Basic ${Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64")}`;
  } else {
    bodyParams.client_secret = creds.clientSecret;
  }

  const tokenRes = await fetch(config.oauth.tokenUrl, {
    method: "POST",
    headers,
    body: new URLSearchParams(bodyParams),
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description || tokenData.error || `${platform} token exchange failed`);
  }

  const handle = await fetchHandle(config, tokenData.access_token);
  return { accessToken: tokenData.access_token, refreshToken: tokenData.refresh_token ?? null, handle };
}
