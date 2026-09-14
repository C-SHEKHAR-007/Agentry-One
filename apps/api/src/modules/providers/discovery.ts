import { prisma } from "../../db/client.js";
import { decryptSecret } from "./crypto.js";

export interface DiscoveredModelInfo {
  modelId: string;
  name: string;
  description?: string;
  inputTypes: string[];
  outputTypes: string[];
  contextLength?: number;
  metadata?: Record<string, unknown>;
}

export async function discoverProviderModels(providerConfigId: string): Promise<DiscoveredModelInfo[]> {
  const provider = await prisma.providerConfig.findUnique({
    where: { id: providerConfigId },
    include: { capability: true },
  });

  if (!provider) {
    throw new Error("Provider configuration not found");
  }

  const secret = provider.encryptedSecret ? decryptSecret(provider.encryptedSecret) : "";
  const baseUrl = provider.baseUrl?.trim() || "";
  const providerType = provider.providerType.toLowerCase();

  let discovered: DiscoveredModelInfo[] = [];

  if (
    providerType.includes("openai") ||
    providerType.includes("groq") ||
    providerType.includes("mistral") ||
    providerType.includes("deepseek") ||
    providerType.includes("together") ||
    providerType.includes("vllm") ||
    providerType.includes("litellm")
  ) {
    discovered = await discoverOpenAICompatibleModels(baseUrl || "https://api.openai.com/v1", secret, providerType);
  } else if (providerType.includes("gemini") || providerType.includes("google")) {
    discovered = await discoverGeminiModels(
      baseUrl || "https://generativelanguage.googleapis.com/v1beta",
      secret,
    );
  } else if (providerType.includes("ollama")) {
    discovered = await discoverOllamaModels(baseUrl || "http://localhost:11434");
  } else if (providerType.includes("stability")) {
    discovered = await discoverStabilityModels(baseUrl || "https://api.stability.ai", secret);
  } else if (providerType.includes("anthropic")) {
    discovered = discoverAnthropicModels();
  } else {
    // Generic fallback or local model detection
    discovered = [
      {
        modelId: (provider.config as any)?.model || provider.name.toLowerCase().replace(/\s+/g, "-"),
        name: provider.name,
        inputTypes: ["text"],
        outputTypes: ["text"],
        metadata: { source: "manual_config" },
      },
    ];
  }

  // Persist discovered models into database
  for (const item of discovered) {
    await prisma.model.upsert({
      where: {
        providerConfigId_modelId: {
          providerConfigId: provider.id,
          modelId: item.modelId,
        },
      },
      create: {
        providerConfigId: provider.id,
        modelId: item.modelId,
        name: item.name,
        description: item.description,
        inputTypes: item.inputTypes,
        outputTypes: item.outputTypes,
        contextLength: item.contextLength,
        metadata: (item.metadata || {}) as object,
        isActive: true,
      },
      update: {
        name: item.name,
        description: item.description,
        inputTypes: item.inputTypes,
        outputTypes: item.outputTypes,
        contextLength: item.contextLength,
        metadata: (item.metadata || {}) as object,
      },
    });
  }

  await prisma.providerConfig.update({
    where: { id: provider.id },
    data: { lastDiscoveredAt: new Date() },
  });

  return discovered;
}

