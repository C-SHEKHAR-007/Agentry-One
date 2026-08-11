import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext.js";
import { Layout } from "./components/Layout.js";
import { Spinner } from "./components/ui/spinner.js";
import { LoginPage } from "./pages/LoginPage.js";
import { SetupPage } from "./pages/SetupPage.js";
import { AgentDetailPage } from "./pages/AgentDetailPage.js";
import { AnalyticsPage } from "./pages/AnalyticsPage.js";
import { ArtifactsPage } from "./pages/ArtifactsPage.js";
import { BuilderPage } from "./pages/BuilderPage.js";
import { CostMonitorPage } from "./pages/CostMonitorPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { ExecutionsPage } from "./pages/ExecutionsPage.js";
import { MyAgentsPage } from "./pages/MyAgentsPage.js";
import { PromptsPage } from "./pages/PromptsPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";
import { StudioPage } from "./pages/StudioPage.js";
import { ProfilePage } from "./pages/ProfilePage.js";
import { TeamPage } from "./pages/TeamPage.js";
import { AgentsPage } from "./pages/AgentsPage.js";
import { ProjectPage } from "./pages/ProjectPage.js";
import { ProjectsPage } from "./pages/ProjectsPage.js";
import { CreateSkillPage } from "./pages/CreateSkillPage.js";
import { IntegrationsPage } from "./pages/IntegrationsPage.js";
import { ProvidersPage } from "./pages/ProvidersPage.js";
import { SubmitAgentPage } from "./pages/SubmitAgentPage.js";
import { TemplateEditPage } from "./pages/TemplateEditPage.js";
import { TemplateRunPage } from "./pages/TemplateRunPage.js";
import { TemplateRunViewPage } from "./pages/TemplateRunViewPage.js";
import { WorkflowPage } from "./pages/WorkflowPage.js";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-6 w-6 text-primary" />
      </div>
    );
  }
  if (status === "needsSetup") return <Navigate to="/setup" replace />;
  if (status === "unauthed") return <Navigate to="/login" replace />;
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
        <Route path="/executions" element={<ExecutionsPage />} />
        <Route path="/artifacts" element={<ArtifactsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/costs" element={<CostMonitorPage />} />
        <Route path="/prompts" element={<PromptsPage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/my-agents" element={<MyAgentsPage />} />
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
      </Route>
    </Routes>
  );
}
