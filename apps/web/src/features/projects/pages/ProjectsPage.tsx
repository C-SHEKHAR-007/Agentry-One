import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { FolderKanban, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { useCreateProjectMutation, useProjectsQuery } from "../projects.api";
import { routes } from "../../../services/api/routes";
import { errorMessage } from "../../../services/http/errors";
import { timeAgo } from "../../../lib/format";
import { PageHeader } from "../../../components/common/PageHeader";
import { Button } from "../../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { EmptyState } from "../../../components/ui/empty-state";
import { Input } from "../../../components/ui/input";
import { Skeleton } from "../../../components/ui/skeleton";
import { Spinner } from "../../../components/ui/spinner";

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
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          >
            <Link
              to={`/projects/${p.id}`}
              className="group block overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/50"
            >
              <div className="flex h-32 items-center justify-center overflow-hidden bg-muted/50">
                {p.coverArtifactId ? (
                  <img
                    src={routes.files.download(p.coverArtifactId)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <FolderKanban className="h-10 w-10 text-muted-foreground/40" />
                )}
              </div>
              <div className="p-4">
                <p className="truncate text-sm font-semibold group-hover:text-primary">{p.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.counts.workflows} workflows · {p.counts.templates} templates ·{" "}
                  {p.counts.artifacts} artifacts
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground/70">
                  {p.lastActivityAt ? `Updated ${timeAgo(p.lastActivityAt)}` : `Created ${timeAgo(p.createdAt)}`}
                </p>
              </div>
            </Link>
          </motion.div>
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
