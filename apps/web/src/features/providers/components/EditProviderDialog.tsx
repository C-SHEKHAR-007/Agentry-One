import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Eye, EyeOff, Pencil, X } from "lucide-react";
import type { DiscoveredModel, ProviderConfig } from "../../../models";
import { useSticky } from "../../../hooks/useSticky";
import { errorMessage } from "../../../services/http/errors";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { Spinner } from "../../../components/ui/spinner";
import { currentModelOf } from "../filtering";
import { useUpdateProviderMutation } from "../providers.api";

interface EditState {
  id: string;
  name: string;
  baseUrl: string;
  secret: string;
  model: string;
  status: string;
  availableModels?: DiscoveredModel[];
  hasSecret?: boolean;
}

/** Edits a provider's name, endpoint, key (write-only), default model and status. */
export function EditProviderDialog({ provider, onClose }: { provider: ProviderConfig | null; onClose: () => void }) {
  const [editing, setEditing] = useState<EditState | null>(null);
  const [isCustomModelMode, setIsCustomModelMode] = useState(false);
  const [showEditSecret, setShowEditSecret] = useState(false);
  // Keeps the form rendered while the dialog animates closed.
  const editShown = useSticky(editing);

  // Opening for a provider starts from its saved values.
  useEffect(() => {
    if (!provider) {
      setEditing(null);
      return;
    }
    const currentModel = currentModelOf(provider);
    const hasModels = Boolean(provider.models && provider.models.length > 0);
    const modelInList = hasModels && provider.models!.some((m) => m.modelId === currentModel);
    setIsCustomModelMode(!modelInList && Boolean(currentModel) && hasModels);
    setShowEditSecret(false);
    setEditing({
      id: provider.id,
      name: provider.name,
      baseUrl: provider.baseUrl || "",
      secret: "",
      model: currentModel,
      status: provider.status || "active",
      availableModels: provider.models || [],
      hasSecret: provider.hasSecret,
    });
  }, [provider]);

  const [update, updateState] = useUpdateProviderMutation();
  const updateProvider = {
    isPending: updateState.isLoading,
    mutate: () => {
      if (!editing) return;
      update({
        id: editing.id,
        body: {
          name: editing.name,
          baseUrl: editing.baseUrl,
          // Saved keys are write-only: only send a key when the user typed a new one.
          secret: editing.secret ? editing.secret : undefined,
          config: editing.model ? { model: editing.model } : {},
          status: editing.status,
        },
      })
        .unwrap()
        .then(() => {
          toast.success("Provider updated successfully");
          onClose();
        })
        .catch((err) => toast.error(errorMessage(err)));
    },
  };

  return (
    <Dialog open={Boolean(provider)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent hideClose aria-describedby={undefined} className="max-w-xl border-0 bg-transparent p-0 shadow-none">
        <DialogTitle className="sr-only">Edit provider</DialogTitle>
      {editShown && (
        <Card className="w-full max-w-xl border-primary/40 shadow-2xl overflow-hidden">
          <div className="p-5 border-b border-border/50 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Pencil className="h-4 w-4 text-primary" /> Edit Provider: {editShown.name}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Update credentials, endpoint URL, default model, and status.
              </p>
            </div>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <CardContent className="p-5">
            <form
              autoComplete="off"
              onSubmit={(e) => {
                e.preventDefault();
                updateProvider.mutate();
              }}
              className="grid gap-3.5 sm:grid-cols-2"
            >
              <div>
                <Label className="text-xs">Display Name</Label>
                <Input
                  name="edit_provider_display_name"
                  autoComplete="off"
                  value={editShown.name}
                  onChange={(e) => setEditing({ ...editShown, name: e.target.value })}
                  required
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs">Default Model</Label>
                  {editShown.availableModels && editShown.availableModels.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsCustomModelMode(!isCustomModelMode)}
                      className="text-[11px] text-primary hover:underline"
                    >
                      {isCustomModelMode ? "Choose from list" : "Enter custom model ID"}
                    </button>
                  )}
                </div>
                {editShown.availableModels && editShown.availableModels.length > 0 && !isCustomModelMode ? (
                  <Select
                    value={editShown.model}
                    onChange={(e) => setEditing({ ...editShown, model: e.target.value })}
                  >
                    <option value="">-- Select Default Model --</option>
                    {editShown.model && !editShown.availableModels.some((m) => m.modelId === editShown.model) && (
                      <option value={editShown.model}>
                        {editShown.model} (Current)
                      </option>
                    )}
                    {editShown.availableModels.map((m) => (
                      <option key={m.modelId} value={m.modelId}>
                        {m.name} ({m.modelId})
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    name="edit_provider_model_id"
                    autoComplete="off"
                    placeholder="e.g. gpt-4o, gemini-1.5-pro, qwen3:8b"
                    value={editShown.model}
                    onChange={(e) => setEditing({ ...editShown, model: e.target.value })}
                    className="h-9 text-xs font-mono"
                  />
                )}
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs">Base URL (Optional)</Label>
                <Input
                  name="edit_provider_base_url"
                  autoComplete="off"
                  placeholder="e.g. https://api.openai.com/v1"
                  value={editShown.baseUrl}
                  onChange={(e) => setEditing({ ...editShown, baseUrl: e.target.value })}
                  className="h-9 text-xs font-mono"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Leave blank to use default API endpoint.
                </p>
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs">API Key / Secret</Label>
                  {editShown.hasSecret && (
                    <span className="text-[11px] text-muted-foreground">A key is saved</span>
                  )}
                </div>
                <div className="relative">
                  <Input
                    name="edit_provider_secret_key"
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    type={showEditSecret ? "text" : "password"}
                    placeholder={editShown.hasSecret ? "Leave blank to keep the saved key" : "Enter API key or leave blank"}
                    value={editShown.secret}
                    onChange={(e) => setEditing({ ...editShown, secret: e.target.value })}
                    className="h-9 text-xs pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditSecret(!showEditSecret)}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
                    title={showEditSecret ? "Hide key" : "Show key"}
                  >
                    {showEditSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Your stored key is decrypted above so you can verify, edit, or replace it.
                </p>
              </div>

              <div>
                <Label className="text-xs">Status</Label>
                <Select
                  value={editShown.status}
                  onChange={(e) => setEditing({ ...editShown, status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </Select>
              </div>

              <div className="sm:col-span-2 flex justify-end gap-2 pt-3 border-t border-border/40">
                <Button type="button" variant="ghost" size="sm" onClick={onClose}>
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
      )}
      </DialogContent>
    </Dialog>
  );
}
