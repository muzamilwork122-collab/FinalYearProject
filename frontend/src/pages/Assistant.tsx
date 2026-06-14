import { useState, useRef, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Send, Loader2, Sparkles, Trash2, User, ScanLine,
  Smartphone, Lightbulb, RefreshCw,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type Role = "user" | "assistant";
type Msg = { role: Role; content: string };

interface AnalysisSummary {
  id: string;
  created_at: string;
  phone_model: string;
  severity: "low" | "medium" | "high";
  damage_score: number;
  repair_cost_usd: number;
}

const WELCOME: Msg = {
  role: "assistant",
  content:
    "Hi! I'm your repair assistant. I can see your past screen analyses, so ask me anything — whether a repair is worth it, how to cut costs in PKR, or how to protect your screen.",
};

function formatPhone(model: string) {
  if (!model || model === "other" || model === "unknown smartphone") return "Unknown phone";
  return model.replace(/_/g, " ").trim();
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString("en-PK", { day: "numeric", month: "short" });
  } catch {
    return value;
  }
}

// Minimal, safe formatter: **bold**, "- " bullets, and line breaks. No raw HTML.
function FormattedMessage({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((line, lineIndex) => {
        const trimmed = line.trim();
        const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("• ");
        const body = isBullet ? trimmed.slice(2) : line;
        const parts = body.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
        const rendered = parts.map((part, partIndex) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={partIndex} className="font-semibold">{part.slice(2, -2)}</strong>
          ) : (
            <span key={partIndex}>{part}</span>
          ),
        );

        if (!trimmed) return <div key={lineIndex} className="h-1.5" />;
        if (isBullet) {
          return (
            <div key={lineIndex} className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-accent" />
              <span>{rendered}</span>
            </div>
          );
        }
        return <p key={lineIndex}>{rendered}</p>;
      })}
    </div>
  );
}

