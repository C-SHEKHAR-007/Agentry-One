import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { LayoutGrid, ListOrdered, Play, Save, Wand2 } from "lucide-react";
import { useTemplateDraft } from "../hooks/useTemplateDraft";
import { PageHeader } from "../components/PageHeader";
import { TemplateCanvas } from "../components/builder/TemplateCanvas";
import { TemplateFormView } from "../components/builder/TemplateFormView";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Spinner } from "../components/ui/spinner";
import { cn } from "../lib/utils";

export function TemplateEditPage() {
  const { templateId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectId = searchParams.get("projectId") ?? "";
  const view = searchParams.get("view") === "form" ? "form" : "canvas";

  const draft = useTemplateDraft(templateId, projectId);

  const setView = (v: "canvas" | "form") => {
    const next = new URLSearchParams(searchParams);
    if (v === "form") next.set("view", "form");
    else next.delete("view");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={draft.isNew ? "New template" : "Edit template"}
        description="Build a sequence of steps — each step runs one agent to completion. A later step can consume an earlier step's run inputs or produced artifacts (kind-checked live and again on save)."
        actions={
          <>
            <div className="flex rounded-md border border-border p-0.5 bg-card/50">
              <button
                onClick={() => setView("canvas")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
                  view === "canvas" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Canvas
              </button>
              <button
                onClick={() => setView("form")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
                  view === "form" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                )}
              >
                <ListOrdered className="h-3.5 w-3.5" /> Form
              </button>
            </div>
            {!draft.isNew && (
              <Button variant="secondary" onClick={() => navigate(`/templates/${templateId}/run`)}>
                <Play className="h-4 w-4 mr-2" /> Run
              </Button>
            )}
            <Button
              onClick={() => draft.save.mutate()}
              disabled={!draft.targetProjectId || !draft.name || draft.save.isPending}
            >
              {draft.save.isPending ? <Spinner className="mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </>
        }
      />

      <div className="flex-1 min-h-0 pb-6">
        <Input
          value={draft.name}
          onChange={(e) => draft.setName(e.target.value)}
          placeholder="Enter a descriptive name for your pipeline..."
          className="mb-6 max-w-md text-lg font-medium h-12 bg-card/50 backdrop-blur-sm border-border/60"
        />

        {draft.isNew && draft.steps.length <= 1 && (
          <Card glass className="mb-6 border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent overflow-hidden relative">
            <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />
            <CardContent className="p-5 flex items-start gap-4">
              <div className="shrink-0 rounded-full bg-primary/20 p-2.5 text-primary mt-0.5 shadow-sm ring-1 ring-primary/20">
                <Wand2 className="h-5 w-5" />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-semibold text-primary">How to build your Multi-Agent Workflow</h4>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
                  <strong>1. Pick Step 1:</strong> Select a starting Agent in the right panel (e.g., Trend Scraper).<br/>
                  <strong>2. Add Step 2:</strong> Click "+ Add step" and pick your next Agent (e.g., Scriptwriter).<br/>
                  <strong>3. Connect them:</strong> In Step 2's inputs, select <i>"from earlier step"</i>. Agentry will automatically find Step 1's outputs and wire them together!
                </p>
              </div>
            </CardContent>
          </Card>
        )}

      {view === "canvas" ? <TemplateCanvas draft={draft} /> : <TemplateFormView draft={draft} />}

      {(draft.liveErrors.length > 0 || draft.serverErrors.length > 0) && (
        <Card className="mt-4 border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {[...new Set([...draft.liveErrors, ...draft.serverErrors])].map((e, i) => (
            <p key={i}>{e}</p>
          ))}
        </Card>
      )}
      </div>
    </div>
  );
}
