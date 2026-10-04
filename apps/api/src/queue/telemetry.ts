import { prisma } from "../db/client.js";

/** What a worker reports about the model calls one attempt made
 * (result.metrics.usage, see python/sdk/telemetry.py). */
export interface RunUsage {
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
}

const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const count = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null;

/** Validates a worker-reported usage object. Anything malformed is dropped
 * field by field rather than failing the job over telemetry. */
export function parseUsage(raw: unknown): RunUsage | null {
  if (!raw || typeof raw !== "object") return null;
  const u = raw as Record<string, unknown>;
  const usage: RunUsage = {
    model: typeof u.model === "string" && u.model.trim() ? u.model.trim().slice(0, 200) : null,
    inputTokens: count(u.inputTokens),
    outputTokens: count(u.outputTokens),
  };
  return usage.model || usage.inputTokens !== null || usage.outputTokens !== null ? usage : null;
}

export type ProgressMessage =
  | { kind: "progress"; percent?: number; message?: string }
  | { kind: "log"; level: LogLevel; message: string }
  | { kind: "usage"; usage: RunUsage };

/** Workers use BullMQ's progress channel for three things: progress ticks
 * ({percent, message}), log lines ({log: {level, message}}) and, when an
 * attempt fails, the usage it had accumulated ({usage}). */
export function classifyProgress(data: unknown): ProgressMessage {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  if (d.log && typeof d.log === "object") {
    const log = d.log as Record<string, unknown>;
    const level = LOG_LEVELS.includes(log.level as LogLevel) ? (log.level as LogLevel) : "info";
    return { kind: "log", level, message: String(log.message ?? "").slice(0, 4000) };
  }
  if (d.usage) {
    const usage = parseUsage(d.usage);
    if (usage) return { kind: "usage", usage };
  }
  return {
    kind: "progress",
    percent: typeof d.percent === "number" ? d.percent : undefined,
    message: typeof d.message === "string" ? d.message : undefined,
  };
}

/** The per-job price configured for a provider type (Cost Monitor pricing),
 * or null when the job has no provider. */
/** A model's token prices in USD per million tokens: its own prices if set,
 * else the per-token prices the provider reported at discovery (OpenRouter
 * gives `pricing.prompt` / `pricing.completion` in USD per token). */
export function tokenRates(model: {
  inputPricePerMTok: number | null;
  outputPricePerMTok: number | null;
  metadata: unknown;
} | null): { input: number; output: number } | null {
  if (!model) return null;
  if (model.inputPricePerMTok !== null || model.outputPricePerMTok !== null) {
    return { input: model.inputPricePerMTok ?? 0, output: model.outputPricePerMTok ?? 0 };
  }
  const pricing = (model.metadata as { pricing?: { prompt?: unknown; completion?: unknown } } | null)?.pricing;
  const perToken = (v: unknown) => (v === undefined || v === null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
  const input = perToken(pricing?.prompt);
  const output = perToken(pricing?.completion);
  if (input === null && output === null) return null;
  return { input: (input ?? 0) * 1_000_000, output: (output ?? 0) * 1_000_000 };
}

/** USD for one attempt's tokens at the given rates. */
export function tokenCost(rates: { input: number; output: number }, inputTokens: number, outputTokens: number): number {
  return Math.round(((inputTokens * rates.input + outputTokens * rates.output) / 1_000_000) * 1e8) / 1e8;
}

/** What a finished attempt cost: by tokens when it reported them and its
 * model has token prices, else the provider's flat per-job price. */
export async function priceAttempt(
  job: { providerConfigId: string | null; providerType: string | null },
  model: string | null,
  usage: RunUsage | null,
): Promise<number | null> {
  if (job.providerConfigId && model && usage && (usage.inputTokens !== null || usage.outputTokens !== null)) {
    const row = await prisma.model.findUnique({
      where: { providerConfigId_modelId: { providerConfigId: job.providerConfigId, modelId: model } },
      select: { inputPricePerMTok: true, outputPricePerMTok: true, metadata: true },
    });
    const rates = tokenRates(row);
    if (rates) return tokenCost(rates, usage.inputTokens ?? 0, usage.outputTokens ?? 0);
  }
  return perJobPrice(job.providerType);
}

export async function perJobPrice(providerType: string | null): Promise<number | null> {
  if (!providerType) return null;
  const setting = await prisma.setting.findFirst({ where: { scope: "global", key: `pricing.${providerType}` } });
  const v = setting?.value as { perJobUsd?: unknown } | undefined;
  return typeof v?.perJobUsd === "number" ? v.perJobUsd : 0;
}

export function formatMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : ms < 60_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

/** One human-readable line summarising a finished attempt. */
export function completionLine(durationMs: number | null, usage: RunUsage | null, artifacts: number): string {
  const parts = [durationMs !== null ? `Completed in ${formatMs(durationMs)}` : "Completed"];
  if (usage?.model) parts.push(`on ${usage.model}`);
  const tokens = (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0);
  if (tokens > 0) parts.push(`${tokens.toLocaleString("en-US")} tokens`);
  parts.push(`${artifacts} artifact${artifacts === 1 ? "" : "s"}`);
  return parts.join(" · ");
}
