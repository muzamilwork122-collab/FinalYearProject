import { useState, type ComponentType } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { CheckCircle2, Eye, EyeOff, Loader2, Power, PowerOff, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  loginAdmin,
  setAdminSession,
  type AdminProfile,
  type ShopkeeperApplication,
} from "@/lib/shopApi";

export const inputClass =
  "w-full rounded-[var(--radius)] border border-input bg-card px-3.5 py-2.5 text-sm text-foreground " +
  "placeholder:text-muted-foreground/60 outline-none transition-colors " +
  "focus:border-accent focus:ring-2 focus:ring-accent/30";

export const STATUS_BADGE: Record<string, string> = {
  pending: "bg-[hsl(var(--warning)/0.15)] text-warning",
  approved: "bg-[hsl(var(--success)/0.15)] text-success",
  rejected: "bg-destructive/15 text-destructive",
};

/** Token shared with every admin sub-page via the layout's <Outlet>. */
export interface AdminOutletContext {
  token: string;
}

export function useAdminToken(): string {
  return useOutletContext<AdminOutletContext>().token;
}

// ── Sign-in ───────────────────────────────────────────────────────────────

export function AdminLoginPanel({ onLoggedIn }: { onLoggedIn: (token: string, profile: AdminProfile) => void }) {
  const [email, setEmail] = useState("admin@dashboard.com");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) return toast.error("Enter the admin email and password");
    setLoading(true);
    try {
      const result = await loginAdmin(email.trim(), password);
      setAdminSession(result.token, result.admin);
      onLoggedIn(result.token, result.admin);
      toast.success("Signed in to admin panel");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md">
        <div className="surface p-7">
          <div className="mb-6 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius)] bg-foreground text-background">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <h1 className="font-display text-xl font-semibold text-foreground">Admin panel</h1>
              <p className="text-xs text-muted-foreground">Restricted access</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
              <input
                className={inputClass}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && submit()}
                placeholder="admin@dashboard.com"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <input
                  className={`${inputClass} pr-11`}
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && submit()}
                  placeholder="Your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              Sign in
            </button>
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/" className="font-medium text-foreground underline underline-offset-2">
            Back to site
          </Link>
        </p>
      </div>
    </div>
  );
}

// ── Small building blocks ───────────────────────────────────────────────────

export function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="surface flex items-center gap-3 p-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius)] bg-secondary text-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  message,
}: {
  icon: ComponentType<{ className?: string }>;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius)] border border-dashed border-border py-16 text-muted-foreground">
      <Icon className="h-9 w-9 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        active ? "bg-accent-soft text-accent-strong" : "bg-destructive/15 text-destructive"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

// ── Reject reason modal ──────────────────────────────────────────────────────

export function RejectModal({
  application,
  onCancel,
  onConfirm,
}: {
  application: ShopkeeperApplication;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const confirm = () => {
    if (reason.trim().length < 3) return toast.error("Please give a clear reason");
    setSubmitting(true);
    onConfirm(reason.trim());
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]" onClick={onCancel} />
      <div className="surface relative z-10 w-full max-w-md p-6">
        <h3 className="font-display text-lg font-semibold text-foreground">Reject application</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Rejecting <span className="font-medium text-foreground">{application.shop_name}</span>. The reason is shown to
          the shopkeeper.
        </p>
        <textarea
          className={`${inputClass} mt-4 min-h-[96px] resize-y`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. Document is unreadable / shop details could not be verified"
          autoFocus
        />
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[var(--radius)] border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shop card (admin shops page) ──────────────────────────────────────────────

export function ShopCard({
  application,
  onApprove,
  onReject,
  onToggleActive,
  busy,
}: {
  application: ShopkeeperApplication;
  onApprove: () => void;
  onReject: () => void;
  onToggleActive: () => void;
  busy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="surface overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">{application.shop_name}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS_BADGE[application.status]}`}>
              {application.status}
            </span>
            <ActiveBadge active={application.is_active} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {application.first_name} {application.last_name} · {application.email} · {application.phone}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {application.category || "Uncategorized"} · {application.address}
            {application.city ? `, ${application.city}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="rounded-[var(--radius)] border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
        >
          {expanded ? "Hide details" : "View details"}
        </button>
      </div>

      {expanded && (
        <div className="grid grid-cols-1 gap-4 border-t border-border px-5 py-4 sm:grid-cols-2">
          <Detail label="Owner" value={`${application.first_name} ${application.last_name}`} />
          <Detail label="Username" value={application.username} />
          <Detail label="Shop phone" value={application.shop_phone || "—"} />
          <Detail label="Website" value={application.website || "—"} />
          <Detail label="Opening hours" value={application.opening_hours || "—"} />
          <Detail label="Country" value={application.country || "—"} />
          <Detail
            label="Map pin"
            value={
              application.latitude != null && application.longitude != null
                ? `${application.latitude.toFixed(4)}, ${application.longitude.toFixed(4)}`
                : "Not pinned"
            }
          />
          <Detail label="Document type" value={application.document_type || "—"} />
          <Detail label="Document number" value={application.document_number || "—"} />
          <div className="sm:col-span-2">
            <Detail label="Description" value={application.description || "—"} />
          </div>
          {application.rejection_reason && (
            <div className="sm:col-span-2">
              <Detail label="Rejection reason" value={application.rejection_reason} />
            </div>
          )}
          {application.document_image && (
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">Document image</p>
              <img
                src={application.document_image}
                alt="Submitted document"
                className="max-h-72 w-full rounded-[var(--radius)] border border-border object-contain bg-secondary/40"
              />
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-3 border-t border-border px-5 py-4">
        <button
          type="button"
          onClick={onToggleActive}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
        >
          {application.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
          {application.is_active ? "Deactivate" : "Activate"}
        </button>
        {application.status === "pending" && (
          <>
            <button
              type="button"
              onClick={onReject}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
            >
              <XCircle className="h-4 w-4" /> Reject
            </button>
            <button
              type="button"
              onClick={onApprove}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Approve
            </button>
          </>
        )}
      </div>
    </div>
  );
}
