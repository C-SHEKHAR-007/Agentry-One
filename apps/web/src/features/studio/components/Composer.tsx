import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Check, Lock, Sparkles } from "lucide-react";
import { planBrief, ROLE_ORDER, type Role } from "../../../lib/studioPlan";
import type { StudioDraft } from "../studio.slice";
import { cn } from "../../../lib/utils";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { Spinner } from "../../../components/ui/spinner";
import { Textarea } from "../../../components/ui/textarea";
import { PipelineStrip } from "./PipelineStrip";
import { ROLES } from "./roles";

export type { SocialAccount } from "../../../models";
import type { SocialAccount } from "../../../models";

/** The composer's state is the Studio draft (features/studio/studio.slice). */
export type ComposerState = StudioDraft;

const TONE_PRESETS = ["Friendly & warm", "Bold & viral", "Professional", "Playful", "Calm & minimal"];
const EXAMPLES = [
  "5 hidden AI tools that save creators 10 hours a week",
  "Behind the scenes of our product launch",
  "Morning routine tips for remote teams",
];
const TOPIC_MAX = 2000;

export function Composer({
  value,
  onChange,
  projects,
  projectId,
  onProjectChange,
  accounts,
  onGenerate,
  generating,
}: {
  value: ComposerState;
  onChange: (next: ComposerState) => void;
  projects: Array<{ id: string; name: string }>;
  projectId: string;
  onProjectChange: (id: string) => void;
  accounts: SocialAccount[];
  onGenerate: () => void;
  generating: boolean;
}) {
  const set = (patch: Partial<ComposerState>) => onChange({ ...value, ...patch });
  const plan = useMemo(() => planBrief(value.roles, Boolean(value.socialAccountId)), [value.roles, value.socialAccountId]);
  const required = new Map(plan.steps.filter((s) => s.reason.kind === "required").map((s) => [s.role, s.reason.kind === "required" ? s.reason.by : []]));

  const toggle = (role: Role) => set({ roles: value.roles.includes(role) ? value.roles.filter((r) => r !== role) : [...value.roles, role] });

  const blocker = !projectId
    ? "Create a project first"
    : !value.topic.trim()
      ? "Describe what the content is about"
      : plan.steps.length === 0
        ? "Pick at least one output"
        : null;

  return (
    <Card glass className="flex flex-col overflow-hidden lg:h-[var(--studio-h,calc(100dvh-12.5rem))] lg:min-h-[480px]">
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          if (!blocker && !generating) onGenerate();
        }}
        onKeyDown={(e) => {
          // ⌘/Ctrl+Enter generates from anywhere in the composer.
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !blocker && !generating) {
            e.preventDefault();
            onGenerate();
          }
        }}
      >
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 scrollbar-thin">
        {projects.length > 1 && (
          <div className="space-y-1.5">
            <Label htmlFor="studio-project" className="text-xs">
              Project
            </Label>
            <Select id="studio-project" value={projectId} onChange={(e) => onProjectChange(e.target.value)} className="h-8 py-1 text-sm">
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="studio-topic" className="text-xs">
              What's it about?
            </Label>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {value.topic.length}/{TOPIC_MAX}
            </span>
          </div>
          <Textarea
            id="studio-topic"
            value={value.topic}
            maxLength={TOPIC_MAX}
            onChange={(e) => set({ topic: e.target.value })}
            placeholder="A topic, campaign idea or product announcement…"
            rows={3}
            className="text-sm leading-relaxed"
          />
          {!value.topic.trim() && (
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 pt-0.5 scrollbar-thin">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => set({ topic: ex })}
                  className="shrink-0 whitespace-nowrap rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="studio-tone" className="text-xs">
            Tone <span className="font-normal text-muted-foreground">· optional</span>
          </Label>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-thin">
            {TONE_PRESETS.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={value.tone === t}
                onClick={() => set({ tone: value.tone === t ? "" : t })}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  value.tone === t ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <Input
            id="studio-tone"
            value={value.tone}
            maxLength={200}
            onChange={(e) => set({ tone: e.target.value })}
            placeholder="…or describe your own"
            className="h-8 text-xs"
          />
        </div>

        {/* min-w-0: fieldsets default to min-content width and would overflow the card */}
        <fieldset className="min-w-0">
          <legend className="mb-2 text-xs font-medium">Outputs</legend>
          <div className="grid grid-cols-2 gap-2">
            {ROLE_ORDER.map((role) => {
              const meta = ROLES[role];
              const Icon = meta.icon;
              const selected = value.roles.includes(role);
              const neededBy = required.get(role);
              const isPublish = role === "publish";
              const publishUnavailable = isPublish && accounts.length === 0;
              const on = selected || Boolean(neededBy);
              return (
                <div key={role} className={cn(isPublish && "col-span-2")}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    aria-label={meta.label}
                    disabled={Boolean(neededBy) || publishUnavailable}
                    onClick={() => toggle(role)}
                    title={meta.description}
                    className={cn(
                      "group relative flex h-full w-full flex-col items-start gap-2 rounded-lg border p-2.5 text-left transition-all disabled:cursor-not-allowed",
                      on
                        ? "border-primary/50 bg-primary/[0.08] shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]"
                        : "border-border/70 hover:-translate-y-px hover:border-primary/30 hover:bg-secondary/30",
                      publishUnavailable && "opacity-60 hover:translate-y-0",
                      isPublish && "flex-row items-center",
                    )}
                  >
                    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors", on ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground group-hover:text-foreground")}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium leading-tight">{meta.label}</span>
                      <span className={cn("mt-0.5 block text-[11px] leading-snug", neededBy ? "text-primary/90" : "text-muted-foreground", !isPublish && "line-clamp-2")}>
                        {neededBy ? `Included — needed for ${neededBy.map((r) => ROLES[r].short.toLowerCase()).join(" and ")}` : meta.description}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded border transition-colors",
                        isPublish && "static",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                      )}
                    >
                      {neededBy ? <Lock className="h-2.5 w-2.5" /> : on ? <Check className="h-3 w-3" /> : null}
                    </span>
                  </button>
                  {isPublish && selected && accounts.length > 0 && (
                    <Select
                      aria-label="Account to publish to"
                      value={value.socialAccountId}
                      onChange={(e) => set({ socialAccountId: e.target.value })}
                      className="mt-1.5 h-8 py-1 text-xs"
                    >
                      <option value="">Choose an account…</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.platform} {a.handle ? `· ${a.handle}` : ""}
                        </option>
                      ))}
                    </Select>
                  )}
                  {publishUnavailable && (
                    <p className="mt-1 pl-1 text-[11px] text-muted-foreground">
                      <Link to="/integrations" className="text-primary hover:underline">
                        Connect a social account
                      </Link>{" "}
                      to publish automatically — you can still publish by hand after generating.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
        </div>

        {/* Pinned footer: what will run + generate, always in view. */}
        <div className="space-y-3 border-t border-border/60 bg-card/80 p-4 backdrop-blur">
          {plan.steps.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Pick at least one output.</p>
          ) : (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {plan.steps.length} {plan.steps.length === 1 ? "agent runs" : "agents run"} in order
              </p>
              <PipelineStrip steps={plan.steps.map((s) => ({ role: s.role, auto: s.reason.kind === "required" }))} />
            </div>
          )}
          {plan.dropped.map((d) => (
            <p key={d.role} className="text-[11px] text-warning">
              {ROLES[d.role].label} won't run: {d.why}
            </p>
          ))}
          <Button type="submit" className="w-full" disabled={Boolean(blocker) || generating} title={blocker ?? undefined}>
            {generating ? <Spinner /> : <Sparkles className="h-4 w-4" />}
            {generating ? "Starting…" : "Generate content"}
            {!generating && !blocker && <kbd className="ml-auto hidden rounded bg-primary-foreground/15 px-1.5 font-mono text-[11px] sm:inline">⌘↵</kbd>}
          </Button>
          {blocker && !generating && <p className="-mt-1.5 text-center text-[11px] text-muted-foreground">{blocker}</p>}
        </div>
      </form>
    </Card>
  );
}
