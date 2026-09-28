import { lazy } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthContext.js";
import { Layout } from "./components/Layout.js";
import { Spinner } from "./components/ui/spinner.js";
import { NotificationProvider } from "./contexts/NotificationContext.js";
import { LoginPage } from "./pages/LoginPage.js";
import { SetupPage } from "./pages/SetupPage.js";
import { NotFoundPage } from "./pages/NotFoundPage.js";


// Route-level code splitting: each page (and heavy deps like reactflow,
// recharts, rjsf) loads on first visit instead of in one 1.5 MB bundle.
const AgentDetailPage = lazy(() => import("./pages/AgentDetailPage.js").then((m) => ({ default: m.AgentDetailPage })));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage.js").then((m) => ({ default: m.AnalyticsPage })));
const ArtifactsPage = lazy(() => import("./pages/ArtifactsPage.js").then((m) => ({ default: m.ArtifactsPage })));
const BuilderPage = lazy(() => import("./pages/BuilderPage.js").then((m) => ({ default: m.BuilderPage })));
const CostMonitorPage = lazy(() => import("./pages/CostMonitorPage.js").then((m) => ({ default: m.CostMonitorPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage.js").then((m) => ({ default: m.DashboardPage })));
const ExecutionsPage = lazy(() => import("./pages/ExecutionsPage.js").then((m) => ({ default: m.ExecutionsPage })));
const PromptsPage = lazy(() => import("./pages/PromptsPage.js").then((m) => ({ default: m.PromptsPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage.js").then((m) => ({ default: m.SettingsPage })));
const StudioPage = lazy(() => import("./pages/StudioPage.js").then((m) => ({ default: m.StudioPage })));
const ProfilePage = lazy(() => import("./pages/ProfilePage.js").then((m) => ({ default: m.ProfilePage })));
const TeamPage = lazy(() => import("./pages/TeamPage.js").then((m) => ({ default: m.TeamPage })));
const AgentsPage = lazy(() => import("./pages/AgentsPage.js").then((m) => ({ default: m.AgentsPage })));
const ProjectPage = lazy(() => import("./pages/ProjectPage.js").then((m) => ({ default: m.ProjectPage })));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage.js").then((m) => ({ default: m.ProjectsPage })));
const CreateSkillPage = lazy(() => import("./pages/CreateSkillPage.js").then((m) => ({ default: m.CreateSkillPage })));
const IntegrationsPage = lazy(() => import("./pages/IntegrationsPage.js").then((m) => ({ default: m.IntegrationsPage })));
const ProvidersPage = lazy(() => import("./pages/ProvidersPage.js").then((m) => ({ default: m.ProvidersPage })));
const SubmitAgentPage = lazy(() => import("./pages/SubmitAgentPage.js").then((m) => ({ default: m.SubmitAgentPage })));
const TemplateEditPage = lazy(() => import("./pages/TemplateEditPage.js").then((m) => ({ default: m.TemplateEditPage })));
const TemplateRunPage = lazy(() => import("./pages/TemplateRunPage.js").then((m) => ({ default: m.TemplateRunPage })));
const TemplateRunViewPage = lazy(() => import("./pages/TemplateRunViewPage.js").then((m) => ({ default: m.TemplateRunViewPage })));
const WorkflowPage = lazy(() => import("./pages/WorkflowPage.js").then((m) => ({ default: m.WorkflowPage })));

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
            <NotificationProvider>
              <Layout />
            </NotificationProvider>
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/studio" element={<StudioPage />} />
        <Route path="/executions" element={<ExecutionsPage />} />
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
