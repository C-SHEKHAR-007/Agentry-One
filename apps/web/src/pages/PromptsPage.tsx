import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Brain, Copy, Plus, Trash2 } from "lucide-react";
import { api } from "../api/client";
import type { Agent, Prompt } from "../api/types";
import { timeAgo } from "../lib/format";
import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { EmptyState } from "../components/ui/empty-state";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { Spinner } from "../components/ui/spinner";
import { Textarea } from "../components/ui/textarea";

export function PromptsPage() {
  const queryClient = useQueryClient();
  const [agentFilter, setAgentFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ agentId: "", key: "", template: "" });

  const { data: agents } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.get<Agent[]>("/agents"),
  });
  const { data: prompts, isLoading } = useQuery({
    queryKey: ["prompts", agentFilter],
    queryFn: () => api.get<Prompt[]>(`/prompts${agentFilter ? `?agentId=${agentFilter}` : ""}`),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, Prompt[]>();
    for (const p of prompts ?? []) {
      const groupKey = `${p.agentId}:${p.key}`;
      map.set(groupKey, [...(map.get(groupKey) ?? []), p]);
    }
    return [...map.entries()];
  }, [prompts]);

  const createPrompt = useMutation({
    mutationFn: () => api.post<Prompt>("/prompts", form),
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
      toast.success(`Saved "${p.key}" v${p.version}`);
      setOpen(false);
      setForm({ agentId: "", key: "", template: "" });
    },
    onError: (err) => toast.error(err.message),
  });

  const deletePrompt = useMutation({
    mutationFn: (id: string) => api.delete(`/prompts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
      toast.success("Prompt deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div>
      <PageHeader
        title="Prompt Library"
        description="Save and version the prompts that work — reuse them from any agent's submit form."
        actions={
          <>
            <Select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className="w-44">
              <option value="">All agents</option>
              {agents?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New prompt
            </Button>
          </>
        }
      />

      {isLoading && <Skeleton className="h-48" />}

      {prompts?.length === 0 && (
        <EmptyState
          icon={Brain}
          title="No saved prompts yet"
          description="Save a prompt here or directly from an agent's submit form."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New prompt
            </Button>
          }
        />
      )}

      <div className="grid gap-4">
        {grouped.map(([groupKey, versions]) => {
          const latest = versions[0];
          return (
            <Card key={groupKey} glass>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  {latest.key}
                  <Badge variant="secondary">{latest.agentId}</Badge>
                  <Badge>v{latest.version}</Badge>
                </CardTitle>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Copy latest version"
                    onClick={() => {
                      navigator.clipboard.writeText(latest.template);
                      toast.success("Copied to clipboard");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        v{v.version} · {timeAgo(v.createdAt)}
                      </p>
                      <p className="mt-1 break-words text-sm">{v.template}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Delete v${v.version}`}
                      onClick={() => deletePrompt.mutate(v.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New prompt</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createPrompt.mutate();
            }}
            className="space-y-4"
          >
            <div>
              <Label>Agent</Label>
              <Select
                value={form.agentId}
                onChange={(e) => setForm({ ...form, agentId: e.target.value })}
                required
              >
                <option value="">Select agent...</option>
                {agents?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Key</Label>
              <Input
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value })}
                placeholder="e.g. product-hero"
                required
              />
            </div>
            <div>
              <Label>Prompt text</Label>
              <Textarea
                value={form.template}
                onChange={(e) => setForm({ ...form, template: e.target.value })}
                rows={4}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createPrompt.isPending}>
                {createPrompt.isPending && <Spinner />}
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
