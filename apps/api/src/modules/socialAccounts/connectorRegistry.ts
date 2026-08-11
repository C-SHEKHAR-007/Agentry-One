import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export interface ConnectorConfig {
  id: string;
  name: string;
  oauth: {
    authorizeUrl: string;
    tokenUrl: string;
    scopes: string[];
    usesPkce: boolean;
    tokenAuthStyle: "basic-header" | "body-param";
    userinfoUrl?: string;
    /** Dotted path into the userinfo JSON response, e.g. "data.username". */
    handlePath?: string;
    handlePrefix?: string;
  };
  /** Names of the env vars holding this platform's OAuth app credentials
   * (e.g. {clientId: "TWITTER_CLIENT_ID", ...}) -- not the credentials
   * themselves. */
  credentialsEnv: { clientId: string; clientSecret: string };
}

export const SOCIAL_CONNECTORS_DIR =
  process.env.SOCIAL_CONNECTORS_DIR ?? path.resolve(process.cwd(), "../../social-connectors");

/** Scans social-connectors/<platform>/connector.json for every subdirectory,
 * mirroring modules/agents/manifestScanner.ts's scan pattern -- adding a new
 * platform is "drop a connector.json (+ a Python publish.py)", no code
 * change here. Silently skips directories without a connector.json. */
export async function loadConnectors(): Promise<Map<string, ConnectorConfig>> {
  const map = new Map<string, ConnectorConfig>();

  let entries: string[];
  try {
    entries = await readdir(SOCIAL_CONNECTORS_DIR);
  } catch {
    return map;
  }

  for (const entry of entries) {
    const connectorPath = path.join(SOCIAL_CONNECTORS_DIR, entry, "connector.json");
    let raw: string;
    try {
      raw = await readFile(connectorPath, "utf-8");
    } catch {
      continue; // not a connector directory
    }
    const config = JSON.parse(raw) as ConnectorConfig;
    map.set(config.id, config);
  }

  return map;
}
