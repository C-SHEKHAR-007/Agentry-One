import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plug, Plus, Trash2, Camera, MessageCircle, Briefcase } from "lucide-react";
import { api } from "../api/client.js";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { Spinner } from "../components/ui/spinner";
import { useAuth } from "../auth/AuthContext.js";

interface Project {
  id: string;
  name: string;
}

interface SocialAccount {
  id: string;
  platform: string;
  handle: string;
  status: string;
}

const PLATFORMS = [
  { id: "instagram", name: "Instagram", icon: Camera },
  { id: "twitter", name: "X (Twitter)", icon: MessageCircle },
  { id: "linkedin", name: "LinkedIn", icon: Briefcase }
];

export function IntegrationsPage() {
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState<string>("");

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.get<Project[]>("/projects"),
  });

  const activeProjectId = projectId || projects?.[0]?.id || "";

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["socialAccounts", activeProjectId],
    queryFn: () => api.get<SocialAccount[]>(`/social-accounts?projectId=${activeProjectId}`),
    enabled: Boolean(activeProjectId),
  });

  const [form, setForm] = useState({
    platform: "",
    handle: "",
    accessToken: "",
  });

  const connectAccount = useMutation({
    mutationFn: () =>
      api.post("/social-accounts", {
        projectId: activeProjectId,
        platform: form.platform,
        handle: form.handle,
        accessToken: form.accessToken,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["socialAccounts", activeProjectId] });
      toast.success(`Connected ${form.platform} account`);
      setForm({ platform: "", handle: "", accessToken: "" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteAccount = useMutation({
    mutationFn: (id: string) => api.delete(`/social-accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["socialAccounts", activeProjectId] });
      toast.success("Account disconnected");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Social Integrations"
        description="Connect your social media accounts to automatically publish generated content via Action Agents."
      />

      {projects && projects.length > 1 && (
        <div className="w-64">
          <Label>Project Scope</Label>
          <Select value={activeProjectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </div>
      )}

      {isLoading && <Skeleton className="h-40" />}

      <div className="grid gap-3">
        {accounts?.map((acc) => {
          const PlatformIcon = PLATFORMS.find(p => p.id === acc.platform)?.icon || Plug;
          return (
            <Card key={acc.id} className="flex flex-wrap items-center justify-between gap-3 p-4 border-l-4 border-l-primary">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <PlatformIcon className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-medium capitalize">{acc.platform}</div>
                  <div className="text-sm text-muted-foreground">{acc.handle || "Connected"}</div>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => deleteAccount.mutate(acc.id)}
                disabled={deleteAccount.isPending}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </Card>
          );
        })}
        {accounts?.length === 0 && (
          <div className="p-8 text-center border border-dashed rounded-lg text-muted-foreground">
            No social accounts connected to this project yet.
          </div>
        )}
      </div>

      <Card glass>
        <CardHeader>
          <CardTitle className="text-base">Connect a New Account</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Select a platform below to log in and securely authorize Agentry to publish on your behalf.</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PLATFORMS.map((p) => {
              const Icon = p.icon;
              return (
                <Button
                  key={p.id}
                  variant="outline"
                  className="h-20 flex flex-col items-center justify-center gap-2 hover:bg-primary/5 hover:border-primary/50 transition-all"
                  onClick={() => {
                    if (!activeProjectId) {
                      toast.error("Please select a project first");
                      return;
                    }
                    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
                    window.location.href = `${apiUrl}/social-accounts/oauth/authorize?platform=${p.id}&projectId=${activeProjectId}`;
                  }}
                >
                  <Icon className="h-6 w-6 text-primary" />
                  <span>Connect {p.name}</span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
