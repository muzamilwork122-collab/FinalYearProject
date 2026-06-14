import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Header from "@/components/Header";
import FeaturesSection from "@/components/FeaturesSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import RepairShopLocator from "@/components/RepairShopLocator";
import AboutSection from "@/components/AboutSection";
import Footer from "@/components/Footer";

const Features = () => (
  <div className="min-h-screen bg-background">
    <Header />
    <main>
      <section className="relative overflow-hidden border-b border-border bg-hero-wash">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-30 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="container relative mx-auto px-6 py-16 lg:py-20">
          <div className="max-w-2xl">
            <span className="chip-accent">Features</span>
            <h1 className="mt-4 font-display text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl text-balance">
              What ScreenScan does, end to end.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              From a single photo to a costed, shareable report — here's everything the tool
              produces. No invented numbers, just the real output.
            </p>
            <Link to="/#analyze" className="btn-primary group mt-7">
              Try it on a screen
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>

      <FeaturesSection showEyebrow={false} />
      <HowItWorksSection />
      <RepairShopLocator />
      <AboutSection />
    </main>
    <Footer />
  </div>
);

export default Features;
