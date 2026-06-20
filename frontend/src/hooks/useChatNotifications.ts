import { useEffect, useRef } from "react";
import { listThreads, type ChatRole } from "@/lib/chatApi";

const NOTIFY_POLL_MS = 5000;

/**
 * Poll the thread list for incoming messages and raise a desktop notification
 * (when permission is granted) for each newly-arrived message.
 *
 * This is the single background notification source per session — it runs in the
 * global `ChatNotifier`. The in-app surface is the header notification bell
 * (`NotificationBell` + `useChatThreads`); this hook only handles OS-level alerts
 * so a message is never announced twice.
 */
export function useChatNotifications(token: string | null, role: ChatRole): void {
  const seenRef = useRef<Record<string, number> | null>(null);

  useEffect(() => {
    seenRef.current = null;
    if (!token) return;

    let active = true;
    const poll = async () => {
      try {
        const { threads } = await listThreads(token);
        if (!active) return;

        const previous = seenRef.current;
        const snapshot: Record<string, number> = {};
        for (const thread of threads) snapshot[thread.id] = thread.unread;

        if (previous) {
          for (const thread of threads) {
            const before = previous[thread.id] ?? 0;
            if (thread.unread > before) {
              const preview =
                thread.last_message.length > 80 ? `${thread.last_message.slice(0, 80)}…` : thread.last_message;
              if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                new Notification(`New message from ${thread.peer_name}`, { body: preview });
              }
            }
          }
        }
        seenRef.current = snapshot;
      } catch {
        /* ignore transient errors */
      }
    };

    poll();
    const timer = window.setInterval(poll, NOTIFY_POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [token, role]);
}
