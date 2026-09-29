import { memo, useMemo } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import type { RunDetail } from "../../models";
import { formatDuration, formatTokens } from "../../lib/format";
import { statusStyle, TONE } from "../../lib/status";
import { cn } from "../../lib/utils";
import { COLUMN_GAP, layoutSteps, NODE_WIDTH, runInputsOf, type GraphStep } from "../../lib/workflowGraph";
import { stepIcon } from "../builder/stepVisuals";
import { InputsNode } from "../builder/WorkflowNodes";
import { StatusDot } from "../StatusBadge";

type RunStep = RunDetail["steps"][number];

export interface RunNodeData {
  step: RunStep;
  agentName: string;
  selected: boolean;
}

const handleClass = "!h-2.5 !w-2.5 !border-2 !border-background !bg-muted-foreground/60";

/** One step of a run, drawn with its live state: status ring, progress,
 * model, duration and tokens. */
const RunStepNode = memo(function RunStepNode({ data }: NodeProps<RunNodeData>) {
  const { step, agentName, selected } = data;
  const st = statusStyle(step.status);
  const tone = TONE[st.tone];
  const Icon = stepIcon(step.templateStep.agentId);
  const u = step.usage;
  const tokens = u.inputTokens + u.outputTokens;
  const running = step.status === "running";
  const pending = step.status === "pending";

  return (
    <div
      style={{ width: NODE_WIDTH }}
      className={cn(
        "cursor-pointer rounded-xl border bg-card/95 shadow-sm backdrop-blur transition-all duration-300",
        pending ? "border-dashed border-border opacity-70" : tone.border,
        running && "animate-status-glow",
        selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:-translate-y-0.5 hover:shadow-lg",
      )}
    >
      <Handle type="target" position={Position.Left} className={handleClass} />
      <div className="flex items-center gap-3 px-3.5 pb-2.5 pt-3">
        <span className={cn("relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", pending ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary")}>
          <Icon className="h-[18px] w-[18px]" />
          {!pending && (
            <span className={cn("absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-card", tone.bg, tone.text)}>
              {st.live ? <StatusDot status={step.status} className="h-1.5 w-1.5" /> : <st.icon className="h-2.5 w-2.5" />}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Step {step.templateStep.stepOrder + 1}</p>
          <p className="truncate text-sm font-semibold">{agentName}</p>
        </div>
      </div>

      <div className="px-3.5 pb-3">
        {running ? (
          <>
            <div className="relative h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${Math.max(u.progressPercent ?? 8, 8)}%` }} />
              <span className="absolute inset-y-0 w-1/3 animate-sweep bg-gradient-to-r from-transparent via-white/60 to-transparent" />
            </div>
            <p className="mt-1.5 truncate text-[11px] text-muted-foreground">{u.progressMessage ?? "Working…"}</p>
          </>
        ) : step.status === "failed" ? (
          <p className="line-clamp-2 text-[11px] text-destructive/90">{u.error ?? "Failed"}</p>
        ) : pending ? (
          <p className="text-[11px] text-muted-foreground">Waiting for upstream steps</p>
        ) : (
          <p className="truncate font-mono text-[11px] text-muted-foreground">{u.model ?? "—"}</p>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-border/60 px-3.5 py-2 font-mono text-[11px] text-muted-foreground">
        <span className={cn("mr-auto font-sans font-semibold", tone.text)}>{st.label}</span>
        <span className="tabular">{formatDuration(u.durationMs)}</span>
        <span className="tabular">{tokens > 0 ? `${formatTokens(tokens, { compact: true })} tok` : u.attempts > 1 ? `${u.attempts} attempts` : "—"}</span>
      </div>
      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  );
});

const nodeTypes = { runStep: RunStepNode, inputs: InputsNode };
const INPUTS_ID = "run-inputs";
const INPUTS_WIDTH = 176;

function Graph({
  run,
  agentNames,
  selected,
  onSelect,
}: {
  run: RunDetail;
  agentNames: Map<string, string>;
  selected: number | null;
  onSelect: (stepOrder: number) => void;
}) {
  const { nodes, edges } = useMemo(() => {
    const graphSteps: GraphStep[] = run.steps.map((s) => ({
      stepOrder: s.templateStep.stepOrder,
      agentId: s.templateStep.agentId,
      agentStepKey: s.templateStep.agentStepKey,
      inputMapping: s.templateStep.inputMapping,
    }));
    const byOrder = new Map(run.steps.map((s) => [s.templateStep.stepOrder, s]));
    const originX = INPUTS_WIDTH + COLUMN_GAP;
    const pos = layoutSteps(graphSteps, originX);
    const inputs = runInputsOf(graphSteps);
    const ys = [...pos.values()].map((p) => p.y);
    const midY = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 + 30 : 30;

    const nodes: Node[] = run.steps.map((s) => ({
      id: `step-${s.templateStep.stepOrder}`,
      type: "runStep",
      position: pos.get(s.templateStep.stepOrder) ?? { x: originX, y: 0 },
      data: {
        step: s,
        agentName: s.workflow?.agentName ?? agentNames.get(s.templateStep.agentId) ?? s.templateStep.agentId,
        selected: selected === s.templateStep.stepOrder,
      } satisfies RunNodeData,
    }));
    if (inputs.length) {
      nodes.unshift({ id: INPUTS_ID, type: "inputs", position: { x: 0, y: midY - 40 }, data: { inputs }, selectable: false });
    }

    const edgeFor = (id: string, source: string, targetStep: RunStep, sourceDone: boolean, label?: string): Edge => {
      const live = targetStep.status === "running";
      const done = sourceDone && targetStep.status === "completed";
      const color = live ? "hsl(var(--primary))" : done ? "hsl(var(--success))" : "hsl(var(--muted-foreground) / 0.45)";
      return {
        id,
        source,
        target: `step-${targetStep.templateStep.stepOrder}`,
        className: live ? "edge-live" : undefined,
        style: { stroke: color, strokeWidth: live || done ? 2 : 1.5, strokeDasharray: !live && !done ? "4 4" : undefined },
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
        label,
        labelStyle: { fontSize: 10, fill: "hsl(var(--muted-foreground))", fontFamily: "Geist Mono Variable, monospace" },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 4,
      };
    };

    const edges: Edge[] = [];
    for (const s of run.steps) {
      const seen = new Set<string>();
      for (const v of Object.values(s.templateStep.inputMapping)) {
        if (v.kind === "fromStep" && byOrder.has(v.stepOrder)) {
          const key = `s${v.stepOrder}-${v.artifactKind}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const src = byOrder.get(v.stepOrder)!;
          edges.push(edgeFor(`e-${v.stepOrder}-${s.templateStep.stepOrder}-${v.artifactKind}`, `step-${v.stepOrder}`, s, src.status === "completed", v.artifactKind));
        } else if (v.kind === "fromRunInput" && !seen.has("inputs") && inputs.length) {
          seen.add("inputs");
          edges.push(edgeFor(`e-in-${s.templateStep.stepOrder}`, INPUTS_ID, s, true));
        }
      }
    }
    return { nodes, edges };
  }, [run, agentNames, selected]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.12, maxZoom: 1.15, minZoom: 0.6 }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      onNodeClick={(_, n) => n.id.startsWith("step-") && onSelect(Number(n.id.slice(5)))}
      proOptions={{ hideAttribution: true }}
      minZoom={0.3}
      maxZoom={1.6}
    >
      <Background variant={BackgroundVariant.Dots} color="hsl(var(--muted-foreground) / 0.25)" gap={20} size={1.2} />
      <Controls showInteractive={false} position="bottom-left" />
    </ReactFlow>
  );
}

/** Read-only graph of a run: the workflow's steps and data flow, coloured by
 * live status, with animated edges into whatever is running now. */
export function RunGraph(props: {
  run: RunDetail;
  agentNames: Map<string, string>;
  selected: number | null;
  onSelect: (stepOrder: number) => void;
}) {
  return (
    <ReactFlowProvider>
      <Graph {...props} />
    </ReactFlowProvider>
  );
}
