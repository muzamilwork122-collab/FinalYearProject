import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  Smartphone, History, TrendingUp, AlertTriangle,
  CheckCircle2, ShieldX, ShieldAlert, Download,
  Calendar, Search, Filter, ChevronDown, LogOut,
  ArrowLeft, RefreshCw, FileText, DollarSign, Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { generateDamageReport } from "@/utils/generateReport";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// ── Types ──────────────────────────────────────────────────────────────────

type Severity = "low" | "medium" | "high";

interface Analysis {
  id:              string;
  created_at:      string;
  phone_model:     string;
  severity:        Severity;
  damage_score:    number;
  confidence:      number;
  repair_cost_usd: number;
}

interface Stats {
  total:       number;
  avgScore:    number;
  totalCost:   number;
  lowCount:    number;
  mediumCount: number;
  highCount:   number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const SEV_COLOR: Record<Severity, string> = {
  low:    "#22c55e",
  medium: "#eab308",
  high:   "#ef4444",
};

const SEV_BG: Record<Severity, string> = {
  low:    "bg-green-500/10 text-green-600",
  medium: "bg-yellow-500/10 text-yellow-600",
  high:   "bg-red-500/10 text-red-600",
};

const SEV_ICON: Record<Severity, React.ElementType> = {
  low:    CheckCircle2,
  medium: ShieldAlert,
  high:   ShieldX,
};

// Safely normalize severity — if API returns something unexpected, default to "low"
function normalizeSeverity(s: string): Severity {
  if (s === "low" || s === "medium" || s === "high") return s;
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

// ── Dashboard Component ────────────────────────────────────────────────────

const Dashboard = () => {
  const [analyses, setAnalyses]           = useState<Analysis[]>([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [sortBy, setSortBy]               = useState<"date" | "score" | "cost">("date");
  const [selectedRow, setSelectedRow]     = useState<string | null>(null);
  const [refreshing, setRefreshing]       = useState(false);
  const navigate                          = useNavigate();

  const user  = JSON.parse(localStorage.getItem("user") || "{}");
  const token = localStorage.getItem("token");

  // ── Auth guard ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { navigate("/login"); return; }
    fetchHistory();
  }, []);

  // ── Fetch ──────────────────────────────────────────────────────────────
  const fetchHistory = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const t    = localStorage.getItem("token") || "";
      const resp = await fetch(`${API_BASE}/api/history?token=${t}&limit=100`);
      if (!resp.ok) throw new Error("Failed to fetch");
      const data: Analysis[] = await resp.json();
      // Normalize severity for every row so SEV_ICON never gets undefined
      const safe = data.map(a => ({ ...a, severity: normalizeSeverity(a.severity) }));
      setAnalyses(safe);
    } catch {
      toast.error("Failed to load history");
    }
    setLoading(false);
    setRefreshing(false);
  };

  // ── Stats ──────────────────────────────────────────────────────────────
  const stats: Stats = {
    total:       analyses.length,
    avgScore:    analyses.length
      ? analyses.reduce((s, a) => s + (a.damage_score || 0), 0) / analyses.length
      : 0,
    totalCost:   analyses.reduce((s, a) => s + (a.repair_cost_usd || 0), 0),
    lowCount:    analyses.filter(a => a.severity === "low").length,
    mediumCount: analyses.filter(a => a.severity === "medium").length,
    highCount:   analyses.filter(a => a.severity === "high").length,
  };

  // ── Chart data ─────────────────────────────────────────────────────────
  const pieData = [
    { name: "Low",    value: stats.lowCount,    color: SEV_COLOR.low    },
    { name: "Medium", value: stats.mediumCount, color: SEV_COLOR.medium },
    { name: "High",   value: stats.highCount,   color: SEV_COLOR.high   },
  ].filter(d => d.value > 0);

  const last7 = [...analyses]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(-7)
    .map(a => ({
      date:  new Date(a.created_at).toLocaleDateString("en-PK", { month: "short", day: "numeric" }),
      score: Math.round(a.damage_score || 0),
      cost:  Math.round(a.repair_cost_usd || 0),
    }));

