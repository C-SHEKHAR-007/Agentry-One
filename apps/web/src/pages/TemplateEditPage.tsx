import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { LayoutGrid, ListOrdered, Play, Save } from "lucide-react";
import { useTemplateDraft } from "../hooks/useTemplateDraft";
import { PageHeader } from "../components/PageHeader";
import { TemplateCanvas } from "../components/builder/TemplateCanvas";
import { TemplateFormView } from "../components/builder/TemplateFormView";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
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
    <div>
      <PageHeader
        title={draft.isNew ? "New template" : "Edit template"}
        description="Build a sequence of steps — each step runs one agent to completion. A later step can consume an earlier step's run inputs or produced artifacts (kind-checked live and again on save)."
        actions={
          <>
            <div className="flex rounded-md border border-border p-0.5">
              <button
                onClick={() => setView("canvas")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
                  view === "canvas" ? "bg-secondary text-foreground" : "text-muted-foreground",
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Canvas
              </button>
              <button
                onClick={() => setView("form")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
                  view === "form" ? "bg-secondary text-foreground" : "text-muted-foreground",
                )}
              >
                <ListOrdered className="h-3.5 w-3.5" /> Form
              </button>
            </div>
            {!draft.isNew && (
              <Button variant="secondary" onClick={() => navigate(`/templates/${templateId}/run`)}>
                <Play className="h-4 w-4" /> Run
              </Button>
            )}
            <Button
              onClick={() => draft.save.mutate()}
              disabled={!draft.targetProjectId || !draft.name || draft.save.isPending}
            >
              {draft.save.isPending ? <Spinner /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          </>
        }
      />

      <Input
        value={draft.name}
        onChange={(e) => draft.setName(e.target.value)}
        placeholder="Template name"
        className="mb-6 max-w-md"
      />

      {view === "canvas" ? <TemplateCanvas draft={draft} /> : <TemplateFormView draft={draft} />}

      {(draft.liveErrors.length > 0 || draft.serverErrors.length > 0) && (
        <Card className="mt-4 border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {[...new Set([...draft.liveErrors, ...draft.serverErrors])].map((e, i) => (
            <p key={i}>{e}</p>
          ))}
        </Card>
      )}
    </div>
  );
}
