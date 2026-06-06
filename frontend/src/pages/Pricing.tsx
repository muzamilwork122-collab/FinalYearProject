import { useRef } from "react";
import Header from "@/components/Header";
import PricingSection from "@/components/PricingSection";
import UploadSection from "@/components/UploadSection";
import Footer from "@/components/Footer";
import RepairShopLocator from "@/components/RepairShopLocator";

// Add in your JSX:
<RepairShopLocator />

const Pricing = () => {
  const uploadRef = useRef<HTMLElement>(null);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20">
        <PricingSection />
        <UploadSection ref={uploadRef} />
        <RepairShopLocator />
      </main>
      <Footer />
    </div>
  );
};

export default Pricing;
