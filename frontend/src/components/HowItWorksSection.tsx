import { Upload, Cpu, FileText, ArrowRight, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import crackedScreen from "@/assets/cracked-screen.webp";
import screenScanning from "@/assets/screen-scanning.webp";
import damageReport from "@/assets/damage-report.webp";

const steps = [
  {
    number: "01",
    icon: Upload,
    title: "Upload Image",
    description: "Take a clear photo of your smartphone screen and upload it to our system.",
    image: crackedScreen,
  },
  {
    number: "02",
    icon: Cpu,
    title: "AI Analysis",
    description: "Our deep learning model analyzes the image for cracks, dead pixels, and defects.",
    image: screenScanning,
  },
  {
    number: "03",
    icon: FileText,
    title: "Get Report",
    description: "Receive a detailed damage report with severity score and repair recommendations.",
    image: damageReport,
  },
];

const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="py-24 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0">
        <motion.div 
          className="absolute top-1/2 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/2"
          animate={{ x: [-50, 50, -50], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 10, repeat: Infinity }}
        />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <motion.span 
            className="inline-block px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4"
            initial={{ scale: 0.8, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
          >
            How It Works
          </motion.span>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="gradient-text">Simple 3-Step Process</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Get your screen analyzed in three simple steps with our AI-powered platform
          </p>
        </motion.div>

        {/* Steps Timeline */}
        <div className="relative max-w-5xl mx-auto">
          {/* Connection line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-primary/20 via-primary to-primary/20 -translate-y-1/2 z-0" />
          
          <div className="grid lg:grid-cols-3 gap-8 relative z-10">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                className="relative"
              >
                <motion.div
                  whileHover={{ y: -10, scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="group"
                >
                  {/* Card */}
                  <div className="glass-card rounded-3xl overflow-hidden hover:border-primary/40 transition-all duration-500">
                    {/* Image with overlay */}
                    <div className="relative h-48 overflow-hidden">
                      <motion.img 
                        src={step.image} 
                        alt={step.title}
                        className="w-full h-full object-cover"
                        whileHover={{ scale: 1.1 }}
                        transition={{ duration: 0.5 }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
                      
                      {/* Step number badge */}
                      <motion.div 
                        className="absolute top-4 left-4 w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg"
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 0.5 }}
                      >
                        {step.number}
                      </motion.div>

                      {/* Scan animation for step 2 */}
                      {index === 1 && (
                        <motion.div
                          className="absolute inset-0 overflow-hidden"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          <motion.div
                            className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary/80 to-transparent"
                            animate={{ top: ["0%", "100%", "0%"] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                          />
                        </motion.div>
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                          <step.icon className="w-5 h-5 text-primary" />
                        </div>
                        <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                          {step.title}
                        </h3>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">
                        {step.description}
                      </p>
                      
                      {/* Checkmark for completed feel */}
                      <motion.div 
                        className="flex items-center gap-2 mt-4 text-sm text-primary"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.5 + index * 0.2 }}
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Quick & Easy</span>
                      </motion.div>
                    </div>
                  </div>

                  {/* Arrow connector (hidden on last item and mobile) */}
                  {index < steps.length - 1 && (
                    <motion.div 
                      className="hidden lg:flex absolute -right-4 top-1/2 -translate-y-1/2 z-20"
                      animate={{ x: [0, 5, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <ArrowRight className="w-8 h-8 text-primary" />
                    </motion.div>
                  )}
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
