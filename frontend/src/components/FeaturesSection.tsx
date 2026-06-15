import { Banknote, FileText, Gauge, Grid3x3, MapPin, ScanLine } from "lucide-react";

const FEATURES = [
  {
    icon: ScanLine,
    title: "Crack detection",
    description: "Spots hairline cracks, spider-web fractures and shattered-glass patterns.",
  },
  {
    icon: Grid3x3,
    title: "Display-fault checks",
    description: "Flags black spots and other panel abnormalities.",
  },
  {
    icon: Gauge,
    title: "Severity score",
    description: "A single 0–100 score so you can compare damage objectively.",
  },
  {
    icon: Banknote,
    title: "Repair-cost estimate",
    description: "Estimated repair cost in PKR, tuned to the phone model you enter.",
  },
  {
    icon: MapPin,
    title: "Repair-shop locator",
    description: "Finds mobile-repair shops near your location on an interactive map.",
  },
  {
    icon: FileText,
    title: "Downloadable reports",
    description: "Export a clean PDF report to keep, share, or show a repair shop.",
  },
];

export default function FeaturesSection({ showEyebrow = true }: { showEyebrow?: boolean }) {
  return (
    <section id="features" className="border-b border-border py-20 lg:py-24">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl">
          {showEyebrow && <span className="chip-accent">What you get</span>}
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Everything from one photo.
          </h2>
          <p className="mt-3 text-muted-foreground">
            No invented benchmarks &mdash; just the analysis the tool actually produces.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="surface-interactive p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius)] bg-accent-soft text-accent-strong">
                <feature.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-foreground">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
