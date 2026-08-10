import { forwardRef, useCallback, useState } from "react";
import {
  AlertTriangle, ArrowLeftRight, Download, ExternalLink, Loader2, MapPin, RotateCcw,
  ScanLine, Share2, ShieldCheck, ShieldX, Upload, X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import axios from "axios";
import { generateDamageReport } from "@/utils/generateReport";
import { useAuth } from "@/context/AuthContext";
import { usePreferences } from "@/context/PreferencesContext";
import AnalysisChat from "@/components/AnalysisChat";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";


interface Detection {
  label: string;
  confidence: number;
  bbox: [number, number, number, number];
}

interface NearbyShop {
  name: string;
  area: string;
  city: string;
  phone: string;
  specialty: string;
}

interface AnalysisResult {
  severity: "low" | "medium" | "high";
  damage_score: number;
  confidence: number;
  repair_cost_usd: number;
  detections: Detection[];
  image_url: string | null;
  report_id: string | null;
  repairable: boolean;
  repair_status: "repairable" | "borderline" | "not_repairable";
  recommendation: string;
  repair_reason: string;
  repair_advice: string;
  nearby_shops: NearbyShop[];
  repair_options?: Array<{ name: string; cost_pkr: number; duration: string }>;
  cautions?: string[];
}

// Severity → semantic token. Green / amber / red are reserved for this only.
const SEVERITY = {
  low: { label: "Low damage", token: "var(--success)", badge: "Low" },
  medium: { label: "Moderate damage", token: "var(--warning)", badge: "Medium" },
  high: { label: "Critical damage", token: "var(--destructive)", badge: "High" },
} as const;

const REPAIR_STATUS = {
  repairable: { token: "var(--success)", icon: ShieldCheck, tag: "Repairable" },
  borderline: { token: "var(--warning)", icon: AlertTriangle, tag: "Get quotes first" },
  not_repairable: { token: "var(--destructive)", icon: ShieldX, tag: "Replace screen" },
} as const;

const STEPS = [
  { pct: 15, text: "Validating image" },
  { pct: 35, text: "Preprocessing" },
  { pct: 55, text: "Running damage analysis" },
  { pct: 75, text: "Detecting damage zones" },
  { pct: 90, text: "Scoring severity" },
];

interface UploadSectionProps {
  onAnalysisComplete?: () => void;
}

// Rough resale value (PKR) by tier, inferred from the phone model string, used
// only for a repair-vs-replace heuristic — not a precise market valuation.
function estimateDeviceValuePkr(model: string): number {
  const text = (model || "").toLowerCase();
  const isApple = /iphone/.test(text);
  const flagship = /(pro max|ultra|pro|fold|flip|s2[0-9]|s1[0-9]|iphone 1[2-9]|iphone 2[0-9])/.test(text);
  const midrange = /(galaxy a|redmi note|note 1|reno|nord|a5[0-9]|a7[0-9]|f[0-9]{2})/.test(text);
  if (isApple && flagship) return 220000;
  if (isApple) return 90000;
  if (flagship) return 160000;
  if (midrange) return 45000;
  return 30000;
}

const UploadSection = forwardRef<HTMLElement, UploadSectionProps>(({ onAnalysisComplete }, ref) => {
  const { requireAuth, token } = useAuth();
  const { formatMoney } = usePreferences();

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [phoneModel, setPhoneModel] = useState("");
  const [locationInput, setLocationInput] = useState("Lahore");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("Analyzing");
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const modelMissing = !phoneModel.trim();

  const setFile = (file: File) => {
    setUploadedFile(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) setFile(file);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFile(file);
  };

  const startAnalysis = async () => {
    if (!uploadedFile) return;
    if (modelMissing) {
      toast.error("Phone model required", { description: "Enter the model so the cost estimate is accurate." });
      return;
    }
    setIsAnalyzing(true);
    setProgress(0);
    setProgressText(STEPS[0].text);

    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex < STEPS.length) {
        setProgress(STEPS[stepIndex].pct);
        setProgressText(STEPS[stepIndex].text);
        stepIndex++;
      }
    }, 600);

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);
      formData.append("phone_model", phoneModel || "unknown smartphone");
      formData.append("location", locationInput || "Lahore");
      formData.append("token", token || "");

      const response = await axios.post<AnalysisResult>(`${API_BASE}/api/predict`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      clearInterval(interval);
      setProgress(100);
      setProgressText("Complete");

      setTimeout(() => {
        setIsAnalyzing(false);
        setResult(response.data);

        if (!response.data.repairable) {
          toast.error("Screen not repairable", { description: "This screen needs a full replacement." });
        } else if (response.data.repair_status === "borderline") {
          toast.warning("Expensive repair", { description: "Get a few quotes before repairing." });
        } else {
          toast.success("Analysis complete", {
            description: `Damage score: ${response.data.damage_score.toFixed(0)}/100`,
          });
        }

        onAnalysisComplete?.();
      }, 400);
    } catch (error) {
      clearInterval(interval);
      setIsAnalyzing(false);
      setProgress(0);
      if (axios.isAxiosError(error) && error.response?.status === 422) {
        const detail: string = error.response.data?.detail || "";
        const isModelError = /model/i.test(detail);
        toast.error(isModelError ? "Invalid phone model" : "Invalid image", {
          description: detail || "Upload a clear photo of a phone screen.",
        });
      } else {
        const message = axios.isAxiosError(error)
          ? error.response?.data?.detail ?? error.message
          : "Analysis failed. Please try again.";
        toast.error(message);
      }
    }
  };

  const resetUpload = () => {
    setUploadedFile(null);
    setPreview(null);
    setResult(null);
    setProgress(0);
  };

  const downloadReport = async () => {
    if (!result) return;
    try {
      await generateDamageReport({
        report_id: result.report_id,
        severity: result.severity,
        damage_score: result.damage_score,
        confidence: result.confidence,
        repair_cost_usd: result.repair_cost_usd,
        repairable: result.repairable,
        repair_status: result.repair_status,
        recommendation: result.recommendation,
        repair_advice: result.repair_advice,
        detections: result.detections,
        phone_model: phoneModel,
        image_url: result.image_url,
      });
      toast.success("PDF report downloaded");
    } catch {
      toast.error("Failed to generate report. Please try again.");
    }
  };

  const shareResult = async () => {
    if (!result) return;
    const lines = [
      "ScreenScan — phone screen damage report",
      `Phone: ${phoneModel || "Unknown"}`,
      `Severity: ${result.severity} (${result.damage_score.toFixed(0)}/100)`,
      `Estimated repair cost: ${formatMoney(result.repair_cost_usd || 0)}`,
      `Verdict: ${result.recommendation || (result.repairable ? "Repairable" : "Replace screen")}`,
    ];
    const text = lines.join("\n");
    try {
      if (navigator.share) {
        await navigator.share({ title: "ScreenScan damage report", text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Report summary copied to clipboard");
      }
    } catch {
      // User dismissed the share sheet — not an error worth surfacing.
    }
  };

  const severity = result ? SEVERITY[result.severity] : null;
  const repair = result?.repair_status ? REPAIR_STATUS[result.repair_status] : null;
  const baseImg = result?.image_url ?? preview;

  const deviceValue = result ? estimateDeviceValuePkr(phoneModel) : 0;
  const repairRatio = result && deviceValue > 0 ? (result.repair_cost_usd || 0) / deviceValue : 0;
  const shouldReplace = result ? !result.repairable || repairRatio >= 0.6 : false;
  const inputClass =
    "w-full rounded-[var(--radius)] border border-input bg-card px-3.5 py-2.5 text-sm text-foreground " +
    "placeholder:text-muted-foreground/60 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

  return (
    <section id="analyze" ref={ref} className="border-b border-border bg-hero-wash py-20 lg:py-24">
      <div className="container mx-auto max-w-3xl px-6">
        <div className="mb-10">
          <span className="chip-accent">Analyze</span>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Upload a screen, get a verdict.
          </h2>
          <p className="mt-3 text-muted-foreground">
            A clear, straight-on photo works best. You'll be asked to sign in before the analysis runs.
          </p>
        </div>

        <div className="surface p-6 sm:p-8">
          <AnimatePresence mode="wait">
            {!preview && (
              <motion.div
                key="upload"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="rounded-[var(--radius)] border-2 border-dashed border-border p-10 text-center transition-colors hover:border-accent/60"
              >
                <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" id="file-upload" />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-[var(--radius)] border border-border bg-secondary">
                    <Upload className="h-6 w-6 text-foreground" />
                  </span>
                  <p className="text-base font-semibold text-foreground">Drop a photo here</p>
                  <p className="mt-1 text-sm text-muted-foreground">or click to browse your device</p>
                  <p className="mt-4 font-mono text-xs text-muted-foreground">
                    JPG · PNG · WebP — max 10MB
                  </p>
                </label>
              </motion.div>
            )}

            {preview && !result && (
              <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="relative overflow-hidden rounded-[var(--radius)] border border-border bg-secondary/50">
                  <img src={preview} alt="Uploaded screen" className="max-h-[30rem] w-full object-contain" />
                  {isAnalyzing ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/85 backdrop-blur-sm">
                      <div className="text-center">
                        <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-foreground" />
                        <p className="text-sm font-medium text-foreground">{progressText}</p>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">{Math.round(progress)}%</p>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={resetUpload}
                      className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-[var(--radius)] border border-border bg-background/90 text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {isAnalyzing && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}

                {!isAnalyzing && (
                  <div className="space-y-5">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">
                        Phone model <span className="text-[hsl(var(--destructive))]">*</span>
                      </label>
                      <input
                        type="text"
                        value={phoneModel}
                        onChange={(e) => setPhoneModel(e.target.value)}
                        placeholder="e.g. iPhone 15 Pro, Samsung S24 Ultra"
                        aria-required="true"
                        className={`${inputClass} ${modelMissing ? "border-[hsl(var(--destructive)/0.5)]" : ""}`}
                      />
                      <p className={`mt-1.5 text-xs ${modelMissing ? "text-[hsl(var(--destructive))]" : "text-muted-foreground"}`}>
                        Required — the exact model drives detection accuracy and the cost estimate.
                      </p>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">Your location</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          value={locationInput}
                          onChange={(e) => setLocationInput(e.target.value)}
                          placeholder="e.g. Lahore, Karachi, Islamabad"
                          className={`${inputClass} pl-9`}
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Used to suggest repair shops near you.
                      </p>
                    </div>

                    <button
                      onClick={() => requireAuth(startAnalysis)}
                      disabled={modelMissing}
                      className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ScanLine className="h-4 w-4" />
                      {modelMissing ? "Enter phone model to continue" : "Start damage analysis"}
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {result && severity && (
              <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                <div className="flex justify-center overflow-hidden rounded-[var(--radius)] border border-border bg-secondary/50">
                  <img src={baseImg!} alt="Analysed screen" className="max-h-[34rem] w-auto object-contain" />
                </div>

                {/* Severity + cost summary */}
                <div
                  className="rounded-[var(--radius)] border p-5"
                  style={{ borderColor: `hsl(${severity.token} / 0.35)`, background: `hsl(${severity.token} / 0.08)` }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-2 font-semibold" style={{ color: `hsl(${severity.token})` }}>
                      <AlertTriangle className="h-4 w-4" />
                      {severity.label}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {(result.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>Damage score</span>
                    <span className="font-mono font-medium text-foreground">{result.damage_score.toFixed(0)} / 100</span>
                  </div>
                  <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-card">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.min(result.damage_score, 100)}%`, background: `hsl(${severity.token})` }}
                    />
                  </div>
                  <div className="flex items-center justify-between border-t border-border/60 pt-3">
                    <span className="text-sm text-muted-foreground">Estimated repair cost</span>
                    <span className="font-mono text-lg font-bold text-foreground">
                      {formatMoney(result.repair_cost_usd)}
                    </span>
                  </div>
                </div>

                {/* Repairability */}
                {repair && (
                  <div
                    className="rounded-[var(--radius)] border p-5"
                    style={{ borderColor: `hsl(${repair.token} / 0.3)`, background: `hsl(${repair.token} / 0.07)` }}
                  >
                    <div className="flex items-center gap-2">
                      <repair.icon className="h-4 w-4" style={{ color: `hsl(${repair.token})` }} />
                      <span className="font-semibold text-foreground">{result.recommendation}</span>
                      <span
                        className="ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{ background: `hsl(${repair.token} / 0.15)`, color: `hsl(${repair.token})` }}
                      >
                        {repair.tag}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{result.repair_advice}</p>
                  </div>
                )}

                {/* Repair vs replace */}
                <div className="rounded-[var(--radius)] border border-border p-5">
                  <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <ArrowLeftRight className="h-4 w-4 text-accent" />
                    Repair or replace?
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[var(--radius)] border border-border p-3">
                      <p className="text-xs text-muted-foreground">Estimated repair</p>
                      <p className="mt-1 font-mono text-base font-bold text-foreground">
                        {formatMoney(result.repair_cost_usd || 0)}
                      </p>
                    </div>
                    <div className="rounded-[var(--radius)] border border-border p-3">
                      <p className="text-xs text-muted-foreground">Approx. device value</p>
                      <p className="mt-1 font-mono text-base font-bold text-foreground">
                        {formatMoney(deviceValue)}
                      </p>
                    </div>
                  </div>
                  <div
                    className="mt-3 flex items-start gap-2 rounded-[var(--radius)] p-3 text-sm"
                    style={{
                      background: shouldReplace ? "hsl(var(--warning) / 0.08)" : "hsl(var(--success) / 0.08)",
                      color: shouldReplace ? "hsl(var(--warning))" : "hsl(var(--success))",
                    }}
                  >
                    {shouldReplace ? <ShieldX className="mt-0.5 h-4 w-4 flex-shrink-0" /> : <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />}
                    <span className="leading-relaxed">
                      {shouldReplace
                        ? `Repair is about ${(repairRatio * 100).toFixed(0)}% of the phone's value. Replacing the screen (or the phone) is likely the better choice — get a firm quote first.`
                        : `Repair is about ${(repairRatio * 100).toFixed(0)}% of the phone's value, so repairing is the economical choice. Device-value figures are rough estimates.`}
                    </span>
                  </div>
                </div>

                {/* Detections */}
                {result.detections.length > 0 && (
                  <div className="rounded-[var(--radius)] border border-border p-5">
                    <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <ScanLine className="h-4 w-4 text-accent" />
                      Detected issues ({result.detections.length})
                    </h4>
                    <div className="space-y-3">
                      {result.detections.map((det, i) => (
                        <div key={i} className="flex items-center justify-between gap-4">
                          <span className="text-sm capitalize text-foreground">{det.label.replace(/_/g, " ")}</span>
                          <div className="flex items-center gap-3">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
                              <div className="h-full rounded-full bg-foreground" style={{ width: `${det.confidence * 100}%` }} />
                            </div>
                            <span className="w-9 text-right font-mono text-xs text-muted-foreground">
                              {(det.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Nearby shops — AI-suggested repair areas */}
                {(result.nearby_shops?.length ?? 0) > 0 && (
                  <div className="rounded-[var(--radius)] border border-border p-5">
                    <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <MapPin className="h-4 w-4 text-accent" />
                      Repair shops near {locationInput || "you"}
                    </h4>
                    <div className="space-y-3">
                      {result.nearby_shops.map((shop, i) => (
                        <div key={i} className="flex items-start gap-3 rounded-[var(--radius)] border border-border p-3">
                          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-xs font-semibold text-foreground">
                            {i + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground">{shop.name}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {shop.area}{shop.city ? `, ${shop.city}` : ""}
                            </p>
                            {shop.specialty && <p className="mt-0.5 text-xs text-muted-foreground">{shop.specialty}</p>}
                          </div>
                          <a
                            href={`https://www.google.com/maps/search/${encodeURIComponent(`${shop.name} ${shop.area} ${shop.city || "Pakistan"}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-shrink-0 items-center gap-1 text-xs font-medium text-foreground underline underline-offset-2"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Search
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Repair options */}
                {result.repair_options?.length ? (
                  <div className="rounded-[var(--radius)] border border-border p-5">
                    <h4 className="mb-4 text-sm font-semibold text-foreground">Repair options</h4>
                    <div className="space-y-2">
                      {result.repair_options.map((opt, i) => (
                        <div key={i} className="flex items-center justify-between rounded-[var(--radius)] border border-border p-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">{opt.name}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{opt.duration}</p>
                          </div>
                          <span className="whitespace-nowrap font-mono text-sm font-semibold text-foreground">
                            {formatMoney(opt.cost_pkr)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Cautions */}
                {result.cautions?.length ? (
                  <div
                    className="rounded-[var(--radius)] border p-5"
                    style={{ borderColor: "hsl(var(--warning) / 0.3)", background: "hsl(var(--warning) / 0.07)" }}
                  >
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: "hsl(var(--warning))" }}>
                      <AlertTriangle className="h-4 w-4" />
                      Cautions
                    </h4>
                    <ul className="space-y-2">
                      {result.cautions.map((caution, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="mt-0.5 text-[hsl(var(--warning))]">•</span>
                          {caution}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {/* Inline assistant — pre-loaded with this analysis's context */}
                <AnalysisChat
                  context={{
                    phoneModel,
                    location: locationInput,
                    severity: result.severity,
                    damageScore: result.damage_score,
                    confidence: result.confidence,
                    repairCost: result.repair_cost_usd,
                    recommendation: result.recommendation,
                    repairStatus: result.repair_status,
                    repairable: result.repairable,
                    repairAdvice: result.repair_advice,
                    detections: result.detections,
                    repairOptions: result.repair_options ?? [],
                    shops: result.nearby_shops ?? [],
                  }}
                />

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={resetUpload}
                    className="flex flex-1 items-center justify-center gap-2 rounded-[var(--radius)] border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Analyze another
                  </button>
                  <button
                    onClick={shareResult}
                    className="flex flex-1 items-center justify-center gap-2 rounded-[var(--radius)] border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                  >
                    <Share2 className="h-4 w-4" />
                    Share
                  </button>
                  <button
                    onClick={downloadReport}
                    className="flex flex-1 items-center justify-center gap-2 rounded-[var(--radius)] bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    <Download className="h-4 w-4" />
                    Download report
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
});

UploadSection.displayName = "UploadSection";
export default UploadSection;
