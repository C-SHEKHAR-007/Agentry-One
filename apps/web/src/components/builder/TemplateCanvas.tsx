import { useCallback, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import { Bot, Plus, Trash2 } from "lucide-react";
import type { TemplateDraft, StepDraft } from "../../hooks/useTemplateDraft";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Select } from "../ui/select";
import { StepMappingPanel } from "./StepMappingPanel";

interface StepNodeData {
  draft: TemplateDraft;
  index: number;
  hasError: boolean;
  selected: boolean;
}

function StepNode({ data }: NodeProps<StepNodeData>) {
  const { draft, index, hasError } = data;
  const step = draft.steps[index];
  if (!step) return null;
  const agent = draft.manifestsById.get(step.agentId);
  const produces = draft.producesFor(step);
  const mappingCount = Object.keys(step.inputMapping).length;

  return (
    <div
      className={`relative w-64 rounded-xl border p-4 shadow-sm backdrop-blur-md transition-all duration-300 ${
        hasError
          ? "border-destructive bg-destructive/5 ring-1 ring-destructive/20"
          : data.selected
            ? "border-primary bg-primary/5 ring-1 ring-primary/30 shadow-[0_0_15px_rgba(var(--primary),0.15)]"
            : "border-border/60 bg-card/80 hover:border-primary/50 hover:bg-card/90"
      }`}
    >
      {/* Decorative gradient blob for selected state */}
      {data.selected && (
        <div className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-br from-primary/10 to-transparent opacity-50" />
      )}
      
      <Handle type="target" position={Position.Left} className="!bg-primary !border-2 !border-background !h-3.5 !w-3.5 !-ml-1.5 transition-transform hover:scale-125" />
      <div className="flex items-center gap-3">
        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
          hasError ? "bg-destructive/15 text-destructive" : data.selected ? "bg-primary/20 text-primary shadow-inner" : "bg-primary/10 text-primary"
        }`}>
          <Bot className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {agent?.name ?? (step.agentId || "Pick an agent")}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            step {step.stepOrder} · {step.agentStepKey}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {produces.map((k) => (
          <Badge key={k} variant="secondary" className="text-[10px] bg-secondary/50">
            → {k}
          </Badge>
        ))}
        {mappingCount > 0 && (
          <Badge variant="outline" className="text-[10px] bg-background/50">
            {mappingCount} mapped
          </Badge>
        )}
        {hasError && (
          <Badge variant="destructive" className="text-[10px] shadow-sm">
            invalid
          </Badge>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-primary !border-2 !border-background !h-3.5 !w-3.5 !-mr-1.5 transition-transform hover:scale-125" />
    </div>
  );
}

const nodeTypes = { step: StepNode };

/** React Flow projection of the draft: nodes/edges are derived from
 * StepDraft[] every render; RF only owns transient position/selection UI
 * state. Edges = fromStep mappings, red when that reference is invalid. */
export function TemplateCanvas({ draft }: { draft: TemplateDraft }) {
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});

  const errorsByStep = useMemo(() => {
    const map = new Map<number, boolean>();
    for (const e of draft.liveErrors) {
      const m = e.match(/^step (\d+):/);
      if (m) map.set(Number(m[1]), true);
    }
    return map;
  }, [draft.liveErrors]);

  const nodes: Node<StepNodeData>[] = useMemo(
    () =>
      draft.steps.map((s, i) => ({
        id: String(s.stepOrder),
        type: "step",
        position: positions[String(s.stepOrder)] ?? { x: s.stepOrder * 300 + 20, y: 80 },
        selected: selectedOrder === s.stepOrder,
        data: {
          draft,
          index: i,
          hasError: errorsByStep.get(s.stepOrder) ?? false,
          selected: selectedOrder === s.stepOrder,
        },
      })),
    [draft, positions, selectedOrder, errorsByStep],
  );

  const edges: Edge[] = useMemo(() => {
    const out: Edge[] = [];
    for (const step of draft.steps) {
      for (const [field, v] of Object.entries(step.inputMapping)) {
        if (v.kind !== "fromStep") continue;
        const source = draft.steps.find((s) => s.stepOrder === v.stepOrder);
        const invalid =
          v.stepOrder >= step.stepOrder ||
          !source ||
          !draft.producesFor(source).includes(v.artifactKind);
        out.push({
          id: `${v.stepOrder}-${step.stepOrder}-${field}`,
          source: String(v.stepOrder),
          target: String(step.stepOrder),
          label: `${v.artifactKind} → ${field}`,
          animated: true,
          style: {
            stroke: invalid ? "hsl(var(--destructive))" : "hsl(var(--primary))",
            strokeWidth: 2,
          },
          labelStyle: { fill: "hsl(var(--muted-foreground))", fontSize: 10 },
          labelBgStyle: { fill: "hsl(var(--card))", fillOpacity: 0.9 },
        });
      }
    }
    return out;
  }, [draft]);

  // Only position drags and selection reach local UI state -- domain data
  // never flows through React Flow.
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    for (const change of changes) {
      if (change.type === "position" && change.position) {
        setPositions((p) => ({ ...p, [change.id]: change.position! }));
      }
      if (change.type === "select") {
        setSelectedOrder(change.selected ? Number(change.id) : null);
      }
    }
  }, []);

  const selectedIndex = draft.steps.findIndex((s) => s.stepOrder === selectedOrder);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="h-[520px] overflow-hidden rounded-xl border border-border/60 bg-background/50 shadow-inner lg:col-span-2 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-card/30 to-transparent pointer-events-none" />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background color="hsl(var(--border))" gap={24} size={1} />
          <Controls showInteractive={false} className="border-border/60 bg-card/80 backdrop-blur-sm shadow-sm" />
        </ReactFlow>
      </div>

      <div className="space-y-3">
        {selectedIndex === -1 && (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Select a step node to edit its agent and field mappings.
          </div>
        )}
        {selectedIndex !== -1 && (
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">Step {draft.steps[selectedIndex].stepOrder}</p>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Delete step"
                disabled={draft.steps.length === 1}
                onClick={() => {
                  draft.removeStep(selectedIndex);
                  setSelectedOrder(null);
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <Select
              value={draft.steps[selectedIndex].agentId}
              onChange={(e) => draft.updateStep(selectedIndex, { agentId: e.target.value })}
              className="mb-3"
            >
              <option value="">Select agent...</option>
              {draft.agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            {draft.steps[selectedIndex].agentId && (
              <StepMappingPanel draft={draft} index={selectedIndex} />
            )}
          </div>
        )}

        <Button variant="secondary" className="w-full" onClick={draft.addStep}>
          <Plus className="h-4 w-4" /> Add step
        </Button>
      </div>
    </div>
  );
}
