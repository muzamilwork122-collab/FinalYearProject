import { Link } from "react-router-dom";
import { Check } from "lucide-react";

const INCLUDED = [
  "Unlimited screen analyses",
  "Severity score out of 100",
  "Repair-cost estimate in PKR",
  "Damage-zone detection overlay",
  "Repair-shop suggestions near you",
  "Downloadable PDF reports",
  "AI repair assistant",
  "Saved analysis history",
];

export default function PricingSection() {
  return (
    <section className="py-20 lg:py-24">
      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="chip-accent">Pricing</span>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl text-balance">
            Free and that's the whole plan.
          </h1>
          <p className="mt-4 text-muted-foreground">
            This is Start of a business. Everything it can do is available to
            everyone at no cost you only need a free account to run an analysis.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-md">
          <div className="surface shadow-soft overflow-hidden p-8">
            <div className="-mx-8 -mt-8 mb-8 h-1.5 bg-gradient-to-r from-primary to-accent-strong" />
            <div className="flex items-baseline justify-between">
              <div>
                <p className="label-mono">Free plan</p>
                <p className="mt-2 font-display text-5xl font-bold tracking-tight text-foreground">
                  ₨0
                </p>
              </div>
              <span className="chip-accent">Always</span>
            </div>

            <Link to="/#analyze" className="btn-primary mt-7 w-full">
              Analyze a screen
            </Link>

            <ul className="mt-7 space-y-3 border-t border-border pt-7">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-foreground">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[hsl(var(--success))]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
