import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { FastifyInstance, FastifyReply } from "fastify";
import { prisma } from "../../db/client.js";
import { authorize, viaProject } from "../../auth/access.js";
import { resolveArtifactPath } from "./storage.js";
import { downloadBlobStream } from "./azureClient.js";
import { artifactUrl, isAzureKey, withArtifactUrls } from "./urls.js";
import { NEWEST_FIRST, pageQuery, toPage } from "../../http/paging.js";

/** Media types a browser may render inline without being able to run script
 * in our origin. Everything else (notably text/html and image/svg+xml, which
 * an agent could produce) is forced to download. */
const INLINE_SAFE = /^(image\/(png|jpe?g|gif|webp|avif)|audio\/[\w.+-]+|video\/[\w.+-]+|text\/plain|application\/pdf)$/i;

function setSafeDownloadHeaders(reply: FastifyReply, mimeType: string, fileName: string, forceAttachment: boolean) {
  const inline = !forceAttachment && INLINE_SAFE.test(mimeType);
  reply.header("Content-Type", mimeType);
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("Content-Security-Policy", "default-src 'none'; sandbox");
  reply.header("Content-Disposition", `${inline ? "inline" : "attachment"}; filename="${fileName}"`);
}

export async function artifactsRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>("/artifacts/:id/sas/preview", async (req, reply) => {
    if (!(await authorize(req, reply, "artifact", req.params.id))) return;
    const artifact = await prisma.artifact.findUniqueOrThrow({ where: { id: req.params.id } });
    return { url: await artifactUrl(artifact, "preview"), mode: "preview" };
  });

  app.get<{ Params: { id: string } }>("/artifacts/:id/sas/download", async (req, reply) => {
    if (!(await authorize(req, reply, "artifact", req.params.id))) return;
    const artifact = await prisma.artifact.findUniqueOrThrow({ where: { id: req.params.id } });
    return { url: await artifactUrl(artifact, "download"), mode: "download" };
  });

  app.get<{ Params: { id: string } }>("/workflows/:id/artifacts", async (req, reply) => {
    if (!(await authorize(req, reply, "workflow", req.params.id))) return;
    const artifacts = await prisma.artifact.findMany({
      where: { workflowStep: { workflowId: req.params.id } },
      orderBy: { createdAt: "asc" },
    });
    return Promise.all(artifacts.map(withArtifactUrls));
  });

  // Flat cross-project listing for the gallery.
  app.get<{ Querystring: { limit?: string; projectId?: string; kind?: string; paged?: string; cursor?: string } }>("/artifacts", async (req) => {
    const limit = Math.min(Number(req.query.limit ?? 50) || 50, 100);
    const page = pageQuery(req.query);
    const rows = await prisma.artifact.findMany({
      where: {
        ...page.where,
        ...(req.query.kind ? { kind: req.query.kind } : {}),
        workflowStep: {
          workflow: {
            ...viaProject(req),
            ...(req.query.projectId ? { projectId: req.query.projectId } : {}),
          },
        },
      },
      orderBy: NEWEST_FIRST,
      take: page.take(limit),
      include: {
        workflowStep: {
          select: {
            workflowId: true,
            workflow: { select: { projectId: true, agentId: true, project: { select: { name: true } } } },
          },
        },
      },
    });
    const { items: artifacts, nextCursor } = toPage(rows, limit);
    const out = await Promise.all(
      artifacts.map(async (a) => {
        const { previewUrl, downloadUrl } = await withArtifactUrls(a);
        return {
          id: a.id,
          kind: a.kind,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          checksum: a.checksum,
          createdAt: a.createdAt,
          workflowId: a.workflowStep.workflowId,
          projectId: a.workflowStep.workflow.projectId,
          projectName: a.workflowStep.workflow.project.name,
          agentId: a.workflowStep.workflow.agentId,
          previewUrl,
          downloadUrl,
        };
      }),
    );
    return page.paged ? { items: out, nextCursor } : out;
  });

  app.get<{ Params: { id: string } }>("/artifacts/:id", async (req, reply) => {
    if (!(await authorize(req, reply, "artifact", req.params.id))) return;
    const artifact = await prisma.artifact.findUniqueOrThrow({ where: { id: req.params.id } });
    return withArtifactUrls(artifact);
  });

  app.get<{ Params: { id: string }; Querystring: { disposition?: string } }>(
    "/artifacts/:id/download",
    async (req, reply) => {
      if (!(await authorize(req, reply, "artifact", req.params.id))) return;
      const artifact = await prisma.artifact.findUniqueOrThrow({ where: { id: req.params.id } });
      const ext = artifact.mimeType.split("/")[1]?.split(/[+;]/)[0] ?? "bin";
      const fileName = `${artifact.kind}-${artifact.id.slice(0, 8)}.${ext}`;
      const forceAttachment = req.query.disposition === "attachment";

      if (isAzureKey(artifact.storageKey)) {
        try {
          const { stream, contentLength } = await downloadBlobStream(artifact.storageKey.replace(/^azure:\/\//, ""));
          setSafeDownloadHeaders(reply, artifact.mimeType, fileName, forceAttachment);
          if (contentLength !== undefined) reply.header("Content-Length", contentLength);
          return reply.send(stream);
        } catch {
          return reply.code(404).send({ error: "artifact_blob_missing" });
        }
      }

      const filePath = resolveArtifactPath(artifact.storageKey);
      if (!filePath) return reply.code(404).send({ error: "artifact_file_missing" });
      try {
        const info = await stat(filePath);
        setSafeDownloadHeaders(reply, artifact.mimeType, fileName, forceAttachment);
        reply.header("Content-Length", info.size);
        return reply.send(createReadStream(filePath));
      } catch {
        return reply.code(404).send({ error: "artifact_file_missing" });
      }
    },
  );
}
