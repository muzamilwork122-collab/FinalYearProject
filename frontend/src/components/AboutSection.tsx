const POINTS = [
  {
    term: "The problem",
    detail:
      "Screens break constantly, and figuring out the damage means trekking between repair shops for inconsistent, gut-feel quotes.",
  },
  {
    term: "The gap",
    detail:
      "There's no standard way to grade screen damage, so prices vary wildly and there's nothing objective to point to.",
  },
  {
    term: "The approach",
    detail:
      "ScreenScan reads the photo, grades the damage on a fixed scale, and attaches a rupee estimate — the same way, every time.",
  },
];

export default function AboutSection() {
  return (
    <section id="about" className="border-b border-border py-20 lg:py-24">
      <div className="container mx-auto grid gap-12 px-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="label-mono">Why it exists</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
            A consistent second opinion before you pay for a repair.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Built as a final-year project to make screen-damage assessment objective and
            repeatable for everyday users and repair shops alike.
          </p>
        </div>

        <dl className="divide-y divide-border border-t border-border">
          {POINTS.map((point) => (
            <div key={point.term} className="grid gap-2 py-6 sm:grid-cols-[180px_1fr] sm:gap-6">
              <dt className="font-mono text-sm font-semibold uppercase tracking-wider text-foreground">
                {point.term}
              </dt>
              <dd className="text-sm leading-relaxed text-muted-foreground">{point.detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
