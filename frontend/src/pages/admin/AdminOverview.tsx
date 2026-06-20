import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, PowerOff, ScanLine, Store, UserX, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { fetchAdminStats, type AdminStats } from "@/lib/shopApi";
import { StatCard, useAdminToken } from "./adminShared";

const AdminOverview = () => {
  const token = useAdminToken();
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    fetchAdminStats(token)
      .then(setStats)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load stats"));
  }, [token]);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
      <p className="mt-1 text-muted-foreground">Platform activity at a glance.</p>

      {stats && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <StatCard label="Users" value={stats.users} icon={Users} />
            <StatCard label="Inactive users" value={stats.users_inactive} icon={UserX} />
            <StatCard label="Analyses" value={stats.analyses} icon={ScanLine} />
            <StatCard label="Shops" value={stats.shopkeepers_total} icon={Store} />
            <StatCard label="Pending" value={stats.shopkeepers_pending} icon={Clock} />
            <StatCard label="Approved" value={stats.shopkeepers_approved} icon={CheckCircle2} />
            <StatCard label="Rejected" value={stats.shopkeepers_rejected} icon={XCircle} />
            <StatCard label="Inactive shops" value={stats.shopkeepers_inactive} icon={PowerOff} />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <QuickAction
              to="/admin/shops?status=pending"
              icon={Clock}
              title={`${stats.shopkeepers_pending} application${stats.shopkeepers_pending === 1 ? "" : "s"} awaiting review`}
              description="Approve or reject pending shop applications."
            />
            <QuickAction
              to="/admin/users"
              icon={Users}
              title="Manage users"
              description="View user details and activate or deactivate accounts."
            />
          </div>
        </>
      )}
    </div>
  );
};

function QuickAction({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: string;
  icon: typeof Users;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="surface flex items-start gap-3 p-5 transition-colors hover:border-accent/50 hover:bg-secondary/40"
    >
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[var(--radius)] bg-secondary text-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}

export default AdminOverview;
