import { useEffect, useState } from "react";
import { listThreads, type ChatThread } from "@/lib/chatApi";

const POLL_MS = 5000;

/**
 * Poll the thread list for a session and expose it for display only.
 *
 * Fires no toasts or desktop notifications — it just powers the header
 * notification bell and any unread badge. Desktop notifications stay sourced
 * solely from the global `ChatNotifier`, so messages are never announced twice.
 */
export function useChatThreads(token: string | null): { threads: ChatThread[]; unreadTotal: number } {
  const [threads, setThreads] = useState<ChatThread[]>([]);

  useEffect(() => {
    if (!token) {
      setThreads([]);
      return;
    }

    let active = true;
    const poll = async () => {
      try {
        const data = await listThreads(token);
        if (active) setThreads(data.threads);
      } catch {
        /* keep last good list on transient errors */
      }
    };

    poll();
    const timer = window.setInterval(poll, POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [token]);

  const unreadTotal = threads.reduce((sum, thread) => sum + thread.unread, 0);
  return { threads, unreadTotal };
}
