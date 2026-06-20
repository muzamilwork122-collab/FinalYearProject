import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  LayoutDashboard,
  Loader2,
  LogOut,
  MapPin,
  MessagesSquare,
  Store,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ConversationsPanel, { type OpenRequest } from "@/components/chat/ConversationsPanel";
import { useChatThreads } from "@/hooks/useChatThreads";
import {
  clearShopSession,
  fetchShopkeeperMe,
  getShopAccount,
  getShopToken,
  loginShopkeeper,
  setShopSession,
  type ShopkeeperAccount,
} from "@/lib/shopApi";

type DashboardTab = "overview" | "messages" | "profile";

const inputClass =
  "w-full rounded-[var(--radius)] border border-input bg-card px-3.5 py-2.5 text-sm text-foreground " +
  "placeholder:text-muted-foreground/60 outline-none transition-colors " +
  "focus:border-accent focus:ring-2 focus:ring-accent/30";

const STATUS_META = {
  pending: {
    label: "Awaiting review",
    icon: Clock,
    tone: "text-warning",
    bg: "bg-[hsl(var(--warning)/0.12)]",
    border: "border-[hsl(var(--warning)/0.3)]",
    blurb: "Your application is in the admin review queue. We'll update this page once a decision is made.",
  },
  approved: {
    label: "Approved partner",
    icon: CheckCircle2,
    tone: "text-success",
    bg: "bg-[hsl(var(--success)/0.12)]",
    border: "border-[hsl(var(--success)/0.3)]",
    blurb: "You're live! Your shop now appears with priority on the map when customers search nearby.",
  },
  rejected: {
    label: "Application rejected",
    icon: XCircle,
    tone: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    blurb: "Unfortunately your application was not approved. See the reason below — you can re-apply after addressing it.",
  },
} as const;

function StatusCard({ account }: { account: ShopkeeperAccount }) {
  const meta = STATUS_META[account.status];
  const Icon = meta.icon;
  return (
    <div className={`rounded-[var(--radius)] border ${meta.border} ${meta.bg} p-6`}>
      <div className="flex items-center gap-3">
        <Icon className={`h-7 w-7 ${meta.tone}`} />
        <div>
          <p className={`text-sm font-semibold ${meta.tone}`}>{meta.label}</p>
          <p className="text-xs text-muted-foreground">Application for {account.shop_name}</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-foreground">{meta.blurb}</p>
      {account.status === "rejected" && account.rejection_reason && (
        <div className="mt-4 rounded-[var(--radius)] border border-destructive/30 bg-card p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-destructive">Reason</p>
          <p className="mt-1 text-sm text-foreground">{account.rejection_reason}</p>
        </div>
      )}
    </div>
  );
}

function LoginPanel({ onLoggedIn }: { onLoggedIn: (account: ShopkeeperAccount) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) return toast.error("Enter your email and password");
    setLoading(true);
    try {
      const result = await loginShopkeeper(email.trim(), password);
      setShopSession(result.token, result.shopkeeper);
      onLoggedIn(result.shopkeeper);
      toast.success("Welcome back");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="surface p-7">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius)] bg-accent text-accent-foreground">
            <Store className="h-4 w-4" />
          </span>
          <div>
            <h1 className="font-display text-xl font-semibold text-foreground">Shop dashboard</h1>
            <p className="text-xs text-muted-foreground">Sign in to your partner account</p>
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
              placeholder="you@email.com"
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
        New partner?{" "}
        <Link to="/shop/register" className="font-medium text-foreground underline underline-offset-2">
          Register your shop
        </Link>
      </p>
    </div>
  );
}

const TABS: { id: DashboardTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "messages", label: "Messages", icon: MessagesSquare },
  { id: "profile", label: "Shop profile", icon: Store },
];

