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
