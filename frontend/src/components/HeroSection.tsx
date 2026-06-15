import { ArrowRight } from "lucide-react";
import heroCrackedPhone from "@/assets/hero-cracked-phone.webp";

interface HeroSectionProps {
  onScrollToUpload: () => void;
}

const OUTPUTS = ["Severity score /100", "Repair cost in PKR", "Nearby repair shops"];

export default function HeroSection({ onScrollToUpload }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden border-b border-border bg-hero-wash">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />

      <div className="container relative mx-auto grid items-center gap-12 px-6 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
        <div className="animate-fade-up">
          <span className="chip-accent">AI screen-damage analysis</span>

          <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl text-balance">
            Know what that cracked screen will actually cost.
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Upload one photo of a phone screen. Get an objective damage assessment, a severity
            score and a repair-cost estimate in rupees in seconds.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button onClick={onScrollToUpload} className="btn-primary group">
              Analyze a screen
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-border px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              How it works
            </a>
          </div>

          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2">
            {OUTPUTS.map((output) => (
              <div key={output} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                <span className="text-sm text-muted-foreground">{output}</span>
              </div>
            ))}
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            Free to use &middot; Browse without an account &middot; Sign in to run an analysis
          </p>
        </div>

        <div className="animate-fade-up [animation-delay:120ms]">
          <figure className="surface shadow-soft overflow-hidden">
            <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
              <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                sample-analysis.jpg
              </span>
            </div>
            <div className="bg-secondary/50 p-4">
              <img
                src={heroCrackedPhone}
                alt="Cracked smartphone screen being analyzed"
                className="mx-auto max-h-[420px] w-full rounded-[calc(var(--radius)-2px)] object-contain"
              />
            </div>
            <figcaption className="grid grid-cols-3 divide-x divide-border border-t border-border">
              {[
                ["Severity", "High"],
                ["Score", "82/100"],
                ["Est. cost", "₨ 24,000"],
              ].map(([label, value]) => (
                <div key={label} className="px-4 py-3">
                  <div className="label-mono !text-[10px] !tracking-[0.16em]">{label}</div>
                  <div className="mt-1 font-mono text-sm font-semibold text-foreground">{value}</div>
                </div>
              ))}
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
