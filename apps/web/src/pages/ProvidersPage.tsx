import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Plug, Plus, Star, Trash2 } from "lucide-react";
import { api } from "../api/client.js";
import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
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
  capability: Capability;
}

const PRESET_TEMPLATES = [
  { label: "Ollama (Local)", cap: "text-generation", type: "ollama_local", name: "Local Ollama (Qwen 3)", model: "qwen3:8b", url: "http://localhost:11434" },
  { label: "OpenAI / Compatible", cap: "text-generation", type: "openai_compatible", name: "OpenAI LLM", model: "gpt-4o", url: "https://api.openai.com/v1" },
  { label: "SD-Turbo (Local)", cap: "image-generation", type: "sd_turbo_local", name: "Local SD-Turbo", model: "stabilityai/sd-turbo", url: "" },
  { label: "Stability AI API", cap: "image-generation", type: "stability_ai", name: "Stability AI Cloud", model: "sd3-medium", url: "https://api.stability.ai" },
];

export function ProvidersPage() {
  const queryClient = useQueryClient();
  const { data: capabilities } = useQuery({
    queryKey: ["capabilities"],
    queryFn: () => api.get<Capability[]>("/capabilities"),
  });
  const { data: providers, isLoading } = useQuery({
    queryKey: ["providers"],
    queryFn: () => api.get<ProviderConfig[]>("/providers"),
  });

  const [form, setForm] = useState({
    capabilityKey: "",
    providerType: "",
    name: "",
    model: "",
    baseUrl: "",
    secret: "",
    authMode: "none",
  });

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      toast.success(`Provider "${form.name}" added`);
      setForm({ capabilityKey: "", providerType: "", name: "", model: "", baseUrl: "", secret: "", authMode: "none" });
    },
    onError: (err) => toast.error(err.message),
  });

  const setDefault = useMutation({
    mutationFn: (id: string) => api.post(`/providers/${id}/set-default`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      toast.success("Default provider updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteProvider = useMutation({
    mutationFn: (id: string) => api.delete(`/providers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      toast.success("Provider deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Providers"
        description="Configure any AI model or API provider. Specify your model name (e.g. qwen3:8b, llama3, gpt-4o) and optional custom base URL for local or cloud inference."
      />

      {isLoading && <Skeleton className="h-40" />}

      <div className="grid gap-3">
        {providers?.map((p) => (
          <Card key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Plug className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  {p.isDefault && <Badge>default</Badge>}
                  {p.config?.model ? (
                    <Badge variant="outline" className="font-mono text-xs">
                      model: {String(p.config.model)}
                    </Badge>
                  ) : null}
                  {p.hasSecret ? (
                    <Badge variant="outline" className="gap-1">
                      <KeyRound className="h-3 w-3" /> key set
                    </Badge>
                  ) : (
                    <Badge variant="secondary">no key</Badge>
                  )}
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {p.capability.label} · <span className="font-mono text-xs">{p.providerType}</span>
                  {p.baseUrl ? <span className="ml-2 font-mono text-xs text-muted-foreground/80">({p.baseUrl})</span> : null}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!p.isDefault && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setDefault.mutate(p.id)}
                  disabled={setDefault.isPending}
                >
                  <Star className="h-3.5 w-3.5" /> Set default
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Delete ${p.name}`}
                onClick={() => deleteProvider.mutate(p.id)}
                disabled={deleteProvider.isPending}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Card glass>
        <CardHeader>
          <CardTitle className="text-base">Add a provider or custom model</CardTitle>
          <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-muted-foreground">
            <span>Quick presets:</span>
            {PRESET_TEMPLATES.map((tpl) => (
              <Badge
                key={tpl.label}
                variant="secondary"
                className="cursor-pointer hover:bg-secondary/80 transition-colors"
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
                + {tpl.label}
              </Badge>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createProvider.mutate();
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div>
              <Label>Capability</Label>
              <Select
                value={form.capabilityKey}
                onChange={(e) => setForm({ ...form, capabilityKey: e.target.value })}
                required
              >
                <option value="">Select capability...</option>
                {capabilities?.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Provider type identifier</Label>
              <Input
                placeholder="e.g. ollama_local, openai_compatible, custom_rest"
                value={form.providerType}
                onChange={(e) => setForm({ ...form, providerType: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Display name</Label>
              <Input
                placeholder="e.g. Ollama (Llama 3 8B)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Model name / ID (Optional)</Label>
              <Input
                placeholder="e.g. qwen3:8b, llama3, mistral, gpt-4o"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
              />
            </div>
            <div>
              <Label>Base URL (Optional)</Label>
              <Input
                placeholder="e.g. http://localhost:11434 or custom API host"
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              />
            </div>
            <div>
              <Label>API key / Secret (Optional)</Label>
              <Input
                placeholder="Required for cloud providers"
                type="password"
                value={form.secret}
                onChange={(e) =>
                  setForm({ ...form, secret: e.target.value, authMode: e.target.value ? "bearer" : "none" })
                }
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={createProvider.isPending}>
                {createProvider.isPending ? <Spinner /> : <Plus className="h-4 w-4" />}
                Add provider
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
