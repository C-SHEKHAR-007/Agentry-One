import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeChange,
} from "reactflow";
import "reactflow/dist/style.css";
import { AlertTriangle, LayoutDashboard, Maximize2, MousePointerClick, Plus } from "lucide-react";
import type { TemplateDraft } from "../../hooks/useTemplateDraft";
import { fieldIssues, layoutSteps, NODE_WIDTH, COLUMN_GAP, runInputsOf, stepLabel } from "../../lib/workflowGraph";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { nodeTypes, type InputsNodeData, type StepNodeData } from "./WorkflowNodes";
import { StepEditorPanel } from "./StepEditorPanel";
import { stepIcon } from "./stepVisuals";

const INPUTS_ID = "run-inputs";
const INPUTS_WIDTH = 176;
const PANEL_WIDTH = 380;

export function WorkflowCanvas(props: { draft: TemplateDraft }) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}

/** Full-size workflow graph. Nodes/edges are derived from the draft on every
 * render; React Flow only owns transient UI state (positions after a drag).
 * Clicking a step opens it in the sidebar editor, one step at a time. */
function Canvas({ draft }: { draft: TemplateDraft }) {
  const rf = useReactFlow();
  const [selected, setSelected] = useState<number | null>(null);
  const [dragged, setDragged] = useState<Record<string, { x: number; y: number }>>({});
  const stepCount = draft.steps.length;

  const selectedIndex = selected === null ? -1 : draft.steps.findIndex((s) => s.stepOrder === selected);

  const issuesByStep = useMemo(() => {
    const out = new Map<number, number>();
    for (const s of draft.steps) {
      const agent = draft.manifestsById.get(s.agentId);
      const ms = agent?.manifest.steps.find((m) => m.key === s.agentStepKey) ?? agent?.manifest.steps[0];
      const n = Object.keys(fieldIssues(s, draft.steps, draft.producesFor, ms?.inputSchema.required ?? [])).length + (s.agentId ? 0 : 1);
      if (n) out.set(s.stepOrder, n);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.steps, draft.manifestsById]);
  const totalIssues = [...issuesByStep.values()].reduce((a, b) => a + b, 0);

  const openStep = useCallback((order: number) => setSelected(order), []);

  const addStep = useCallback(() => {
    const order = draft.addStep();
    setSelected(order);
  }, [draft]);

  const nodes: Node[] = useMemo(() => {
    const originX = INPUTS_WIDTH + COLUMN_GAP;
    const auto = layoutSteps(draft.steps, originX);
    const runInputs = runInputsOf(draft.steps);
    const ys = [...auto.values()].map((p) => p.y);
    const midY = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 + 40 : 40;

    const stepNodes: Node<StepNodeData>[] = draft.steps.map((s) => {
      const agent = draft.manifestsById.get(s.agentId);
      const id = `step-${s.stepOrder}`;
      return {
        id,
        type: "step",
        position: dragged[id] ?? auto.get(s.stepOrder) ?? { x: originX, y: 0 },
        data: {
          number: s.stepOrder + 1,
          agentName: agent?.name ?? (s.agentId ? s.agentId : null),
          actionKey: s.agentStepKey,
          icon: stepIcon(s.agentId, agent),
          produces: draft.producesFor(s),
          mappings: Object.entries(s.inputMapping),
          fieldLabel: (f: string) => f,
          issueCount: issuesByStep.get(s.stepOrder) ?? 0,
          active: s.stepOrder === selected,
          sourceLabel: stepLabel,
        },
      };
    });

    const inputsNode: Node<InputsNodeData> = {
      id: INPUTS_ID,
      type: "inputs",
      position: dragged[INPUTS_ID] ?? { x: 0, y: midY - 60 },
      data: { inputs: runInputs },
      selectable: false,
    };

    return [inputsNode, ...stepNodes];
  }, [draft, dragged, selected, issuesByStep]);

  const edges: Edge[] = useMemo(() => {
    const out: Edge[] = [];
    const muted = "hsl(var(--muted-foreground) / 0.45)";
    for (const step of draft.steps) {
      const runFields = Object.values(step.inputMapping).filter((v) => v.kind === "fromRunInput").length;
      if (runFields > 0) {
        out.push({
          id: `in-${step.stepOrder}`,
          source: INPUTS_ID,
          target: `step-${step.stepOrder}`,
          type: "smoothstep",
          style: { stroke: muted, strokeWidth: 1.5, strokeDasharray: "4 4" },
        });
      }
      const seen = new Set<string>();
      for (const v of Object.values(step.inputMapping)) {
        if (v.kind !== "fromStep") continue;
        const key = `${v.stepOrder}-${v.artifactKind}`;
        if (seen.has(key)) continue; // one edge per source+kind, even if it feeds two fields
        seen.add(key);
        const source = draft.steps.find((s) => s.stepOrder === v.stepOrder);
        if (!source) continue;
        const invalid = v.stepOrder >= step.stepOrder || !draft.producesFor(source).includes(v.artifactKind);
        const color = invalid ? "hsl(var(--destructive))" : "hsl(var(--primary))";
        out.push({
          id: `e-${v.stepOrder}-${step.stepOrder}-${v.artifactKind}`,
          source: `step-${v.stepOrder}`,
          target: `step-${step.stepOrder}`,
          type: "smoothstep",
          animated: !invalid,
          label: v.artifactKind,
          style: { stroke: color, strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
          labelStyle: { fill: invalid ? "hsl(var(--destructive))" : "hsl(var(--foreground))", fontSize: 11, fontWeight: 600 },
          labelBgStyle: { fill: "hsl(var(--card))" },
          labelBgPadding: [6, 3],
          labelBgBorderRadius: 6,
        });
      }
    }
    return out;
  }, [draft]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    for (const c of changes) {
      if (c.type === "position" && c.position) setDragged((p) => ({ ...p, [c.id]: c.position! }));
    }
  }, []);

  // Keep the whole workflow in view when steps are added or removed.
  const fit = useCallback(() => rf.fitView({ padding: 0.08, duration: 300, maxZoom: 1 }), [rf]);
  const firstFit = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => {
      fit();
      firstFit.current = true;
    }, firstFit.current ? 50 : 120);
    return () => clearTimeout(t);
  }, [stepCount, fit]);

  // Opening a step: bring it into view beside the sidebar instead of under it.
  useEffect(() => {
    if (selected === null) return;
    const node = rf.getNode(`step-${selected}`);
    if (!node) return;
    const { zoom } = rf.getViewport();
    const cx = node.position.x + NODE_WIDTH / 2 + PANEL_WIDTH / 2 / zoom;
    const cy = node.position.y + 70;
    rf.setCenter(cx, cy, { zoom, duration: 300 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const tidy = () => {
    setDragged({});
    setTimeout(fit, 50);
  };

  const firstIssue = draft.steps.find((s) => issuesByStep.has(s.stepOrder));

  return (
    <div className="relative h-full overflow-hidden rounded-xl border border-border bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={(_, node) => {
          if (node.id.startsWith("step-")) openStep(Number(node.id.slice(5)));
        }}
        onPaneClick={() => setSelected(null)}
        nodesConnectable={false}
        minZoom={0.3}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} color="hsl(var(--muted-foreground) / 0.25)" gap={20} size={1.2} />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          className={cn("!hidden !rounded-lg !border !border-border !bg-card", selectedIndex === -1 && "md:!block")}
          maskColor="hsl(var(--background) / 0.7)"
          nodeColor={(n) => (n.id.startsWith("step-") ? "hsl(var(--primary) / 0.55)" : "hsl(var(--muted-foreground) / 0.3)")}
        />
      </ReactFlow>

      {/* Floating toolbar */}
      <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-lg border border-border bg-card/95 p-1 shadow-sm backdrop-blur">
        <Button size="sm" variant="ghost" onClick={addStep}>
          <Plus className="h-4 w-4" /> Add step
        </Button>
        <span className="h-5 w-px bg-border" />
        <Button size="sm" variant="ghost" onClick={tidy} title="Re-arrange steps automatically">
          <LayoutDashboard className="h-4 w-4" /> Tidy up
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={fit} aria-label="Fit workflow to screen" title="Fit to screen">
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      {totalIssues > 0 && firstIssue && selectedIndex === -1 && (
        <button
          type="button"
          onClick={() => openStep(firstIssue.stepOrder)}
          className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-card/95 px-3 py-2 text-xs font-medium text-destructive shadow-sm backdrop-blur hover:bg-destructive/10"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          {totalIssues} {totalIssues === 1 ? "issue" : "issues"} · review {stepLabel(firstIssue.stepOrder)}
        </button>
      )}

      {selectedIndex === -1 && (
        <p className="pointer-events-none absolute bottom-4 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-card/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur sm:flex">
          <MousePointerClick className="h-3.5 w-3.5" /> Click a step to edit it · drag to rearrange
        </p>
      )}

      {selectedIndex !== -1 && (
        <StepEditorPanel
          draft={draft}
          index={selectedIndex}
          onSelect={(i) => setSelected(draft.steps[i]?.stepOrder ?? null)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
