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
      description: "Generate/re-rank text via an LLM. Consumed by the Dynamic Skill agent (ollama_local / gemini / openai_compatible adapters).",
    },
  });

  const audioGen = await prisma.capability.upsert({
    where: { key: "audio-generation" },
    update: {},
    create: {
      key: "audio-generation",
      label: "Audio generation",
      description: "Text-to-speech voiceover. Consumed by the Voice agent.",
    },
  });

  const existingImageDefault = await prisma.providerConfig.findFirst({
    where: { capabilityId: imageGen.id, scope: "global", isDefault: true },
  });
  if (!existingImageDefault) {
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

  const existingAudioDefault = await prisma.providerConfig.findFirst({
    where: { capabilityId: audioGen.id, scope: "global", isDefault: true },
  });
  if (!existingAudioDefault) {
    await prisma.providerConfig.create({
      data: {
        capabilityId: audioGen.id,
        providerType: "pyttsx3_local",
        name: "Local offline TTS (default)",
        authMode: "none",
        isDefault: true,
        scope: "global",
        status: "active",
      },
    });
  }
}
