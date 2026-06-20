import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Smartphone, History, TrendingUp, AlertTriangle, CheckCircle2, ShieldX,
  ShieldAlert, Download, Calendar, Search, Filter, ChevronDown, LogOut,
  ArrowLeft, RefreshCw, FileText, Banknote, Activity, ScanLine, X, Sparkles,
  Trash2, Settings, MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { generateDamageReport } from "@/utils/generateReport";
import { useAuth } from "@/context/AuthContext";
import { usePreferences } from "@/context/PreferencesContext";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationBell from "@/components/chat/NotificationBell";
import UploadSection from "@/components/UploadSection";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type Severity = "low" | "medium" | "high";

interface Analysis {
  id: string;
  created_at: string;
  phone_model: string;
  severity: Severity;
  damage_score: number;
  confidence: number;
  repair_cost_usd: number;
}

// Concrete colors for the chart canvas (SVG attributes can't read CSS vars).
const ACCENT = "#2563eb";
const GRID = "#e5e9f0";

// Green / amber / red — reserved strictly for damage severity.
const SEV_COLOR: Record<Severity, string> = {
  low: "#28a06f",
  medium: "#e8910f",
  high: "#e23b3b",
};

const SEV_BG: Record<Severity, string> = {
  low: "bg-[hsl(152_56%_36%/0.12)] text-[hsl(152_56%_28%)]",
  medium: "bg-[hsl(33_92%_47%/0.14)] text-[hsl(30_85%_34%)]",
  high: "bg-[hsl(0_72%_51%/0.12)] text-[hsl(0_72%_45%)]",
};

const SEV_ICON: Record<Severity, React.ElementType> = {
  low: CheckCircle2,
  medium: ShieldAlert,
  high: ShieldX,
};

function normalizeSeverity(value: string): Severity {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "low";
}

function formatPKT(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString("en-PK", {
      timeZone: "Asia/Karachi", day: "2-digit", month: "short",
      year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
    });
  } catch {
    return dateStr;
  }
}

function formatPhone(model: string) {
  if (!model || model === "other" || model === "unknown smartphone") return "Unknown";
  return model.replace(/_/g, " ").trim();
}

