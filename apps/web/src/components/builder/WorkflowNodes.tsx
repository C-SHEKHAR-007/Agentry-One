import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { AlertTriangle, Keyboard, Link2, PenLine } from "lucide-react";
import type { InputMappingValue } from "../../api/types";
import { cn } from "../../lib/utils";
import { NODE_WIDTH } from "../../lib/workflowGraph";
import { KindChip } from "./stepVisuals";

export interface StepNodeData {
  number: number;
  agentName: string | null;
  actionKey: string;
  icon: React.ComponentType<{ className?: string }>;
  produces: string[];
  mappings: Array<[string, InputMappingValue]>;
  fieldLabel: (field: string) => string;
  issueCount: number;
  active: boolean;
  sourceLabel: (order: number) => string;
}

const handleClass = "!h-2.5 !w-2.5 !border-2 !border-background !bg-muted-foreground/60";

function describe(v: InputMappingValue, sourceLabel: (order: number) => string): { icon: typeof PenLine; text: string } {
  if (v.kind === "fromStep") return { icon: Link2, text: `${sourceLabel(v.stepOrder)} · ${v.artifactKind}` };
  if (v.kind === "fromRunInput") return { icon: Keyboard, text: v.field ? `run input · ${v.field}` : "run input" };
  const s = v.value === undefined || v.value === null ? "" : String(v.value);
  return { icon: PenLine, text: s ? `"${s}"` : "not set" };
}

export const StepNode = memo(function StepNode({ data }: NodeProps<StepNodeData>) {
  const Icon = data.icon;
  const shown = data.mappings.slice(0, 3);
  const hidden = data.mappings.length - shown.length;
  return (
    <div
      style={{ width: NODE_WIDTH }}
      className={cn(
        "group cursor-pointer rounded-xl border bg-card shadow-sm transition-all",
        data.active
          ? "border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.2)]"
          : data.issueCount > 0
            ? "border-destructive/60 hover:border-destructive"
            : "border-border hover:border-primary/50 hover:shadow-md",
      )}
    >
      <Handle type="target" position={Position.Left} className={handleClass} />
      <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Step {data.number}</p>
          <p className={cn("truncate text-sm font-semibold", !data.agentName && "text-muted-foreground")}>
            {data.agentName ?? "Choose an agent"}
          </p>
        </div>
        {data.issueCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
            <AlertTriangle className="h-3 w-3" /> {data.issueCount}
          </span>
        )}
      </div>
      <div className="space-y-1 px-4 py-2.5">
        {shown.length === 0 ? (
          <p className="py-1 text-xs text-muted-foreground">{data.agentName ? "No inputs configured" : "Click to configure"}</p>
        ) : (
          shown.map(([field, v]) => {
            const d = describe(v, data.sourceLabel);
            const DIcon = d.icon;
            return (
              <div key={field} className="flex items-center gap-1.5 text-xs">
                <span className="max-w-[45%] shrink-0 truncate text-muted-foreground">{data.fieldLabel(field)}</span>
                <DIcon className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                <span className="truncate text-foreground/90">{d.text}</span>
              </div>
            );
          })
        )}
        {hidden > 0 && <p className="text-[11px] text-muted-foreground">+{hidden} more</p>}
      </div>
      {data.produces.length > 0 && (
        <div className="flex items-center gap-1.5 border-t border-border/60 px-4 py-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Outputs</span>
          {data.produces.map((k) => (
            <KindChip key={k} kind={k} />
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  );
});

export interface InputsNodeData {
  inputs: Array<{ name: string; usedBy: number[] }>;
}

/** The workflow's entry point: the values asked for when it's run. */
export const InputsNode = memo(function InputsNode({ data }: NodeProps<InputsNodeData>) {
  return (
    <div className="w-44 rounded-xl border border-dashed border-border bg-card/70 p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Keyboard className="h-3 w-3" /> Run inputs
      </p>
      {data.inputs.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">None — every value is fixed or comes from a step.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {data.inputs.map((i) => (
            <li key={i.name} className="flex items-center justify-between gap-2 text-xs">
              <code className="truncate font-medium text-foreground">{i.name}</code>
              <span className="shrink-0 text-muted-foreground">→ {i.usedBy.map((o) => o + 1).join(", ")}</span>
            </li>
          ))}
        </ul>
      )}
      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  );
});

export const nodeTypes = { step: StepNode, inputs: InputsNode };
