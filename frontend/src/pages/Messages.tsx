import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, LogOut, MessageSquare, ScanLine } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationBell from "@/components/chat/NotificationBell";
import ConversationsPanel, { type OpenRequest } from "@/components/chat/ConversationsPanel";

const Messages = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [openRequest, setOpenRequest] = useState<OpenRequest | null>(null);

  // A `?shop=<id>` param (from the locator's "Message" action) auto-opens or
  // creates that thread, then is cleared so a refresh doesn't re-trigger it.
  useEffect(() => {
    const shopId = searchParams.get("shop");
    if (!shopId) return;
    setOpenRequest({ shopId, nonce: Date.now() });
    searchParams.delete("shop");
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const initials = (user?.name?.toString().trim()?.[0] || "U").toUpperCase();
  const btnGhost =
    "flex items-center gap-1.5 rounded-[var(--radius)] px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
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
              <span className="text-sm text-muted-foreground">/ Messages</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell token={token} role="user" />
            <ThemeToggle />
            <div className="hidden items-center gap-2 sm:flex">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground">
                {initials}
              </span>
              <span className="text-sm font-medium text-foreground">{user?.name || "User"}</span>
            </div>
            <button onClick={handleLogout} className={btnGhost}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto flex w-full min-h-0 max-w-5xl flex-1 flex-col px-6 pb-8 pt-6">
        <div className="mb-5">
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-foreground">
            <MessageSquare className="h-6 w-6 text-accent" />
            Messages
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Chat directly with verified repair shops near you.
          </p>
        </div>

        <div className="surface flex min-h-0 flex-1 overflow-hidden">
          {token && <ConversationsPanel token={token} role="user" variant="full" openRequest={openRequest} />}
        </div>
      </main>
    </div>
  );
};

export default Messages;
