import { lazy } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "../features/auth/useAuth";
import { Layout } from "../features/shell/components/Layout.js";
import { Spinner } from "../components/ui/spinner.js";
import { LoginPage } from "../features/auth/pages/LoginPage.js";
import { SetupPage } from "../features/auth/pages/SetupPage.js";
import { NotFoundPage } from "../components/common/NotFoundPage.js";


// Route-level code splitting: each page (and heavy deps like reactflow,
// recharts, rjsf) loads on first visit instead of in one 1.5 MB bundle.
const AgentDetailPage = lazy(() => import("../features/agents/pages/AgentDetailPage.js").then((m) => ({ default: m.AgentDetailPage })));
const AnalyticsPage = lazy(() => import("../features/analytics/pages/AnalyticsPage.js").then((m) => ({ default: m.AnalyticsPage })));
const ArtifactsPage = lazy(() => import("../features/artifacts/pages/ArtifactsPage.js").then((m) => ({ default: m.ArtifactsPage })));
const BuilderPage = lazy(() => import("../features/workflows/pages/BuilderPage.js").then((m) => ({ default: m.BuilderPage })));
const CostMonitorPage = lazy(() => import("../features/costs/pages/CostMonitorPage.js").then((m) => ({ default: m.CostMonitorPage })));
const DashboardPage = lazy(() => import("../features/dashboard/pages/DashboardPage.js").then((m) => ({ default: m.DashboardPage })));
const ExecutionsPage = lazy(() => import("../features/runs/pages/ExecutionsPage.js").then((m) => ({ default: m.ExecutionsPage })));
const PromptsPage = lazy(() => import("../features/prompts/pages/PromptsPage.js").then((m) => ({ default: m.PromptsPage })));
const SettingsPage = lazy(() => import("../features/settings/pages/SettingsPage.js").then((m) => ({ default: m.SettingsPage })));
const StudioPage = lazy(() => import("../features/studio/pages/StudioPage.js").then((m) => ({ default: m.StudioPage })));
const ProfilePage = lazy(() => import("../features/profile/pages/ProfilePage.js").then((m) => ({ default: m.ProfilePage })));
const TeamPage = lazy(() => import("../features/team/pages/TeamPage.js").then((m) => ({ default: m.TeamPage })));
const AgentsPage = lazy(() => import("../features/agents/pages/AgentsPage.js").then((m) => ({ default: m.AgentsPage })));
const ProjectPage = lazy(() => import("../features/projects/pages/ProjectPage.js").then((m) => ({ default: m.ProjectPage })));
const ProjectsPage = lazy(() => import("../features/projects/pages/ProjectsPage.js").then((m) => ({ default: m.ProjectsPage })));
const CreateSkillPage = lazy(() => import("../features/agents/pages/CreateSkillPage.js").then((m) => ({ default: m.CreateSkillPage })));
const IntegrationsPage = lazy(() => import("../features/integrations/pages/IntegrationsPage.js").then((m) => ({ default: m.IntegrationsPage })));
const ProvidersPage = lazy(() => import("../features/providers/pages/ProvidersPage.js").then((m) => ({ default: m.ProvidersPage })));
const SubmitAgentPage = lazy(() => import("../features/agents/pages/SubmitAgentPage.js").then((m) => ({ default: m.SubmitAgentPage })));
const TemplateEditPage = lazy(() => import("../features/workflows/pages/TemplateEditPage.js").then((m) => ({ default: m.TemplateEditPage })));
const TemplateRunPage = lazy(() => import("../features/workflows/pages/TemplateRunPage.js").then((m) => ({ default: m.TemplateRunPage })));
const TemplateRunViewPage = lazy(() => import("../features/runs/pages/TemplateRunViewPage.js").then((m) => ({ default: m.TemplateRunViewPage })));
const WorkflowPage = lazy(() => import("../features/runs/pages/WorkflowPage.js").then((m) => ({ default: m.WorkflowPage })));

/** Old links (/executions?status=failed) keep working after the rename. */
function RedirectKeepingQuery({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}`} replace />;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-6 w-6 text-primary" />
      </div>
    );
  }
  if (status === "needsSetup") return <Navigate to="/setup" replace />;
  if (status === "unauthed") return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

export default function App() {
  const { status } = useAuth();
  return (
    <Routes>
      <Route
        path="/login"
        element={status === "authed" ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/setup"
        element={status === "needsSetup" ? <SetupPage /> : <Navigate to="/" replace />}
      />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/studio" element={<StudioPage />} />
        <Route path="/runs" element={<ExecutionsPage />} />
        <Route path="/executions" element={<RedirectKeepingQuery to="/runs" />} />
        <Route path="/artifacts" element={<ArtifactsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/costs" element={<CostMonitorPage />} />
        <Route path="/cost-monitor" element={<Navigate to="/costs" replace />} />
        <Route path="/prompts" element={<PromptsPage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/my-agents" element={<Navigate to="/agents?tab=workers" replace />} />
        <Route path="/builder" element={<BuilderPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/agents/create-skill" element={<CreateSkillPage />} />
        <Route path="/agents/:agentId" element={<AgentDetailPage />} />
        <Route path="/agents/:agentId/submit" element={<SubmitAgentPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/providers" element={<ProvidersPage />} />
        <Route path="/templates/new" element={<TemplateEditPage />} />
        <Route path="/templates/:templateId/edit" element={<TemplateEditPage />} />
        <Route path="/templates/:templateId/run" element={<TemplateRunPage />} />
        <Route path="/workflows/:workflowId" element={<WorkflowPage />} />
        <Route path="/template-runs/:runId" element={<TemplateRunViewPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
