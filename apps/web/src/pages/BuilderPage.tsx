import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { LayoutGrid, Play, Plus, Workflow } from "lucide-react";
import { api } from "../api/client";
import { useProjects } from "../api/queries";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { EmptyState } from "../components/ui/empty-state";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";

interface Template {
  id: string;
  name: string;
  status: string;
}

export function BuilderPage() {
  const navigate = useNavigate();
  const { data: projects, isLoading } = useProjects();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedProject, setPickedProject] = useState("");

  const templateQueries = useQueries({
    queries: (projects ?? []).map((p) => ({
      queryKey: ["templates", p.id],
      queryFn: () => api.get<Template[]>(`/projects/${p.id}/templates`),
    })),
  });

  const rows = (projects ?? []).flatMap((p, i) =>
    (templateQueries[i]?.data ?? []).map((t) => ({ project: p, template: t })),
  );

  return (
    <div>
      <PageHeader
        title="Workflow Builder"
        description="Compose multi-step pipelines visually — each node runs one agent, edges wire artifacts into later steps."
        actions={
          <Button onClick={() => setPickerOpen(true)}>
            <Plus className="h-4 w-4" /> New template
          </Button>
        }
      />

      {isLoading && <Skeleton className="h-48" />}

      {!isLoading && rows.length === 0 && (
        <EmptyState
          icon={Workflow}
          title="No templates yet"
          description="Create a template to chain agent steps into a reusable pipeline."
          action={
            <Button onClick={() => setPickerOpen(true)}>
              <Plus className="h-4 w-4" /> New template
            </Button>
          }
        />
      )}

      <div className="grid gap-3">
        {rows.map(({ project, template }) => (
          <Card key={template.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <Link
              to={`/templates/${template.id}/edit`}
              className="flex min-w-0 items-center gap-3"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <LayoutGrid className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium hover:text-primary">{template.name}</p>
                <p className="truncate text-xs text-muted-foreground">{project.name}</p>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <StatusBadge status={template.status} />
              <Link to={`/templates/${template.id}/edit`}>
                <Button size="sm" variant="secondary">
                  Open in canvas
                </Button>
              </Link>
              <Link to={`/templates/${template.id}/run`}>
                <Button size="sm">
                  <Play className="h-3.5 w-3.5" /> Run
                </Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New template</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (pickedProject) navigate(`/templates/new?projectId=${pickedProject}`);
            }}
            className="space-y-4"
          >
            <div>
              <Label>Project</Label>
              <Select value={pickedProject} onChange={(e) => setPickedProject(e.target.value)} required>
                <option value="">Select a project...</option>
                {projects?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setPickerOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!pickedProject}>
                Open builder
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
