import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Monitor, Moon, Plus, Sun } from "lucide-react";
import { api } from "../api/client";
import { useSystemHealth } from "../api/queries";
import { useTheme } from "../lib/theme";
import { cn } from "../lib/utils";
import { PageHeader } from "../components/PageHeader";
import { PricingEditor } from "../components/PricingEditor";
import { SystemHealthPanel } from "../components/SystemHealthPanel";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";

interface Setting {
  id: string;
  scope: string;
  projectId: string | null;
  agentId: string | null;
  key: string;
  value: unknown;
}

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { data: version } = useQuery({
    queryKey: ["version"],
    queryFn: () => api.get<{ name: string; version: string }>("/version"),
  });
  const { data: health } = useSystemHealth();
  const { data: settings } = useQuery({
    queryKey: ["settings", "global"],
    queryFn: () => api.get<Setting[]>("/settings"),
  });

  const [newKV, setNewKV] = useState({ key: "", value: "" });
  const putSetting = useMutation({
    mutationFn: (input: { key: string; value: unknown }) =>
      api.put("/settings", { scope: "global", key: input.key, value: input.value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Setting saved");
      setNewKV({ key: "", value: "" });
    },
    onError: (err) => toast.error(err.message),
  });

  const otherSettings = (settings ?? []).filter((s) => !s.key.startsWith("pricing."));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader title="Settings" description="Platform status, appearance, and global configuration." />

      <Card glass>
        <CardHeader>
          <CardTitle className="text-base">Platform</CardTitle>
          <CardDescription>
            {version ? `${version.name} v${version.version}` : "…"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {health ? <SystemHealthPanel health={health} /> : <Skeleton className="h-32" />}
        </CardContent>
      </Card>

      <Card glass>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>Theme preference is stored in this browser.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {THEME_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-2 rounded-lg border px-4 py-3 text-sm transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-secondary/50",
                  )}
                  aria-pressed={active}
                >
                  <Icon className="h-5 w-5" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card glass>
        <CardHeader>
          <CardTitle className="text-base">Pricing</CardTitle>
          <CardDescription>Per-job prices used by the Cost Monitor.</CardDescription>
        </CardHeader>
        <CardContent>
          <PricingEditor />
        </CardContent>
      </Card>

      <Card glass>
        <CardHeader>
          <CardTitle className="text-base">Billing & Workspaces</CardTitle>
          <CardDescription>Manage your subscription and Stripe payment methods.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
              <div>
                <p className="font-semibold text-sm">Current Plan: Pro (Agency)</p>
                <p className="text-xs text-muted-foreground mt-1">10,000 AI Executions / mo</p>
              </div>
              <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Active</Badge>
            </div>
            
            <div className="flex items-center gap-3">
              <Button variant="outline" className="flex-1">
                Manage in Stripe
              </Button>
              <Button variant="secondary" className="flex-1">
                View Invoices
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card glass>
        <CardHeader>
          <CardTitle className="text-base">Global settings</CardTitle>
          <CardDescription>
            Raw key/value store (scoped global). Values are JSON — strings can be entered directly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {otherSettings.length === 0 && (
            <p className="text-sm text-muted-foreground">No non-pricing global settings yet.</p>
          )}
          {otherSettings.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
              <Badge variant="secondary">{s.key}</Badge>
              <code className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {JSON.stringify(s.value)}
              </code>
            </div>
          ))}
          <form
            className="flex flex-wrap items-center gap-2 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newKV.key.trim()) return;
              let value: unknown = newKV.value;
              try {
                value = JSON.parse(newKV.value);
              } catch {
                /* keep as plain string */
              }
              putSetting.mutate({ key: newKV.key.trim(), value });
            }}
          >
            <Input
              placeholder="key (e.g. ui.motd)"
              value={newKV.key}
              onChange={(e) => setNewKV({ ...newKV, key: e.target.value })}
              className="w-48"
            />
            <Input
              placeholder='value (JSON or string)'
              value={newKV.value}
              onChange={(e) => setNewKV({ ...newKV, value: e.target.value })}
              className="min-w-40 flex-1"
            />
            <Button type="submit" size="sm" disabled={putSetting.isPending}>
              <Plus className="h-3.5 w-3.5" /> Set
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
