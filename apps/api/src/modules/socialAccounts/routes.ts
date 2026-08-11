import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client.js";

export async function socialAccountsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { projectId: string } }>("/social-accounts", async (req) => {
    const { projectId } = req.query;
    return prisma.socialAccount.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" }
    });
  });

  app.post<{ Body: { projectId: string; platform: string; handle: string; accessToken: string; refreshToken?: string } }>(
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
          accessToken,
          refreshToken
        }
      });
      return reply.code(201).send(account);
    }
  );

  app.delete<{ Params: { id: string } }>("/social-accounts/:id", async (req, reply) => {
    await prisma.socialAccount.delete({
      where: { id: req.params.id }
    });
    return reply.send({ success: true });
  });

  // OAuth 2.0 Flow routes

  app.get<{ Querystring: { platform: string; projectId: string } }>(
    "/social-accounts/oauth/authorize",
    async (req, reply) => {
      const { platform, projectId } = req.query;
      
      // In a real application, you would construct the provider's OAuth URL
      // using process.env.TWITTER_CLIENT_ID, INSTAGRAM_CLIENT_ID, etc.
      // e.g. https://api.twitter.com/oauth2/authorize?response_type=code&client_id=...
      
      // For this implementation, we will simulate the OAuth redirect to a mock provider
      // or redirect back to the callback immediately to simulate successful login.
      const state = Buffer.from(JSON.stringify({ platform, projectId })).toString("base64");
      
      // We will redirect to a mock consent screen that then hits our callback
      // Or for a seamless UX in our demo, we just directly hit the callback
      // to simulate the user saying "Yes, allow access".
      
      const callbackUrl = `${req.protocol}://${req.hostname}/social-accounts/oauth/callback?code=simulated_oauth_code_42&state=${state}`;
      
      // If we had real credentials:
      // const oauthUrls: Record<string, string> = {
      //   twitter: `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=...&redirect_uri=...&state=${state}`,
      //   instagram: `https://api.instagram.com/oauth/authorize?client_id=...&redirect_uri=...&response_type=code&state=${state}`
      // };
      // return reply.redirect(oauthUrls[platform] || callbackUrl);
      
      return reply.redirect(callbackUrl);
    }
  );

  app.get<{ Querystring: { code: string; state: string } }>(
    "/social-accounts/oauth/callback",
    async (req, reply) => {
      const { code, state } = req.query;
      
      try {
        const decodedState = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
        const { platform, projectId } = decodedState;
        
        // In a real app, we would POST the `code` to the provider's token endpoint
        // e.g. POST https://api.twitter.com/2/oauth2/token
        // const tokenResponse = await fetch(...)
        // const { access_token, refresh_token } = await tokenResponse.json();
        
        // Simulate exchanging the code for an access token
        const accessToken = `oauth_token_${platform}_${Math.random().toString(36).substring(7)}`;
        const handle = `@user_${platform}`;
        
        await prisma.socialAccount.create({
          data: {
            projectId,
            platform,
            handle,
            accessToken,
            refreshToken: "mock_refresh_token"
          }
        });

        // Redirect back to the frontend Integrations page
        // Assuming frontend runs on localhost:5173 or the referer host
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        return reply.redirect(`${frontendUrl}/integrations`);
        
      } catch (err) {
        console.error("OAuth callback error", err);
        return reply.redirect("http://localhost:5173/integrations?error=oauth_failed");
      }
    }
  );
}
