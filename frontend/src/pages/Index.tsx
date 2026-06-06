import { useRef } from "react";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import UploadSection from "@/components/UploadSection";
import AboutSection from "@/components/AboutSection";
import Footer from "@/components/Footer";
import AIChatWidget from "@/components/AIChatWidget";

const Index = () => {
  const uploadRef = useRef<HTMLElement>(null);

  const scrollToUpload = () => {
    uploadRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection onScrollToUpload={scrollToUpload} />
        <UploadSection ref={uploadRef} />
        <AboutSection />
      </main>
      <Footer />
      <AIChatWidget />
    </div>
  );
};

export default Index;
