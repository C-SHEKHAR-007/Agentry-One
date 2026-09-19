import { prisma } from "../../db/client.js";

/** Seeds the capability enum and zero-config local default providers
 * per capability, so existing and new agents keep working without any operator setup. */
export async function ensureCapabilitiesAndDefaults(): Promise<void> {
  const imageGen = await prisma.capability.upsert({
    where: { key: "image-generation" },
    update: {},
    create: { key: "image-generation", label: "Image generation", description: "Generate an image from a text prompt." },
  });

  const textGen = await prisma.capability.upsert({
    where: { key: "text-generation" },
    update: {},
    create: {
      key: "text-generation",
      label: "Text generation",
      description: "Generate/re-rank text via an LLM. Consumed by dynamic agents and copywriting skills.",
    },
  });

  const audioGen = await prisma.capability.upsert({
    where: { key: "audio-generation" },
    update: {},
    create: {
      key: "audio-generation",
      label: "Audio generation",
      description: "Text-to-speech voiceover and audio synthesis.",
    },
  });

  const webSearch = await prisma.capability.upsert({
    where: { key: "web-search" },
    update: {},
    create: {
      key: "web-search",
      label: "Web Search & Trends",
      description: "Search the web, news, and trending topics across domains.",
    },
  });

  const videoGen = await prisma.capability.upsert({
    where: { key: "video-generation" },
    update: {},
    create: {
      key: "video-generation",
      label: "Video & Reel generation",
      description: "Synthesize vertical reels, short videos with text, audio, and visual overlays.",
    },
  });

  const existingImageDefault = await prisma.providerConfig.findFirst({
    where: { capabilityId: imageGen.id, scope: "global", isDefault: true },
  });
  if (!existingImageDefault) {
    const p = await prisma.providerConfig.create({
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
    await prisma.model.upsert({
      where: { providerConfigId_modelId: { providerConfigId: p.id, modelId: "stabilityai/sd-turbo" } },
      create: {
        providerConfigId: p.id,
        modelId: "stabilityai/sd-turbo",
        name: "SD-Turbo Local",
        description: "Zero-latency real-time text-to-image synthesis",
        inputTypes: ["text"],
        outputTypes: ["image"],
      },
      update: {},
    });
  }

  const existingTextDefault = await prisma.providerConfig.findFirst({
    where: { capabilityId: textGen.id, scope: "global", isDefault: true },
  });
  if (!existingTextDefault) {
    const p = await prisma.providerConfig.create({
      data: {
        capabilityId: textGen.id,
        providerType: "ollama_local",
        name: "Local Ollama (default)",
        authMode: "none",
        isDefault: true,
        scope: "global",
        status: "active",
      },
    });
    await prisma.model.upsert({
      where: { providerConfigId_modelId: { providerConfigId: p.id, modelId: "qwen3:8b" } },
      create: {
        providerConfigId: p.id,
        modelId: "qwen3:8b",
        name: "Qwen 3 (8B) Local",
        description: "Local text generation model",
        inputTypes: ["text"],
        outputTypes: ["text", "json"],
      },
      update: {},
    });
  }

  const existingAudioDefault = await prisma.providerConfig.findFirst({
    where: { capabilityId: audioGen.id, scope: "global", isDefault: true },
  });
  if (!existingAudioDefault) {
    const p = await prisma.providerConfig.create({
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
    await prisma.model.upsert({
      where: { providerConfigId_modelId: { providerConfigId: p.id, modelId: "pyttsx3-engine" } },
      create: {
        providerConfigId: p.id,
        modelId: "pyttsx3-engine",
        name: "Offline TTS Engine",
        description: "Built-in local speech synthesis",
        inputTypes: ["text"],
        outputTypes: ["audio"],
      },
      update: {},
    });
  }

  const existingSearchDefault = await prisma.providerConfig.findFirst({
    where: { capabilityId: webSearch.id, scope: "global", isDefault: true },
  });
  if (!existingSearchDefault) {
    const p = await prisma.providerConfig.create({
      data: {
        capabilityId: webSearch.id,
        providerType: "duckduckgo_free",
        name: "DuckDuckGo Web Search (Free)",
        authMode: "none",
        isDefault: true,
        scope: "global",
        status: "active",
      },
    });
    await prisma.model.upsert({
      where: { providerConfigId_modelId: { providerConfigId: p.id, modelId: "ddg-search" } },
      create: {
        providerConfigId: p.id,
        modelId: "ddg-search",
        name: "DuckDuckGo Live Trends & News",
        description: "Free real-time web and trend search engine",
        inputTypes: ["query"],
        outputTypes: ["text", "json"],
      },
      update: {},
    });
  }
}

