import crackedScreen from "@/assets/cracked-screen.webp";
import screenScanning from "@/assets/screen-scanning.webp";
import damageReport from "@/assets/damage-report.webp";

const STEPS = [
  {
    number: "01",
    title: "Upload a photo",
    description: "Take a clear, well-lit photo of the phone screen and drop it in. JPG, PNG or WebP.",
    image: crackedScreen,
  },
  {
    number: "02",
    title: "AI inspects the damage",
    description:
      "The screen is checked for cracks and display faults then scored for severity.",
    image: screenScanning,
  },
  {
    number: "03",
    title: "Get a costed report",
    description:
      "Read the severity score and a repair-cost estimate in PKR, then download a PDF report.",
    image: damageReport,
  },
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="border-b border-border py-20 lg:py-24">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl">
          <span className="chip-accent">How it works</span>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Three steps, about thirty seconds.
          </h2>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((step) => (
            <article key={step.number} className="surface-interactive flex flex-col overflow-hidden">
              <div className="border-b border-border bg-secondary/50">
                <img
                  src={step.image}
                  alt={step.title}
                  className="h-44 w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft font-mono text-sm font-semibold text-accent-strong">
                  {step.number}
                </span>
                <h3 className="mt-2 text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
