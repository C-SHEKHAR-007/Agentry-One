import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { api } from "../api/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Spinner } from "./ui/spinner";

interface Setting {
  id: string;
  scope: string;
  key: string;
  value: unknown;
}

const LABELS: Record<string, string> = {
  "pricing.sd_turbo_local": "Local SD-Turbo (per image)",
  "pricing.stability_ai": "Stability AI (per image)",
  "pricing.reference": "Reference premium price (savings baseline)",
};

// Editable per-job USD prices stored as global settings (pricing.* keys).
// Shared between the Cost Monitor and Settings pages.
export function PricingEditor() {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["settings", "global"],
    queryFn: () => api.get<Setting[]>("/settings"),
  });

  const pricing = (settings ?? []).filter((s) => s.key.startsWith("pricing."));
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const s of pricing) {
      next[s.key] = String((s.value as { perJobUsd?: number })?.perJobUsd ?? 0);
    }
    setDrafts(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const save = useMutation({
    mutationFn: (key: string) =>
      api.put("/settings", {
        scope: "global",
        key,
        value: { perJobUsd: Number(drafts[key]) || 0 },
      }),
    onSuccess: (_d, key) => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast.success(`${LABELS[key] ?? key} updated`);
    },
    onError: (err) => toast.error(err.message),
  });

  if (pricing.length === 0) {
    return <p className="text-sm text-muted-foreground">No pricing settings found.</p>;
  }

  return (
    <div className="space-y-3">
      {pricing.map((s) => (
        <div key={s.key} className="flex flex-wrap items-center gap-3">
          <span className="w-full text-sm text-muted-foreground sm:w-72">
            {LABELS[s.key] ?? s.key}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">$</span>
            <Input
              type="number"
              step="0.001"
              min="0"
              value={drafts[s.key] ?? ""}
              onChange={(e) => setDrafts({ ...drafts, [s.key]: e.target.value })}
              className="w-28"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => save.mutate(s.key)}
              disabled={save.isPending}
            >
              {save.isPending ? <Spinner /> : <Save className="h-3.5 w-3.5" />}
              Save
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
