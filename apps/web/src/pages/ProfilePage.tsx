import { useEffect, useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Check, KeyRound, Trash2, Upload, User, UserCircle } from "lucide-react";
import { api } from "../api/client";
import { useAuth, type AuthUser } from "../auth/AuthContext";
import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Spinner } from "../components/ui/spinner";

export function ProfilePage() {
  const { user, refresh } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    avatarUrl: user?.avatarUrl || "",
  });

  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const [urlMode, setUrlMode] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        avatarUrl: user.avatarUrl || "",
      });
    }
  }, [user]);

  const updateProfile = useMutation({
    mutationFn: async (data: { firstName?: string; lastName?: string; avatarUrl?: string; password?: string }) => {
      const res = await api.patch<{ user: AuthUser }>("/auth/profile", data);
      return res.user;
    },
    onSuccess: async () => {
      await refresh();
      toast.success("Profile updated successfully");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/webp", 0.82);
          setForm((prev) => ({ ...prev, avatarUrl: dataUrl }));
          toast.info("Photo processed! Click 'Save Profile' to apply.");
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      avatarUrl: form.avatarUrl.trim() || undefined,
    });
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    updateProfile.mutate(
      { password: passwordForm.newPassword },
      {
        onSuccess: () => {
          setPasswordForm({ newPassword: "", confirmPassword: "" });
        },
      },
    );
  };

  const displayName = user?.name ?? user?.email ?? "…";
  const initials =
    displayName
      .split(/[\s@.]+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "?";

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="My Profile"
        description="Manage your personal information, display name, and avatar picture."
      />

      {/* Avatar & Basic Info */}
      <Card glass>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-primary" /> Profile Photo
          </CardTitle>
          <CardDescription>
            Your avatar photo appears in the top navigation bar and across team spaces.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative group">
              {form.avatarUrl ? (
                <img
                  src={form.avatarUrl}
                  alt="Avatar preview"
                  className="h-24 w-24 rounded-full object-cover border-2 border-primary/50 shadow-lg"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/70 to-primary text-2xl font-bold text-primary-foreground shadow-lg border-2 border-primary/30">
                  {initials}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 text-white font-medium text-xs gap-1"
                title="Change Photo"
              >
                <Camera className="h-4 w-4" /> Change
              </button>
            </div>

            <div className="flex-1 space-y-3 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-1.5" /> Upload Photo
                </Button>
                {form.avatarUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setForm((prev) => ({ ...prev, avatarUrl: "" }));
                      updateProfile.mutate({ avatarUrl: "" });
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" /> Remove
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setUrlMode(!urlMode)}
                  className="text-xs text-muted-foreground"
                >
                  {urlMode ? "Hide URL Input" : "Paste Image URL"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Recommended: Square image (PNG, JPG, WEBP). Automatically resized and optimized.
              </p>
              {urlMode && (
                <div className="flex gap-2 pt-1">
                  <Input
                    placeholder="https://example.com/avatar.png"
                    value={form.avatarUrl}
                    onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
                    className="text-xs"
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <form onSubmit={handleSaveProfile}>
        <Card glass>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-5 w-5 text-primary" /> Personal Information
            </CardTitle>
            <CardDescription>
              Update your first and last name. This updates how your name is displayed in workspaces.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  placeholder="e.g. Alex"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="e.g. Rivera"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <Label>Email Address</Label>
                <div className="flex items-center gap-2">
                  <Input value={user?.email || ""} disabled className="bg-secondary/40 text-muted-foreground font-mono text-sm" />
                  <Badge variant="outline" className="shrink-0 bg-primary/10 text-primary border-primary/20">
                    Verified
                  </Badge>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Workspace Role</Label>
                <div className="flex items-center gap-2">
                  <Input value={user?.role?.toUpperCase() || ""} disabled className="bg-secondary/40 text-muted-foreground font-mono text-sm" />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? <Spinner className="mr-2" /> : <Check className="h-4 w-4 mr-1.5" />}
                Save Profile
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Change Password */}
      <form onSubmit={handleUpdatePassword}>
        <Card glass>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> Change Password
            </CardTitle>
            <CardDescription>
              Ensure your account is using a long, secure password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="At least 8 characters"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repeat new password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                variant="secondary"
                disabled={updateProfile.isPending || !passwordForm.newPassword}
              >
                {updateProfile.isPending && <Spinner className="mr-2" />}
                Update Password
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