const Dashboard = () => {
  const { user, token, logout } = useAuth();
  const { theme, formatMoney } = usePreferences();
  const navigate = useNavigate();

  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "score" | "cost">("date");
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showAnalyzer, setShowAnalyzer] = useState(false);
  const analyzerRef = useRef<HTMLElement>(null);

  const startNewAnalysis = () => {
    setShowAnalyzer(true);
    requestAnimationFrame(() => {
      analyzerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchHistory = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/history?token=${token ?? ""}&limit=100`);
      if (!resp.ok) throw new Error("Failed to fetch");
      const data: Analysis[] = await resp.json();
      setAnalyses(data.map((a) => ({ ...a, severity: normalizeSeverity(a.severity) })));
    } catch {
      toast.error("Failed to load history");
    }
    setLoading(false);
    setRefreshing(false);
  };

  const stats = {
    total: analyses.length,
    avgScore: analyses.length
      ? analyses.reduce((sum, a) => sum + (a.damage_score || 0), 0) / analyses.length
      : 0,
    totalCost: analyses.reduce((sum, a) => sum + (a.repair_cost_usd || 0), 0),
    lowCount: analyses.filter((a) => a.severity === "low").length,
    mediumCount: analyses.filter((a) => a.severity === "medium").length,
    highCount: analyses.filter((a) => a.severity === "high").length,
  };

  const pieData = [
    { name: "Low", value: stats.lowCount, color: SEV_COLOR.low },
    { name: "Medium", value: stats.mediumCount, color: SEV_COLOR.medium },
    { name: "High", value: stats.highCount, color: SEV_COLOR.high },
  ].filter((d) => d.value > 0);

  const last7 = [...analyses]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(-7)
    .map((a) => ({
      date: new Date(a.created_at).toLocaleDateString("en-PK", { month: "short", day: "numeric" }),
      score: Math.round(a.damage_score || 0),
    }));

  const phoneData = Object.entries(
    analyses.reduce((acc: Record<string, number>, a) => {
      const key = formatPhone(a.phone_model || "Unknown");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const filtered = analyses
    .filter((a) => {
      const matchSearch =
        search === "" ||
        (a.phone_model || "").toLowerCase().includes(search.toLowerCase()) ||
        a.severity.includes(search.toLowerCase());
      const matchSev = severityFilter === "all" || a.severity === severityFilter;
      return matchSearch && matchSev;
    })
    .sort((a, b) => {
      if (sortBy === "score") return (b.damage_score || 0) - (a.damage_score || 0);
      if (sortBy === "cost") return (b.repair_cost_usd || 0) - (a.repair_cost_usd || 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const gridColor = theme === "dark" ? "#2a3550" : GRID;

  const deleteAnalysis = (id: string) => {
    toast("Delete this analysis?", {
      description: "This permanently removes it from your history.",
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            const resp = await fetch(`${API_BASE}/api/history/${id}?token=${token ?? ""}`, {
              method: "DELETE",
            });
            if (!resp.ok) throw new Error("Delete failed");
            setAnalyses((prev) => prev.filter((a) => a.id !== id));
            if (selectedRow === id) setSelectedRow(null);
            toast.success("Analysis deleted");
          } catch {
            toast.error("Failed to delete analysis");
          }
        },
      },
    });
  };

  const downloadCSV = () => {
    const rows = [
      ["ID", "Date (PKT)", "Phone Model", "Severity", "Damage Score", "Repair Cost (PKR)"],
      ...analyses.map((a) => [
        a.id,
        formatPKT(a.created_at),
        formatPhone(a.phone_model || "Unknown"),
        a.severity,
        (a.damage_score || 0).toFixed(1),
        Math.round(a.repair_cost_usd || 0).toString(),
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url;
    el.download = `ScreenScan_History_${Date.now()}.csv`;
    el.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const initials = (user?.name?.toString().trim()?.[0] || "U").toUpperCase();
  const btnGhost =
    "flex items-center gap-1.5 rounded-[var(--radius)] px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground";
  const btnOutline =
    "flex items-center gap-2 rounded-[var(--radius)] border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary";
  const btnSolid =
    "flex items-center gap-2 rounded-[var(--radius)] bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-foreground" />
          <p className="text-sm text-muted-foreground">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Link to="/" className={btnGhost}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <span className="h-5 w-px bg-border" />
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-[var(--radius)] bg-accent text-accent-foreground">
                <ScanLine className="h-4 w-4" />
              </span>
              <span className="font-display text-sm font-semibold">ScreenScan</span>
              <span className="text-sm text-muted-foreground">/ Dashboard</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell token={token} role="user" />
            <Link to="/messages" className={btnOutline}>
              <MessageSquare className="h-4 w-4 text-accent" />
              <span className="hidden sm:inline">Messages</span>
            </Link>
            <Link to="/assistant" className={btnOutline}>
              <Sparkles className="h-4 w-4 text-accent" />
              <span className="hidden sm:inline">Assistant</span>
            </Link>
            <Link to="/settings" className={btnOutline} aria-label="Account settings">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </Link>
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

      <main className="container mx-auto max-w-7xl px-6 pb-16 pt-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Analysis dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Every screen you've analysed, in one place.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => fetchHistory(true)} className={btnOutline}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button onClick={downloadCSV} className={btnOutline}>
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button onClick={startNewAnalysis} className={btnSolid}>
              <Smartphone className="h-4 w-4" />
              New analysis
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showAnalyzer && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8 overflow-hidden"
            >
              <div className="surface shadow-soft overflow-hidden">
                <div className="flex items-center justify-between border-b border-border px-5 py-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Smartphone className="h-4 w-4 text-accent" />
                    New analysis
                  </span>
                  <button
                    onClick={() => setShowAnalyzer(false)}
                    className="rounded-[var(--radius)] p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label="Close analyzer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <UploadSection ref={analyzerRef} onAnalysisComplete={() => fetchHistory(true)} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Total analyses", value: stats.total, icon: History },
            { label: "Avg damage score", value: `${stats.avgScore.toFixed(1)}/100`, icon: TrendingUp },
            { label: "Est. total repairs", value: formatMoney(stats.totalCost), icon: Banknote },
            { label: "Critical screens", value: stats.highCount, icon: AlertTriangle },
          ].map((card) => (
            <div key={card.label} className="surface p-5">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius)] border border-border bg-secondary">
                  <card.icon className="h-4 w-4 text-foreground" />
                </span>
                <span className="text-xs text-muted-foreground">{card.label}</span>
              </div>
              <p className="font-mono text-2xl font-bold text-foreground">{card.value}</p>
            </div>
          ))}
        </div>

        {analyses.length > 0 && (
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="surface p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Activity className="h-4 w-4 text-accent" />
                Severity breakdown
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v} analyses`]} />
                  <Legend iconSize={8} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="surface p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                <TrendingUp className="h-4 w-4 text-accent" />
                Damage score trend
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={last7}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke={ACCENT} strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="surface p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Smartphone className="h-4 w-4 text-accent" />
                Top phone models
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={phoneData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={70} />
                  <Tooltip />
                  <Bar dataKey="count" fill={ACCENT} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by phone model or severity…"
              className="w-full rounded-[var(--radius)] border border-border bg-card py-2.5 pl-9 pr-4 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>

          <div className="relative">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="cursor-pointer appearance-none rounded-[var(--radius)] border border-border bg-card py-2.5 pl-3 pr-8 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
            >
              <option value="all">All severities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <Filter className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>

          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "date" | "score" | "cost")}
              className="cursor-pointer appearance-none rounded-[var(--radius)] border border-border bg-card py-2.5 pl-3 pr-8 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
            >
              <option value="date">Sort: Latest</option>
              <option value="score">Sort: Damage score</option>
              <option value="cost">Sort: Repair cost</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>

          <span className="ml-auto text-xs text-muted-foreground">
            {filtered.length} of {analyses.length} records
          </span>
        </div>

        <div className="surface overflow-hidden">
          <div className="grid grid-cols-12 gap-4 border-b border-border bg-secondary/50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <div className="col-span-3">Date &amp; time (PKT)</div>
            <div className="col-span-2">Phone model</div>
            <div className="col-span-2">Severity</div>
            <div className="col-span-2">Damage score</div>
            <div className="col-span-2">Repair cost</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <History className="h-10 w-10 text-muted-foreground/30" />
              <p className="font-medium text-foreground">
                {analyses.length === 0 ? "No analyses yet" : "No results match your filters"}
              </p>
              <p className="text-sm text-muted-foreground">
                {analyses.length === 0
                  ? "Upload your first phone-screen photo to get started."
                  : "Try adjusting your search or filter."}
              </p>
              {analyses.length === 0 && (
                <button onClick={startNewAnalysis} className={`${btnSolid} mt-2`}>
                  <Smartphone className="h-4 w-4" /> Analyze a screen
                </button>
              )}
            </div>
          )}

          <AnimatePresence>
            {filtered.map((a, i) => {
              const sev = normalizeSeverity(a.severity);
              const SevIcon = SEV_ICON[sev];
              const isOpen = selectedRow === a.id;

              return (
                <motion.div key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                  <div
                    onClick={() => setSelectedRow(isOpen ? null : a.id)}
                    className={`grid cursor-pointer grid-cols-12 gap-4 border-b border-border/60 px-5 py-4 transition-colors ${
                      isOpen ? "bg-secondary/60" : "hover:bg-secondary/40"
                    }`}
                  >
                    <div className="col-span-3 flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                      <span className="text-sm text-foreground">{formatPKT(a.created_at)}</span>
                    </div>

                    <div className="col-span-2 flex items-center">
                      <span className="truncate text-sm font-medium text-foreground">
                        {formatPhone(a.phone_model || "Unknown")}
                      </span>
                    </div>

                    <div className="col-span-2 flex items-center">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${SEV_BG[sev]}`}>
                        <SevIcon className="h-3 w-3" />
                        {sev.charAt(0).toUpperCase() + sev.slice(1)}
                      </span>
                    </div>

                    <div className="col-span-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(a.damage_score || 0, 100)}%`, background: SEV_COLOR[sev] }}
                        />
                      </div>
                      <span className="w-12 text-right font-mono text-sm font-medium text-foreground">
                        {(a.damage_score || 0).toFixed(0)}
                      </span>
                    </div>

                    <div className="col-span-2 flex items-center">
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {formatMoney(a.repair_cost_usd || 0)}
                      </span>
                    </div>

                    <div className="col-span-1 flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          generateDamageReport({
                            report_id: a.id,
                            severity: sev,
                            damage_score: a.damage_score || 0,
                            confidence: a.confidence || 0,
                            repair_cost_usd: a.repair_cost_usd || 0,
                            repairable: sev !== "high",
                            repair_status: sev === "high" ? "not_repairable" : sev === "medium" ? "borderline" : "repairable",
                            recommendation: sev === "high" ? "Screen replacement required" : "Repairable",
                            repair_reason: `Damage score: ${a.damage_score || 0}`,
                            repair_advice: "Visit a certified repair shop for a professional assessment.",
                            detections: [],
                            phone_model: a.phone_model || "Unknown",
                          }).then(() => toast.success("Report downloaded"));
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-[var(--radius)] bg-secondary text-muted-foreground transition-colors hover:text-foreground"
                        title="Download PDF report"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteAnalysis(a.id);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-[var(--radius)] bg-secondary text-muted-foreground transition-colors hover:bg-[hsl(var(--destructive)/0.12)] hover:text-[hsl(var(--destructive))]"
                        title="Delete analysis"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-b border-border/60 bg-secondary/30 px-5 py-4"
                      >
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                          {[
                            { label: "Report ID", value: a.id.slice(0, 16) + "…" },
                            { label: "Confidence", value: `${((a.confidence || 0) * 100).toFixed(1)}%` },
                            { label: "Repair cost", value: formatMoney(a.repair_cost_usd || 0) },
                            { label: "Damage score", value: `${(a.damage_score || 0).toFixed(1)} / 100` },
                          ].map((detail) => (
                            <div key={detail.label} className="rounded-[var(--radius)] border border-border bg-card p-3">
                              <p className="mb-1 text-xs text-muted-foreground">{detail.label}</p>
                              <p className="font-mono text-sm font-semibold text-foreground">{detail.value}</p>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
