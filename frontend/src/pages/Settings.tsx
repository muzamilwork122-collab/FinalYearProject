import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Check, Loader2, LogOut, Moon, ScanLine, Sun, Trash2, User as UserIcon, X,
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { usePreferences } from "@/context/PreferencesContext";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const NAME_RE = /^[A-Za-z\u00C0-\u024F]+(?:[ '-][A-Za-z\u00C0-\u024F]+)*$/;

const PASSWORD_RULES: Array<{ label: string; test: (value: string) => boolean }> = [
  { label: "At least 8 characters", test: (v) => v.length >= 8 },
  { label: "An uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { label: "A lowercase letter", test: (v) => /[a-z]/.test(v) },
  { label: "A number", test: (v) => /[0-9]/.test(v) },
  { label: "A special character", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

function apiError(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    return (error.response?.data?.detail as string) ?? error.message ?? fallback;
  }
  return fallback;
}

function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <li
            key={rule.label}
            className={`flex items-center gap-1.5 text-xs ${ok ? "text-[hsl(var(--success))]" : "text-muted-foreground"}`}
          >
            {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}

export default function Settings() {
  const { user, token, updateUser, logout } = useAuth();
  const { theme, setTheme } = usePreferences();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name?.toString() ?? "");
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [deletePassword, setDeletePassword] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const initials = (user?.name?.toString().trim()?.[0] || "U").toUpperCase();

  const cardClass = "surface p-6";
  const inputClass =
    "w-full rounded-[var(--radius)] border border-input bg-card px-3.5 py-2.5 text-sm text-foreground " +
    "placeholder:text-muted-foreground/60 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";
  const labelClass = "mb-1.5 block text-sm font-medium text-foreground";

  const saveName = async () => {
    const trimmed = name.trim();
    if (!NAME_RE.test(trimmed)) {
      toast.error("Enter a valid name (letters, spaces, hyphens only)");
      return;
    }
    setSavingName(true);
    try {
      const resp = await axios.patch(`${API_BASE}/api/auth/profile`, { token, name: trimmed });
      updateUser({ name: resp.data.name });
      toast.success("Name updated");
    } catch (error) {
      toast.error(apiError(error, "Could not update name"));
    }
    setSavingName(false);
  };

  const savePassword = async () => {
    if (!currentPassword) {
      toast.error("Enter your current password");
      return;
    }
    if (!PASSWORD_RULES.every((rule) => rule.test(newPassword))) {
      toast.error("New password does not meet the requirements");
      return;
    }
    setSavingPassword(true);
    try {
      await axios.post(`${API_BASE}/api/auth/change-password`, {
        token,
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
    } catch (error) {
      toast.error(apiError(error, "Could not change password"));
    }
    setSavingPassword(false);
  };

  const deleteAccount = async () => {
    if (!deletePassword) {
      toast.error("Enter your password to confirm");
      return;
    }
    setDeleting(true);
    try {
      await axios.post(`${API_BASE}/api/auth/delete-account`, { token, password: deletePassword });
      toast.success("Account deleted");
      logout();
      navigate("/");
    } catch (error) {
      toast.error(apiError(error, "Could not delete account"));
      setDeleting(false);
    }
  };

  const btnGhost =
    "flex items-center gap-1.5 rounded-[var(--radius)] px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground";
  const btnSolid =
    "flex items-center gap-2 rounded-[var(--radius)] bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className={btnGhost}>
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <span className="h-5 w-px bg-border" />
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-[var(--radius)] bg-accent text-accent-foreground">
                <ScanLine className="h-4 w-4" />
              </span>
              <span className="font-display text-sm font-semibold">ScreenScan</span>
              <span className="text-sm text-muted-foreground">/ Settings</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground">
              {initials}
            </span>
            <button onClick={() => { logout(); navigate("/"); }} className={btnGhost}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl space-y-6 px-6 pb-16 pt-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Account settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your profile, security and preferences.</p>
        </div>

        {/* Profile */}
        <section className={cardClass}>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <UserIcon className="h-4 w-4 text-accent" />
            Profile
          </h2>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Full name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Your name" />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input value={user?.email?.toString() ?? ""} disabled className={`${inputClass} cursor-not-allowed opacity-70`} />
              <p className="mt-1.5 text-xs text-muted-foreground">Email can't be changed.</p>
            </div>
            <button onClick={saveName} disabled={savingName} className={btnSolid}>
              {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save changes
            </button>
          </div>
        </section>

        {/* Preferences */}
        <section className={cardClass}>
          <h2 className="mb-4 text-sm font-semibold text-foreground">Preferences</h2>
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Appearance</p>
                <p className="text-xs text-muted-foreground">Choose light or dark mode.</p>
              </div>
              <div className="inline-flex items-center rounded-[var(--radius)] border border-border bg-card p-0.5">
                <button
                  onClick={() => setTheme("light")}
                  className={`flex items-center gap-1.5 rounded-[calc(var(--radius)-4px)] px-3 py-1.5 text-xs font-semibold transition-colors ${theme === "light" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Sun className="h-3.5 w-3.5" /> Light
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={`flex items-center gap-1.5 rounded-[calc(var(--radius)-4px)] px-3 py-1.5 text-xs font-semibold transition-colors ${theme === "dark" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Moon className="h-3.5 w-3.5" /> Dark
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Security */}
        <section className={cardClass}>
          <h2 className="mb-4 text-sm font-semibold text-foreground">Change password</h2>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Current password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className={labelClass}>New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
              />
              {newPassword.length > 0 && <PasswordChecklist password={newPassword} />}
            </div>
            <button onClick={savePassword} disabled={savingPassword} className={btnSolid}>
              {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Update password
            </button>
          </div>
        </section>

        {/* Danger zone */}
        <section
          className="rounded-[var(--radius)] border p-6"
          style={{ borderColor: "hsl(var(--destructive) / 0.4)", background: "hsl(var(--destructive) / 0.05)" }}
        >
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold" style={{ color: "hsl(var(--destructive))" }}>
            <Trash2 className="h-4 w-4" />
            Delete account
          </h2>
          <p className="text-sm text-muted-foreground">
            Permanently deletes your account and all analysis history. This cannot be undone.
          </p>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="mt-4 rounded-[var(--radius)] border px-4 py-2.5 text-sm font-semibold transition-colors"
              style={{ borderColor: "hsl(var(--destructive) / 0.5)", color: "hsl(var(--destructive))" }}
            >
              Delete my account
            </button>
          ) : (
            <div className="mt-4 space-y-3">
              <div>
                <label className={labelClass}>Enter your password to confirm</label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setConfirmDelete(false); setDeletePassword(""); }}
                  className="rounded-[var(--radius)] border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={deleteAccount}
                  disabled={deleting}
                  className="flex items-center gap-2 rounded-[var(--radius)] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ background: "hsl(var(--destructive))" }}
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Permanently delete
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
