import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Cpu, Eye, EyeOff, Plus, Sparkles, X } from "lucide-react";
import type { Capability } from "../../../models";
import { errorMessage } from "../../../services/http/errors";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { Spinner } from "../../../components/ui/spinner";
import { PRESET_TEMPLATES } from "../presets";
import { useCreateProviderMutation } from "../providers.api";

const emptyForm = (capabilityKey = "text-generation") => ({
  capabilityKey,
  providerType: "",
  name: "",
  model: "",
  baseUrl: "",
  secret: "",
  authMode: "none",
});

/** Registers a provider: a preset or hand-filled endpoint, key and default model. */
export function RegisterProviderDialog({
  open,
  onClose,
  capabilities,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  capabilities: Capability[] | undefined;
  onCreated: (id: string) => void;
}) {
  const [form, setForm] = useState(emptyForm);
  const [showSecret, setShowSecret] = useState(false);

  const resetAddForm = () => {
    setForm(emptyForm(capabilities?.[0]?.key || "text-generation"));
    setShowSecret(false);
  };
  const close = () => {
    resetAddForm();
    onClose();
  };
  // Every open starts from a clean form on the first capability.
  useEffect(() => {
    if (open) resetAddForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on open
  }, [open]);

  const [create, createState] = useCreateProviderMutation();
  const createProvider = {
    isPending: createState.isLoading,
    mutate: () =>
      create({
        capabilityKey: form.capabilityKey,
        providerType: form.providerType,
        name: form.name,
        baseUrl: form.baseUrl ? form.baseUrl : undefined,
        secret: form.secret ? form.secret : undefined,
        authMode: form.authMode,
        config: form.model ? { model: form.model } : {},
        isDefault: false,
      })
        .unwrap()
        .then((created) => {
          toast.success(`Provider "${form.name}" registered successfully.`);
          if (created?.id) onCreated(created.id);
          close();
        })
        .catch((err) => toast.error(errorMessage(err))),
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent hideClose aria-describedby={undefined} className="max-w-2xl border-0 bg-transparent p-0 shadow-none">
        <DialogTitle className="sr-only">Register AI provider</DialogTitle>
        <Card className="w-full max-w-2xl border-primary/30 shadow-2xl overflow-hidden">
          <div className="p-5 border-b border-border/50 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Cpu className="h-5 w-5 text-primary" /> Register AI Provider
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Connect cloud AI services or local engines (Ollama, vLLM, LMStudio) to dynamically sync models.
              </p>
            </div>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={close} aria-label="Close">
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
              autoComplete="off"
              onSubmit={(e) => {
                e.preventDefault();
                createProvider.mutate();
              }}
              className="grid gap-3.5 sm:grid-cols-2"
            >
              <div>
                <Label className="text-xs">Capability</Label>
                <Select
                  value={form.capabilityKey}
                  onChange={(e) => setForm({ ...form, capabilityKey: e.target.value })}
                  required
                  className="h-9 text-xs"
                >
                  <option value="">-- Select Capability --</option>
                  {capabilities?.map((c) => (
                    <option key={c.id} value={c.key}>
                      {c.label} ({c.key})
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label className="text-xs">Provider Type</Label>
                <Select
                  value={form.providerType}
                  onChange={(e) => setForm({ ...form, providerType: e.target.value })}
                  required
                  className="h-9 text-xs"
                >
                  <option value="openai">OpenAI / Compatible</option>
                  <option value="ollama">Ollama (Local)</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="elevenlabs">ElevenLabs (Audio)</option>
                  <option value="replicate">Replicate (Multi-modal)</option>
                  <option value="huggingface">HuggingFace Inference</option>
                  <option value="custom_http">Custom HTTP Endpoint</option>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Display Name</Label>
                <Input
                  name="new_provider_display_name"
                  autoComplete="off"
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
                  name="new_provider_model_id"
                  autoComplete="off"
                  placeholder="e.g. gpt-4o, gemini-1.5-pro, qwen3:8b"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs">Base URL (Optional)</Label>
                <Input
                  name="new_provider_base_url"
                  autoComplete="off"
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
                    name="new_provider_api_key"
                    autoComplete="new-password"
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
                    aria-label={showSecret ? "Hide key" : "Show key"}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="sm:col-span-2 flex justify-end gap-2 pt-3 border-t border-border/40">
                <Button type="button" variant="ghost" size="sm" onClick={close}>
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
      </DialogContent>
    </Dialog>
  );
}
