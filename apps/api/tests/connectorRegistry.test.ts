import { describe, expect, it } from "vitest";
import { loadConnectors } from "../src/modules/socialAccounts/connectorRegistry.js";

describe("loadConnectors", () => {
  it("finds the real twitter and linkedin connector.json files", async () => {
    const connectors = await loadConnectors();
    expect([...connectors.keys()].sort()).toEqual(["linkedin", "twitter"]);
  });

  it("twitter uses PKCE and a Basic-auth-header token exchange", async () => {
    const twitter = (await loadConnectors()).get("twitter");
    expect(twitter?.oauth.usesPkce).toBe(true);
    expect(twitter?.oauth.tokenAuthStyle).toBe("basic-header");
    expect(twitter?.credentialsEnv).toEqual({ clientId: "TWITTER_CLIENT_ID", clientSecret: "TWITTER_CLIENT_SECRET" });
  });

  it("linkedin does not use PKCE and sends client_secret in the token body", async () => {
    const linkedin = (await loadConnectors()).get("linkedin");
    expect(linkedin?.oauth.usesPkce).toBe(false);
    expect(linkedin?.oauth.tokenAuthStyle).toBe("body-param");
    expect(linkedin?.credentialsEnv).toEqual({ clientId: "LINKEDIN_CLIENT_ID", clientSecret: "LINKEDIN_CLIENT_SECRET" });
  });
});
