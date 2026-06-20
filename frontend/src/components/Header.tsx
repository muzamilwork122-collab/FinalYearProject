import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, LogOut, Menu, ScanLine, Store, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationBell from "@/components/chat/NotificationBell";
import {
  clearShopSession,
  getShopAccount,
  getShopToken,
  SHOP_SESSION_EVENT,
  type ShopkeeperAccount,
} from "@/lib/shopApi";

const NAV = [
  { label: "Home", to: "/" },
  { label: "Features", to: "/features" },
  { label: "Pricing", to: "/pricing" },
  { label: "For shops", to: "/shop/register" },
];

export default function Header() {
  const { isAuthenticated, user, token, logout, openLogin, requireAuth } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [shop, setShop] = useState<ShopkeeperAccount | null>(() => (getShopToken() ? getShopAccount() : null));

  // Reflect shopkeeper login/logout (which happens on the /shop page) in the header.
  useEffect(() => {
    const sync = () => setShop(getShopToken() ? getShopAccount() : null);
    window.addEventListener(SHOP_SESSION_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SHOP_SESSION_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const goDashboard = () => {
    setMenuOpen(false);
    requireAuth(() => navigate("/dashboard"));
  };

  const goShopDashboard = () => {
    setMenuOpen(false);
    navigate("/shop");
  };

  const shopLogout = () => {
    clearShopSession();
    setMenuOpen(false);
    navigate("/");
  };

  // A signed-in customer takes header precedence; otherwise show the shopkeeper.
  const showShop = !isAuthenticated && Boolean(shop);
  const initials = (user?.name?.toString().trim()?.[0] || "U").toUpperCase();
  const shopInitials = (shop?.shop_name?.trim()?.[0] || shop?.first_name?.trim()?.[0] || "S").toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 shadow-sm backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2" onClick={() => setMenuOpen(false)}>
          <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius)] bg-accent text-accent-foreground">
            <ScanLine className="h-4 w-4" />
          </span>
          <span className="font-display text-base font-semibold tracking-tight">ScreenScan</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `rounded-[var(--radius)] px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-accent-soft text-accent-strong" : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          {isAuthenticated ? (
            <>
              <button
                onClick={goDashboard}
                className="flex items-center gap-2 rounded-[var(--radius)] px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </button>
              <NotificationBell token={token} role="user" />
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground">
                {initials}
              </span>
              <button
                onClick={logout}
                aria-label="Sign out"
                className="flex h-9 w-9 items-center justify-center rounded-[var(--radius)] border border-border text-muted-foreground transition-colors hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : showShop ? (
            <>
              <button
                onClick={goShopDashboard}
                className="flex items-center gap-2 rounded-[var(--radius)] px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <Store className="h-4 w-4" />
                Shop dashboard
              </button>
              <NotificationBell token={getShopToken()} role="shop" />
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                {shopInitials}
              </span>
              <button
                onClick={shopLogout}
                aria-label="Sign out"
                className="flex h-9 w-9 items-center justify-center rounded-[var(--radius)] border border-border text-muted-foreground transition-colors hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={openLogin}
                className="rounded-[var(--radius)] px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Sign in
              </button>
              <Link
                to="/#analyze"
                className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Analyze a screen
              </Link>
            </>
          )}
        </div>

        <button
          className="flex h-9 w-9 items-center justify-center rounded-[var(--radius)] border border-border text-foreground md:hidden"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="container mx-auto flex flex-col gap-1 px-6 py-4">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium ${
                    isActive ? "bg-accent-soft text-accent-strong" : "text-muted-foreground"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
              {isAuthenticated ? (
                <>
                  <button
                    onClick={goDashboard}
                    className="rounded-[var(--radius)] border border-border px-3 py-2.5 text-left text-sm font-medium text-foreground"
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => {
                      logout();
                      setMenuOpen(false);
                    }}
                    className="rounded-[var(--radius)] px-3 py-2.5 text-left text-sm font-medium text-muted-foreground"
                  >
                    Sign out
                  </button>
                </>
              ) : showShop ? (
                <>
                  <button
                    onClick={goShopDashboard}
                    className="rounded-[var(--radius)] border border-border px-3 py-2.5 text-left text-sm font-medium text-foreground"
                  >
                    Shop dashboard
                  </button>
                  <button
                    onClick={shopLogout}
                    className="rounded-[var(--radius)] px-3 py-2.5 text-left text-sm font-medium text-muted-foreground"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      openLogin();
                      setMenuOpen(false);
                    }}
                    className="rounded-[var(--radius)] border border-border px-3 py-2.5 text-left text-sm font-medium text-foreground"
                  >
                    Sign in
                  </button>
                  <Link
                    to="/#analyze"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-[var(--radius)] bg-primary px-3 py-2.5 text-center text-sm font-semibold text-primary-foreground"
                  >
                    Analyze a screen
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
