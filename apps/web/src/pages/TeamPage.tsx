import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Users } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { timeAgo } from "../lib/format";
import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { Spinner } from "../components/ui/spinner";

interface TeamUser {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  role: string;
  createdAt: string;
}

export function TeamPage() {
  const queryClient = useQueryClient();
  const { user: me } = useAuth();
  const isOwner = me?.role === "owner";

  const { data: users, isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<TeamUser[]>("/users"),
    retry: false,
    enabled: isOwner,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", role: "member" });

  const createUser = useMutation({
    mutationFn: () => api.post<TeamUser>("/users", form),
    onSuccess: (u) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(`${u.email} added`);
      setOpen(false);
      setForm({ firstName: "", lastName: "", email: "", password: "", role: "member" });
    },
    onError: (err) => toast.error(err.message),
  });

  const patchRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api.patch<TeamUser>(`/users/${id}`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Role updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User removed");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Team"
        description={
          isOwner
            ? "Manage who can sign in to this workspace."
            : "Workspace members. Ask an owner to make changes."
        }
        actions={
          isOwner && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Add member
            </Button>
          )
        }
      />

      {isLoading && <Skeleton className="h-40" />}
      {(!isOwner || error != null) && (
        <Card className="p-6 text-sm text-muted-foreground">
          <Users className="mb-2 h-5 w-5" />
          Only owners can view the member list.
        </Card>
      )}

      <div className="grid gap-3">
        {users?.map((u) => {
          const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ");
          const displayName = fullName || u.email;
          const initials = displayName
            .split(/[\s@.]+/)
            .slice(0, 2)
            .map((s) => s[0]?.toUpperCase() ?? "")
            .join("");
          const isStub = u.email === "local@agentry.dev";
          const isSelf = me?.id === u.id;
          return (
            <Card key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                {u.avatarUrl ? (
                  <img
                    src={u.avatarUrl}
                    alt={displayName}
                    className="h-10 w-10 shrink-0 rounded-full object-cover border border-border/60 shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
                    {initials}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {displayName}
                    {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {u.email} · joined {timeAgo(u.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isStub ? (
                  <Badge variant="outline">system</Badge>
                ) : isOwner && !isSelf ? (
                  <>
                    <Select
                      value={u.role}
                      onChange={(e) => patchRole.mutate({ id: u.id, role: e.target.value })}
                      className="h-8 w-28"
                    >
                      <option value="member">member</option>
                      <option value="owner">owner</option>
                    </Select>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove ${u.email}`}
                      onClick={() => deleteUser.mutate(u.id)}
                      disabled={deleteUser.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                ) : (
                  <Badge variant={u.role === "owner" ? "default" : "secondary"}>{u.role}</Badge>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add member</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createUser.mutate();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>First Name</Label>
                <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div>
                <Label>Last Name</Label>
                <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Password (min 8 characters)</Label>
              <Input
                type="password"
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="member">member</option>
                <option value="owner">owner</option>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createUser.isPending}>
                {createUser.isPending && <Spinner />}
                Add member
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
