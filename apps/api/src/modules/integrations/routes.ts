import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authorize } from "../../auth/access.js";
import { parse, z } from "../../http/validate.js";
import { HelperError, HelperOfflineError, instagramHelper, type InstagramHelper } from "./instagramHelper.js";

const StartBody = z.object({ projectId: z.string().min(1).max(100) });

export interface InstagramLoginRoutesOptions {
  helper?: InstagramHelper;
  /** Checks the signed-in user may link accounts to the project (replies 404 if not). */
  canUseProject?: (req: FastifyRequest, reply: FastifyReply, projectId: string) => Promise<boolean>;
}

const BASE = "/integrations/instagram/browser-login";

/**
 * Proxies the local Instagram login helper. Signed-in users only (the global
 * auth hook); starting a login also requires access to the target project.
 * The helper keeps a single login session on the desktop it runs on.
 */
export async function instagramLoginRoutes(app: FastifyInstance, opts: InstagramLoginRoutesOptions = {}) {
  const helper = opts.helper ?? instagramHelper();
  const canUseProject = opts.canUseProject ?? ((req, reply, projectId) => authorize(req, reply, "project", projectId));

  const fail = (reply: FastifyReply, err: unknown) => {
    if (err instanceof HelperOfflineError) return reply.code(503).send({ error: "helper_offline", message: err.message });
    if (err instanceof HelperError) return reply.code(502).send({ error: "helper_error", message: err.message });
    throw err;
  };

  // Availability check for the UI: offline is an answer, not an error.
  app.get(`${BASE}/status`, async (_req, reply) => {
    try {
      const s = await helper.status();
      return { online: true, ready: s.ready, session: s.session };
    } catch (err) {
      if (err instanceof HelperOfflineError || err instanceof HelperError) return { online: false, ready: false, session: "idle" };
      return fail(reply, err);
    }
  });

  app.post(`${BASE}/start`, async (req, reply) => {
    const { projectId } = parse(StartBody, req.body);
    if (!(await canUseProject(req, reply, projectId))) return;
    try {
      await helper.start(projectId);
      return { status: "in_progress" };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.get(`${BASE}/session`, async (_req, reply) => {
    try {
      return await helper.progress();
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post(`${BASE}/cancel`, async (_req, reply) => {
    try {
      await helper.cancel();
      return { canceled: true };
    } catch (err) {
      return fail(reply, err);
    }
  });
}
