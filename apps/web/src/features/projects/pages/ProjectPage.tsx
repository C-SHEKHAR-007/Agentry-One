import { NotFoundPage } from "../../../components/common/NotFoundPage";
import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Images, LayoutDashboard, Play, Plus, Trash2, Workflow } from "lucide-react";
import { useArtifactsQuery } from "../../artifacts/artifacts.api";
import { useDeleteProjectMutation, useProjectQuery, useProjectTemplatesQuery } from "../projects.api";
import { errorMessage } from "../../../services/http/errors";
import { timeAgo } from "../../../lib/format";
import { PageHeader } from "../../../components/common/PageHeader";
import { Button } from "../../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { ResponsiveTabs } from "../../../components/ui/responsive-tabs";
import { Skeleton } from "../../../components/ui/skeleton";
import { Spinner } from "../../../components/ui/spinner";
import { ProjectArtifacts } from "../components/ProjectArtifacts";
import { ProjectOverview } from "../components/ProjectOverview";
import { ProjectWorkflows } from "../components/ProjectWorkflows";

const TABS = ["overview", "workflows", "artifacts"] as const;
type Tab = (typeof TABS)[number];

export function ProjectPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removeProject, deleteState] = useDeleteProjectMutation();

  // The tab lives in the URL (?tab=artifacts) so it survives reloads and can be linked.
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tab");
  const tab: Tab = TABS.includes(requested as Tab) ? (requested as Tab) : "overview";
  const setTab = (t: string) => setSearchParams(t === "overview" ? {} : { tab: t }, { replace: true });

  // Once a delete starts, drop this page's subscriptions so the cache
  // invalidation it triggers doesn't refetch the project being removed.
  const id = projectId ?? "";
  const skip = !projectId || deleteState.isLoading || deleteState.isSuccess;
  const { data: project, isError: projectLoadFailed } = useProjectQuery(id, { skip });
  const { data: templates } = useProjectTemplatesQuery(id, { skip });
  const { data: recentArtifacts } = useArtifactsQuery({ projectId, limit: 4 }, { skip: skip || tab !== "overview" });

  const deleteProject = () =>
    removeProject(id)
      .unwrap()
      .then(() => {
        toast.success("Project deleted");
        navigate("/projects");
      })
      .catch((err) => toast.error(errorMessage(err)));

  if (projectLoadFailed) return <NotFoundPage what="project" />;
  if (!project) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        description={`Created ${timeAgo(project.createdAt)}`}
        actions={
          <>
            <Link to="/agents">
              <Button variant="secondary">
                <Play className="h-4 w-4" /> Run an agent
              </Button>
            </Link>
            <Link to={`/templates/new?projectId=${projectId}`}>
              <Button>
                <Plus className="h-4 w-4" /> New workflow
              </Button>
            </Link>
            <Button variant="ghost" size="icon" aria-label="Delete project" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </>
        }
      />

      <ResponsiveTabs
        activeTab={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: "Overview", icon: LayoutDashboard },
          { id: "workflows", label: "Workflows", icon: Workflow, count: project.counts.templates },
          { id: "artifacts", label: "Artifacts", icon: Images, count: project.counts.artifacts },
        ]}
      />

      {tab === "overview" && <ProjectOverview project={project} templates={templates} recentArtifacts={recentArtifacts} onTab={setTab} />}
      {tab === "workflows" && <ProjectWorkflows templates={templates} />}
      {tab === "artifacts" && <ProjectArtifacts projectId={project.id} />}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{project.name}"?</DialogTitle>
            <DialogDescription>
              This permanently deletes the project and everything under it — workflows, templates, and artifact records. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteProject} disabled={deleteState.isLoading}>
              {deleteState.isLoading && <Spinner />}
              Delete project
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
