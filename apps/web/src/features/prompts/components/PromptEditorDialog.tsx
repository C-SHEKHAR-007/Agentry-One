import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Braces, GitBranchPlus, Sparkles } from "lucide-react";
import type { Agent, Prompt } from "../../../models";
import { errorMessage } from "../../../services/http/errors";
import { useCreatePromptMutation } from "../prompts.api";
import { extractPlaceholders, textStats, toPromptKey } from "../../../lib/promptText";
import { Button } from "../../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { Spinner } from "../../../components/ui/spinner";
import { Textarea } from "../../../components/ui/textarea";

export type EditorMode =
  | { kind: "new" }
  /** Save an edited copy of an existing prompt as its next version. */
  | { kind: "version"; agentId: string; key: string; template: string; nextVersion: number };

export function PromptEditorDialog({
  mode,
  onClose,
  agents,
  prompts,
  onSaved,
}: {
  mode: EditorMode | null;
  onClose: () => void;
  agents: Agent[];
  prompts: Prompt[];
  onSaved: (p: Prompt) => void;
}) {
  const [createPrompt, createState] = useCreatePromptMutation();
  const [agentId, setAgentId] = useState("");
  const [key, setKey] = useState("");
  const [template, setTemplate] = useState("");

  useEffect(() => {
    if (!mode) return;
    if (mode.kind === "version") {
      setAgentId(mode.agentId);
      setKey(mode.key);
      setTemplate(mode.template);
    } else {
      setAgentId("");
      setKey("");
      setTemplate("");
    }
  }, [mode]);

  const isVersion = mode?.kind === "version";
  const normalizedKey = toPromptKey(key);
  const placeholders = useMemo(() => extractPlaceholders(template), [template]);
  const stats = useMemo(() => textStats(template), [template]);
  const unchanged = isVersion && template === mode.template;

  // Saving a "new" prompt under an existing agent+key appends a version
  // rather than failing -- tell the user before they click.
  const existingLatest = useMemo(() => {
    if (isVersion || !agentId || !normalizedKey) return null;
    return prompts
      .filter((p) => p.agentId === agentId && p.key === normalizedKey)
      .reduce<Prompt | null>((best, p) => (!best || p.version > best.version ? p : best), null);
  }, [isVersion, agentId, normalizedKey, prompts]);

  const save = {
    isPending: createState.isLoading,
    mutate: () =>
      createPrompt({ agentId, key: normalizedKey, template })
        .unwrap()
        .then((p) => {
          toast.success(p.version > 1 ? `Saved "${p.key}" as v${p.version}` : `Created "${p.key}"`);
          onSaved(p);
          onClose();
        })
        .catch((err) => toast.error(errorMessage(err))),
  };

  const canSave = Boolean(agentId && normalizedKey && template.trim()) && !unchanged && !save.isPending;

  return (
    <Dialog open={Boolean(mode)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isVersion ? <GitBranchPlus className="h-4 w-4 text-primary" /> : <Sparkles className="h-4 w-4 text-primary" />}
            {isVersion ? `New version of ${mode.key}` : "New prompt"}
          </DialogTitle>
          <DialogDescription>
            {isVersion
              ? `Edit the text and save it as v${mode.nextVersion}. Earlier versions stay in the history.`
              : "Save a prompt you want to reuse. Saving the same agent and key again creates a new version."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) save.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="prompt-agent">Agent</Label>
              <Select id="prompt-agent" value={agentId} onChange={(e) => setAgentId(e.target.value)} disabled={isVersion} required>
                <option value="">Select an agent…</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prompt-key">Key</Label>
              <Input
                id="prompt-key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                onBlur={() => setKey(normalizedKey)}
                placeholder="e.g. product-hero"
                disabled={isVersion}
                required
                className="font-mono"
              />
              {!isVersion && key && normalizedKey !== key && (
                <p className="text-xs text-muted-foreground">
                  Saved as <code className="text-foreground">{normalizedKey || "…"}</code>
                </p>
              )}
            </div>
          </div>

          {existingLatest && (
            <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              <strong>{normalizedKey}</strong> already exists for this agent — saving creates v{existingLatest.version + 1}.
            </p>
          )}

          <div className="space-y-1.5">
            <div className="flex items-end justify-between">
              <Label htmlFor="prompt-template">Prompt text</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {stats.words} words · {stats.characters} chars
              </span>
            </div>
            <Textarea
              id="prompt-template"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={10}
              required
              spellCheck
              placeholder={"Write the prompt. Use {{placeholders}} for the parts that change,\ne.g. A product shot of {{product}} on a {{surface}}."}
              className="min-h-[220px] text-sm leading-relaxed"
            />
            <div className="flex min-h-6 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Braces className="h-3.5 w-3.5" />
              {placeholders.length === 0 ? (
                <span>No placeholders — wrap a word in {"{{ }}"} to mark it as one.</span>
              ) : (
                placeholders.map((p) => (
                  <code key={p} className="rounded bg-primary/15 px-1.5 py-0.5 font-semibold text-primary">
                    {p}
                  </code>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            {unchanged && <span className="mr-auto text-xs text-muted-foreground">Edit the text to save a new version.</span>}
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSave}>
              {save.isPending && <Spinner />}
              {isVersion ? `Save v${mode.nextVersion}` : existingLatest ? `Save v${existingLatest.version + 1}` : "Create prompt"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
