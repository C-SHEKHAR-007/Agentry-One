import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Bot, Copy, Plus, RefreshCw, Terminal, Trash2 } from "lucide-react";
import { api } from "../api/client";
import type { Agent, Capability } from "../api/types";
import { useSystemHealth } from "../api/queries";
import { timeAgo } from "../lib/format";
import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { Spinner } from "../components/ui/spinner";
import { Textarea } from "../components/ui/textarea";
import { cn } from "../lib/utils";

interface FieldDraft {
  name: string;
  type: "string" | "number" | "integer" | "boolean";
  required: boolean;
}

interface ScaffoldResult {
  agent: Agent;
  files: string[];
  workerCommand: string;
}

interface AgentWithDiscovery extends Agent {
  discoveredAt?: string;
}

export function MyAgentsPage() {
  const queryClient = useQueryClient();
  const { data: agents, isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.get<AgentWithDiscovery[]>("/agents"),
  });
  const { data: capabilities } = useQuery({
    queryKey: ["capabilities"],
    queryFn: () => api.get<Capability[]>("/capabilities"),
  });
  const { data: health } = useSystemHealth();
  const onlineByAgent = new Map((health?.workers ?? []).map((w) => [w.agentId, w.online]));

  const [wizardOpen, setWizardOpen] = useState(false);
  const [result, setResult] = useState<ScaffoldResult | null>(null);
  const [form, setForm] = useState({ id: "", name: "", description: "", capability: "" });
  const [fields, setFields] = useState<FieldDraft[]>([
    { name: "message", type: "string", required: true },
  ]);

  const rescan = useMutation({
    mutationFn: () => api.post<{ agents: { id: string }[] }>("/agents/rescan"),
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast.success(`Registry rescanned — ${d.agents.length} agent(s) found`);
    },
    onError: (err) => toast.error(err.message),
  });

  const scaffold = useMutation({
    mutationFn: () =>
      api.post<ScaffoldResult>("/agents/scaffold", {
        ...form,
        capability: form.capability || undefined,
        fields,
      }),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setWizardOpen(false);
      setResult(r);
      setForm({ id: "", name: "", description: "", capability: "" });
      setFields([{ name: "message", type: "string", required: true }]);
      toast.success(`Agent "${r.agent?.name}" scaffolded`);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Agents"
        description="Every agent in the registry, plus a scaffolder to create your own — no platform code changes needed."
        actions={
          <>
            <Button variant="secondary" onClick={() => rescan.mutate()} disabled={rescan.isPending}>
              <RefreshCw className={cn("h-4 w-4", rescan.isPending && "animate-spin")} /> Rescan registry
            </Button>
            <Button onClick={() => setWizardOpen(true)}>
              <Plus className="h-4 w-4" /> Create Agent
            </Button>
          </>
        }
      />

      {isLoading && <Skeleton className="h-48" />}

      <div className="grid gap-3">
        {agents?.map((a) => {
          const online = onlineByAgent.get(a.id);
          return (
            <Card key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <Link to={`/agents/${a.id}`} className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Bot className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium hover:text-primary">{a.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.id} · v{a.version}
                    {a.discoveredAt ? ` · discovered ${timeAgo(a.discoveredAt)}` : ""}
                  </p>
                </div>
              </Link>
              <div className="flex items-center gap-2">
                {online != null && (
                  <Badge variant={online ? "success" : "destructive"}>
                    {online ? "worker online" : "worker offline"}
                  </Badge>
                )}
                <Badge variant="secondary">{a.status}</Badge>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="border-warning/30 bg-warning/5 p-4 text-sm text-muted-foreground">
        Scaffolding writes into the repo's <code>agents/</code> directory, so it works when the API
        runs from the repo (local dev). The docker-compose stack mounts <code>agents/</code>{" "}
        read-only — scaffold locally, then rebuild.
      </Card>

      {/* Scaffold wizard */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Create a new agent</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              scaffold.mutate();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Agent id (slug)</Label>
                <Input
                  value={form.id}
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                  placeholder="echo-agent"
                  pattern="[a-z][a-z0-9-]{1,39}"
                  required
                />
              </div>
              <div>
                <Label>Display name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Echo Agent"
                  required
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                required
              />
            </div>
            <div>
              <Label>Capability (optional — for BYOK provider dispatch)</Label>
              <Select
                value={form.capability}
                onChange={(e) => setForm({ ...form, capability: e.target.value })}
              >
                <option value="">None — self-contained worker</option>
                {capabilities?.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.key}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label>Input fields</Label>
              <div className="space-y-2">
                {fields.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={f.name}
                      onChange={(e) =>
                        setFields(fields.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                      }
                      placeholder="field name"
                      className="flex-1"
                      required
                    />
                    <Select
                      value={f.type}
                      onChange={(e) =>
                        setFields(
                          fields.map((x, j) =>
                            j === i ? { ...x, type: e.target.value as FieldDraft["type"] } : x,
                          ),
                        )
                      }
                      className="w-28"
                    >
                      <option value="string">string</option>
                      <option value="number">number</option>
                      <option value="integer">integer</option>
                      <option value="boolean">boolean</option>
                    </Select>
                    <label className="flex items-center gap-1 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={f.required}
                        onChange={(e) =>
                          setFields(
                            fields.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)),
                          )
                        }
                      />
                      req
                    </label>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Remove field"
                      disabled={fields.length === 1}
                      onClick={() => setFields(fields.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setFields([...fields, { name: "", type: "string", required: false }])}
                >
                  <Plus className="h-3.5 w-3.5" /> Add field
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setWizardOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={scaffold.isPending}>
                {scaffold.isPending && <Spinner />}
                Scaffold agent
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Success dialog with worker command */}
      <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent className="max-w-xl">
          {result && (
            <div>
              <DialogHeader>
                <DialogTitle>"{result.agent?.name}" is registered 🎉</DialogTitle>
              </DialogHeader>
              <Card className="mb-4">
                <CardHeader>
                  <CardTitle className="text-sm">Files created</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 font-mono text-xs text-muted-foreground">
                    {result.files.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Terminal className="h-4 w-4" /> Start its worker
                  </CardTitle>
                  <CardDescription>
                    Run this from the repo root (needs Python 3 with <code>bullmq</code> installed).
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded bg-secondary px-2 py-1.5 text-xs">
                    REDIS_URL=redis://localhost:6379 {result.workerCommand}
                  </code>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `REDIS_URL=redis://localhost:6379 ${result.workerCommand}`,
                      );
                      toast.success("Copied");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
              <div className="mt-4 flex justify-end gap-2">
                <Link to={`/agents/${result.agent?.id}`}>
                  <Button variant="secondary">View in Marketplace</Button>
                </Link>
                <Button onClick={() => setResult(null)}>Done</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
