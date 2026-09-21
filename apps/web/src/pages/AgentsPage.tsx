import { useState } from "react";
import { Plus, RefreshCw, Code2, Search, Trash2, Bot, Sparkles, Activity, Layers } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../api/client.js";
import type { Agent, Capability } from "../api/types";
import { useAgentStats, useSystemHealth } from "../api/queries";
import { comingSoonAgents } from "../data/comingSoonAgents";
import { ComingSoonAgentCard, InstalledAgentCard } from "../components/AgentCard";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { SystemHealthPanel } from "../components/SystemHealthPanel";
import { ResponsiveTabs } from "../components/ui/responsive-tabs";

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

export function AgentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active tab: "all" | "installed" | "custom" | "workers"
  const activeTab = searchParams.get("tab") || (searchParams.get("filter") === "installed" ? "installed" : "all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: agents, isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.get<Agent[]>("/agents"),
  });
  const { data: capabilities } = useQuery({
    queryKey: ["capabilities"],
    queryFn: () => api.get<Capability[]>("/capabilities"),
  });
  const { data: agentStats } = useAgentStats();
  const { data: health } = useSystemHealth();

  const runsByAgent = new Map(
    (agentStats?.agents ?? []).map((a) => [a.agentId, a.runs]),
  );
  const onlineByAgent = new Map(
    (health?.workers ?? []).map((w) => [w.agentId, w.online]),
  );

  // Developer Scaffold modal state
  const [scaffoldOpen, setScaffoldOpen] = useState(false);
  const [scaffoldResult, setScaffoldResult] = useState<ScaffoldResult | null>(null);
  const [scaffoldForm, setScaffoldForm] = useState({ id: "", name: "", description: "", capability: "" });
  const [scaffoldFields, setScaffoldFields] = useState<FieldDraft[]>([
    { name: "message", type: "string", required: true },
  ]);

  const rescan = useMutation({
    mutationFn: () => api.post<{ agents: { id: string }[] }>("/agents/rescan"),
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast.success(`Registry rescanned — ${d.agents.length} agent(s) found`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const scaffold = useMutation({
    mutationFn: () =>
      api.post<ScaffoldResult>("/agents/scaffold", {
        ...scaffoldForm,
        capability: scaffoldForm.capability || undefined,
        fields: scaffoldFields,
      }),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setScaffoldOpen(false);
      setScaffoldResult(r);
      setScaffoldForm({ id: "", name: "", description: "", capability: "" });
      setScaffoldFields([{ name: "message", type: "string", required: true }]);
      toast.success(`Python agent "${r.agent?.name}" scaffolded to agents/${r.agent?.id}`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const setTab = (tab: string) => {
    setSearchParams(tab === "all" ? {} : { tab });
  };

  // Filter agents based on tab & search query
  const filteredAgents = (agents ?? []).filter((agent) => {
    const matchesSearch =
      !searchQuery.trim() ||
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.id.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === "custom") {
      return agent.id.startsWith("custom-");
    }
    return true;
  });

  const filteredComingSoon = comingSoonAgents.filter((agent) => {
    if (activeTab === "installed" || activeTab === "custom" || activeTab === "workers") return false;
    if (!searchQuery.trim()) return true;
    return (
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Agents"
        description="Discover, orchestrate, and create custom AI agents & skills. Configure prompts, modalities, models, and execution human review gates."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {activeTab === "workers" ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => rescan.mutate()}
                disabled={rescan.isPending}
                className="text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${rescan.isPending ? "animate-spin" : ""}`} />
                Rescan Registry
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setScaffoldOpen(true)}
                className="text-xs text-muted-foreground hover:text-foreground"
                title="Generate boilerplate Python agent files in the repo"
              >
                <Code2 className="h-3.5 w-3.5 mr-1.5" />
                Scaffold Code
              </Button>
            )}

            <Button
              size="sm"
              onClick={() => navigate("/agents/create-skill")}
              className="bg-primary hover:bg-primary/90 text-xs shadow-sm"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Create Agent
            </Button>
          </div>
        }
      />

      {/* Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
        <ResponsiveTabs
          activeTab={activeTab}
          onChange={setTab}
          tabs={[
            { id: "all", label: "All Agents", icon: Layers, count: (agents?.length ?? 0) + comingSoonAgents.length },
            { id: "installed", label: "Installed", icon: Bot, count: agents?.length ?? 0 },
            { id: "custom", label: "Custom", icon: Sparkles, iconColor: "text-purple-400", count: agents?.filter((a) => a.id.startsWith("custom-")).length ?? 0 },
            { id: "workers", label: "Worker Diagnostics", icon: Activity, iconColor: "text-emerald-400" }
          ]}
        />

        {/* Search Filter (for grid tabs) */}
        {activeTab !== "workers" && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter agents..."
              className="h-8 pl-8 text-xs bg-background/60"
            />
          </div>
        )}
      </div>

      {/* 1. Worker Diagnostics Tab */}
      {activeTab === "workers" ? (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="glass-panel">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-400" /> System &amp; Worker Health
                </CardTitle>
                <CardDescription className="text-xs">
                  Heartbeat state of supervised worker runner processes connected to Redis queues.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {health ? <SystemHealthPanel health={health} /> : <Skeleton className="h-48" />}
              </CardContent>
            </Card>

            <Card className="glass-panel flex flex-col justify-between">
              <div>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-primary" /> Developer Code Scaffolding
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Need to code a heavy agent in Python with custom libraries? Scaffold boilerplate worker code directly onto disk.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-2">
                  <p>
                    Writes into the repo&apos;s <code>agents/</code> directory with <code>manifest.json</code>, <code>worker.py</code>, and <code>requirements.txt</code>.
                  </p>
                  <p>
                    For quick dynamic agents with custom prompts and models without code, use <strong>Create Agent</strong> instead.
                  </p>
                </CardContent>
              </div>
              <CardContent className="pt-0">
                <Button size="sm" variant="outline" onClick={() => setScaffoldOpen(true)} className="w-full text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Scaffold Python Worker Files
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* 2. Agent Cards Grid */
        <div>
          {isLoading && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          )}

          {!isLoading && filteredAgents.length === 0 && filteredComingSoon.length === 0 && (
            <div className="p-12 text-center border border-dashed border-border rounded-xl space-y-3">
              <Bot className="h-8 w-8 mx-auto text-muted-foreground" />
              <div className="text-sm font-medium">No agents found</div>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No agents matched your current filter. Create a new custom agent or adjust your search query.
              </p>
              <Button size="sm" onClick={() => navigate("/agents/create-skill")} className="text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" /> Create Custom Agent
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAgents.map((agent, i) => (
              <InstalledAgentCard
                key={agent.id}
                agent={agent}
                runs={runsByAgent.get(agent.id)}
                online={onlineByAgent.get(agent.id)}
                delay={i * 0.04}
              />
            ))}

            {filteredComingSoon.map((agent, i) => (
              <ComingSoonAgentCard
                key={agent.id}
                agent={agent}
                delay={((filteredAgents.length ?? 0) + i) * 0.04}
              />
            ))}
          </div>
        </div>
      )}

      {/* Developer Scaffold Wizard Dialog */}
      <Dialog open={scaffoldOpen} onOpenChange={setScaffoldOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Code2 className="h-4 w-4 text-primary" /> Scaffold Python Worker on Disk
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              scaffold.mutate();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Agent Slug</Label>
                <Input
                  value={scaffoldForm.id}
                  onChange={(e) => setScaffoldForm({ ...scaffoldForm, id: e.target.value })}
                  placeholder="e.g. echo-agent"
                  pattern="[a-z][a-z0-9-]{1,39}"
                  required
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">Display Name</Label>
                <Input
                  value={scaffoldForm.name}
                  onChange={(e) => setScaffoldForm({ ...scaffoldForm, name: e.target.value })}
                  placeholder="e.g. Echo Agent"
                  required
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                value={scaffoldForm.description}
                onChange={(e) => setScaffoldForm({ ...scaffoldForm, description: e.target.value })}
                rows={2}
                placeholder="What does this agent do?"
                className="text-xs"
              />
            </div>

            <div>
              <Label className="text-xs">Capability</Label>
              <Select
                value={scaffoldForm.capability}
                onChange={(e) => setScaffoldForm({ ...scaffoldForm, capability: e.target.value })}
                className="h-8 text-xs"
              >
                <option value="">None / custom</option>
                {capabilities?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label className="text-xs">Input Schema Fields</Label>
              <div className="space-y-2 mt-1">
                {scaffoldFields.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={f.name}
                      onChange={(e) =>
                        setScaffoldFields(scaffoldFields.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                      }
                      placeholder="field_name"
                      className="h-8 text-xs flex-1 font-mono"
                      required
                    />
                    <Select
                      value={f.type}
                      onChange={(e) =>
                        setScaffoldFields(
                          scaffoldFields.map((x, j) =>
                            j === i ? { ...x, type: e.target.value as FieldDraft["type"] } : x,
                          ),
                        )
                      }
                      className="h-8 text-xs w-28"
                    >
                      <option value="string">string</option>
                      <option value="number">number</option>
                      <option value="integer">integer</option>
                      <option value="boolean">boolean</option>
                    </Select>
                    <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={f.required}
                        onChange={(e) =>
                          setScaffoldFields(
                            scaffoldFields.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)),
                          )
                        }
                      />
                      Req
                    </label>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={scaffoldFields.length === 1}
                      onClick={() => setScaffoldFields(scaffoldFields.filter((_, j) => j !== i))}
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setScaffoldFields([...scaffoldFields, { name: "", type: "string", required: false }])}
                  className="text-xs h-7"
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Field
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
              <Button type="button" variant="ghost" size="sm" onClick={() => setScaffoldOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={scaffold.isPending} className="text-xs">
                {scaffold.isPending ? "Scaffolding..." : "Create Boilerplate Files"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Scaffold Result Dialog */}
      <Dialog open={scaffoldResult != null} onOpenChange={(open) => !open && setScaffoldResult(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base">Agent files created!</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            <p>Boilerplate files were written into the repository:</p>
            <ul className="list-disc pl-5 font-mono text-muted-foreground space-y-0.5">
              {scaffoldResult?.files.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <p>Run the worker with:</p>
            <pre className="rounded bg-black/50 p-2.5 font-mono text-primary text-[11px] overflow-x-auto">
              {scaffoldResult?.workerCommand}
            </pre>
            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => setScaffoldResult(null)} className="text-xs">
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
