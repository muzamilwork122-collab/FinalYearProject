/**
 * generateReport.ts
 * Professional PDF report generator for ScreenAI damage analysis
 *
 * Place at: frontend/src/utils/generateReport.ts
 *
 * Install dependency first:
 *   npm install jspdf
 */

import jsPDF from "jspdf";

interface Detection {
  label: string;
  confidence: number;
  bbox: [number, number, number, number];
}

interface ReportData {
  report_id:       string | null;
  severity:        string;
  damage_score:    number;
  confidence:      number;
  repair_cost_usd: number;
  repairable:      boolean;
  repair_status:   string;
  recommendation:  string;
  repair_advice:   string;
  detections:      Detection[];
  phone_model:     string;
  image_url?:      string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getPakistaniTime(): string {
  return new Date().toLocaleString("en-PK", {
    timeZone:    "Asia/Karachi",
    year:        "numeric",
    month:       "long",
    day:         "2-digit",
    hour:        "2-digit",
    minute:      "2-digit",
    second:      "2-digit",
    hour12:      true,
  }) + " PKT";
}

function getSeverityColor(severity: string): [number, number, number] {
  switch (severity) {
    case "low":    return [34, 197, 94];    // green
    case "medium": return [234, 179, 8];    // yellow
    case "high":   return [239, 68, 68];    // red
    default:       return [99, 102, 241];
  }
}

function getRepairStatusColor(status: string): [number, number, number] {
  switch (status) {
    case "repairable":     return [34, 197, 94];
    case "borderline":     return [234, 179, 8];
    case "not_repairable": return [239, 68, 68];
    default:               return [99, 102, 241];
  }
}

function formatPhoneModel(model: string): string {
  return model
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function wrapText(doc: jsPDF, text: string, x: number, maxWidth: number, lineHeight: number, startY: number): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, startY);
  return startY + lines.length * lineHeight;
}


// ── Main PDF generator ─────────────────────────────────────────────────────

