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
      className={`w-60 rounded-lg border bg-card p-3 shadow-sm transition-colors ${
        hasError ? "border-destructive" : data.selected ? "border-primary" : "border-border"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-primary !border-0 !h-2.5 !w-2.5" />
      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Bot className="h-4 w-4" />
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
      <div className="mt-2 flex flex-wrap gap-1">
        {produces.map((k) => (
          <Badge key={k} variant="secondary" className="text-[10px]">
            → {k}
          </Badge>
        ))}
        {mappingCount > 0 && (
          <Badge variant="outline" className="text-[10px]">
            {mappingCount} mapped
          </Badge>
        )}
        {hasError && (
          <Badge variant="destructive" className="text-[10px]">
            invalid
          </Badge>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-primary !border-0 !h-2.5 !w-2.5" />
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
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="h-[480px] overflow-hidden rounded-lg border border-border bg-card/40 lg:col-span-2">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background color="hsl(var(--border))" gap={20} />
          <Controls showInteractive={false} />
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
