import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useLoginMutation } from "../auth.api";
import { errorMessage } from "../../../services/http/errors";
import { useAuth } from "../useAuth";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { Button } from "../../../components/ui/button";
import { AuthShell } from "../components/AuthShell";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Spinner } from "../../../components/ui/spinner";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { refresh } = useAuth();
  const [login] = useLoginMutation();
  const [form, setForm] = useState({ email: "", password: "" });
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
      await login(form).unwrap();
      await refresh();
      // Return to the page that bounced the user to login (in-app paths only).
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from.startsWith("/") && !from.startsWith("//") ? from : "/", { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your Agentry One workspace" footer="No account yet? Ask the owner of this workspace to add you.">
      <GoogleSignInButton />
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            autoFocus
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending && <Spinner />}
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
