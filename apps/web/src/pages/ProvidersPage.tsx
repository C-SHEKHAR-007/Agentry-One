import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Bot, Compass, Cpu, Image as ImageIcon, Layers, Plus, Radio, Search, Server, Sparkles, Volume2, X } from "lucide-react";
import type { ProviderConfig } from "../models";
import { useCapabilitiesQuery } from "../features/agents/agents.api";
import {
  useDeleteModelMutation,
  useDeleteProviderMutation,
  useDiscoverModelsMutation,
  useProvidersQuery,
  useSetDefaultModelMutation,
  useSetDefaultProviderMutation,
} from "../features/providers/providers.api";
import { currentModelOf, filterProviders } from "../features/providers/filtering";
import { ProviderCard } from "../features/providers/components/ProviderCard";
import { RegisterProviderDialog } from "../features/providers/components/RegisterProviderDialog";
import { EditProviderDialog } from "../features/providers/components/EditProviderDialog";
import { AddModelDialog } from "../features/providers/components/AddModelDialog";
import { errorMessage } from "../services/http/errors";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/StatCard";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { ResponsiveTabs } from "../components/ui/responsive-tabs";

export function ProvidersPage() {
  const [selectedModality, setSelectedModality] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingProvider, setEditingProvider] = useState<ProviderConfig | null>(null);
  const [addModelForProvider, setAddModelForProvider] = useState<string | null>(null);
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});
  const [modelSearchQuery, setModelSearchQuery] = useState<Record<string, string>>({});

  const { data: capabilities } = useCapabilitiesQuery();
  const { data: providers, isLoading } = useProvidersQuery();

  const expand = (id: string) => setExpandedProviders((prev) => ({ ...prev, [id]: true }));
  const toggleProviderExpand = (id: string) => setExpandedProviders((prev) => ({ ...prev, [id]: !prev[id] }));
  const fail = (prefix = "") => (err: unknown) => toast.error(prefix + errorMessage(err));

  const [discover, discoverState] = useDiscoverModelsMutation();
  const discoverModels = (id: string) =>
    discover(id)
      .unwrap()
      .then((data) => {
        expand(id);
        toast.success(`Discovered ${data.count} models!`);
      })
      .catch(fail("Discovery failed: "));
  const [setDefault, setDefaultState] = useSetDefaultProviderMutation();
  const [setModel, setModelState] = useSetDefaultModelMutation();
  const [removeProvider, deleteProviderState] = useDeleteProviderMutation();
  const [removeModel, deleteModelState] = useDeleteModelMutation();

  // Stats
  const totalProviders = providers?.length || 0;
  const totalDiscoveredModels = useMemo(() => providers?.reduce((acc, p) => acc + (p.models?.length || 0), 0) || 0, [providers]);
  const defaultTextProvider = providers?.find((p) => p.capability?.key === "text-generation" && p.isDefault);
  const defaultTextModel = (defaultTextProvider && currentModelOf(defaultTextProvider)) || "None";

  // Providers per capability: default badges and buttons only matter when several compete.
  const capabilityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    providers?.forEach((p) => {
      const key = p.capability?.key || p.capability?.id || "unknown";
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [providers]);

  const filteredProviders = useMemo(
    () => (providers ? filterProviders(providers, selectedModality, searchQuery) : []),
    [providers, searchQuery, selectedModality],
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <PageHeader
        title="AI Providers"
        description="Connect hosted and local AI providers, discover their models, and pick the default for each capability."
        actions={
          <Button
            onClick={() => setShowAddModal(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Register AI Provider
          </Button>
        }
      />

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Server} label="Configured Providers" value={totalProviders} sub="Active AI endpoints & engines" />
        <StatCard icon={Layers} label="Available Models" value={totalDiscoveredModels} sub="Synced across all endpoints" color="hsl(var(--chart-3))" />
        <StatCard
          icon={Bot}
          label="Primary Text Model"
          value={<span className="block truncate font-mono text-base" title={defaultTextModel}>{defaultTextModel}</span>}
          sub={`Provider: ${defaultTextProvider?.name || "None set"}`}
          color="hsl(var(--chart-2))"
        />
        <StatCard icon={Sparkles} label="Capabilities Covered" value={capabilities?.length || 4} sub="Text, image, audio & search" color="hsl(var(--chart-4))" />
      </div>

      {/* Search & Modality Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-card/80 rounded-xl border border-border/60 shadow-sm backdrop-blur-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search providers, model IDs, endpoints..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs bg-background/60 border-border/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <ResponsiveTabs
          activeTab={selectedModality}
          onChange={setSelectedModality}
          tabs={[
            { id: "all", label: "All Modalities", icon: Layers },
            { id: "text", label: "Text", icon: Bot },
            { id: "image", label: "Image", icon: ImageIcon },
            { id: "audio", label: "Audio", icon: Volume2 },
            { id: "video", label: "Video", icon: Radio },
            { id: "search", label: "Search & Web", icon: Compass },
          ]}
        />
      </div>

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
      )}

      {/* Providers Cards List */}
      <div className="space-y-4">
        {filteredProviders.map((p) => (
          <ProviderCard
            key={p.id}
            p={p}
            isExpanded={Boolean(expandedProviders[p.id])}
            hasMultipleInCap={(capabilityCounts[p.capability?.key || p.capability?.id || ""] || 0) > 1}
            selectedModality={selectedModality}
            modelQuery={modelSearchQuery[p.id] || ""}
            onModelQuery={(q) => setModelSearchQuery({ ...modelSearchQuery, [p.id]: q })}
            pending={{
              discover: discoverState.isLoading,
              setDefault: setDefaultState.isLoading,
              delete: deleteProviderState.isLoading,
              defaultModel: setModelState.isLoading,
              deleteModel: deleteModelState.isLoading,
            }}
            on={{
              discover: () => discoverModels(p.id),
              edit: () => setEditingProvider(p),
              setDefault: () =>
                setDefault(p.id)
                  .unwrap()
                  .then(() => toast.success("Default provider updated"))
                  .catch(fail()),
              delete: () =>
                removeProvider(p.id)
                  .unwrap()
                  .then(() => toast.success("Provider deleted"))
                  .catch(fail()),
              toggle: () => toggleProviderExpand(p.id),
              addModel: () => setAddModelForProvider(p.id),
              setDefaultModel: (modelId) =>
                setModel({ providerId: p.id, modelId })
                  .unwrap()
                  .then(() => toast.success(`Default model set to "${modelId}"`))
                  .catch(fail()),
              deleteModel: (id) =>
                removeModel(id)
                  .unwrap()
                  .then(() => toast.success("Model removed"))
                  .catch(fail()),
            }}
          />
        ))}

      {filteredProviders.length === 0 && !isLoading && (
        <div className="p-12 text-center border border-dashed rounded-xl bg-card/30 space-y-3.5">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Cpu className="h-6 w-6" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-foreground">No Providers Found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `No providers or models matching "${searchQuery}". Try a different keyword.`
                : "Register your first AI provider to connect models for autonomous workflows."}
            </p>
          </div>
          <Button size="sm" onClick={() => setShowAddModal(true)} className="gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" /> Register AI Provider
          </Button>
        </div>
      )}
      </div>

      <RegisterProviderDialog open={showAddModal} onClose={() => setShowAddModal(false)} capabilities={capabilities} onCreated={expand} />
      <EditProviderDialog provider={editingProvider} onClose={() => setEditingProvider(null)} />
      <AddModelDialog providerId={addModelForProvider} onClose={() => setAddModelForProvider(null)} />
    </div>
  );
}