  const phoneData = Object.entries(
    analyses.reduce((acc: Record<string, number>, a) => {
      const k = formatPhone(a.phone_model || "Unknown");
      acc[k]  = (acc[k] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, count]) => ({ name, count }))
   .sort((a, b) => b.count - a.count)
   .slice(0, 5);

  // ── Filtered list ──────────────────────────────────────────────────────
  const filtered = analyses
    .filter(a => {
      const matchSearch = search === "" ||
        (a.phone_model || "").toLowerCase().includes(search.toLowerCase()) ||
        a.severity.includes(search.toLowerCase());
      const matchSev = severityFilter === "all" || a.severity === severityFilter;
      return matchSearch && matchSev;
    })
    .sort((a, b) => {
      if (sortBy === "score") return (b.damage_score || 0) - (a.damage_score || 0);
      if (sortBy === "cost")  return (b.repair_cost_usd || 0) - (a.repair_cost_usd || 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const downloadCSV = () => {
    const rows = [
      ["ID", "Date (PKT)", "Phone Model", "Severity", "Damage Score", "Repair Cost USD"],
      ...analyses.map(a => [
        a.id,
        formatPKT(a.created_at),
        formatPhone(a.phone_model || "Unknown"),
        a.severity,
        (a.damage_score || 0).toFixed(1),
        (a.repair_cost_usd || 0).toFixed(2),
      ])
    ];
    const csv  = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const el   = document.createElement("a");
    el.href = url;
    el.download = `ScreenAI_History_${Date.now()}.csv`;
    el.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported!");
  };

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-muted-foreground text-sm">Loading your dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">

      {/* ── Top navbar ── */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-border/40 bg-background/90 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back</span>
            </Link>
            <div className="w-px h-5 bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-primary" />
              </div>
              <span className="font-semibold text-sm">ScreenAI</span>
              <span className="text-muted-foreground text-sm">/ Dashboard</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                {(user?.name || "U")[0].toUpperCase()}
              </div>
              <span className="text-sm font-medium">{user?.name || "User"}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}
              className="gap-1.5 text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline text-sm">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="pt-20 pb-16 container mx-auto px-6 max-w-7xl">

        {/* ── Page header ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8 mt-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analysis Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">
              All your smartphone damage analyses in one place
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fetchHistory(true)} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={downloadCSV} className="gap-2">
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
            <Button size="sm" onClick={() => navigate("/")} className="gap-2">
              <Smartphone className="w-4 h-4" />
              New Analysis
            </Button>
          </div>
        </motion.div>

        {/* ── Stats cards ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Analyses",     value: stats.total,                        icon: History,       color: "text-primary",    bg: "bg-primary/10"    },
            { label: "Avg Damage Score",   value: `${stats.avgScore.toFixed(1)}/100`, icon: TrendingUp,    color: "text-yellow-500", bg: "bg-yellow-500/10" },
            { label: "Est. Total Repairs", value: `$${stats.totalCost.toFixed(0)}`,   icon: DollarSign,    color: "text-green-500",  bg: "bg-green-500/10"  },
            { label: "Critical Screens",   value: stats.highCount,                    icon: AlertTriangle, color: "text-red-500",    bg: "bg-red-500/10"    },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Charts row ── */}
        {analyses.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">

            {/* Severity pie */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Severity Breakdown
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                    paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v} analyses`]} />
                  <Legend iconSize={8} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Score trend */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Damage Score Trend
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={last7}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Top phones */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-primary" />
                Top Phone Models
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={phoneData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={70} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* ── Filters row ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap items-center gap-3 mb-5">

          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by phone model or severity..."
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="relative">
            <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2.5 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
              <option value="all">All Severities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <Filter className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>

          <div className="relative">
            <select value={sortBy} onChange={e => setSortBy(e.target.value as "date" | "score" | "cost")}
              className="appearance-none pl-3 pr-8 py-2.5 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
              <option value="date">Sort: Latest</option>
              <option value="score">Sort: Damage Score</option>
              <option value="cost">Sort: Repair Cost</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>

          <span className="text-xs text-muted-foreground ml-auto">
            {filtered.length} of {analyses.length} records
          </span>
        </motion.div>

        {/* ── Table ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-card border border-border rounded-2xl overflow-hidden">

          {/* Table header */}
          <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-border bg-secondary/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <div className="col-span-3">Date & Time (PKT)</div>
            <div className="col-span-2">Phone Model</div>
            <div className="col-span-2">Severity</div>
            <div className="col-span-2">Damage Score</div>
            <div className="col-span-2">Repair Cost</div>
            <div className="col-span-1 text-right">Report</div>
          </div>

          {/* Empty state */}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <History className="w-10 h-10 text-muted-foreground/30" />
              <p className="font-medium text-foreground">
                {analyses.length === 0 ? "No analyses yet" : "No results match your filters"}
              </p>
              <p className="text-sm text-muted-foreground">
                {analyses.length === 0
                  ? "Upload your first phone screen photo to get started"
                  : "Try adjusting your search or filter"}
              </p>
              {analyses.length === 0 && (
                <Button size="sm" onClick={() => navigate("/")} className="mt-2 gap-2">
                  <Smartphone className="w-4 h-4" /> Analyze a Screen
                </Button>
              )}
            </div>
          )}

          {/* Rows */}
          <AnimatePresence>
            {filtered.map((a, i) => {
              const sev     = normalizeSeverity(a.severity); // safe lookup
              const SevIcon = SEV_ICON[sev];
              const isOpen  = selectedRow === a.id;

              return (
                <motion.div key={a.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}>

                  {/* Main row */}
                  <div
                    onClick={() => setSelectedRow(isOpen ? null : a.id)}
                    className={`grid grid-cols-12 gap-4 px-5 py-4 border-b border-border/50 cursor-pointer transition-colors ${
                      isOpen ? "bg-primary/5" : "hover:bg-secondary/40"
                    }`}>

                    <div className="col-span-3 flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm text-foreground">{formatPKT(a.created_at)}</span>
                    </div>

                    <div className="col-span-2 flex items-center">
                      <span className="text-sm font-medium text-foreground truncate">
                        {formatPhone(a.phone_model || "Unknown")}
                      </span>
                    </div>

                    <div className="col-span-2 flex items-center">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${SEV_BG[sev]}`}>
                        <SevIcon className="w-3 h-3" />
                        {sev.charAt(0).toUpperCase() + sev.slice(1)}
                      </span>
                    </div>

                    <div className="col-span-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(a.damage_score || 0, 100)}%`,
                            background: SEV_COLOR[sev],
                          }} />
                      </div>
                      <span className="text-sm font-medium text-foreground w-12 text-right">
                        {(a.damage_score || 0).toFixed(0)}/100
                      </span>
                    </div>

                    <div className="col-span-2 flex items-center">
                      <span className="text-sm font-semibold text-foreground">
                        ${(a.repair_cost_usd || 0).toFixed(0)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">
                        ≈ PKR {((a.repair_cost_usd || 0) * 278).toFixed(0)}
                      </span>
                    </div>

                    <div className="col-span-1 flex items-center justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          generateDamageReport({
                            report_id:       a.id,
                            severity:        sev,
                            damage_score:    a.damage_score || 0,
                            confidence:      a.confidence || 0,
                            repair_cost_usd: a.repair_cost_usd || 0,
                            repairable:      sev !== "high",
                            repair_status:   sev === "high" ? "not_repairable" : sev === "medium" ? "borderline" : "repairable",
                            recommendation:  sev === "high" ? "Screen Replacement Required" : "Repairable",
                            repair_reason:   `Damage score: ${a.damage_score || 0}`,
                            repair_advice:   "Visit a certified repair shop for professional assessment.",
                            detections:      [],
                            phone_model:     a.phone_model || "Unknown",
                          }).then(() => toast.success("Report downloaded!"));
                        }}
                        className="w-8 h-8 rounded-lg bg-secondary hover:bg-primary/10 flex items-center justify-center transition-colors group"
                        title="Download PDF report"
                      >
                        <FileText className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail row */}
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-primary/3 border-b border-border/50 px-5 py-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {[
                            { label: "Report ID",  value: a.id.slice(0, 16) + "..."                              },
                            { label: "Confidence", value: `${((a.confidence || 0) * 100).toFixed(1)}%`           },
                            { label: "Cost (USD)", value: `$${(a.repair_cost_usd || 0).toFixed(2)}`              },
                            { label: "Cost (PKR)", value: `PKR ${((a.repair_cost_usd || 0) * 278).toLocaleString()}` },
                          ].map((d, di) => (
                            <div key={di} className="bg-card rounded-xl border border-border p-3">
                              <p className="text-xs text-muted-foreground mb-1">{d.label}</p>
                              <p className="text-sm font-semibold text-foreground font-mono">{d.value}</p>
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
        </motion.div>

        <p className="text-xs text-muted-foreground text-center mt-6">
          All times shown in Pakistan Standard Time (PKT, UTC+5) · 1 USD ≈ PKR 278
        </p>

      </main>
    </div>
  );
};

export default Dashboard;
