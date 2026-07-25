import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client.js";
import { resolveArtifactPath } from "./storage.js";

import {
  downloadBlobStream,
  generateReadSasUrl,
  generateUploadSasUrl,
} from "./azureClient.js";

export async function artifactsRoutes(app: FastifyInstance) {
  app.post<{ Body: { blobName: string } }>(
    "/artifacts/sas/upload",
    async (req, reply) => {
      const { blobName } = req.body || {};
      if (!blobName) return reply.code(400).send({ error: "blobName_required" });
      // Upload SAS is always capped at 20 minutes — write window is intentionally short
      const sas = await generateUploadSasUrl(blobName, 20);
      return sas;
    },
  );

  app.post<{
    Body: {
      filename?: string;
      blobName?: string;
      mode?: "preview" | "post" | "upload" | "download" | "read" | "write";
      mimeType?: string;
    };
  }>("/artifacts/sas", async (req, reply) => {
    const name = req.body?.filename || req.body?.blobName;
    if (!name) return reply.code(400).send({ error: "filename_or_blobName_required" });
    const cleanName = name.replace(/^azure:\/\//, "");
    const mode = (req.body?.mode || "preview").toLowerCase();

    if (mode === "post" || mode === "upload" || mode === "write") {
      const res = await generateUploadSasUrl(cleanName, 20);
      return { url: res.url, mode: "upload", expiresAt: res.expiresAt };
    } else {
      const readMode = mode === "download" ? "download" : "preview";
      const sas = await generateReadSasUrl(cleanName, {
        mode: readMode,
        mimeType: req.body?.mimeType || "application/octet-stream",
        expiresInMinutes: 120,
      });
      return sas;
    }
  });

  app.get<{ Params: { id: string } }>(
    "/artifacts/:id/sas/preview",
    async (req, reply) => {
      const artifact = await prisma.artifact.findUnique({ where: { id: req.params.id } });
      if (!artifact) return reply.code(404).send({ error: "artifact_not_found" });

      const blobName = artifact.storageKey.replace(/^azure:\/\//, "");
      // Read SAS is always 2 hours (120 min)
      const sas = await generateReadSasUrl(blobName, {
        mode: "preview",
        mimeType: artifact.mimeType,
        expiresInMinutes: 120,
      });
      return sas;
    },
  );

  app.get<{ Params: { id: string } }>(
    "/artifacts/:id/sas/download",
    async (req, reply) => {
      const artifact = await prisma.artifact.findUnique({ where: { id: req.params.id } });
      if (!artifact) return reply.code(404).send({ error: "artifact_not_found" });

      const blobName = artifact.storageKey.replace(/^azure:\/\//, "");
      // Download SAS is always 2 hours (120 min)
      const sas = await generateReadSasUrl(blobName, {
        mode: "download",
        mimeType: artifact.mimeType,
        fileName: `${artifact.kind}-${artifact.id.slice(0, 8)}`,
        expiresInMinutes: 120,
      });
      return sas;
    },
  );

  app.get<{ Params: { id: string } }>("/workflows/:id/artifacts", async (req) => {
    const artifacts = await prisma.artifact.findMany({ where: { workflowStep: { workflowId: req.params.id } }, orderBy: { createdAt: "asc" } });
    return Promise.all(
      artifacts.map(async (a) => {
        const blobName = a.storageKey.replace(/^azure:\/\//, "");
        const [preview, download] = await Promise.all([
          generateReadSasUrl(blobName, { mode: "preview", mimeType: a.mimeType, expiresInMinutes: 120 }),
          generateReadSasUrl(blobName, {
            mode: "download",
            mimeType: a.mimeType,
            fileName: `${a.kind}-${a.id.slice(0, 8)}`,
            expiresInMinutes: 120,
          }),
        ]);
        return { ...a, previewUrl: preview.url, downloadUrl: download.url };
      }),
    );
  });

  // Flat cross-project listing for the gallery. Registered before the :id
  // routes only for readability -- Fastify routes static/param segments
  // independently, so there is no conflict.
  app.get<{ Querystring: { limit?: string; projectId?: string; kind?: string } }>(
    "/artifacts",
    async (req) => {
      const limit = Math.min(Number(req.query.limit ?? 50) || 50, 100);
      const artifacts = await prisma.artifact.findMany({
        where: {
          ...(req.query.kind ? { kind: req.query.kind } : {}),
          ...(req.query.projectId
            ? { workflowStep: { workflow: { projectId: req.query.projectId } } }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          workflowStep: {
            select: {
              workflowId: true,
              workflow: {
                select: {
                  projectId: true,
                  agentId: true,
                  project: { select: { name: true } },
                },
              },
            },
          },
        },
      });
      return Promise.all(
        artifacts.map(async (a) => {
          const blobName = a.storageKey.replace(/^azure:\/\//, "");
          const [preview, download] = await Promise.all([
            generateReadSasUrl(blobName, { mode: "preview", mimeType: a.mimeType, expiresInMinutes: 120 }),
            generateReadSasUrl(blobName, {
              mode: "download",
              mimeType: a.mimeType,
              fileName: `${a.kind}-${a.id.slice(0, 8)}`,
              expiresInMinutes: 120,
            }),
          ]);
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
            previewUrl: preview.url,
            downloadUrl: download.url,
          };
        }),
      );
    },
  );

  app.get<{ Params: { id: string } }>("/artifacts/:id", async (req, reply) => {
    const artifact = await prisma.artifact.findUnique({ where: { id: req.params.id } });
    if (!artifact) return reply.code(404).send({ error: "artifact_not_found" });
    const blobName = artifact.storageKey.replace(/^azure:\/\//, "");
    const [preview, download] = await Promise.all([
      generateReadSasUrl(blobName, { mode: "preview", mimeType: artifact.mimeType, expiresInMinutes: 120 }),
      generateReadSasUrl(blobName, {
        mode: "download",
        mimeType: artifact.mimeType,
        fileName: `${artifact.kind}-${artifact.id.slice(0, 8)}`,
        expiresInMinutes: 120,
      }),
    ]);
    return { ...artifact, previewUrl: preview.url, downloadUrl: download.url };
  });

  app.get<{ Params: { id: string } }>("/artifacts/:id/download", async (req, reply) => {
    const artifact = await prisma.artifact.findUnique({ where: { id: req.params.id } });
    if (!artifact) return reply.code(404).send({ error: "artifact_not_found" });

    if (artifact.storageKey.startsWith("azure://") || process.env.STORAGE_PROVIDER === "azure") {
      const blobName = artifact.storageKey.replace(/^azure:\/\//, "");
      try {
        const { stream, contentLength, contentType } = await downloadBlobStream(blobName);
        reply.header("Content-Type", contentType || artifact.mimeType);
        if (contentLength !== undefined) {
          reply.header("Content-Length", contentLength);
        }
        return reply.send(stream);
      } catch {
        return reply.code(404).send({ error: "artifact_blob_missing" });
      }
    }

    const filePath = resolveArtifactPath(artifact.storageKey);
    try {
      const info = await stat(filePath);
      reply.header("Content-Type", artifact.mimeType);
      reply.header("Content-Length", info.size);
      return reply.send(createReadStream(filePath));
    } catch {
      return reply.code(404).send({ error: "artifact_file_missing" });
    }
  });
}
