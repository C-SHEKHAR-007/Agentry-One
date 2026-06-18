import { prisma } from "../../db/client.js";

/** Seeds the closed capability enum and a zero-config local default provider
 * per capability, so existing agents keep working without any operator
 * setup (the backward-compatibility guarantee -- see the plan's ADR-0009
 * equivalent, "fixed capability enum, not a generic pluggable interface"). */
export async function ensureCapabilitiesAndDefaults(): Promise<void> {
  const imageGen = await prisma.capability.upsert({
    where: { key: "image-generation" },
    update: {},
    create: { key: "image-generation", label: "Image generation", description: "Generate an image from a text prompt." },
  });

  await prisma.capability.upsert({
    where: { key: "text-generation" },
    update: {},
    create: {
      key: "text-generation",
      label: "Text generation",
      description: "Generate/re-rank text via an LLM. Modeled for forward-compatibility -- no consumer or adapter in this build.",
    },
  });

  const existingDefault = await prisma.providerConfig.findFirst({
    where: { capabilityId: imageGen.id, scope: "global", isDefault: true },
  });
  if (!existingDefault) {
    await prisma.providerConfig.create({
      data: {
        capabilityId: imageGen.id,
        providerType: "sd_turbo_local",
        name: "Local SD-Turbo (default)",
        authMode: "none",
        isDefault: true,
        scope: "global",
        status: "active",
      },
    });
  }
}
