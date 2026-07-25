import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Spinner } from "../components/ui/spinner";

export function SetupPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { refresh } = useAuth();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "" });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      toast.error(error);
      searchParams.delete("error");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      await api.post("/auth/setup", form);
      await refresh();
      toast.success("Workspace ready — welcome!");
      navigate("/");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card glass className="w-full max-w-sm p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="h-6 w-6" />
          </span>
          <h1 className="text-xl font-semibold">Set up Agentry One</h1>
          <p className="text-sm text-muted-foreground">
            Create the owner account for this workspace.
          </p>
        </div>
        <GoogleSignInButton label="Sign up with Google" />
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>First Name</Label>
              <Input
                autoFocus
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                required
              />
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
          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Spinner />}
            Create owner account
          </Button>
        </form>
      </Card>
    </div>
  );
}
