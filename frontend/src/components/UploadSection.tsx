import { useState, useCallback, forwardRef } from "react";
import {
  Upload, X, Loader2, CheckCircle2, AlertTriangle,
  Brain, Sparkles, Download, RotateCcw, Shield, ShieldAlert, ShieldX
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import axios from "axios";
import { generateDamageReport } from "@/utils/generateReport";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// ── Types ──────────────────────────────────────────────────────────────────

interface Detection {
  label: string;
  confidence: number;
  bbox: [number, number, number, number];
}

interface AnalysisResult {
  severity:        "low" | "medium" | "high";
  damage_score:    number;
  confidence:      number;
  repair_cost_usd: number;
  detections:      Detection[];
  image_url:       string | null;
  report_id:       string | null;
  // Repairability
  repairable:      boolean;
  repair_status:   "repairable" | "borderline" | "not_repairable";
  recommendation:  string;
  repair_reason:   string;
  repair_advice:   string;
}

// ── Phone models ───────────────────────────────────────────────────────────

const PHONE_MODELS = [
  { value: "other",             label: "Select Phone Model (Optional)" },
  { value: "iphone_15_pro_max", label: "iPhone 15 Pro Max" },
  { value: "iphone_15_pro",     label: "iPhone 15 Pro" },
  { value: "iphone_15",         label: "iPhone 15" },
  { value: "iphone_14",         label: "iPhone 14" },
  { value: "iphone_13",         label: "iPhone 13" },
  { value: "iphone_12",         label: "iPhone 12" },
  { value: "iphone_11",         label: "iPhone 11" },
  { value: "iphone_x",          label: "iPhone X" },
  { value: "samsung_s24_ultra", label: "Samsung Galaxy S24 Ultra" },
  { value: "samsung_s24",       label: "Samsung Galaxy S24" },
  { value: "samsung_s23",       label: "Samsung Galaxy S23" },
  { value: "samsung_a55",       label: "Samsung Galaxy A55" },
  { value: "samsung_a35",       label: "Samsung Galaxy A35" },
  { value: "xiaomi_14_pro",     label: "Xiaomi 14 Pro" },
  { value: "xiaomi_13",         label: "Xiaomi 13" },
  { value: "oppo_find_x7",      label: "OPPO Find X7" },
  { value: "oppo_reno11",       label: "OPPO Reno 11" },
  { value: "vivo_x100",         label: "Vivo X100" },
  { value: "realme_12_pro",     label: "Realme 12 Pro" },
  { value: "nokia_g42",         label: "Nokia G42" },
];

// ── Severity display helpers ───────────────────────────────────────────────

const SEVERITY_DISPLAY = {
  low:    { label: "Low Damage",      colorText: "text-green-500",  colorBg: "bg-green-500/10 border-green-500/30"  },
  medium: { label: "Moderate Damage", colorText: "text-yellow-500", colorBg: "bg-yellow-500/10 border-yellow-500/30" },
  high:   { label: "Critical Damage", colorText: "text-red-500",    colorBg: "bg-red-500/10 border-red-500/30"      },
};

// ── Repairability display helpers ──────────────────────────────────────────

const REPAIR_STATUS_DISPLAY = {
  repairable: {
    icon:       ShieldAlert,
    iconColor:  "text-green-500",
    bgColor:    "bg-green-500/8 border-green-500/25",
    textColor:  "text-green-600",
    badgeBg:    "bg-green-100",
    badgeText:  "text-green-700",
  },
  borderline: {
    icon:       ShieldAlert,
    iconColor:  "text-yellow-500",
    bgColor:    "bg-yellow-500/8 border-yellow-500/25",
    textColor:  "text-yellow-600",
    badgeBg:    "bg-yellow-100",
    badgeText:  "text-yellow-700",
  },
  not_repairable: {
    icon:       ShieldX,
    iconColor:  "text-red-500",
    bgColor:    "bg-red-500/8 border-red-500/25",
    textColor:  "text-red-600",
    badgeBg:    "bg-red-100",
    badgeText:  "text-red-700",
  },
};

// ── Component ──────────────────────────────────────────────────────────────

const UploadSection = forwardRef<HTMLElement>((_, ref) => {
  const [uploadedFile, setUploadedFile]   = useState<File | null>(null);
  const [preview, setPreview]             = useState<string | null>(null);
  const [phoneModel, setPhoneModel]       = useState("other");
  const [isAnalyzing, setIsAnalyzing]     = useState(false);
  const [progress, setProgress]           = useState(0);
  const [progressText, setProgressText]   = useState("Analyzing...");
  const [result, setResult]               = useState<AnalysisResult | null>(null);
  const [showAnnotated, setShowAnnotated] = useState(false);

  // ── File handling ─────────────────────────────────────────────────────────

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      setUploadedFile(file);
      setPreview(URL.createObjectURL(file));
      setResult(null);
      setShowAnnotated(false);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setPreview(URL.createObjectURL(file));
      setResult(null);
      setShowAnnotated(false);
    }
  };

  // ── Analysis ──────────────────────────────────────────────────────────────

  const startAnalysis = async () => {
    if (!uploadedFile) return;
    setIsAnalyzing(true);
    setProgress(0);
    setProgressText("Validating image...");

    const steps = [
      { pct: 15, text: "Validating image..." },
      { pct: 35, text: "Preprocessing..." },
      { pct: 55, text: "Running AI segmentation..." },
      { pct: 75, text: "Detecting damage zones..." },
      { pct: 90, text: "Calculating severity score..." },
    ];

    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex < steps.length) {
        setProgress(steps[stepIndex].pct);
        setProgressText(steps[stepIndex].text);
        stepIndex++;
      }
    }, 600);

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);
      formData.append("phone_model", phoneModel);
      formData.append("token", localStorage.getItem("token") || "");

      const response = await axios.post<AnalysisResult>(
        `${API_BASE}/api/predict`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      clearInterval(interval);
      setProgress(100);
      setProgressText("Complete!");

      setTimeout(() => {
        setIsAnalyzing(false);
        setResult(response.data);
        if (response.data.image_url) setShowAnnotated(true);

        // Show toast based on repairability
        if (!response.data.repairable) {
          toast.error("⛔ Screen Not Repairable", {
            description: "This screen requires full replacement.",
            duration: 5000,
          });
        } else if (response.data.repair_status === "borderline") {
          toast.warning("⚠️ Expensive Repair", {
            description: "Consider getting multiple quotes before repairing.",
            duration: 4000,
          });
        } else {
          toast.success("✅ Analysis Complete", {
            description: `Damage score: ${response.data.damage_score.toFixed(0)}/100`,
            duration: 3000,
          });
        }
      }, 400);

    } catch (error) {
      clearInterval(interval);
      setIsAnalyzing(false);
      setProgress(0);

      if (axios.isAxiosError(error) && error.response?.status === 422) {
        // Image validation failed
        const detail = error.response.data?.detail;
        toast.error("Invalid Image", {
          description: detail || "Please upload a clear photo of a smartphone screen.",
          duration: 6000,
        });
      } else {
        const msg = axios.isAxiosError(error)
          ? error.response?.data?.detail ?? error.message
          : "Analysis failed. Please try again.";
        toast.error(msg);
      }
    }
  };

  const resetUpload = () => {
    setUploadedFile(null);
    setPreview(null);
    setResult(null);
    setProgress(0);
    setShowAnnotated(false);
  };

  const downloadReport = async () => {
  if (!result) return;
  try {
    await generateDamageReport({
      report_id:       result.report_id,
      severity:        result.severity,
      damage_score:    result.damage_score,
      confidence:      result.confidence,
      repair_cost_usd: result.repair_cost_usd,
      repairable:      result.repairable,
      repair_status:   result.repair_status,
      recommendation:  result.recommendation,
      repair_advice:   result.repair_advice,
      detections:      result.detections,
      phone_model:     phoneModel,
      image_url:       result.image_url,
    });
    toast.success("PDF report downloaded!");
  } catch (e) {
    toast.error("Failed to generate report. Please try again.");
    console.error(e);
  }
};
  // ── Render helpers ────────────────────────────────────────────────────────

  const display     = result ? SEVERITY_DISPLAY[result.severity] : null;
  const repairDisp  = result?.repair_status ? REPAIR_STATUS_DISPLAY[result.repair_status] : null;
  const displayImg  = showAnnotated && result?.image_url ? result.image_url : preview;

  return (
    <section id="analyze" ref={ref} className="py-24 relative">
      <div className="container mx-auto px-6 max-w-4xl">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-4">
            <Brain className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Powered by AI</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="gradient-text">Analyze Your Screen</span>
          </h2>
          <p className="text-muted-foreground">
            Upload a clear photo of your smartphone screen our AI analyzes damage in seconds
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card p-8 rounded-3xl"
        >
          <AnimatePresence mode="wait">

            {/* ── Upload state ── */}
            {!preview && (
              <motion.div
                key="upload"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-border hover:border-primary/50 rounded-2xl p-12 text-center transition-colors cursor-pointer group"
              >
                <input
                  type="file" accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden" id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 transition-colors">
                    <Upload className="w-10 h-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-foreground">Drop your image here</h3>
                  <p className="text-muted-foreground mb-4">or click to browse from your device</p>
                  <p className="text-xs text-muted-foreground">Supports: JPG, PNG, WebP · Max 10MB · Must be a phone screen photo</p>
                </label>
              </motion.div>
            )}

            {/* ── Preview + analyze state ── */}
            {preview && !result && (
              <motion.div
                key="preview"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Image preview */}
                <div className="relative rounded-2xl overflow-hidden bg-secondary/50">
                  <img src={preview} alt="Uploaded screen" className="w-full max-h-80 object-contain" />

                  {/* Analyzing overlay */}
                  {isAnalyzing && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
                      <div className="text-center">
                        <div className="relative">
                          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
                          <Sparkles className="w-5 h-5 text-primary absolute top-0 right-1/2 translate-x-8 animate-pulse" />
                        </div>
                        <p className="text-foreground font-medium">{progressText}</p>
                        <p className="text-sm text-muted-foreground mt-1">{Math.round(progress)}%</p>
                      </div>
                    </div>
                  )}

                  {!isAnalyzing && (
                    <button
                      onClick={resetUpload}
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Progress bar */}
                {isAnalyzing && (
                  <div className="space-y-2">
                    <Progress value={progress} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{progressText}</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                  </div>
                )}

                {/* Phone model selector */}
                {!isAnalyzing && (
                  <div>
                    <label className="block text-sm font-medium mb-2 text-muted-foreground">
                      Phone Model <span className="text-xs">(improves cost accuracy)</span>
                    </label>
                    <select
                      value={phoneModel}
                      onChange={(e) => setPhoneModel(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      {PHONE_MODELS.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Analyze button */}
                {!isAnalyzing && (
                  <Button
                    onClick={startAnalysis}
                    size="lg"
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6 rounded-xl"
                  >
                    <Brain className="w-5 h-5 mr-2" />
                    Start AI Damage Analysis
                  </Button>
                )}
              </motion.div>
            )}

            {/* ── Results state ── */}
            {result && display && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="space-y-5"
              >
                {/* Before / After image toggle */}
                <div className="relative rounded-2xl overflow-hidden bg-secondary/50">
                  <img
                    src={displayImg!}
                    alt={showAnnotated ? "Damage overlay" : "Original"}
                    className="w-full max-h-80 object-contain"
                  />
                  {result.image_url && (
                    <button
                      onClick={() => setShowAnnotated((v) => !v)}
                      className="absolute top-3 right-3 bg-background/80 hover:bg-background rounded-full px-3 py-1.5 text-xs border border-border font-medium"
                    >
                      {showAnnotated ? "Original" : "Show Damage"}
                    </button>
                  )}
                </div>

                {/* Severity badge */}
                <div className={`rounded-2xl border p-5 ${display.colorBg}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`w-5 h-5 ${display.colorText}`} />
                      <span className={`font-semibold ${display.colorText}`}>{display.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {(result.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>

                  {/* Damage score bar — real value from backend */}
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Damage Score</span>
                    <span className="font-medium">{result.damage_score.toFixed(0)} / 100</span>
                  </div>
                  <Progress value={result.damage_score} className="h-2 mb-4" />

                  {/* Repair cost — real value from backend cost estimator */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Estimated Repair Cost</span>
                    <span className="font-bold text-lg">${result.repair_cost_usd.toFixed(0)}</span>
                  </div>
                </div>

                {/* ── Repairability card ── */}
                {repairDisp && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className={`rounded-2xl border p-5 ${repairDisp.bgColor}`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <repairDisp.icon className={`w-5 h-5 ${repairDisp.iconColor} flex-shrink-0`} />
                      <span className={`font-semibold ${repairDisp.textColor}`}>
                        {result.recommendation}
                      </span>
                      <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${repairDisp.badgeBg} ${repairDisp.badgeText}`}>
                        {result.repair_status === "not_repairable" ? "Replace Screen" :
                         result.repair_status === "borderline"     ? "Get Quotes First" : "Repairable"}
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {result.repair_advice}
                    </p>

                    {/* Not repairable warning banner */}
                    {!result.repairable && (
                      <div className="mt-3 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
                        <ShieldX className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <span className="text-xs font-medium text-red-600">
                          This screen cannot be repaired — full replacement required
                        </span>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Detections list */}
                {result.detections.length > 0 && (
                  <div className="bg-secondary/30 rounded-xl p-5 border border-border/30">
                    <h4 className="font-semibold mb-4 text-foreground flex items-center gap-2">
                      <Brain className="w-4 h-4 text-primary" />
                      Detected Issues ({result.detections.length})
                    </h4>
                    <div className="space-y-3">
                      {result.detections.map((det, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <AlertTriangle className="w-4 h-4 text-yellow-500" />
                            <span className="text-sm text-foreground capitalize">
                              {det.label.replace("_", " ")}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Progress value={det.confidence * 100} className="w-20 h-1.5" />
                            <span className="text-xs text-muted-foreground w-10">
                              {(det.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Model confidence */}
                <div className="bg-secondary/30 rounded-xl p-5 border border-border/30">
                  <h4 className="font-semibold mb-3 text-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Model Confidence
                  </h4>
                  <div className="flex items-center gap-4">
                    <Progress value={result.confidence * 100} className="flex-1 h-2" />
                    <span className="text-sm font-semibold text-primary w-14 text-right">
                      {(result.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3">
                  <Button onClick={resetUpload} variant="outline" className="flex-1">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Analyze Another
                  </Button>
                  <Button onClick={downloadReport} className="flex-1">
                    <Download className="w-4 h-4 mr-2" />
                    Download Report
                  </Button>
                </div>

              </motion.div>
            )}

          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
});

UploadSection.displayName = "UploadSection";
export default UploadSection;
