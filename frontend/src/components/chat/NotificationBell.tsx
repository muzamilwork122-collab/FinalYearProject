import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, MessageSquare, Store, User as UserIcon } from "lucide-react";
import { type ChatRole, type ChatThread } from "@/lib/chatApi";
import { useChatThreads } from "@/hooks/useChatThreads";

interface Props {
  token: string | null;
  role: ChatRole;
  /** Which edge the dropdown aligns to (defaults to the button's right edge). */
  align?: "left" | "right";
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSeconds = Math.round((Date.now() - then) / 1000);
  if (diffSeconds < 60) return "just now";
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Header notification centre for chat. Shows an unread badge on a bell icon and,
 * on click, a dropdown listing recent conversations ("New message from …").
 * Selecting one deep-links into the right inbox: customers go to `/messages`,
 * shopkeepers to their dashboard's Messages tab.
 */
export default function NotificationBell({ token, role, align = "right" }: Props) {
  const navigate = useNavigate();
  const { threads, unreadTotal } = useChatThreads(token);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!token) return null;

  const items = [...threads]
    .filter((thread) => Boolean(thread.last_message_at))
    .sort((a, b) => new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime());

  const openThread = (thread: ChatThread) => {
    setOpen(false);
    if (role === "user") {
      navigate(`/messages?shop=${encodeURIComponent(thread.peer_id)}`);
    } else {
      navigate(`/shop?tab=messages&thread=${encodeURIComponent(thread.id)}`);
    }
  };

  const openInbox = () => {
    setOpen(false);
    navigate(role === "user" ? "/messages" : "/shop?tab=messages");
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={unreadTotal > 0 ? `Notifications (${unreadTotal} unread)` : "Notifications"}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-[var(--radius)] border border-border text-muted-foreground transition-colors hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {unreadTotal > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
            {unreadTotal > 99 ? "99+" : unreadTotal}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute z-50 mt-2 w-80 overflow-hidden rounded-[var(--radius)] border border-border bg-card shadow-soft ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unreadTotal > 0 && (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-strong">
                {unreadTotal} new
              </span>
            )}
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">You're all caught up.</p>
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((thread) => {
                const isUnread = thread.unread > 0;
                return (
                  <li key={thread.id}>
                    <button
                      type="button"
                      onClick={() => openThread(thread)}
                      className={`flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-secondary/60 ${
                        isUnread ? "bg-accent-soft/40" : ""
                      }`}
                    >
                      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
                        {thread.peer_type === "shop" ? <Store className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
                        {isUnread && (
                          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-destructive" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className={`truncate text-sm ${isUnread ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>
                            {isUnread ? `New message from ${thread.peer_name}` : thread.peer_name}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">{relativeTime(thread.last_message_at)}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {thread.last_message || "No messages yet"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={openInbox}
            className="flex w-full items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-accent-strong transition-colors hover:bg-secondary/60"
          >
            <MessageSquare className="h-4 w-4" /> Open inbox
          </button>
        </div>
      )}
    </div>
  );
}
