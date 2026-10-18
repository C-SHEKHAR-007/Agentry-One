import { useState } from "react";
import { toast } from "sonner";
import { FolderKanban, Plus } from "lucide-react";
import { useCreateProjectMutation, useProjectsQuery } from "../projects.api";
import { errorMessage } from "../../../services/http/errors";
import { PageHeader } from "../../../components/common/PageHeader";
import { Button } from "../../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { EmptyState } from "../../../components/ui/empty-state";
import { Input } from "../../../components/ui/input";
import { Skeleton } from "../../../components/ui/skeleton";
import { Spinner } from "../../../components/ui/spinner";
import { ProjectCard } from "../components/ProjectCard";

export function ProjectsPage() {
  const { data: projects, isLoading } = useProjectsQuery();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const [create, createState] = useCreateProjectMutation();
  const createProject = {
    isPending: createState.isLoading,
    mutate: () =>
      create({ name })
        .unwrap()
        .then((p) => {
          toast.success(`Project "${p.name}" created`);
          setName("");
          setOpen(false);
        })
        .catch((err) => toast.error(errorMessage(err))),
  };

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Workspaces that group your workflows, templates, and artifacts."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New Project
          </Button>
        }
      />

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-52" />
          ))}
        </div>
      )}

      {projects?.length === 0 && (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create a project to start running agents and saving templates."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New Project
            </Button>
          }
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects?.map((p, i) => (
          <ProjectCard key={p.id} project={p} index={i} />
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) createProject.mutate();
            }}
            className="space-y-4"
          >
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || createProject.isPending}>
                {createProject.isPending && <Spinner />}
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
