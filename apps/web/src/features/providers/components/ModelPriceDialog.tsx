import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CircleDollarSign } from "lucide-react";
import type { DiscoveredModel } from "../../../models";
import { useSticky } from "../../../hooks/useSticky";
import { errorMessage } from "../../../services/http/errors";
import { Button } from "../../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Spinner } from "../../../components/ui/spinner";
import { useSetModelPricesMutation } from "../providers.api";

const toField = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));
const toPrice = (v: string) => (v.trim() === "" ? null : Number(v));

/** A model's token prices (USD per million tokens). Runs on the model are
 * then priced by the tokens they use instead of the flat per-job price. */
export function ModelPriceDialog({ model, onClose }: { model: DiscoveredModel | null; onClose: () => void }) {
  const shown = useSticky(model);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [save, state] = useSetModelPricesMutation();

  useEffect(() => {
    if (!model) return;
    setInput(toField(model.inputPricePerMTok));
    setOutput(toField(model.outputPricePerMTok));
  }, [model]);

  const invalid = [input, output].some((v) => v.trim() !== "" && !(Number(v) >= 0));
  const submit = () => {
    if (!model || invalid) return;
    save({ id: model.id, inputPricePerMTok: toPrice(input), outputPricePerMTok: toPrice(output) })
      .unwrap()
      .then(() => {
        toast.success(`Prices saved for ${model.name || model.modelId}`);
        onClose();
      })
      .catch((err) => toast.error(errorMessage(err)));
  };

  const discovered = (shown?.metadata as { pricing?: { prompt?: unknown; completion?: unknown } } | undefined)?.pricing;

  return (
    <Dialog open={Boolean(model)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CircleDollarSign className="h-4 w-4 text-primary" /> Token prices
          </DialogTitle>
          <DialogDescription>
            {shown?.name || shown?.modelId}: runs on this model are priced by the tokens they use. Leave both empty to use{" "}
            {discovered ? "the price the provider reported" : "the provider's per-job price"}.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="price-in" className="text-xs">Input, $ per 1M tokens</Label>
              <Input id="price-in" type="number" min="0" step="any" placeholder="e.g. 3" value={input} onChange={(e) => setInput(e.target.value)} className="font-mono" />
            </div>
            <div>
              <Label htmlFor="price-out" className="text-xs">Output, $ per 1M tokens</Label>
              <Input id="price-out" type="number" min="0" step="any" placeholder="e.g. 15" value={output} onChange={(e) => setOutput(e.target.value)} className="font-mono" />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">Applies to runs from now on; past runs keep the cost they were recorded with.</p>
          <div className="flex justify-end gap-2 border-t border-border/40 pt-3">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={state.isLoading || invalid}>
              {state.isLoading && <Spinner className="h-3.5 w-3.5" />} Save prices
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
