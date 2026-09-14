import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  KeyRound,
  Plus,
  Star,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle2,
  Pencil,
  X,
  Cpu,
  Check,
  Globe,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Zap,
  ShieldCheck,
  Eye,
  EyeOff,
  Bot,
  Layers,
  Image as ImageIcon,
  Volume2,
  Radio,
  SlidersHorizontal,
  Compass,
} from "lucide-react";
import { api } from "../api/client.js";
import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { Spinner } from "../components/ui/spinner";

interface Capability {
  id: string;
  key: string;
  label: string;
  description: string;
}

interface DiscoveredModel {
  id: string;
  providerConfigId: string;
  modelId: string;
  name: string;
  description?: string;
  inputTypes: string[];
  outputTypes: string[];
  contextLength?: number;
  metadata?: Record<string, any>;
  isActive: boolean;
  providerConfig?: {
    id: string;
    name: string;
    providerType: string;
    capability: { key: string; label: string };
  };
}

interface ProviderConfig {
  id: string;
  providerType: string;
  name: string;
  baseUrl?: string;
  config?: Record<string, unknown>;
  isDefault: boolean;
  scope: string;
  status: string;
  hasSecret: boolean;
  lastDiscoveredAt?: string;
  capability: Capability;
  models?: DiscoveredModel[];
}

const PRESET_TEMPLATES = [
  { label: "Google Gemini 1.5", cap: "text-generation", type: "gemini", name: "Google Gemini Cloud", model: "gemini-1.5-pro", url: "https://generativelanguage.googleapis.com/v1beta", icon: "✨" },
  { label: "OpenAI GPT-4o", cap: "text-generation", type: "openai_compatible", name: "OpenAI Cloud", model: "gpt-4o", url: "https://api.openai.com/v1", icon: "🤖" },
  { label: "Ollama (Qwen 3 / Local)", cap: "text-generation", type: "ollama_local", name: "Local Ollama Engine", model: "qwen3:8b", url: "http://localhost:11434", icon: "🦙" },
  { label: "Groq Cloud (Ultra Fast)", cap: "text-generation", type: "groq", name: "Groq Inference", model: "llama-3.3-70b-versatile", url: "https://api.groq.com/openai/v1", icon: "⚡" },
  { label: "Anthropic Claude 3.5", cap: "text-generation", type: "anthropic", name: "Anthropic Claude", model: "claude-3-5-sonnet-20241022", url: "https://api.anthropic.com/v1", icon: "🎭" },
  { label: "OpenRouter (400+ Models)", cap: "text-generation", type: "openai_compatible", name: "OpenRouter AI", model: "anthropic/claude-3.5-sonnet", url: "https://openrouter.ai/api/v1", icon: "🌐" },
  { label: "OpenAI DALL·E 3", cap: "image-generation", type: "openai_dalle", name: "OpenAI DALL-E 3", model: "dall-e-3", url: "https://api.openai.com/v1", icon: "🎨" },
  { label: "Stability AI Cloud", cap: "image-generation", type: "stability_ai", name: "Stability AI Cloud", model: "sd3-medium", url: "https://api.stability.ai", icon: "🖼️" },
  { label: "DuckDuckGo Search", cap: "web-search", type: "duckduckgo_free", name: "DuckDuckGo Live Search", model: "ddg-search", url: "", icon: "🔍" },
];