export async function generateDamageReport(data: ReportData): Promise<void> {
  const doc    = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W      = 210;   // A4 width mm
  const margin = 18;
  const contentW = W - margin * 2;
  let   y      = 0;

  // ── COLORS ────────────────────────────────────────────────────────────────
  const PRIMARY    : [number, number, number] = [79, 70, 229];    // indigo
  const DARK       : [number, number, number] = [15, 23, 42];     // slate-900
  const GRAY       : [number, number, number] = [100, 116, 139];  // slate-500
  const LIGHT_GRAY : [number, number, number] = [241, 245, 249];  // slate-100
  const WHITE      : [number, number, number] = [255, 255, 255];
  const sevColor   = getSeverityColor(data.severity);
  const repColor   = getRepairStatusColor(data.repair_status);


  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 1
  // ══════════════════════════════════════════════════════════════════════════

  // ── Header bar ────────────────────────────────────────────────────────────
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, W, 42, "F");

  // Project name
  doc.setTextColor(...WHITE);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("ScreenAI", margin, 16);

  // Subtitle
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("AI-Based Screen Damage Detection & Severity Classification", margin, 24);

  // Report title right-aligned
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("DAMAGE ANALYSIS REPORT", W - margin, 16, { align: "right" });

  // University name
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
 

  y = 50;

  // ── Report metadata row ───────────────────────────────────────────────────
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(margin, y, contentW, 22, 3, 3, "F");

  doc.setTextColor(...GRAY);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");

  const pkTime   = getPakistaniTime();
  const reportId = data.report_id ?? "N/A";
  const colW     = contentW / 3;

  doc.text("Report ID",         margin + 6,          y + 6);
  doc.text("Generated (PKT)",   margin + colW + 6,   y + 6);
  doc.text("Phone Model",       margin + colW * 2 + 6, y + 6);

  doc.setTextColor(...DARK);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(reportId.toUpperCase().slice(0, 28),          margin + 6,           y + 14);
  doc.text(pkTime,                                        margin + colW + 6,    y + 14);
  doc.text(formatPhoneModel(data.phone_model || "Unknown"), margin + colW * 2 + 6, y + 14);

  y += 30;

  // ── Section: Damage Summary ───────────────────────────────────────────────
  doc.setTextColor(...PRIMARY);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("1.  Damage Summary", margin, y);

  // Divider line
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.5);
  doc.line(margin, y + 2, W - margin, y + 2);
  y += 10;

  // Score cards (3 columns)
  const cardW = (contentW - 8) / 3;

  const cards = [
    {
      label: "Damage Score",
      value: `${data.damage_score.toFixed(0)} / 100`,
      sub:   "AI computed",
      color: sevColor,
    },
    {
      label: "Severity Level",
      value: data.severity.toUpperCase(),
      sub:   "Classification",
      color: sevColor,
    },
    {
      label: "AI Confidence",
      value: `${(data.confidence * 100).toFixed(1)}%`,
      sub:   "Model certainty",
      color: PRIMARY,
    },
  ];

  cards.forEach((card, i) => {
    const cx = margin + i * (cardW + 4);
    doc.setFillColor(...LIGHT_GRAY);
    doc.roundedRect(cx, y, cardW, 28, 3, 3, "F");

    // Colored top accent
    doc.setFillColor(...card.color);
    doc.roundedRect(cx, y, cardW, 4, 2, 2, "F");

    doc.setTextColor(...GRAY);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(card.label, cx + cardW / 2, y + 11, { align: "center" });

    doc.setTextColor(...card.color);
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text(card.value, cx + cardW / 2, y + 21, { align: "center" });

    doc.setTextColor(...GRAY);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(card.sub, cx + cardW / 2, y + 27, { align: "center" });
  });

  y += 36;

  // ── Damage score bar ──────────────────────────────────────────────────────
  doc.setTextColor(...GRAY);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Damage Severity Scale", margin, y);
  doc.text(`${data.damage_score.toFixed(0)}%`, W - margin, y, { align: "right" });
  y += 4;

  // Background bar
  doc.setFillColor(220, 220, 220);
  doc.roundedRect(margin, y, contentW, 5, 2, 2, "F");

  // Filled bar
  doc.setFillColor(...sevColor);
  doc.roundedRect(margin, y, contentW * (data.damage_score / 100), 5, 2, 2, "F");

  y += 14;

  // ── Section: Repairability ────────────────────────────────────────────────
  doc.setTextColor(...PRIMARY);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("2.  Repairability Assessment", margin, y);
  doc.setDrawColor(...PRIMARY);
  doc.line(margin, y + 2, W - margin, y + 2);
  y += 10;

  // Status badge
  doc.setFillColor(...repColor);
  doc.roundedRect(margin, y, contentW, 12, 3, 3, "F");

  doc.setTextColor(...WHITE);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  const statusEmoji = data.repairable === false ? "NOT REPAIRABLE" :
                      data.repair_status === "borderline" ? "BORDERLINE — EXPENSIVE REPAIR" :
                      "REPAIRABLE";
  doc.text(statusEmoji, W / 2, y + 8, { align: "center" });
  y += 18;

  // Recommendation
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(margin, y, contentW, 8, 2, 2, "F");
  doc.setTextColor(...DARK);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`Recommendation:  ${data.recommendation}`, margin + 5, y + 5.5);
  y += 14;

  // Repair advice paragraph
  doc.setTextColor(...DARK);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  y = wrapText(doc, data.repair_advice, margin, contentW, 5.5, y);
  y += 8;

  // ── Section: Cost Estimate ────────────────────────────────────────────────
  doc.setTextColor(...PRIMARY);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("3.  Repair Cost Estimate", margin, y);
  doc.setDrawColor(...PRIMARY);
  doc.line(margin, y + 2, W - margin, y + 2);
  y += 10;

  // Cost box
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(margin, y, contentW, 20, 3, 3, "F");

  doc.setTextColor(...GRAY);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Estimated Repair Cost (PKR)", margin + 5, y + 7);
  doc.text("Damage Score", W / 2 + 5, y + 7);

  doc.setTextColor(...PRIMARY);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`PKR ${Math.round(data.repair_cost_usd).toLocaleString("en-PK")}`, margin + 5, y + 17);
  doc.text(`${data.damage_score.toFixed(0)} / 100`, W / 2 + 5, y + 17);

  // Divider between two costs
  doc.setDrawColor(...GRAY);
  doc.setLineWidth(0.3);
  doc.line(W / 2, y + 4, W / 2, y + 18);

  y += 28;

  // ── Section: Detected Issues ──────────────────────────────────────────────
  doc.setTextColor(...PRIMARY);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("4.  Detected Issues", margin, y);
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.5);
  doc.line(margin, y + 2, W - margin, y + 2);
  y += 10;

  if (data.detections.length === 0) {
    doc.setFillColor(...LIGHT_GRAY);
    doc.roundedRect(margin, y, contentW, 10, 2, 2, "F");
    doc.setTextColor(...GRAY);
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text("No specific damage zones detected by object detection model.", margin + 5, y + 7);
    y += 16;
  } else {
    // Table header
    doc.setFillColor(...PRIMARY);
    doc.rect(margin, y, contentW, 8, "F");
    doc.setTextColor(...WHITE);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Damage Type",  margin + 4,              y + 5.5);
    doc.text("Confidence",   margin + contentW * 0.45, y + 5.5);
    doc.text("Severity",     margin + contentW * 0.70, y + 5.5);
    y += 8;

    data.detections.forEach((det, i) => {
      const rowBg: [number, number, number] = i % 2 === 0 ? LIGHT_GRAY : WHITE;
      doc.setFillColor(...rowBg);
      doc.rect(margin, y, contentW, 8, "F");

      doc.setTextColor(...DARK);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");

      const label     = det.label.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      const confPct   = `${(det.confidence * 100).toFixed(1)}%`;
      const sev       = det.confidence > 0.8 ? "High" : det.confidence > 0.5 ? "Medium" : "Low";
      const sevC      = getSeverityColor(sev.toLowerCase());

      doc.text(label,   margin + 4,              y + 5.5);
      doc.text(confPct, margin + contentW * 0.45, y + 5.5);

      doc.setTextColor(...sevC);
      doc.setFont("helvetica", "bold");
      doc.text(sev, margin + contentW * 0.70, y + 5.5);

      y += 8;
    });
    y += 6;
  }


  // ══════════════════════════════════════════════════════════════════════════
  // Check if we need a new page for disclaimer
  // ══════════════════════════════════════════════════════════════════════════
  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  // ── Section: Disclaimer ───────────────────────────────────────────────────
  doc.setTextColor(...PRIMARY);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("5.  Disclaimer", margin, y);
  doc.setDrawColor(...PRIMARY);
  doc.line(margin, y + 2, W - margin, y + 2);
  y += 10;

  const disclaimer =
    "This report is generated by an AI system and is intended for informational purposes only. " +
    "Damage assessment accuracy depends on image quality and model training data. " +
    "Repair cost estimates are approximate and may vary by location, parts availability, and technician rates. " +
    "Always consult a certified repair professional before making repair or replacement decisions. ";

  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(234, 179, 8);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, contentW, 30, 3, 3, "FD");

  doc.setTextColor(120, 80, 0);
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  wrapText(doc, disclaimer, margin + 5, contentW - 10, 4.8, y + 7);

  y += 38;

  // ── Footer ─────────────────────────────────────────────────────────────────
  const footerY = 285;
  doc.setFillColor(...LIGHT_GRAY);
  doc.rect(0, footerY, W, 12, "F");

  doc.setTextColor(...GRAY);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text(
    "ScreenAI — AI-Based Screen Damage Detection & Severity Classification | University of South Asia, Lahore",
    W / 2, footerY + 5,
    { align: "center" }
  );
  doc.text(
    `Generated: ${pkTime}  |  Report ID: ${reportId}`,
    W / 2, footerY + 10,
    { align: "center" }
  );

  // ── Save PDF ───────────────────────────────────────────────────────────────
  const fileName = `ScreenAI_Report_${reportId?.slice(0, 8) ?? "unknown"}_${Date.now()}.pdf`;
  doc.save(fileName);
}
