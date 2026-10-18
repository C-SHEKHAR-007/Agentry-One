import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useSetupMutation } from "../auth.api";
import { errorMessage } from "../../../services/http/errors";
import { useAuth } from "../useAuth";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { Button } from "../../../components/ui/button";
import { AuthShell } from "../components/AuthShell";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Spinner } from "../../../components/ui/spinner";

export function SetupPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { refresh } = useAuth();
  const [setup] = useSetupMutation();
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
      await setup(form).unwrap();
      await refresh();
      toast.success("Workspace ready — welcome!");
      navigate("/");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthShell title="Set up Agentry One" subtitle="Create the owner account for this workspace.">
      <GoogleSignInButton label="Sign up with Google" />
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="setup-first">First name</Label>
            <Input
              id="setup-first"
              autoComplete="given-name"
              autoFocus
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="setup-last">Last name</Label>
            <Input
              id="setup-last"
              autoComplete="family-name"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              required
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="setup-email">Email</Label>
          <Input
            id="setup-email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="setup-password">Password</Label>
          <Input
            id="setup-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            aria-describedby="setup-password-hint"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <p id="setup-password-hint" className="text-xs text-muted-foreground">
            At least 8 characters.
          </p>
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending && <Spinner />}
          Create owner account
        </Button>
      </form>
    </AuthShell>
  );
}
