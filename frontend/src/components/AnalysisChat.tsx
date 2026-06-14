import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Send, Sparkles, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type Role = "user" | "assistant";
type Msg = { role: Role; content: string };

interface Detection {
  label: string;
  confidence: number;
}

interface RepairOption {
  name: string;
  cost_pkr: number;
  duration: string;
}

interface ShopInfo {
  name: string;
  area?: string;
  city?: string;
}

interface AnalysisChatContext {
  phoneModel: string;
  location: string;
  severity: "low" | "medium" | "high";
  damageScore: number;
  confidence: number;
  repairCost: number;
  recommendation: string;
  repairStatus: string;
  repairable: boolean;
  repairAdvice: string;
  detections: Detection[];
  repairOptions: RepairOption[];
  shops: ShopInfo[];
}

interface AnalysisChatProps {
  context: AnalysisChatContext;
}

function pkr(amount: number): string {
  return `PKR ${Math.round(amount || 0).toLocaleString("en-PK")}`;
}

function cleanModel(model: string): string {
  const trimmed = (model || "").replace(/_/g, " ").trim();
  return trimmed && trimmed !== "unknown smartphone" ? trimmed : "your phone";
}

/** Build the plain-text brief the assistant is grounded on, so it already
 *  "knows" everything the user can see in the result panel. */
function buildContext(ctx: AnalysisChatContext): string {
  const model = cleanModel(ctx.phoneModel);
  const lines = [
    "The user just analysed a phone screen on this app. These are the EXACT results shown to them — answer using these numbers, do not invent different ones:",
    `- Phone model: ${model}`,
    `- Location: ${ctx.location || "Pakistan"}`,
    `- Severity: ${ctx.severity} (damage score ${Math.round(ctx.damageScore)}/100)`,
    `- Detection confidence: ${Math.round(ctx.confidence * 100)}%`,
    `- Estimated repair cost: ${pkr(ctx.repairCost)}`,
    `- Verdict: ${ctx.recommendation || (ctx.repairable ? "Repairable" : "Replace screen")} (status: ${ctx.repairStatus})`,
    `- Repairable: ${ctx.repairable ? "yes" : "no"}`,
  ];
  if (ctx.repairAdvice) lines.push(`- Advice given: ${ctx.repairAdvice}`);
  if (ctx.detections.length > 0) {
    const issues = ctx.detections
      .map((det) => `${det.label.replace(/_/g, " ")} (${Math.round(det.confidence * 100)}%)`)
      .join(", ");
    lines.push(`- Detected issues: ${issues}`);
  }
  if (ctx.repairOptions.length > 0) {
    const options = ctx.repairOptions
      .map((opt) => `${opt.name} — ${pkr(opt.cost_pkr)} (${opt.duration})`)
      .join("; ");
    lines.push(`- Repair options: ${options}`);
  }
  if (ctx.shops.length > 0) {
    const shopList = ctx.shops
      .slice(0, 5)
      .map((shop) => {
        const place = [shop.area, shop.city].filter(Boolean).join(", ");
        return place ? `${shop.name} (${place})` : shop.name;
      })
      .join("; ");
    lines.push(`- Repair areas to consider: ${shopList}`);
  }
  lines.push(
    "When asked about cost, repair options, shops, or whether to repair vs replace, refer to THESE results. Keep answers concise and in PKR.",
  );
  return lines.join("\n");
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

export default function AnalysisChat({ context }: AnalysisChatProps) {
  const { token } = useAuth();
  const model = cleanModel(context.phoneModel);

  const welcome: Msg = useMemo(
    () => ({
      role: "assistant",
      content: `I've reviewed your **${model}** analysis — ${context.severity} damage, est. **${pkr(
        context.repairCost,
      )}** to repair. Ask me anything: which repair option to pick, whether it's worth fixing, how to cut the cost, or what a shop should charge.`,
    }),
    [model, context.severity, context.repairCost],
  );

  const groundingContext = useMemo(() => buildContext(context), [context]);

  const [messages, setMessages] = useState<Msg[]>([welcome]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const suggestions = [
    `Is it worth repairing my ${model}?`,
    "Which repair option should I pick?",
    "What should a fair shop charge?",
    "How do I prevent further damage?",
  ];

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    setIsLoading(true);
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, token: token || null, context: groundingContext, ephemeral: true }),
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
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    inputRef.current?.focus();
  };

  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-accent/30 bg-accent-soft/30">
      <div className="flex items-center gap-3 border-b border-accent/20 bg-accent-soft/50 px-5 py-3.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius)] bg-accent text-accent-foreground">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <h4 className="text-sm font-semibold text-foreground">Ask the repair assistant</h4>
          <p className="text-xs text-muted-foreground">
            It already knows your {model} results — ask any follow-up question.
          </p>
        </div>
      </div>

      <div className="max-h-80 space-y-4 overflow-y-auto p-5">
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
          <div className="flex flex-wrap gap-2 pt-1">
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
        )}

        <div ref={endRef} />
      </div>

      <div className="border-t border-accent/20 bg-card/50 p-3">
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
            placeholder={`Ask about your ${model}…`}
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
    </div>
  );
}
