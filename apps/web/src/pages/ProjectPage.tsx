import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { FileStack, FileText, Headphones, Play, Plus, Trash2 } from "lucide-react";
import { api } from "../api/client.js";
import { useArtifacts } from "../api/queries";
import { downloadUrl } from "../api/client.js";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Skeleton } from "../components/ui/skeleton";
import { Spinner } from "../components/ui/spinner";

interface Project {
  id: string;
  name: string;
}

interface Template {
  id: string;
  name: string;
  status: string;
}

export function ProjectPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.get<Project>(`/projects/${projectId}`),
  });
  const { data: templates } = useQuery({
    queryKey: ["templates", projectId],
    queryFn: () => api.get<Template[]>(`/projects/${projectId}/templates`),
  });
  const { data: artifacts } = useArtifacts({ projectId, limit: 12 });

  const deleteProject = useMutation({
    mutationFn: () => api.delete(`/projects/${projectId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project deleted");
      navigate("/projects");
    },
    onError: (err) => toast.error(err.message),
  });

  if (!project) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const recentArtifacts = (artifacts ?? []).slice(0, 12);

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        description="Project workspace"
        actions={
          <>
            <Link to="/agents">
              <Button variant="secondary">
                <Play className="h-4 w-4" /> Run an agent
              </Button>
            </Link>
            <Link to={`/templates/new?projectId=${projectId}`}>
              <Button>
                <Plus className="h-4 w-4" /> New template
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete project"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </>
        }
      />

      <Card glass>
        <CardHeader>
          <CardTitle className="text-base">Templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {templates?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No templates yet — compose reusable multi-step pipelines from your agents.
            </p>
          )}
          {templates?.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-md border border-border px-4 py-3 transition-colors hover:border-primary/40"
            >
              <Link to={`/templates/${t.id}/edit`} className="min-w-0 flex-1 truncate font-medium hover:text-primary">
                {t.name}
              </Link>
              <div className="flex items-center gap-3">
                <StatusBadge status={t.status} />
                <Link to={`/templates/${t.id}/run`}>
                  <Button size="sm" variant="secondary">
                    <Play className="h-3.5 w-3.5" /> Run
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {recentArtifacts.length > 0 && (
        <Card glass>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent Artifacts</CardTitle>
            <Link to="/artifacts" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
              <FileStack className="h-3.5 w-3.5" /> View all
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {recentArtifacts.map((a) => {
                const isImage = a.mimeType.startsWith("image/");
                const isAudio = a.mimeType.startsWith("audio/");
                const isText = a.mimeType.startsWith("text/") || a.mimeType.includes("json") || a.kind === "text" || a.kind === "search_brief";

                return (
                  <Link
                    key={a.id}
                    to={`/workflows/${a.workflowId}`}
                    className="group overflow-hidden rounded-md border border-border bg-card/60 transition-all hover:border-primary/50 block"
                  >
                    {isImage ? (
                      <img
                        src={downloadUrl(a.id)}
                        alt={a.kind}
                        loading="lazy"
                        className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : isAudio ? (
                      <div className="aspect-square w-full p-2 bg-secondary/20 flex flex-col items-center justify-center text-center gap-1">
                        <Headphones className="h-5 w-5 text-primary" />
                        <span className="text-[10px] font-medium truncate capitalize">{a.kind}</span>
                      </div>
                    ) : isText ? (
                      <div className="aspect-square w-full p-2.5 bg-secondary/15 flex flex-col justify-between overflow-hidden">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="text-[10px] font-medium truncate capitalize">{a.kind}</span>
                        <span className="text-[9px] text-muted-foreground uppercase">Doc</span>
                      </div>
                    ) : (
                      <div className="aspect-square w-full p-2 bg-secondary/20 flex flex-col items-center justify-center text-center gap-1">
                        <FileStack className="h-5 w-5 text-muted-foreground" />
                        <span className="text-[10px] font-medium truncate capitalize">{a.kind}</span>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{project.name}"?</DialogTitle>
            <DialogDescription>
              This permanently deletes the project and everything under it — workflows, templates,
              and artifact records. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteProject.mutate()}
              disabled={deleteProject.isPending}
            >
              {deleteProject.isPending && <Spinner />}
              Delete project
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
