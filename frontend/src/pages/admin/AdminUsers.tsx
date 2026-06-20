import { useCallback, useEffect, useState } from "react";
import { Loader2, Power, PowerOff, ScanLine, Users } from "lucide-react";
import { toast } from "sonner";
import {
  fetchAdminUserDetail,
  fetchAdminUsers,
  setUserActive,
  type AdminUser,
  type AdminUserDetail,
} from "@/lib/shopApi";
import { ActiveBadge, Detail, EmptyState, useAdminToken } from "./adminShared";

const ACTIVE_FILTERS = ["all", "active", "inactive"] as const;
type ActiveFilter = (typeof ACTIVE_FILTERS)[number];

const AdminUsers = () => {
  const token = useAdminToken();
  const [filter, setFilter] = useState<ActiveFilter>("all");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await fetchAdminUsers(token, filter === "all" ? undefined : filter));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load users");
    }
    setLoading(false);
  }, [token, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (user: AdminUser) => {
    setBusyId(user.id);
    try {
      await setUserActive(token, user.id, !user.is_active);
      toast.success(user.is_active ? "User deactivated" : "User activated");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    }
    setBusyId(null);
  };

  const openDetail = async (user: AdminUser) => {
    try {
      setDetail(await fetchAdminUserDetail(token, user.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load details");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Users</h1>
          <p className="mt-1 text-muted-foreground">View user accounts and manage access.</p>
        </div>
        <div className="inline-flex flex-wrap gap-1.5">
          {ACTIVE_FILTERS.map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                filter === value
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <EmptyState icon={Users} message="No users found." />
        ) : (
          <div className="surface overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 text-center font-medium">Analyses</th>
                  <th className="px-5 py-3 font-medium">Joined</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                    <td className="px-5 py-3 font-medium text-foreground">{user.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{user.email}</td>
                    <td className="px-5 py-3 text-center text-foreground">{user.analyses_count}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <ActiveBadge active={user.is_active} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openDetail(user)}
                          className="rounded-[var(--radius)] border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(user)}
                          disabled={busyId === user.id}
                          className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
                        >
                          {busyId === user.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : user.is_active ? (
                            <PowerOff className="h-3.5 w-3.5" />
                          ) : (
                            <Power className="h-3.5 w-3.5" />
                          )}
                          {user.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detail && <UserDetailModal detail={detail} onClose={() => setDetail(null)} />}
    </div>
  );
};

function UserDetailModal({ detail, onClose }: { detail: AdminUserDetail; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="surface relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">{detail.name}</h3>
            <p className="text-sm text-muted-foreground">{detail.email}</p>
          </div>
          <ActiveBadge active={detail.is_active} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <Detail label="Analyses" value={String(detail.analyses_count)} />
          <Detail
            label="Joined"
            value={detail.created_at ? new Date(detail.created_at).toLocaleDateString() : "—"}
          />
        </div>

        <div className="mt-6">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Recent analyses</p>
          {detail.recent_analyses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No analyses yet.</p>
          ) : (
            <div className="space-y-2">
              {detail.recent_analyses.map((analysis) => (
                <div
                  key={analysis.id}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-border px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <ScanLine className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm text-foreground">
                      {analysis.phone_model || "Unknown device"}
                    </span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium capitalize text-foreground">
                      {analysis.severity}
                    </span>
                  </div>
                  <span className="flex-shrink-0 text-xs text-muted-foreground">
                    {new Date(analysis.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius)] border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminUsers;
