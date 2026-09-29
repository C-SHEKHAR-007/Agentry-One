import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Cpu, X } from "lucide-react";
import { useSticky } from "../../../hooks/useSticky";
import { errorMessage } from "../../../services/http/errors";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Spinner } from "../../../components/ui/spinner";
import { useCreateModelMutation } from "../providers.api";

const EMPTY_MODEL = { modelId: "", name: "", description: "", inputTypes: ["text"], outputTypes: ["text"], contextLength: "128000" };

/** Adds a model to a provider by hand (for endpoints that can't list theirs). */
export function AddModelDialog({ providerId, onClose }: { providerId: string | null; onClose: () => void }) {
  const addModelShown = useSticky(providerId);
  const [modelForm, setModelForm] = useState(EMPTY_MODEL);

  const [create, createState] = useCreateModelMutation();
  const createModel = {
    isPending: createState.isLoading,
    mutate: () => {
      if (!providerId) return;
      create({
        providerConfigId: providerId,
        modelId: modelForm.modelId.trim(),
        name: modelForm.name.trim() || modelForm.modelId.trim(),
        description: modelForm.description.trim() || undefined,
        inputTypes: modelForm.inputTypes,
        outputTypes: modelForm.outputTypes,
        contextLength: modelForm.contextLength ? parseInt(modelForm.contextLength, 10) : undefined,
      })
        .unwrap()
        .then(() => {
          toast.success(`Model "${modelForm.name || modelForm.modelId}" registered successfully!`);
          onClose();
          setModelForm(EMPTY_MODEL);
        })
        .catch((err) => toast.error(errorMessage(err)));
    },
  };

  return (
    <Dialog open={Boolean(providerId)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent hideClose aria-describedby={undefined} className="max-w-lg border-0 bg-transparent p-0 shadow-none">
        <DialogTitle className="sr-only">Add a model</DialogTitle>
      {addModelShown && (
        <Card className="w-full max-w-lg border-primary/30 shadow-2xl overflow-hidden">
          <div className="p-5 border-b border-border/50 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Cpu className="h-5 w-5 text-primary" /> Register Custom Model
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manually define a custom model identifier, modality outputs, and context capacity for this provider.
              </p>
            </div>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <CardContent className="p-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createModel.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <Label className="text-xs">Model Identifier (API slug) *</Label>
                <Input
                  required
                  placeholder="e.g. llama-3.3-70b, gpt-4o-mini, qwen2.5:14b, claude-3-5-haiku"
                  value={modelForm.modelId}
                  onChange={(e) => setModelForm({ ...modelForm, modelId: e.target.value })}
                  className="h-9 text-xs font-mono"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  The exact model name/slug passed in inference calls to the provider API.
                </p>
              </div>

              <div>
                <Label className="text-xs">Display Name</Label>
                <Input
                  placeholder="e.g. Meta Llama 3.3 70B Versatile"
                  value={modelForm.name}
                  onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Output Modalities</Label>
                  <div className="flex flex-wrap gap-1.5 pt-1.5">
                    {["text", "image", "audio", "video"].map((mod) => {
                      const isSelected = modelForm.outputTypes.includes(mod);
                      return (
                        <button
                          key={mod}
                          type="button"
                          onClick={() => {
                            const next = isSelected
                              ? modelForm.outputTypes.filter((t) => t !== mod)
                              : [...modelForm.outputTypes, mod];
                            setModelForm({ ...modelForm, outputTypes: next.length ? next : ["text"] });
                          }}
                          className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors capitalize ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-secondary text-muted-foreground border-border/50 hover:text-foreground"
                          }`}
                        >
                          {mod}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Context Length (Tokens)</Label>
                  <Input
                    type="number"
                    placeholder="128000"
                    value={modelForm.contextLength}
                    onChange={(e) => setModelForm({ ...modelForm, contextLength: e.target.value })}
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Description (Optional)</Label>
                <Input
                  placeholder="Brief description of model characteristics or specialty"
                  value={modelForm.description}
                  onChange={(e) => setModelForm({ ...modelForm, description: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
                <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={createModel.isPending || !modelForm.modelId.trim()}>
                  {createModel.isPending ? <Spinner className="mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                  Register Model
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