const Assistant = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/history?token=${token}&limit=100`)
      .then((response) => response.json())
      .then((data: AnalysisSummary[]) => Array.isArray(data) && setAnalyses(data))
      .catch(() => {});

    fetch(`${API_BASE}/api/chat/history?token=${token}`)
      .then((response) => response.json())
      .then((data) => {
        if (data?.messages?.length > 0) setMessages([WELCOME, ...data.messages]);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const context = useMemo(() => {
    if (analyses.length === 0) return "";
    const recent = [...analyses]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
    const avg = analyses.reduce((sum, a) => sum + (a.damage_score || 0), 0) / analyses.length;
    const lines = recent.map(
      (a) =>
        `- ${formatPhone(a.phone_model)}: ${a.severity} severity, score ${Math.round(
          a.damage_score || 0,
        )}/100, est. PKR ${Math.round(a.repair_cost_usd || 0).toLocaleString("en-PK")} (${formatDate(a.created_at)})`,
    );
    return `Total analyses: ${analyses.length}. Average damage score: ${avg.toFixed(
      0,
    )}/100.\nMost recent analyses:\n${lines.join("\n")}`;
  }, [analyses]);

  const latest = useMemo(
    () =>
      [...analyses].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )[0] ?? null,
    [analyses],
  );

  const suggestions = useMemo(() => {
    const base = [
      "How can I prevent further screen damage?",
      "What affects screen repair cost in Pakistan?",
      "Should I use a screen protector or tempered glass?",
    ];
    if (latest) {
      return [
        `Explain my ${formatPhone(latest.phone_model)} analysis in simple terms`,
        `Is it worth repairing my ${formatPhone(latest.phone_model)}?`,
        ...base,
      ];
    }
    return ["What does a damage score mean?", "Is a cracked screen worth repairing?", ...base];
  }, [latest]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    const userMsg: Msg = { role: "user", content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, token: token || null, context }),
      });
      if (!response.ok) throw new Error(`Server error ${response.status}`);
      const data = await response.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data?.content ?? "No response." }]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown error";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Something went wrong: ${detail}. Please try again.` },
      ]);
    }
    setIsLoading(false);
    inputRef.current?.focus();
  };

  const clearChat = async () => {
    if (token) {
      await fetch(`${API_BASE}/api/chat/history?token=${token}`, { method: "DELETE" }).catch(() => {});
    }
    setMessages([WELCOME]);
  };

  const initials = (user?.name?.toString().trim()?.[0] || "U").toUpperCase();

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 shadow-sm backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 rounded-[var(--radius)] px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <span className="h-5 w-px bg-border" />
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-[var(--radius)] bg-accent text-accent-foreground">
                <ScanLine className="h-4 w-4" />
              </span>
              <span className="font-display text-sm font-semibold">ScreenScan</span>
              <span className="text-sm text-muted-foreground">/ Assistant</span>
            </div>
          </div>
          <button
            onClick={clearChat}
            className="flex items-center gap-2 rounded-[var(--radius)] border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Clear chat</span>
          </button>
        </div>
      </header>

      <main className="container mx-auto flex w-full max-w-6xl flex-1 gap-6 overflow-hidden px-6 py-6">
        <section className="surface flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border bg-secondary/40 px-5 py-3.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius)] bg-accent text-accent-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h1 className="text-sm font-semibold text-foreground">Repair assistant</h1>
              <p className="text-xs text-muted-foreground">
                {analyses.length > 0
                  ? `Aware of your ${analyses.length} analysis${analyses.length === 1 ? "" : "es"}`
                  : "Ask about screen repairs in PKR"}
              </p>
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft">
                    <Sparkles className="h-4 w-4 text-accent-strong" />
                  </span>
                )}
                <div
                  className={`max-w-[80%] rounded-[var(--radius)] px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card text-foreground"
                  }`}
                >
                  {msg.role === "assistant" ? <FormattedMessage text={msg.content} /> : msg.content}
                </div>
                {msg.role === "user" && (
                  <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-secondary">
                    <User className="h-4 w-4 text-foreground" />
                  </span>
                )}
              </motion.div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft">
                  <Sparkles className="h-4 w-4 animate-pulse text-accent-strong" />
                </span>
                <div className="rounded-[var(--radius)] border border-border bg-card px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}

            {messages.length <= 1 && !isLoading && (
              <div className="pt-2">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Lightbulb className="h-3.5 w-3.5" />
                  Try asking
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => send(suggestion)}
                      className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-strong"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-border p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex gap-2"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about repairs, costs, or your screens…"
                disabled={isLoading}
                className="flex-1 rounded-[var(--radius)] border border-border bg-card px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="btn-primary flex-shrink-0 !px-4"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </section>

        <aside className="hidden w-72 flex-shrink-0 flex-col gap-4 overflow-y-auto lg:flex">
          <div className="surface p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Smartphone className="h-4 w-4 text-accent" />
              Your recent screens
            </h2>
            {analyses.length === 0 ? (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">
                  No analyses yet. Run one to get personalised advice.
                </p>
                <button
                  onClick={() => navigate("/dashboard")}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-[var(--radius)] border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  <RefreshCw className="h-4 w-4" />
                  Go analyse a screen
                </button>
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {[...analyses]
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .slice(0, 5)
                  .map((a) => (
                    <li key={a.id}>
                      <button
                        onClick={() => send(`Give me advice about my ${formatPhone(a.phone_model)} (score ${Math.round(a.damage_score || 0)}/100, ${a.severity} severity).`)}
                        className="surface-interactive w-full p-3 text-left"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-foreground">
                            {formatPhone(a.phone_model)}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {formatDate(a.created_at)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">{Math.round(a.damage_score || 0)}/100</span>
                          <span>·</span>
                          <span className="capitalize">{a.severity}</span>
                          <span>·</span>
                          <span>PKR {Math.round(a.repair_cost_usd || 0).toLocaleString("en-PK")}</span>
                        </div>
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </div>

          <div className="surface p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Lightbulb className="h-4 w-4 text-accent" />
              Quick questions
            </h2>
            <div className="mt-4 flex flex-col gap-2">
              {suggestions.slice(0, 4).map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => send(suggestion)}
                  className="rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-left text-xs font-medium text-foreground transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-strong"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default Assistant;
