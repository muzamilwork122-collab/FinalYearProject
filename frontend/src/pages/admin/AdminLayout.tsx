import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Camera,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  ScanLine,
  Store,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  changeAdminPassword,
  clearAdminSession,
  getAdminProfile,
  getAdminToken,
  setAdminSession,
  updateAdminProfile,
  type AdminProfile,
} from "@/lib/shopApi";
import { AdminLoginPanel, inputClass } from "./adminShared";

const NAV_LINKS = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/users", label: "Users", icon: Users, end: false },
  { to: "/admin/shops", label: "Shops", icon: Store, end: false },
];

const AdminLayout = () => {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(() => getAdminToken());
  const [profile, setProfile] = useState<AdminProfile | null>(() => getAdminProfile());
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<"profile" | "password" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const handleLogin = (nextToken: string, nextProfile: AdminProfile) => {
    setToken(nextToken);
    setProfile(nextProfile);
  };

  const handleProfileSaved = (nextToken: string, nextProfile: AdminProfile) => {
    setAdminSession(nextToken, nextProfile);
    setToken(nextToken);
    setProfile(nextProfile);
  };

  const logout = () => {
    clearAdminSession();
    setToken(null);
    setProfile(null);
    toast.success("Signed out");
  };

  if (!token) return <AdminLoginPanel onLoggedIn={handleLogin} />;

  const initials = (profile?.name?.trim()?.[0] || "A").toUpperCase();
  const navClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-[var(--radius)] px-3 py-2 text-sm font-medium transition-colors ${
      active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 shadow-sm backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius)] bg-foreground text-background">
                <ScanLine className="h-4 w-4" />
              </span>
              <span className="font-display text-base font-semibold tracking-tight">ScreenScan Admin</span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {NAV_LINKS.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} className={({ isActive }) => navClass(isActive)}>
                  <Icon className="h-4 w-4" />
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="flex items-center gap-2 rounded-[var(--radius)] border border-border px-2.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              <AdminAvatar avatar={profile?.avatar} initials={initials} size="sm" />
              <span className="hidden max-w-[140px] truncate sm:inline">{profile?.name || "Administrator"}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>

            {menuOpen && (
              <div className="surface absolute right-0 mt-2 w-60 overflow-hidden p-1.5 shadow-lg">
                <div className="flex items-center gap-3 px-3 py-2">
                  <AdminAvatar avatar={profile?.avatar} initials={initials} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{profile?.name || "Administrator"}</p>
                    <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
                  </div>
                </div>
                <div className="my-1 h-px bg-border" />
                <MenuButton
                  icon={UserCog}
                  label="Edit profile"
                  onClick={() => {
                    setMenuOpen(false);
                    setModal("profile");
                  }}
                />
                <MenuButton
                  icon={KeyRound}
                  label="Change password"
                  onClick={() => {
                    setMenuOpen(false);
                    setModal("password");
                  }}
                />
                <div className="my-1 h-px bg-border" />
                <MenuButton icon={LogOut} label="Sign out" onClick={logout} danger />
              </div>
            )}
          </div>
        </div>

        <nav className="container mx-auto flex items-center gap-1 px-6 pb-3 md:hidden">
          {NAV_LINKS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => navClass(isActive)}>
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="container mx-auto max-w-5xl px-6 py-10">
        <Outlet context={{ token }} />
      </main>

      {modal === "profile" && profile && (
        <EditProfileModal
          token={token}
          profile={profile}
          onClose={() => setModal(null)}
          onSaved={handleProfileSaved}
        />
      )}
      {modal === "password" && (
        <ChangePasswordModal token={token} onClose={() => setModal(null)} onChanged={() => navigate("/admin")} />
      )}
    </div>
  );
};

function AdminAvatar({
  avatar,
  initials,
  size,
}: {
  avatar?: string | null;
  initials: string;
  size: "sm" | "md" | "lg";
}) {
  const dimensions = size === "lg" ? "h-16 w-16 text-xl" : size === "md" ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs";
  if (avatar) {
    return <img src={avatar} alt="Profile" className={`${dimensions} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <span
      className={`flex ${dimensions} shrink-0 items-center justify-center rounded-full bg-foreground font-semibold text-background`}
    >
      {initials}
    </span>
  );
}

function MenuButton({
  icon: Icon,
  label,
  onClick,
  danger = false,
}: {
  icon: typeof UserCog;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-[calc(var(--radius)-3px)] px-3 py-2 text-sm font-medium transition-colors ${
        danger ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-secondary"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

// ── Modals ────────────────────────────────────────────────────────────────

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="surface relative z-10 w-full max-w-md p-6">
        <h3 className="font-display text-lg font-semibold text-foreground">{title}</h3>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function EditProfileModal({
  token,
  profile,
  onClose,
  onSaved,
}: {
  token: string;
  profile: AdminProfile;
  onClose: () => void;
  onSaved: (token: string, profile: AdminProfile) => void;
}) {
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [avatar, setAvatar] = useState<string | null>(profile.avatar ?? null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = (name.trim()?.[0] || profile.name?.[0] || "A").toUpperCase();

  const pickFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (file.size > MAX_AVATAR_BYTES) return toast.error("Image is too large (max 2MB)");
    const reader = new FileReader();
    reader.onload = () => setAvatar(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => toast.error("Could not read that image");
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!name.trim() || !email.trim()) return toast.error("Name and email are required");
    setSaving(true);
    try {
      const result = await updateAdminProfile(token, name.trim(), email.trim(), avatar);
      onSaved(result.token, result.admin);
      toast.success("Profile updated");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update profile");
    }
    setSaving(false);
  };

  return (
    <ModalShell title="Edit profile" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <AdminAvatar avatar={avatar} initials={initials} size="lg" />
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/*" onChange={pickFile} className="hidden" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              <Camera className="h-4 w-4" />
              {avatar ? "Change photo" : "Upload photo"}
            </button>
            {avatar && (
              <button
                type="button"
                onClick={() => setAvatar(null)}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-border px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Name</label>
          <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
          <input
            className={inputClass}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">Changing your email signs you in again on next visit.</p>
        </div>
        <ModalActions saving={saving} onCancel={onClose} onSubmit={submit} submitLabel="Save changes" />
      </div>
    </ModalShell>
  );
}

function ChangePasswordModal({
  token,
  onClose,
  onChanged,
}: {
  token: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!current || !next) return toast.error("Fill in all fields");
    if (next !== confirm) return toast.error("New passwords don't match");
    setSaving(true);
    try {
      await changeAdminPassword(token, current, next);
      toast.success("Password changed");
      onClose();
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change password");
    }
    setSaving(false);
  };

  const field = (label: string, value: string, setValue: (value: string) => void) => (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      <input
        className={inputClass}
        type={show ? "text" : "password"}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </div>
  );

  return (
    <ModalShell title="Change password" onClose={onClose}>
      <div className="space-y-4">
        {field("Current password", current, setCurrent)}
        {field("New password", next, setNext)}
        {field("Confirm new password", confirm, setConfirm)}
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => setShow((value) => !value)}
            className="inline-flex items-center gap-1.5 text-foreground"
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
            {show ? "Hide passwords" : "Show passwords"}
          </button>
        </label>
        <ModalActions saving={saving} onCancel={onClose} onSubmit={submit} submitLabel="Update password" />
      </div>
    </ModalShell>
  );
}

function ModalActions({
  saving,
  onCancel,
  onSubmit,
  submitLabel,
}: {
  saving: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-3 pt-1">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-[var(--radius)] border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {submitLabel}
      </button>
    </div>
  );
}

export default AdminLayout;
