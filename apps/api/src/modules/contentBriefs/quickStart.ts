import { prisma } from "../../db/client.js";
import { createTemplate, runTemplate, TemplateError } from "../templates/service.js";
import type { InputMapping, TemplateStepInput } from "../templates/types.js";

const WRITER_AGENT_ID = "content-brief-writer";
const VALID_FORMATS = ["text", "image", "voice", "video"] as const;
type Format = (typeof VALID_FORMATS)[number];

export class ContentBriefError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
  }
}

/** The one built-in Dynamic Skill every Content Brief uses to draft its
 * caption -- auto-provisioned the same way ensureCapabilitiesAndDefaults
 * seeds a default provider, so a fresh install works without the operator
 * manually creating a skill first (see /agents/custom for the general
 * user-created-skill path this borrows its shape from). */
async function ensureWriterAgent(): Promise<void> {
  const existing = await prisma.agent.findUnique({ where: { id: WRITER_AGENT_ID } });
  if (existing) return;

  const manifest = {
    id: WRITER_AGENT_ID,
    name: "Content Brief Writer",
    version: "1.0",
    description: "Built-in skill the Content Studio uses to draft a caption from a topic + tone.",
    entrypoint: { queueName: "agent.dynamic" },
    steps: [
      {
        key: "run",
        description: "Draft a caption",
        requiresCapability: "text-generation",
        humanGate: false,
        inputSchema: {
          type: "object",
          required: ["topic"],
          properties: {
            topic: { type: "string" },
            tone: { type: "string" },
          },
        },
        outputSchema: { type: "object", properties: { text: { type: "string" } } },
        producesArtifactKinds: ["text"],
        ui_config: {
          system_prompt:
            "Write a short, engaging social media caption about: {{topic}}. Tone: {{tone}}. " +
            "Keep it under 280 characters. No hashtags unless they read naturally.",
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

/** Translates a Content Studio brief into the step list for an ordinary
 * Template -- text/image start immediately (no dependencies), voice depends
 * on text, video depends on image (+ voice, if requested) + text (for its
 * caption). Pure (no DB access) so it's unit-testable on its own; all
 * execution (including the parallel/branching scheduling) goes through the
 * same generic Template engine every hand-built template uses
 * (templates/service.ts). */
export function buildBriefSteps(
  topic: string,
  tone: string | undefined,
  formats: string[],
): { steps: TemplateStepInput[]; requested: Format[] } {
  const requested = formats.filter((f): f is Format => (VALID_FORMATS as readonly string[]).includes(f));
  if (requested.length === 0) {
    throw new ContentBriefError(`formats must include at least one of: ${VALID_FORMATS.join(", ")}`, 422);
  }
  if (!topic?.trim()) {
    throw new ContentBriefError("topic is required", 422);
  }

  const wantsText = requested.some((f) => f === "text" || f === "voice" || f === "video");
  const wantsImage = requested.some((f) => f === "image" || f === "video");
  const wantsVoice = requested.some((f) => f === "voice" || f === "video");
  const wantsVideo = requested.includes("video");

  const steps: TemplateStepInput[] = [];
  const orderOf: Partial<Record<Format, number>> = {};
  const nextOrder = () => steps.length;

  if (wantsText) {
    orderOf.text = nextOrder();
    steps.push({
      stepOrder: orderOf.text,
      agentId: WRITER_AGENT_ID,
      agentStepKey: "run",
      inputMapping: { topic: fromRunInput("topic"), tone: fromRunInput("tone") },
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

  return { steps, requested };
}

export async function createContentBriefTemplate(
  projectId: string,
  topic: string,
  tone: string | undefined,
  formats: string[],
) {
  const { steps, requested } = buildBriefSteps(topic, tone, formats);

  await ensureWriterAgent();

  const name = `Brief: ${topic.slice(0, 40)}${topic.length > 40 ? "…" : ""} — ${new Date().toISOString().slice(0, 10)}`;

  let template;
  try {
    template = await createTemplate(projectId, name, `Generated from the Content Studio brief form (formats: ${requested.join(", ")}).`, steps);
  } catch (err) {
    if (err instanceof TemplateError) throw new ContentBriefError(err.message, err.statusCode);
    throw err;
  }

  const runInputs: Record<string, unknown> = {
    topic,
    tone: tone || "friendly and engaging",
    imagePrompt: tone ? `${topic}, ${tone} style` : topic,
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
