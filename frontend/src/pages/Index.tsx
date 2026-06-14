import { useRef } from "react";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import FeaturesSection from "@/components/FeaturesSection";
import UploadSection from "@/components/UploadSection";
import AboutSection from "@/components/AboutSection";
import Footer from "@/components/Footer";

const Index = () => {
  const uploadRef = useRef<HTMLElement>(null);

  const scrollToUpload = () => uploadRef.current?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection onScrollToUpload={scrollToUpload} />
        <HowItWorksSection />
        <FeaturesSection />
        <UploadSection ref={uploadRef} />
        <AboutSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