export function ProvidersPage() {
  const queryClient = useQueryClient();
  const [selectedModality, setSelectedModality] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showSecret, setShowSecret] = useState<boolean>(false);
  const [showEditSecret, setShowEditSecret] = useState<boolean>(false);
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});
  const [modelSearchQuery, setModelSearchQuery] = useState<Record<string, string>>({});

  const { data: capabilities } = useQuery({
    queryKey: ["capabilities"],
    queryFn: () => api.get<Capability[]>("/capabilities"),
  });

  const { data: providers, isLoading } = useQuery({
    queryKey: ["providers"],
    queryFn: () => api.get<ProviderConfig[]>("/providers"),
  });

  const [form, setForm] = useState({
    capabilityKey: "text-generation",
    providerType: "",
    name: "",
    model: "",
    baseUrl: "",
    secret: "",
    authMode: "none",
  });

  const resetAddForm = () => {
    setForm({
      capabilityKey: capabilities?.[0]?.key || "text-generation",
      providerType: "",
      name: "",
      model: "",
      baseUrl: "",
      secret: "",
      authMode: "none",
    });
    setShowSecret(false);
  };

  const openAddModal = () => {
    resetAddForm();
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    resetAddForm();
    setShowAddModal(false);
  };

  const [editingProvider, setEditingProvider] = useState<{
    id: string;
    name: string;
    baseUrl: string;
    secret: string;
    model: string;
    status: string;
    availableModels?: DiscoveredModel[];
  } | null>(null);

  const toggleProviderExpand = (providerId: string) => {
    setExpandedProviders((prev) => ({
      ...prev,
      [providerId]: !prev[providerId],
    }));
  };

  const createProvider = useMutation({
    mutationFn: () =>
      api.post("/providers", {
        capabilityKey: form.capabilityKey,
        providerType: form.providerType,
        name: form.name,
        baseUrl: form.baseUrl ? form.baseUrl : undefined,
        secret: form.secret ? form.secret : undefined,
        authMode: form.authMode,
        config: form.model ? { model: form.model } : {},
        isDefault: false,
      }),
    onSuccess: (created: any) => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      queryClient.invalidateQueries({ queryKey: ["all-models"] });
      toast.success(`Provider "${form.name}" registered successfully.`);
      if (created?.id) {
        setExpandedProviders((prev) => ({ ...prev, [created.id]: true }));
      }
      resetAddForm();
      setShowAddModal(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateProvider = useMutation({
    mutationFn: () => {
      if (!editingProvider) throw new Error("No provider selected for edit");
      return api.put(`/providers/${editingProvider.id}`, {
        name: editingProvider.name,
        baseUrl: editingProvider.baseUrl ? editingProvider.baseUrl : undefined,
        secret: editingProvider.secret ? editingProvider.secret : undefined,
        config: editingProvider.model ? { model: editingProvider.model } : {},
        status: editingProvider.status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      queryClient.invalidateQueries({ queryKey: ["all-models"] });
      toast.success("Provider updated successfully");
      setEditingProvider(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const discoverModels = useMutation({
    mutationFn: (id: string) => api.post<{ success: boolean; count: number }>(`/providers/${id}/discover-models`),
    onSuccess: (data, providerId) => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      queryClient.invalidateQueries({ queryKey: ["all-models"] });
      setExpandedProviders((prev) => ({ ...prev, [providerId]: true }));
      toast.success(`Discovered ${data.count} models!`);
    },
    onError: (err: any) => toast.error(`Discovery failed: ${err.message}`),
  });

  const setDefaultProvider = useMutation({
    mutationFn: (id: string) => api.post(`/providers/${id}/set-default`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      toast.success("Default provider updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const setDefaultModel = useMutation({
    mutationFn: ({ providerId, modelId }: { providerId: string; modelId: string }) =>
      api.post(`/providers/${providerId}/set-default-model`, { modelId }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      queryClient.invalidateQueries({ queryKey: ["all-models"] });
      toast.success(`Default model set to "${vars.modelId}"`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteProvider = useMutation({
    mutationFn: (id: string) => api.delete(`/providers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      queryClient.invalidateQueries({ queryKey: ["all-models"] });
      toast.success("Provider deleted");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Calculate stats
  const totalProviders = providers?.length || 0;
  const totalDiscoveredModels = useMemo(() => {
    return providers?.reduce((acc, p) => acc + (p.models?.length || 0), 0) || 0;
  }, [providers]);

  const defaultTextProvider = providers?.find((p) => p.capability?.key === "text-generation" && p.isDefault);
  const defaultTextModel = (defaultTextProvider?.config as any)?.model || defaultTextProvider?.models?.[0]?.modelId || "None";

  // Count providers per capability to only show default badges/buttons when there are competing providers
  const capabilityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    providers?.forEach((p) => {
      const key = p.capability?.key || p.capability?.id || "unknown";
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [providers]);

  // Filtered & stably sorted providers
  const filteredProviders = useMemo(() => {
    if (!providers) return [];

    const q = searchQuery.trim().toLowerCase();

    return providers
      .filter((p) => {
        // 1. Modality Filter
        const capKey = (p.capability?.key || "").toLowerCase();
        const capLabel = (p.capability?.label || "").toLowerCase();

        let matchesModality = selectedModality === "all";
        if (!matchesModality) {
          const capMatches =
            (selectedModality === "text" && (capKey.includes("text") || capLabel.includes("text"))) ||
            (selectedModality === "image" && (capKey.includes("image") || capLabel.includes("image"))) ||
            (selectedModality === "audio" && (capKey.includes("audio") || capLabel.includes("audio") || capKey.includes("tts") || capKey.includes("speech"))) ||
            (selectedModality === "video" && (capKey.includes("video") || capLabel.includes("video"))) ||
            (selectedModality === "search" && (capKey.includes("search") || capLabel.includes("search") || capKey.includes("web")));

          const modelMatches = (p.models || []).some((m) =>
            m.outputTypes.some((t) => t.toLowerCase() === selectedModality) ||
            m.inputTypes.some((t) => t.toLowerCase() === selectedModality)
          );

          matchesModality = Boolean(capMatches || modelMatches);
        }

        if (!matchesModality) return false;

        // 2. Search Query Filter
        if (!q) return true;

        const providerMatchesQuery =
          p.name.toLowerCase().includes(q) ||
          p.providerType.toLowerCase().includes(q) ||
          capLabel.includes(q) ||
          capKey.includes(q) ||
          (p.baseUrl && p.baseUrl.toLowerCase().includes(q));

        const hasModelMatchingQuery = (p.models || []).some((m) =>
          m.name.toLowerCase().includes(q) ||
          m.modelId.toLowerCase().includes(q) ||
          (m.description && m.description.toLowerCase().includes(q))
        );

        return providerMatchesQuery || hasModelMatchingQuery;
      })
      .sort((a, b) => {
        // Deterministic stable ordering by capability then name so cards never jump on update
        const capOrder = (a.capability?.key || "").localeCompare(b.capability?.key || "");
        if (capOrder !== 0) return capOrder;
        return a.name.localeCompare(b.name);
      });
  }, [providers, searchQuery, selectedModality]);

  const getProviderIcon = (providerType: string, capKey?: string) => {
    if (providerType.includes("ollama")) return <Cpu className="h-5 w-5 text-indigo-500" />;
    if (providerType.includes("openai") || providerType.includes("groq")) return <Sparkles className="h-5 w-5 text-emerald-500" />;
    if (providerType.includes("gemini")) return <Zap className="h-5 w-5 text-blue-500" />;
    if (providerType.includes("anthropic")) return <Bot className="h-5 w-5 text-amber-500" />;
    if (providerType.includes("stability") || capKey === "image-generation") return <ImageIcon className="h-5 w-5 text-pink-500" />;
    if (capKey === "audio-generation") return <Volume2 className="h-5 w-5 text-purple-500" />;
    if (capKey === "web-search") return <Compass className="h-5 w-5 text-orange-500" />;
    return <Layers className="h-5 w-5 text-primary" />;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
              <Cpu className="h-5 w-5" />
            </div>
            <span>Providers &amp; Dynamic Models</span>
          </div>
        }
        description="Manage AI providers, local inference engines (Ollama, vLLM), and discover available models. Set your active default model for each capability."
        actions={
          <Button
            onClick={openAddModal}
            className="gap-2 shadow-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Register AI Provider
          </Button>
        }
      />

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="border border-border/60 bg-card/60 backdrop-blur-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Configured Providers</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground mt-1.5">{totalProviders}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Active AI endpoints &amp; engines</div>
        </Card>

        <Card className="border border-border/60 bg-card/60 backdrop-blur-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Available Models</span>
            <Layers className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground mt-1.5">{totalDiscoveredModels}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Synced across all endpoints</div>
        </Card>

        <Card className="border border-border/60 bg-card/60 backdrop-blur-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Primary Text Model</span>
            <Bot className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-sm font-semibold tracking-tight text-foreground mt-2 truncate font-mono" title={defaultTextModel}>
            {defaultTextModel}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
            Provider: {defaultTextProvider?.name || "None set"}
          </div>
        </Card>

        <Card className="border border-border/60 bg-card/60 backdrop-blur-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Capabilities Covered</span>
            <Sparkles className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground mt-1.5">
            {capabilities?.length || 4}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Text, Image, Audio &amp; Search</div>
        </Card>
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
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-0.5">
          {[
            { id: "all", label: "All Modalities", icon: Layers },
            { id: "text", label: "Text", icon: Bot },
            { id: "image", label: "Image", icon: ImageIcon },
            { id: "audio", label: "Audio", icon: Volume2 },
            { id: "video", label: "Video", icon: Radio },
            { id: "search", label: "Search & Web", icon: Compass },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSelectedModality(id)}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-xs font-medium ${
                selectedModality === id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/70 border border-transparent"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
      )}

      {/* Providers Cards List */}
      <div className="space-y-4">
        {filteredProviders?.map((p) => {
          const currentDefaultModel = (p.config as any)?.model || (p.models && p.models.length > 0 ? p.models[0].modelId : "");
          const isExpanded = Boolean(expandedProviders[p.id]);
          const totalModelsCount = p.models?.length || 0;
          const searchInModel = (modelSearchQuery[p.id] || "").toLowerCase();

          const modelsList = (p.models || []).filter((m) => {
            const matchesQuery =
              !searchInModel ||
              m.name.toLowerCase().includes(searchInModel) ||
              m.modelId.toLowerCase().includes(searchInModel);
            const matchesModality =
              selectedModality === "all" ||
              m.outputTypes.includes(selectedModality) ||
              m.inputTypes.includes(selectedModality);
            return matchesQuery && matchesModality;
          });

          const capKey = p.capability?.key || p.capability?.id || "";
          const hasMultipleInCap = (capabilityCounts[capKey] || 0) > 1;

          return (
            <div
              key={p.id}
              className="rounded-2xl border border-border/70 bg-card/90 overflow-hidden shadow-sm hover:border-primary/40 hover:shadow-md transition-all duration-200"
            >
              {/* Top Card Row */}
              <div className="p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Identity & Badges */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="h-11 w-11 shrink-0 rounded-xl bg-secondary/80 border border-border/60 flex items-center justify-center shadow-xs">
                      {getProviderIcon(p.providerType, p.capability?.key)}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground text-base tracking-tight truncate">{p.name}</h3>
                        
                        {hasMultipleInCap && p.isDefault && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                            <Star className="h-3 w-3 fill-current" /> Active {p.capability?.label || "Default"}
                          </span>
                        )}

                        <Badge variant="secondary" className="text-[11px] font-medium">
                          {p.capability?.label || p.capability?.key}
                        </Badge>

                        {p.hasSecret ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            <KeyRound className="h-2.5 w-2.5" /> Key Configured
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-sky-600 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
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
                      onClick={() => discoverModels.mutate(p.id)}
                      disabled={discoverModels.isPending}
                      title="Sync / Discover Models from Endpoint"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${discoverModels.isPending ? "animate-spin text-primary" : ""}`} />
                      <span>Sync</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1.5 border-border/60 hover:border-primary/40"
                      onClick={() =>
                        setEditingProvider({
                          id: p.id,
                          name: p.name,
                          baseUrl: p.baseUrl || "",
                          secret: "",
                          model: currentDefaultModel,
                          status: p.status || "active",
                          availableModels: p.models || [],
                        })
                      }
                      title="Edit Provider Settings"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </Button>

                    {hasMultipleInCap && !p.isDefault && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10"
                        onClick={() => setDefaultProvider.mutate(p.id)}
                        disabled={setDefaultProvider.isPending}
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
                      onClick={() => deleteProvider.mutate(p.id)}
                      disabled={deleteProvider.isPending}
                      title="Delete Provider"
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
                    onClick={() => toggleProviderExpand(p.id)}
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

                    {totalModelsCount > 6 && (
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Filter models in list..."
                          value={modelSearchQuery[p.id] || ""}
                          onChange={(e) =>
                            setModelSearchQuery({ ...modelSearchQuery, [p.id]: e.target.value })
                          }
                          className="h-8 pl-8 text-xs bg-card/80 border-border/50"
                        />
                      </div>
                    )}
                  </div>

                  {modelsList.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[460px] overflow-y-auto pr-1 scrollbar-thin">
                      {modelsList.map((m) => {
                        const isDefault = currentDefaultModel === m.modelId;
                        const lowerId = m.modelId.toLowerCase();
                        
                        // Infer Speed / Tokens per sec
                        let speedText = m.metadata?.speedEstimate || "";
                        if (!speedText) {
                          if (p.providerType.includes("groq") || lowerId.includes("groq")) {
                            speedText = "⚡ ~300-750 tok/s";
                          } else if (lowerId.includes("flash") || lowerId.includes("turbo") || lowerId.includes("mini") || lowerId.includes("haiku")) {
                            speedText = "⚡ ~120-180 tok/s";
                          } else if (p.providerType.includes("ollama")) {
                            speedText = "⚡ Local Engine";
                          }
                        }

                        // Infer Parameter Size
                        let paramText = m.metadata?.parameter_size || "";
                        if (!paramText) {
                          const paramMatch = lowerId.match(/(\d+b)/i);
                          if (paramMatch) paramText = paramMatch[1].toUpperCase();
                        }

                        // Quantization / Format
                        const quantText = m.metadata?.quantization_level || (m.metadata?.format ? `${m.metadata.format.toUpperCase()}` : "");

                        // Pricing
                        let pricingText = "";
                        if (m.metadata?.pricing?.prompt) {
                          const promptCost = (Number(m.metadata.pricing.prompt) * 1000000).toFixed(2);
                          pricingText = `$${promptCost}/1M in`;
                        } else if (p.providerType.includes("ollama") || p.providerType.includes("duckduckgo") || p.providerType.includes("pyttsx3") || p.providerType.includes("sd_turbo")) {
                          pricingText = "Free / Local";
                        }

                        return (
                          <div
                            key={m.id}
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

                              {/* Compact Top-Right Default Button / Indicator */}
                              <div className="shrink-0">
                                {isDefault ? (
                                  <span
                                    title="Active Default Model"
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-500/15 dark:text-emerald-400 dark:bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30"
                                  >
                                    <Check className="h-2.5 w-2.5" /> Default
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    title="Set as active default model"
                                    onClick={() => setDefaultModel.mutate({ providerId: p.id, modelId: m.modelId })}
                                    disabled={setDefaultModel.isPending}
                                    className="px-2 py-0.5 rounded text-[11px] font-medium text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-colors border border-border/40 hover:border-amber-500/30 flex items-center gap-1"
                                  >
                                    <Star className="h-3 w-3" />
                                    <span>Set</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Specs Strip (Context window, Speed, Params, Pricing) */}
                            <div className="flex items-center gap-1.5 flex-wrap text-[10px] pt-1">
                              {m.contextLength ? (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary/80 text-foreground font-mono text-[10px] border border-border/40"
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
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium text-[10px] border border-amber-500/20"
                                  title="Inference Throughput"
                                >
                                  <Zap className="h-2.5 w-2.5 fill-current" />
                                  {speedText}
                                </span>
                              ) : null}

                              {paramText ? (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium text-[10px] border border-indigo-500/20"
                                  title="Model Parameters"
                                >
                                  <Cpu className="h-2.5 w-2.5" />
                                  {paramText}
                                </span>
                              ) : null}

                              {quantText ? (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-mono text-[10px] border border-border/30"
                                  title="Format & Quantization"
                                >
                                  {quantText}
                                </span>
                              ) : null}

                              {pricingText ? (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] border border-emerald-500/20"
                                  title="Cost Tier"
                                >
                                  {pricingText}
                                </span>
                              ) : null}
                            </div>

                            {/* Modalities & Context Footer */}
                            <div className="space-y-1.5 pt-2 border-t border-border/30 text-[10px]">
                              {m.inputTypes && m.inputTypes.length > 0 && (
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-muted-foreground font-medium">Input:</span>
                                  <div className="flex flex-wrap gap-1 justify-end">
                                    {m.inputTypes.map((t) => (
                                      <span
                                        key={t}
                                        className="px-1.5 py-0.5 rounded bg-secondary/80 text-foreground font-medium capitalize text-[10px] border border-border/40"
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
                                        className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium capitalize text-[10px] border border-primary/20"
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
                      })}
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
                          onClick={() => discoverModels.mutate(p.id)}
                          disabled={discoverModels.isPending}
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
        })}

        {(!filteredProviders || filteredProviders.length === 0) && (
          <div className="p-12 text-center border border-dashed rounded-2xl bg-card/30 space-y-3.5">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
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
            <Button size="sm" onClick={openAddModal} className="gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> Register AI Provider
            </Button>
          </div>
        )}
      </div>

      {/* REGISTER PROVIDER MODAL DIALOG */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-150">
          <Card className="w-full max-w-2xl border-primary/30 shadow-2xl bg-card/95 backdrop-blur-md rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-border/50 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-primary" /> Register AI Provider
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Connect cloud AI services or local engines (Ollama, vLLM, LMStudio) to dynamically sync models.
                </p>
              </div>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={closeAddModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <CardContent className="p-5 space-y-4">
              {/* 1-Click Quick Presets */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> 1-Click Presets:
                  </Label>
                  {(form.name || form.baseUrl || form.providerType || form.model) && (
                    <button
                      type="button"
                      onClick={resetAddForm}
                      className="text-[11px] text-muted-foreground hover:text-foreground underline"
                    >
                      Clear Form
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PRESET_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      className="px-3 py-2 text-left text-xs rounded-xl bg-secondary/50 hover:bg-primary/10 hover:border-primary/40 text-foreground transition-all font-medium border border-border/50 flex items-center gap-2 group"
                      onClick={() =>
                        setForm({
                          ...form,
                          capabilityKey: tpl.cap,
                          providerType: tpl.type,
                          name: tpl.name,
                          model: tpl.model,
                          baseUrl: tpl.url,
                        })
                      }
                    >
                      <span className="text-sm">{tpl.icon}</span>
                      <span className="truncate group-hover:text-primary transition-colors">{tpl.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createProvider.mutate();
                }}
                className="grid gap-3.5 sm:grid-cols-2 pt-3 border-t border-border/40"
              >
                <div>
                  <Label className="text-xs">Capability Category</Label>
                  <Select
                    value={form.capabilityKey}
                    onChange={(e) => setForm({ ...form, capabilityKey: e.target.value })}
                    required
                  >
                    {capabilities?.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Provider Type</Label>
                  <Input
                    placeholder="e.g. openai_compatible, gemini, ollama_local"
                    value={form.providerType}
                    onChange={(e) => setForm({ ...form, providerType: e.target.value })}
                    required
                    className="h-9 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs">Display Name</Label>
                  <Input
                    placeholder="e.g. OpenAI Cloud, Local Ollama"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    className="h-9 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs">Default Model ID (Optional)</Label>
                  <Input
                    placeholder="e.g. gpt-4o, gemini-1.5-pro, qwen3:8b"
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label className="text-xs">Base URL (Optional)</Label>
                  <Input
                    placeholder="e.g. https://api.openai.com/v1 or http://localhost:11434"
                    value={form.baseUrl}
                    onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                    className="h-9 text-xs font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label className="text-xs">API Key / Secret (Optional)</Label>
                  <div className="relative">
                    <Input
                      placeholder="Encrypted securely with AES-256 (Leave blank for local/free)"
                      type={showSecret ? "text" : "password"}
                      value={form.secret}
                      onChange={(e) =>
                        setForm({ ...form, secret: e.target.value, authMode: e.target.value ? "bearer" : "none" })
                      }
                      className="h-9 text-xs pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-2 flex justify-end gap-2 pt-3 border-t border-border/40">
                  <Button type="button" variant="ghost" size="sm" onClick={closeAddModal}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={createProvider.isPending}>
                    {createProvider.isPending ? <Spinner className="mr-2" /> : <Plus className="h-4 w-4 mr-1.5" />}
                    Add &amp; Sync Models
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* EDIT PROVIDER MODAL DIALOG */}
      {editingProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-150">
          <Card className="w-full max-w-xl border-primary/40 shadow-2xl bg-card/95 backdrop-blur-md rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-border/50 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Pencil className="h-4 w-4 text-primary" /> Edit Provider: {editingProvider.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Update credentials, endpoint URL, default model, and status.
                </p>
              </div>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingProvider(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <CardContent className="p-5">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  updateProvider.mutate();
                }}
                className="grid gap-3.5 sm:grid-cols-2"
              >
                <div>
                  <Label className="text-xs">Display Name</Label>
                  <Input
                    value={editingProvider.name}
                    onChange={(e) => setEditingProvider({ ...editingProvider, name: e.target.value })}
                    required
                    className="h-9 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs">Default Model</Label>
                  {editingProvider.availableModels && editingProvider.availableModels.length > 0 ? (
                    <Select
                      value={editingProvider.model}
                      onChange={(e) => setEditingProvider({ ...editingProvider, model: e.target.value })}
                    >
                      <option value="">-- Select Default Model --</option>
                      {editingProvider.availableModels.map((m) => (
                        <option key={m.modelId} value={m.modelId}>
                          {m.name} ({m.modelId})
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      placeholder="e.g. gpt-4o, gemini-1.5-pro, qwen3:8b"
                      value={editingProvider.model}
                      onChange={(e) => setEditingProvider({ ...editingProvider, model: e.target.value })}
                      className="h-9 text-xs"
                    />
                  )}
                </div>

                <div className="sm:col-span-2">
                  <Label className="text-xs">Base URL (Optional)</Label>
                  <Input
                    placeholder="e.g. https://api.openai.com/v1"
                    value={editingProvider.baseUrl}
                    onChange={(e) => setEditingProvider({ ...editingProvider, baseUrl: e.target.value })}
                    className="h-9 text-xs font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label className="text-xs">New API Key / Secret (Leave blank to keep existing)</Label>
                  <div className="relative">
                    <Input
                      type={showEditSecret ? "text" : "password"}
                      placeholder="Enter new key only if updating"
                      value={editingProvider.secret}
                      onChange={(e) => setEditingProvider({ ...editingProvider, secret: e.target.value })}
                      className="h-9 text-xs pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditSecret(!showEditSecret)}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      {showEditSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={editingProvider.status}
                    onChange={(e) => setEditingProvider({ ...editingProvider, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </Select>
                </div>

                <div className="sm:col-span-2 flex justify-end gap-2 pt-3 border-t border-border/40">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditingProvider(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={updateProvider.isPending}>
                    {updateProvider.isPending ? <Spinner className="mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
