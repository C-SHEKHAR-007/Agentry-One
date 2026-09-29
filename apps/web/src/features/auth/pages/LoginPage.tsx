import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { useLoginMutation } from "../auth.api";
import { errorMessage } from "../../../services/http/errors";
import { useAuth } from "../useAuth";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { Button } from "../../../components/ui/button";
import { AuthShell } from "../components/AuthShell";
import { Card } from "../../../components/ui/card";
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
    <AuthShell>
      <Card glass className="glow-border w-full max-w-sm border-transparent p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="h-6 w-6" />
          </span>
          <h1 className="text-xl font-semibold">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Sign in to your Agentry One workspace</p>
        </div>
        <GoogleSignInButton />
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              autoFocus
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div>
            <Label>Password</Label>
            <Input
              type="password"
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
      </Card>
    </AuthShell>
  );
}
