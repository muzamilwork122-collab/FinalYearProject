import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import {
  approveShopkeeper,
  fetchAdminShopkeepers,
  rejectShopkeeper,
  setShopkeeperActive,
  type ShopkeeperApplication,
} from "@/lib/shopApi";
import { EmptyState, RejectModal, ShopCard, useAdminToken } from "./adminShared";

const STATUS_FILTERS = ["pending", "approved", "rejected", "all"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const ACTIVE_FILTERS = ["all", "active", "inactive"] as const;
type ActiveFilter = (typeof ACTIVE_FILTERS)[number];

function isStatusFilter(value: string | null): value is StatusFilter {
  return value != null && (STATUS_FILTERS as readonly string[]).includes(value);
}

const AdminShops = () => {
  const token = useAdminToken();
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const initial = searchParams.get("status");
    return isStatusFilter(initial) ? initial : "pending";
  });
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [shops, setShops] = useState<ShopkeeperApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ShopkeeperApplication | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchAdminShopkeepers(
        token,
        statusFilter === "all" ? undefined : statusFilter,
        activeFilter === "all" ? undefined : activeFilter,
      );
      setShops(list);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load shops");
    }
    setLoading(false);
  }, [token, statusFilter, activeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (shop: ShopkeeperApplication) => {
    setBusyId(shop.id);
    try {
      await approveShopkeeper(token, shop.id);
      toast.success(`Approved ${shop.shop_name}`);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Approval failed");
    }
    setBusyId(null);
  };

  const handleReject = async (reason: string) => {
    if (!rejectTarget) return;
    setBusyId(rejectTarget.id);
    try {
      await rejectShopkeeper(token, rejectTarget.id, reason);
      toast.success(`Rejected ${rejectTarget.shop_name}`);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Rejection failed");
    } finally {
      setRejectTarget(null);
      setBusyId(null);
    }
  };

  const handleToggleActive = async (shop: ShopkeeperApplication) => {
    setBusyId(shop.id);
    try {
      await setShopkeeperActive(token, shop.id, !shop.is_active);
      toast.success(shop.is_active ? "Shop deactivated" : "Shop activated");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    }
    setBusyId(null);
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Shops</h1>
      <p className="mt-1 text-muted-foreground">Review applications and manage listed shops.</p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                statusFilter === filter
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
        <div className="inline-flex flex-wrap gap-1.5">
          {ACTIVE_FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                activeFilter === filter
                  ? "bg-secondary text-foreground"
                  : "border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : shops.length === 0 ? (
          <EmptyState icon={Store} message="No shops match these filters." />
        ) : (
          <div className="space-y-4">
            {shops.map((shop) => (
              <ShopCard
                key={shop.id}
                application={shop}
                busy={busyId === shop.id}
                onApprove={() => handleApprove(shop)}
                onReject={() => setRejectTarget(shop)}
                onToggleActive={() => handleToggleActive(shop)}
              />
            ))}
          </div>
        )}
      </div>

      {rejectTarget && (
        <RejectModal application={rejectTarget} onCancel={() => setRejectTarget(null)} onConfirm={handleReject} />
      )}
    </div>
  );
};

export default AdminShops;