async function discoverOpenAICompatibleModels(
  baseUrl: string,
  secret: string,
  providerType: string,
): Promise<DiscoveredModelInfo[]> {
  const url = `${baseUrl.replace(/\/+$/, "")}/models`;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch models from ${url} (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { data?: Array<Record<string, any>> };
  const rawList = data.data || [];

  return rawList.map((m) => {
    const id = m.id || m.name || "unknown-model";
    let inputTypes = ["text"];
    let outputTypes = ["text"];
    let contextLength = m.context_length || m.max_context_length || m.max_tokens || 8192;

    const lower = id.toLowerCase();
    if (lower.includes("dall-e") || lower.includes("image") || lower.includes("flux") || lower.includes("diffusion") || lower.includes("midjourney")) {
      inputTypes = ["text"];
      outputTypes = ["image"];
    } else if (lower.includes("whisper") || lower.includes("transcribe")) {
      inputTypes = ["audio"];
      outputTypes = ["text", "json"];
    } else if (lower.includes("tts") || lower.includes("speech") || lower.includes("audio")) {
      inputTypes = ["text"];
      outputTypes = ["audio"];
    } else if (lower.includes("embed")) {
      inputTypes = ["text"];
      outputTypes = ["embedding"];
    } else if (lower.includes("sora") || lower.includes("video") || lower.includes("gen-2") || lower.includes("kling")) {
      inputTypes = ["text", "image"];
      outputTypes = ["video"];
    } else {
      // Vision enabled LLMs
      if (
        lower.includes("vision") ||
        lower.includes("gpt-4o") ||
        lower.includes("gpt-4-turbo") ||
        lower.includes("omni") ||
        lower.includes("claude-3") ||
        lower.includes("gemini") ||
        lower.includes("vl") ||
        lower.includes("qwen-vl")
      ) {
        inputTypes = ["text", "image"];
        outputTypes = ["text", "json"];
      } else {
        inputTypes = ["text"];
        outputTypes = ["text", "json"];
      }
    }

    if (!m.context_length) {
      if (lower.includes("128k") || lower.includes("gpt-4o") || lower.includes("claude-3") || lower.includes("llama-3.3") || lower.includes("llama-3.1")) {
        contextLength = 128000;
      } else if (lower.includes("1m") || lower.includes("gemini-1.5") || lower.includes("gemini-2.0")) {
        contextLength = 1000000;
      } else if (lower.includes("200k") || lower.includes("claude-3-5")) {
        contextLength = 200000;
      }
    }

    // Infer speed & throughput
    let speedEstimate = "";
    if (providerType.includes("groq")) {
      speedEstimate = "⚡ ~300-750 tok/s";
    } else if (providerType.includes("openai") || providerType.includes("together") || providerType.includes("mistral")) {
      speedEstimate = "⚡ ~70-120 tok/s";
    }

    const metadata: Record<string, any> = {
      raw: m,
      pricing: m.pricing,
      architecture: m.architecture,
      topProvider: m.top_provider,
      speedEstimate,
    };

    return {
      modelId: id,
      name: m.name || formatModelName(id),
      description: m.description || `Discovered from ${providerType} (${m.owned_by || "native"})`,
      inputTypes,
      outputTypes,
      contextLength,
      metadata,
    };
  });
}

async function discoverGeminiModels(baseUrl: string, apiKey: string): Promise<DiscoveredModelInfo[]> {
  const url = `${baseUrl.replace(/\/+$/, "")}/models?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch models from Gemini API (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as {
    models?: Array<{
      name: string;
      displayName?: string;
      description?: string;
      supportedGenerationMethods?: string[];
      inputTokenLimit?: number;
      outputTokenLimit?: number;
    }>;
  };

  const rawList = data.models || [];
  return rawList.map((m) => {
    // m.name is "models/gemini-1.5-pro" -> clean to "gemini-1.5-pro"
    const modelId = m.name.replace(/^models\//, "");
    let inputTypes = ["text"];
    let outputTypes = ["text"];

    const methods = m.supportedGenerationMethods || [];
    if (methods.includes("generateContent")) {
      if (modelId.includes("gemini-1.5") || modelId.includes("gemini-2.0") || modelId.includes("flash") || modelId.includes("pro")) {
        inputTypes = ["text", "image", "audio", "video"];
        outputTypes = ["text", "json"];
      } else {
        inputTypes = ["text", "image"];
        outputTypes = ["text", "json"];
      }
    } else if (methods.includes("embedContent")) {
      inputTypes = ["text"];
      outputTypes = ["embedding"];
    }

    if (modelId.includes("imagen")) {
      inputTypes = ["text"];
      outputTypes = ["image"];
    }

    return {
      modelId,
      name: m.displayName || formatModelName(modelId),
      description: m.description,
      inputTypes,
      outputTypes,
      contextLength: m.inputTokenLimit || 128000,
      metadata: { methods, outputTokenLimit: m.outputTokenLimit },
    };
  });
}

async function discoverOllamaModels(baseUrl: string): Promise<DiscoveredModelInfo[]> {
  const url = `${baseUrl.replace(/\/+$/, "")}/api/tags`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch models from Ollama (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as {
    models?: Array<{
      name: string;
      model: string;
      size: number;
      details?: {
        parent_model?: string;
        format?: string;
        family?: string;
        parameter_size?: string;
      };
    }>;
  };

  const rawList = data.models || [];
  return rawList.map((m) => {
    const id = m.name;
    const lower = id.toLowerCase();
    let inputTypes = ["text"];
    let outputTypes = ["text", "json"];

    if (lower.includes("llava") || lower.includes("vision") || lower.includes("moondream") || lower.includes("bakllava")) {
      inputTypes = ["text", "image"];
    }

    return {
      modelId: id,
      name: `${id} (${m.details?.parameter_size || Math.round(m.size / (1024 * 1024 * 1024)) + "GB"})`,
      description: `Local Ollama model: ${m.details?.family || "LLM"}`,
      inputTypes,
      outputTypes,
      contextLength: 8192,
      metadata: { ...m.details, sizeBytes: m.size },
    };
  });
}

async function discoverStabilityModels(baseUrl: string, apiKey: string): Promise<DiscoveredModelInfo[]> {
  return [
    {
      modelId: "sd3-medium",
      name: "Stable Diffusion 3 Medium",
      description: "Stability AI flagship text-to-image model",
      inputTypes: ["text"],
      outputTypes: ["image"],
      metadata: { provider: "stability_ai" },
    },
    {
      modelId: "sd3-large",
      name: "Stable Diffusion 3 Large",
      description: "High-fidelity photorealistic image generation",
      inputTypes: ["text"],
      outputTypes: ["image"],
      metadata: { provider: "stability_ai" },
    },
    {
      modelId: "stable-diffusion-xl-1024-v1-0",
      name: "SDXL 1.0",
      description: "1024x1024 native image generation",
      inputTypes: ["text"],
      outputTypes: ["image"],
      metadata: { provider: "stability_ai" },
    },
  ];
}

function discoverAnthropicModels(): DiscoveredModelInfo[] {
  return [
    {
      modelId: "claude-3-5-sonnet-20241022",
      name: "Claude 3.5 Sonnet",
      description: "Anthropic's most intelligent model with state-of-the-art reasoning and vision",
      inputTypes: ["text", "image"],
      outputTypes: ["text", "json"],
      contextLength: 200000,
      metadata: { provider: "anthropic" },
    },
    {
      modelId: "claude-3-opus-20240229",
      name: "Claude 3 Opus",
      description: "Top-level intelligence for highly complex tasks",
      inputTypes: ["text", "image"],
      outputTypes: ["text", "json"],
      contextLength: 200000,
      metadata: { provider: "anthropic" },
    },
    {
      modelId: "claude-3-5-haiku-20241022",
      name: "Claude 3.5 Haiku",
      description: "Fastest Claude model with near-instant responses",
      inputTypes: ["text", "image"],
      outputTypes: ["text", "json"],
      contextLength: 200000,
      metadata: { provider: "anthropic" },
    },
  ];
}

function formatModelName(modelId: string): string {
  return modelId
    .replace(/^models\//, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