function OverviewTab({ account, unread, onOpenMessages }: { account: ShopkeeperAccount; unread: number; onOpenMessages: () => void }) {
  return (
    <div className="space-y-6">
      <StatusCard account={account} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Application status" value={STATUS_META[account.status].label} tone={STATUS_META[account.status].tone} />
        <StatTile label="Unread messages" value={String(unread)} tone={unread > 0 ? "text-primary" : "text-foreground"} />
        <StatTile
          label="Map visibility"
          value={account.status === "approved" ? "Live (priority)" : "Hidden"}
          tone={account.status === "approved" ? "text-success" : "text-muted-foreground"}
        />
      </div>

      <div className="surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Customer messages</h2>
          <button
            onClick={onOpenMessages}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-strong hover:underline"
          >
            <MessagesSquare className="h-4 w-4" /> Open inbox{unread > 0 ? ` (${unread})` : ""}
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          {account.status === "approved"
            ? "Customers can message you straight from your map listing. Reply from the Messages tab — they'll see it instantly."
            : "Once approved, customers will be able to message you here directly from the map."}
        </p>
      </div>

      <div className="surface p-6">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Account summary</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SummaryRow label="Shop name" value={account.shop_name} />
          <SummaryRow label="Owner" value={`${account.first_name} ${account.last_name}`} />
          <SummaryRow label="Username" value={account.username} />
          <SummaryRow label="Email" value={account.email} />
          <SummaryRow label="Submitted" value={account.created_at ? new Date(account.created_at).toLocaleDateString() : "—"} />
          <SummaryRow label="Reviewed" value={account.reviewed_at ? new Date(account.reviewed_at).toLocaleDateString() : "Pending"} />
        </dl>
      </div>
    </div>
  );
}

function ProfileTab({ account }: { account: ShopkeeperAccount }) {
  return (
    <div className="space-y-6">
      <div className="surface p-6">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Shop details</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SummaryRow label="Shop name" value={account.shop_name} />
          <SummaryRow label="Category" value={account.category || "—"} />
          <SummaryRow label="Shop phone" value={account.shop_phone || "—"} />
          <SummaryRow label="Website" value={account.website || "—"} />
          <SummaryRow label="Opening hours" value={account.opening_hours || "—"} />
          <SummaryRow label="City / Country" value={[account.city, account.country].filter(Boolean).join(", ") || "—"} />
        </dl>
        <div className="mt-4">
          <SummaryRow label="Address" value={account.address || "—"} />
        </div>
        {account.description && (
          <div className="mt-4">
            <SummaryRow label="Description" value={account.description} />
          </div>
        )}
        {(account.latitude != null && account.longitude != null) && (
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            Pinned at {account.latitude.toFixed(5)}, {account.longitude.toFixed(5)}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Need to change these details? Contact support — profile editing is coming soon.
      </p>
    </div>
  );
}

const ShopDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [account, setAccount] = useState<ShopkeeperAccount | null>(() => (getShopToken() ? getShopAccount() : null));
  const [loading, setLoading] = useState(Boolean(getShopToken()));
  const [tab, setTab] = useState<DashboardTab>(() =>
    searchParams.get("tab") === "messages" || searchParams.get("thread") ? "messages" : "overview",
  );
  const [openRequest, setOpenRequest] = useState<OpenRequest | null>(null);

  const token = getShopToken();
  const { unreadTotal: unread } = useChatThreads(account ? token : null);

  useEffect(() => {
    const current = getShopToken();
    if (!current) {
      setLoading(false);
      return;
    }
    fetchShopkeeperMe(current)
      .then((fresh) => {
        setAccount(fresh);
        setShopSession(current, fresh);
      })
      .catch(() => {
        clearShopSession();
        setAccount(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // A `?tab=messages&thread=<id>` deep-link (from the notification bell) opens the
  // Messages tab on that thread, then is cleared so a refresh doesn't re-trigger it.
  useEffect(() => {
    const threadParam = searchParams.get("thread");
    if (threadParam) setOpenRequest({ threadId: threadParam, nonce: Date.now() });
    if (searchParams.has("tab") || searchParams.has("thread")) {
      searchParams.delete("tab");
      searchParams.delete("thread");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = () => {
    clearShopSession();
    setAccount(null);
    toast.success("Signed out");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-5xl px-6 py-12">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : account && token ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="label-mono">Shop dashboard</p>
                <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground">
                  Hi {account.first_name}, welcome
                </h1>
              </div>
              <button
                onClick={logout}
                className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>

            <div className="flex items-center gap-1 border-b border-border">
              {TABS.map((item) => {
                const Icon = item.icon;
                const isActive = tab === item.id;
                const showBadge = item.id === "messages" && unread > 0;
                return (
                  <button
                    key={item.id}
                    onClick={() => setTab(item.id)}
                    className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "border-accent text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                    {showBadge && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                        {unread}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {tab === "overview" && <OverviewTab account={account} unread={unread} onOpenMessages={() => setTab("messages")} />}
            {tab === "messages" && (
              <div className="surface h-[560px] overflow-hidden p-0">
                <ConversationsPanel token={token} role="shop" variant="full" openRequest={openRequest} />
              </div>
            )}
            {tab === "profile" && <ProfileTab account={account} />}
          </div>
        ) : (
          <LoginPanel onLoggedIn={setAccount} />
        )}
      </main>
      <Footer />
    </div>
  );
};

function StatTile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="surface p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

export default ShopDashboard;
