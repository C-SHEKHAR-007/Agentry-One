import { afterEach, describe, expect, it } from "vitest";
import { buildAuthorizeUrl } from "../src/modules/socialAccounts/adapters.js";

const ENV_KEYS = ["TWITTER_CLIENT_ID", "TWITTER_CLIENT_SECRET", "LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"];

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe("buildAuthorizeUrl", () => {
  it("returns null when no app credentials are configured (dev-mock fallback territory)", async () => {
    expect(await buildAuthorizeUrl("twitter", "http://localhost:4000/cb", "state", "challenge")).toBeNull();
  });

  it("returns null for a platform with no registered connector", async () => {
    process.env.TWITTER_CLIENT_ID = "id";
    process.env.TWITTER_CLIENT_SECRET = "secret";
    expect(await buildAuthorizeUrl("myspace", "http://localhost:4000/cb", "state", "challenge")).toBeNull();
  });

  it("builds a PKCE authorize URL for twitter when credentials are configured", async () => {
    process.env.TWITTER_CLIENT_ID = "twitter-id";
    process.env.TWITTER_CLIENT_SECRET = "twitter-secret";
    const url = await buildAuthorizeUrl("twitter", "http://localhost:4000/cb", "the-state", "the-challenge");
    expect(url).toContain("https://twitter.com/i/oauth2/authorize?");
    const params = new URL(url!).searchParams;
    expect(params.get("client_id")).toBe("twitter-id");
    expect(params.get("redirect_uri")).toBe("http://localhost:4000/cb");
    expect(params.get("state")).toBe("the-state");
    expect(params.get("code_challenge")).toBe("the-challenge");
    expect(params.get("code_challenge_method")).toBe("S256");
    expect(params.get("scope")).toContain("tweet.write");
  });

  it("builds a non-PKCE authorize URL for linkedin when credentials are configured", async () => {
    process.env.LINKEDIN_CLIENT_ID = "li-id";
    process.env.LINKEDIN_CLIENT_SECRET = "li-secret";
    const url = await buildAuthorizeUrl("linkedin", "http://localhost:4000/cb", "the-state", "unused-challenge");
    expect(url).toContain("https://www.linkedin.com/oauth/v2/authorization?");
    const params = new URL(url!).searchParams;
    expect(params.get("client_id")).toBe("li-id");
    expect(params.has("code_challenge")).toBe(false);
    expect(params.get("scope")).toContain("w_member_social");
  });
});
