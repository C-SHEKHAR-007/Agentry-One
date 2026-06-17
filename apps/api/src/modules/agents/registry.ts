import { prisma } from "../../db/client.js";
import { scanAgentManifests, type AgentManifest } from "./manifestScanner.js";

/** Scans each agent directory's manifest.json and upserts it into the `agents`
 * table. Runs once at API boot -- no live hot-reload (ADR-0006). */
export async function syncAgentRegistry(): Promise<AgentManifest[]> {
  const manifests = await scanAgentManifests();

  for (const manifest of manifests) {
    await prisma.agent.upsert({
      where: { id: manifest.id },
      create: {
        id: manifest.id,
        version: manifest.version,
        name: manifest.name,
        description: manifest.description,
        manifest: manifest as unknown as object,
        status: "active",
      },
      update: {
        version: manifest.version,
        name: manifest.name,
        description: manifest.description,
        manifest: manifest as unknown as object,
        status: "active",
      },
    });
  }

  return manifests;
}
