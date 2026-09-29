import { useState } from "react";
import { toast } from "sonner";
import { Plus, ShieldCheck } from "lucide-react";
import { useProjectsQuery } from "../../projects/projects.api";
import {
  useDeleteSocialAccountMutation,
  useSocialAccountsQuery,
  useTestSocialAccountMutation,
} from "../socialAccounts.api";
import { PLATFORMS } from "../platforms";
import { AccountCard } from "../components/AccountCard";
import { PlatformCard } from "../components/PlatformCard";
import { ConnectAccountDialog } from "../components/ConnectAccountDialog";
import { errorMessage } from "../../../services/http/errors";
import { PageHeader } from "../../../components/common/PageHeader";
import { Button } from "../../../components/ui/button";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { Skeleton } from "../../../components/ui/skeleton";

export function IntegrationsPage() {
  const [projectId, setProjectId] = useState<string>("");
  const [showModal, setShowModal] = useState<boolean>(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("instagram");

  const { data: projects } = useProjectsQuery();
  const activeProjectId = projectId || projects?.[0]?.id || "";
  // currentData: switching project never shows the previous project's accounts.
  const { currentData: accounts, isFetching } = useSocialAccountsQuery(activeProjectId, { skip: !activeProjectId });
  const isLoading = isFetching && !accounts;

  const [testAccount, testState] = useTestSocialAccountMutation();
  const testConnection = (id: string) =>
    testAccount({ id, projectId: activeProjectId })
      .unwrap()
      .then((data) => {
        if (data.success) toast.success(data.message || `Account verified! Connected as ${data.handle || "active"}`);
      })
      .catch((err) => toast.error(`Verification error: ${errorMessage(err)}`));

  const [removeAccount, deleteState] = useDeleteSocialAccountMutation();
  const deleteAccount = (id: string) =>
    removeAccount({ id, projectId: activeProjectId })
      .unwrap()
      .then(() => toast.success("Account disconnected"))
      .catch((err) => toast.error(errorMessage(err)));

  const openConnectModal = (platformId: string) => {
    setSelectedPlatform(platformId);
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Connect social accounts so workflows can publish for you. Credentials are stored encrypted."
      />

      {projects && projects.length > 1 && (
        <div className="w-72">
          <Label>Active Project Scope</Label>
          <Select value={activeProjectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {isLoading && <Skeleton className="h-40" />}

      {/* Connected Accounts Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Connected Accounts ({accounts?.length || 0})
          </h2>

          <Button
            variant="default"
            size="sm"
            onClick={() => {
              setSelectedPlatform("instagram");
              setShowModal(true);
            }}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Connect New Account
          </Button>
        </div>

        <div className="grid gap-3">
          {accounts?.map((acc) => (
            <AccountCard
              key={acc.id}
              acc={acc}
              testing={testState.isLoading && testState.originalArgs?.id === acc.id}
              deleting={deleteState.isLoading && deleteState.originalArgs?.id === acc.id}
              onTest={() => testConnection(acc.id)}
              onDelete={() => deleteAccount(acc.id)}
            />
          ))}

          {accounts?.length === 0 && (
            <div className="p-8 text-center border border-dashed rounded-xl text-muted-foreground bg-card/20">
              No social accounts connected to this project yet. Click &quot;Connect New Account&quot; or choose a platform below to log in directly.
            </div>
          )}
        </div>
      </div>

      {/* Available Social Platforms Cards */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold tracking-tight">Available Social Platforms</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLATFORMS.map((p) => (
            <PlatformCard key={p.id} p={p} onSelect={() => openConnectModal(p.id)} />
          ))}
        </div>
      </div>

      <ConnectAccountDialog
        open={showModal}
        onClose={() => setShowModal(false)}
        projectId={activeProjectId}
        selectedPlatform={selectedPlatform}
        onPlatformChange={setSelectedPlatform}
      />
    </div>
  );
}
