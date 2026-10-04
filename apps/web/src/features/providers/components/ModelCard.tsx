import { Check, CircleDollarSign, Cpu, Layers, Star, Trash2, Zap } from "lucide-react";
import type { DiscoveredModel } from "../../../models";

type Meta = { speedEstimate?: string; parameter_size?: string; quantization_level?: string; format?: string; pricing?: { prompt?: string | number } };

/** One model of a provider: specs (inferred where the API has none), modalities, default and delete. */
export function ModelCard({
  m,
  providerType,
  isDefault,
  settingDefault,
  deleting,
  onSetDefault,
  onDelete,
  onEditPrices,
}: {
  m: DiscoveredModel;
  providerType: string;
  isDefault: boolean;
  settingDefault: boolean;
  deleting: boolean;
  onSetDefault: () => void;
  onDelete: () => void;
  onEditPrices: () => void;
}) {
  const metadata = (m.metadata ?? {}) as Meta;
  const lowerId = m.modelId.toLowerCase();

  // Infer Speed / Tokens per sec
  let speedText = metadata.speedEstimate || "";
  if (!speedText) {
    if (providerType.includes("groq") || lowerId.includes("groq")) {
      speedText = "⚡ ~300-750 tok/s";
    } else if (lowerId.includes("flash") || lowerId.includes("turbo") || lowerId.includes("mini") || lowerId.includes("haiku")) {
      speedText = "⚡ ~120-180 tok/s";
    } else if (providerType.includes("ollama")) {
      speedText = "⚡ Local Engine";
    }
  }

  // Infer Parameter Size
  let paramText = metadata.parameter_size || "";
  if (!paramText) {
    const paramMatch = lowerId.match(/(\d+b)/i);
    if (paramMatch) paramText = paramMatch[1].toUpperCase();
  }

  // Quantization / Format
  const quantText = metadata.quantization_level || (metadata.format ? `${metadata.format.toUpperCase()}` : "");

  // Pricing
  let pricingText = "";
  const fmt = (n: number) => `$${Number(n.toFixed(4))}`;
  if (m.inputPricePerMTok != null || m.outputPricePerMTok != null) {
    pricingText = `${fmt(m.inputPricePerMTok ?? 0)} / ${fmt(m.outputPricePerMTok ?? 0)} per 1M`;
  } else if (metadata.pricing?.prompt) {
    const promptCost = (Number(metadata.pricing.prompt) * 1000000).toFixed(2);
    pricingText = `$${promptCost}/1M in`;
  } else if (providerType.includes("ollama") || providerType.includes("duckduckgo") || providerType.includes("pyttsx3") || providerType.includes("sd_turbo")) {
    pricingText = "Free / Local";
  }

  return (
    <div
      className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between space-y-2.5 shadow-2xs ${
        isDefault
          ? "border-primary/80 bg-primary/5 ring-1 ring-primary/30 shadow-xs"
          : "border-border/50 bg-card/70 hover:bg-card hover:border-border/90"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-xs text-foreground truncate" title={m.name}>
            {m.name}
          </div>
          <div className="font-mono text-[11px] text-muted-foreground truncate select-all" title={m.modelId}>
            {m.modelId}
          </div>
        </div>

        {/* Compact Top-Right Default Button / Indicator & Delete */}
        <div className="shrink-0 flex items-center gap-1.5">
          {isDefault ? (
            <span
              title="Active Default Model"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-success bg-success/15 px-2 py-0.5 rounded-full border border-success/30"
            >
              <Check className="h-2.5 w-2.5" /> Default
            </span>
          ) : (
            <button
              type="button"
              title="Set as active default model"
              onClick={onSetDefault}
              disabled={settingDefault}
              className="px-2 py-0.5 rounded text-[11px] font-medium text-muted-foreground hover:text-warning hover:bg-warning/10 transition-colors border border-border/40 hover:border-warning/30 flex items-center gap-1"
            >
              <Star className="h-3 w-3" />
              <span>Set</span>
            </button>
          )}
          <button
            type="button"
            title="Token prices"
            aria-label={`Token prices for ${m.name || m.modelId}`}
            onClick={onEditPrices}
            className="p-1 rounded text-muted-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <CircleDollarSign className="h-3 w-3" />
          </button>
          <button
            type="button"
            title="Delete model"
            aria-label={`Delete model ${m.name || m.modelId}`}
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Remove model "${m.name || m.modelId}" from this provider?`)) {
                onDelete();
              }
            }}
            disabled={deleting}
            className="p-1 rounded text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Specs Strip (Context window, Speed, Params, Pricing) */}
      <div className="flex items-center gap-1.5 flex-wrap text-[11px] pt-1">
        {m.contextLength ? (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary/80 text-foreground font-mono text-[11px] border border-border/40"
            title={`Context Window: ${m.contextLength.toLocaleString()} tokens`}
          >
            <Layers className="h-2.5 w-2.5 text-primary" />
            {m.contextLength >= 1000000
              ? `${(m.contextLength / 1000000).toFixed(1)}M ctx`
              : `${Math.round(m.contextLength / 1000)}k ctx`}
          </span>
        ) : null}

        {speedText ? (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-warning/10 text-warning font-medium text-[11px] border border-warning/20"
            title="Inference Throughput"
          >
            <Zap className="h-2.5 w-2.5 fill-current" />
            {speedText}
          </span>
        ) : null}

        {paramText ? (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium text-[11px] border border-primary/20"
            title="Model Parameters"
          >
            <Cpu className="h-2.5 w-2.5" />
            {paramText}
          </span>
        ) : null}

        {quantText ? (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-mono text-[11px] border border-border/30"
            title="Format & Quantization"
          >
            {quantText}
          </span>
        ) : null}

        {pricingText ? (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-success/10 text-success font-mono text-[11px] border border-success/20"
            title="Cost Tier"
          >
            {pricingText}
          </span>
        ) : null}
      </div>

      {/* Modalities & Context Footer */}
      <div className="space-y-1.5 pt-2 border-t border-border/30 text-[11px]">
        {m.inputTypes && m.inputTypes.length > 0 && (
          <div className="flex items-center justify-between gap-1">
            <span className="text-muted-foreground font-medium">Input:</span>
            <div className="flex flex-wrap gap-1 justify-end">
              {m.inputTypes.map((t) => (
                <span
                  key={t}
                  className="px-1.5 py-0.5 rounded bg-secondary/80 text-foreground font-medium capitalize text-[11px] border border-border/40"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {m.outputTypes && m.outputTypes.length > 0 && (
          <div className="flex items-center justify-between gap-1">
            <span className="text-muted-foreground font-medium">Output:</span>
            <div className="flex flex-wrap gap-1 justify-end">
              {m.outputTypes.map((t) => (
                <span
                  key={t}
                  className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium capitalize text-[11px] border border-primary/20"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
