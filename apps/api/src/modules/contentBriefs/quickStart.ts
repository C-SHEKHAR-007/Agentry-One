import { prisma } from "../../db/client.js";
import { createTemplate, runTemplate, TemplateError } from "../templates/service.js";
import type { InputMapping, TemplateStepInput } from "../templates/types.js";

const WRITER_AGENT_ID = "content-brief-writer";
const VALID_FORMATS = ["search", "text", "image", "voice", "video", "publish"] as const;
type Format = (typeof VALID_FORMATS)[number];

export class ContentBriefError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
  }
}

async function ensureWriterAgent(): Promise<void> {
  const existing = await prisma.agent.findUnique({ where: { id: WRITER_AGENT_ID } });
  if (existing) return;

  const manifest = {
    id: WRITER_AGENT_ID,
    name: "Content Brief Writer",
    version: "1.0",
    description: "Multi-modal copywriter that drafts engaging captions, hashtags, and visual prompts from research or topics.",
    entrypoint: { queueName: "agent.dynamic" },
    steps: [
      {
        key: "run",
        description: "Draft viral social media caption and image prompt",
        requiresCapability: "text-generation",
        humanGate: false,
        inputSchema: {
          type: "object",
          required: ["topic"],
          properties: {
            topic: { type: "string" },
            tone: { type: "string" },
            research_brief: { type: "string" },
          },
        },
        outputSchema: { type: "object", properties: { text: { type: "string" } } },
        producesArtifactKinds: ["text"],
        ui_config: {
          system_prompt:
            "You are an elite Social Media Copywriter and Creative Director. " +
            "Based on the following topic and trend research, draft a high-converting, viral Instagram post caption with engaging hooks, emojis, and 5-8 relevant hashtags. " +
            "Topic: {{topic}}. Tone: {{tone}}. \n\nResearch context: {{research_brief}}",
        },
      },
    ],
  };

  await prisma.agent.create({
    data: {
      id: WRITER_AGENT_ID,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      manifest: manifest as object,
      status: "active",
    },
  });
}

function fromRunInput(field: string): InputMapping[string] {
  return { kind: "fromRunInput", field };
}
function fromStep(stepOrder: number, artifactKind: string): InputMapping[string] {
  return { kind: "fromStep", stepOrder, artifactKind };
}

export function buildBriefSteps(
  topic: string,
  tone: string | undefined,
  formats: string[],
  socialAccountId?: string,
): { steps: TemplateStepInput[]; requested: Format[] } {
  const requested = formats.filter((f): f is Format => (VALID_FORMATS as readonly string[]).includes(f));
  if (requested.length === 0) {
    throw new ContentBriefError(`formats must include at least one of: ${VALID_FORMATS.join(", ")}`, 422);
  }
  if (!topic?.trim()) {
    throw new ContentBriefError("topic is required", 422);
  }

  const wantsSearch = requested.includes("search");
  const wantsText = requested.some((f) => f === "text" || f === "voice" || f === "video" || f === "publish");
  const wantsImage = requested.some((f) => f === "image" || f === "video" || f === "publish");
  const wantsVoice = requested.some((f) => f === "voice" || f === "video");
  const wantsVideo = requested.includes("video");
  const wantsPublish = requested.includes("publish") && Boolean(socialAccountId);

  const steps: TemplateStepInput[] = [];
  const orderOf: Partial<Record<Format, number>> = {};
  const nextOrder = () => steps.length;

  if (wantsSearch) {
    orderOf.search = nextOrder();
    steps.push({
      stepOrder: orderOf.search,
      agentId: "web-search-agent",
      agentStepKey: "search",
      inputMapping: { query: fromRunInput("topic") },
    });
  }

  if (wantsText) {
    orderOf.text = nextOrder();
    const textMapping: InputMapping = {
      topic: fromRunInput("topic"),
      tone: fromRunInput("tone"),
    };
    if (wantsSearch) {
      textMapping.research_brief = fromStep(orderOf.search!, "text");
    }
    steps.push({
      stepOrder: orderOf.text,
      agentId: WRITER_AGENT_ID,
      agentStepKey: "run",
      inputMapping: textMapping,
    });
  }

  if (wantsImage) {
    orderOf.image = nextOrder();
    steps.push({
      stepOrder: orderOf.image,
      agentId: "sketch-agent",
      agentStepKey: "generate",
      inputMapping: { prompt: fromRunInput("imagePrompt") },
    });
  }

  if (wantsVoice) {
    orderOf.voice = nextOrder();
    steps.push({
      stepOrder: orderOf.voice,
      agentId: "voice-agent",
      agentStepKey: "generate",
      inputMapping: { text: fromStep(orderOf.text!, "text") },
    });
  }

  if (wantsVideo) {
    orderOf.video = nextOrder();
    const videoMapping: InputMapping = {
      imagePath: fromStep(orderOf.image!, "image"),
      caption: fromStep(orderOf.text!, "text"),
    };
    if (wantsVoice) videoMapping.audioPath = fromStep(orderOf.voice!, "audio");
    steps.push({ stepOrder: orderOf.video, agentId: "video-agent", agentStepKey: "assemble", inputMapping: videoMapping });
  }

  if (wantsPublish) {
    orderOf.publish = nextOrder();
    const publishMapping: InputMapping = {
      socialAccountId: fromRunInput("socialAccountId"),
      text: fromStep(orderOf.text!, "text"),
    };
    if (wantsImage) {
      publishMapping.mediaUrl = fromStep(orderOf.image!, "image");
    }
    steps.push({
      stepOrder: orderOf.publish,
      agentId: "social-publisher",
      agentStepKey: "run",
      inputMapping: publishMapping,
    });
  }

  return { steps, requested };
}

export async function createContentBriefTemplate(
  projectId: string,
  topic: string,
  tone: string | undefined,
  formats: string[],
  socialAccountId?: string,
) {
  const { steps, requested } = buildBriefSteps(topic, tone, formats, socialAccountId);

  await ensureWriterAgent();

  const name = `Brief: ${topic.slice(0, 40)}${topic.length > 40 ? "…" : ""} — ${new Date().toISOString().slice(0, 10)}`;

  let template;
  try {
    template = await createTemplate(projectId, name, `Multi-agent pipeline (steps: ${requested.join(" -> ")}).`, steps);
  } catch (err) {
    if (err instanceof TemplateError) throw new ContentBriefError(err.message, err.statusCode);
    throw err;
  }

  const runInputs: Record<string, unknown> = {
    topic,
    tone: tone || "engaging, trendy and viral",
    imagePrompt: tone ? `${topic}, ${tone} style, high quality photography, vibrant colors` : `${topic}, modern digital artwork, ultra-detailed`,
    socialAccountId: socialAccountId || undefined,
  };

  let run;
  try {
    run = await runTemplate(template.id, runInputs);
  } catch (err) {
    if (err instanceof TemplateError) throw new ContentBriefError(err.message, err.statusCode);
    throw err;
  }

  return { templateId: template.id, runId: run.id };
}

