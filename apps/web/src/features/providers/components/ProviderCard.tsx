import {
  ChevronDown,
  ChevronUp,
  Cpu,
  Globe,
  KeyRound,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import type { DiscoveredModel, ProviderConfig } from "../../../models";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { currentModelOf, filterModels } from "../filtering";
import { ModelCard } from "./ModelCard";
import { ProviderIcon } from "./ProviderIcon";

export interface ProviderCardActions {
  discover: () => void;
  edit: () => void;
  setDefault: () => void;
  delete: () => void;
  toggle: () => void;
  addModel: () => void;
  setDefaultModel: (modelId: string) => void;
  deleteModel: (id: string) => void;
  editModelPrices: (model: DiscoveredModel) => void;
}

/** A configured provider: identity, actions, and its models drawer. */
export function ProviderCard({
  p,
  isExpanded,
  hasMultipleInCap,
  selectedModality,
  modelQuery,
  onModelQuery,
  pending,
  on,
}: {
  p: ProviderConfig;
  isExpanded: boolean;
  /** Other providers serve the same capability, so "default" means something. */
  hasMultipleInCap: boolean;
  selectedModality: string;
  modelQuery: string;
  onModelQuery: (q: string) => void;
  pending: { discover: boolean; setDefault: boolean; delete: boolean; defaultModel: boolean; deleteModel: boolean };
  on: ProviderCardActions;
}) {
  const currentDefaultModel = currentModelOf(p);
  const totalModelsCount = p.models?.length || 0;
  const modelsList = filterModels(p.models || [], modelQuery, selectedModality);

  return (
    <div
      className="rounded-lg border border-border/70 bg-card overflow-hidden hover:border-primary/40 transition-all duration-200"
    >
      {/* Top Card Row */}
      <div className="p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left: Identity & Badges */}
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="h-11 w-11 shrink-0 rounded-xl bg-secondary/80 border border-border/60 flex items-center justify-center shadow-xs">
              <ProviderIcon providerType={p.providerType} capKey={p.capability?.key} />
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-foreground tracking-tight truncate">{p.name}</h3>

                {hasMultipleInCap && p.isDefault && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-warning bg-warning/10 px-2 py-0.5 rounded-full border border-warning/20">
                    <Star className="h-3 w-3 fill-current" /> Active {p.capability?.label || "Default"}
                  </span>
                )}

                <Badge variant="secondary" className="text-[11px] font-medium">
                  {p.capability?.label || p.capability?.key}
                </Badge>

                {p.hasSecret ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-full border border-success/20">
                    <KeyRound className="h-2.5 w-2.5" /> Key Configured
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-chart-3 bg-chart-3/10 px-2 py-0.5 rounded-full border border-chart-3/20">
                    <ShieldCheck className="h-2.5 w-2.5" /> Local / Public
                  </span>
                )}
              </div>

              {/* Subtitle / Metadata details */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap pt-0.5">
                <span className="font-mono text-[11px] text-foreground/80 bg-secondary/50 px-1.5 py-0.5 rounded">
                  {p.providerType}
                </span>

                {p.baseUrl && (
                  <span className="font-mono text-[11px] truncate max-w-sm text-muted-foreground flex items-center gap-1">
                    <Globe className="h-3 w-3 text-primary" /> {p.baseUrl}
                  </span>
                )}

                <span className="text-[11px] text-muted-foreground">
                  {totalModelsCount} models discovered
                </span>
              </div>
            </div>
          </div>

          {/* Right: Actions Cluster */}
          <div className="flex items-center gap-1.5 shrink-0 self-end md:self-auto">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5 border-border/60 hover:border-primary/40"
              onClick={on.discover}
              disabled={pending.discover}
              title="Sync / Discover Models from Endpoint"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${pending.discover ? "animate-spin text-primary" : ""}`} />
              <span>Sync</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5 border-border/60 hover:border-primary/40"
              onClick={on.edit}
              title="Edit Provider Settings"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit</span>
            </Button>

            {hasMultipleInCap && !p.isDefault && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-muted-foreground hover:text-warning hover:bg-warning/10"
                onClick={on.setDefault}
                disabled={pending.setDefault}
                title={`Set as default provider for ${p.capability?.label || "this capability"}`}
              >
                <Star className="h-3.5 w-3.5 mr-1" />
                <span className="hidden sm:inline">Set Default</span>
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={on.delete}
              disabled={pending.delete}
              title="Delete Provider"
              aria-label={`Delete provider ${p.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Bottom Model Summary & Expand Trigger Bar */}
        <div className="mt-4 pt-3 border-t border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Active Model:</span>
            {currentDefaultModel ? (
              <span className="font-mono text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" /> {currentDefaultModel}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground italic">No default model selected</span>
            )}
          </div>

          <Button
            size="sm"
            variant={isExpanded ? "secondary" : "outline"}
            className="h-7 text-xs gap-1.5 font-medium self-start sm:self-auto border-border/60"
            onClick={on.toggle}
          >
            <Layers className="h-3.5 w-3.5 text-primary" />
            <span>{isExpanded ? "Hide Models" : `View Available Models (${totalModelsCount})`}</span>
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5 ml-0.5" /> : <ChevronDown className="h-3.5 w-3.5 ml-0.5" />}
          </Button>
        </div>
      </div>

      {/* Models Drawer (Hidden by default, smooth expand on click) */}
      {isExpanded && (
        <div className="border-t border-border/50 bg-secondary/25 p-4 sm:p-5 space-y-3.5">
          {/* Models Filter / Search Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Cpu className="h-4 w-4 text-primary" />
                Available Models
              </span>
              <span className="text-[11px] text-muted-foreground">
                ({modelsList.length} of {totalModelsCount} showing)
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                onClick={on.addModel}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Model</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5 border-border/60"
                onClick={on.discover}
                disabled={pending.discover}
                title="Auto-discover models from API"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-primary ${pending.discover ? "animate-spin" : ""}`} />
                <span>Discover</span>
              </Button>
              {totalModelsCount > 6 && (
                <div className="relative w-full sm:w-48">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Filter list..."
                    value={modelQuery}
                    onChange={(e) => onModelQuery(e.target.value)}
                    className="h-8 pl-8 text-xs bg-card/80 border-border/50"
                  />
                </div>
              )}
            </div>
          </div>

          {modelsList.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[460px] overflow-y-auto pr-1 scrollbar-thin">
                          {modelsList.map((m) => (
                            <ModelCard
                              key={m.id}
                              m={m}
                              providerType={p.providerType}
                              isDefault={currentDefaultModel === m.modelId}
                              settingDefault={pending.defaultModel}
                              deleting={pending.deleteModel}
                              onSetDefault={() => on.setDefaultModel(m.modelId)}
                              onDelete={() => on.deleteModel(m.id)}
                              onEditPrices={() => on.editModelPrices(m)}
                            />
                          ))}
            </div>
          ) : (
            <div className="p-8 text-center border border-dashed rounded-xl bg-card/40 space-y-2">
              <p className="text-xs text-muted-foreground">
                {totalModelsCount === 0
                  ? "No models discovered for this endpoint yet."
                  : "No models match your search filter."}
              </p>
              {totalModelsCount === 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={on.discover}
                  disabled={pending.discover}
                  className="h-8 text-xs gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-primary" />
                  Discover Models Now
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
