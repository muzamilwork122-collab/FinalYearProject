import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, MessageSquare, Send, Store, User as UserIcon } from "lucide-react";
import {
  fetchMessages,
  listThreads,
  sendMessage,
  startThread,
  type ChatMessage,
  type ChatRole,
  type ChatThread,
} from "@/lib/chatApi";

const THREAD_POLL_MS = 5000;
const MESSAGE_POLL_MS = 3000;

/** Request to auto-open a thread. Provide `threadId` to open an existing thread
 *  directly (either role), or `shopId` to open/create a customer→shop thread.
 *  The nonce lets the same target be opened again after the panel was closed. */
export interface OpenRequest {
  shopId?: string;
  threadId?: string;
  nonce: number;
}

interface Props {
  token: string;
  role: ChatRole;
  /** "compact" stacks list/thread for the floating widget; "full" is two-pane. */
  variant?: "compact" | "full";
  openRequest?: OpenRequest | null;
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function PeerIcon({ type }: { type: ChatRole }) {
  return type === "shop" ? <Store className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />;
}

export default function ConversationsPanel({ token, role, variant = "full", openRequest = null }: Props) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshThreads = useCallback(async () => {
    try {
      const data = await listThreads(token);
      setThreads(data.threads);
    } catch {
      /* keep last good list on transient errors */
    } finally {
      setLoadingThreads(false);
    }
  }, [token]);

  const refreshMessages = useCallback(
    async (threadId: string) => {
      try {
        const data = await fetchMessages(token, threadId);
        setMessages(data.messages);
        // Reading clears unread server-side; reflect it locally right away.
        setThreads((prev) => prev.map((thread) => (thread.id === threadId ? { ...thread, unread: 0 } : thread)));
      } catch {
        /* ignore transient errors */
      }
    },
    [token],
  );

  // Poll the thread list.
  useEffect(() => {
    refreshThreads();
    const timer = window.setInterval(refreshThreads, THREAD_POLL_MS);
    return () => window.clearInterval(timer);
  }, [refreshThreads]);

  // Poll the open thread's messages.
  useEffect(() => {
    if (!activeId) return;
    refreshMessages(activeId);
    const timer = window.setInterval(() => refreshMessages(activeId), MESSAGE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [activeId, refreshMessages]);

  // Auto-open a thread on request: by id (notification bell) or by shop
  // (customer "Message" action, which opens or creates the thread).
  useEffect(() => {
    if (!openRequest) return;

    if (openRequest.threadId) {
      setActiveId(openRequest.threadId);
      return;
    }

    if (!openRequest.shopId || role !== "user") return;
    let cancelled = false;
    startThread(token, openRequest.shopId)
      .then((thread) => {
        if (cancelled) return;
        setThreads((prev) => (prev.some((item) => item.id === thread.id) ? prev : [thread, ...prev]));
        setActiveId(thread.id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [openRequest, role, token]);

  // Keep the message view pinned to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, activeId]);

  const active = threads.find((thread) => thread.id === activeId) ?? null;

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || !activeId || sending) return;
    setSending(true);
    setDraft("");
    try {
      const message = await sendMessage(token, activeId, content);
      setMessages((prev) => [...prev, message]);
      refreshThreads();
    } catch {
      setDraft(content);
    } finally {
      setSending(false);
    }
  };

  const showList = variant === "full" || !activeId;
  const showThread = variant === "full" || Boolean(activeId);

  const ThreadList = (
    <div className={`flex flex-col ${variant === "full" ? "w-64 border-r border-border" : "w-full"}`}>
      {loadingThreads ? (
        <div className="flex flex-1 items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : threads.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            {role === "shop" ? "No customer messages yet." : "Start a chat from a shop on the map."}
          </p>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {threads.map((thread) => (
            <li key={thread.id}>
              <button
                onClick={() => setActiveId(thread.id)}
                className={`flex w-full items-center gap-3 border-b border-border px-3 py-3 text-left transition-colors hover:bg-secondary/60 ${
                  thread.id === activeId ? "bg-secondary/70" : ""
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
                  <PeerIcon type={thread.peer_type} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{thread.peer_name}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{formatTime(thread.last_message_at)}</span>
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground">{thread.last_message || "No messages yet"}</span>
                    {thread.unread > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                        {thread.unread}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const ThreadView = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {active ? (
        <>
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            {variant === "compact" && (
              <button
                onClick={() => setActiveId(null)}
                className="flex h-7 w-7 items-center justify-center rounded-[var(--radius)] text-muted-foreground hover:text-foreground"
                aria-label="Back to conversations"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-foreground">
              <PeerIcon type={active.peer_type} />
            </span>
            <span className="truncate text-sm font-semibold text-foreground">{active.peer_name}</span>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-muted/30 p-3">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${
                    message.mine
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-card text-foreground shadow-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  <p className={`mt-1 text-right text-[10px] ${message.mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {formatTime(message.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-end gap-2 border-t border-border p-2.5">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              placeholder="Type a message…"
              className="max-h-28 min-h-[40px] flex-1 resize-none rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
            <button
              onClick={handleSend}
              disabled={sending || !draft.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              aria-label="Send message"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
          <MessageSquare className="h-9 w-9 text-muted-foreground/40" />
          <p className="text-sm">Select a conversation to start chatting.</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-full w-full min-h-0 overflow-hidden">
      {showList && ThreadList}
      {showThread && ThreadView}
    </div>
  );
}
