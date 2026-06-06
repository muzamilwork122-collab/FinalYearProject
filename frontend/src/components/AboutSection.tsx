import { Users, Target, TrendingUp, Zap, Smartphone, Cpu, Lightbulb, HelpCircle } from "lucide-react";
import { motion } from "framer-motion";

const aboutItems = [
  {
    icon: Lightbulb,
    title: "Overview",
    description: "ScreenScan AI is an intelligent damage detection platform that uses advanced computer vision to analyze smartphone screens, identifying cracks, dead pixels, and display abnormalities with precision accuracy.",
  },
  {
    icon: Users,
    title: "Client",
    description: "Designed for smartphone users, repair shops, insurance companies, and device resellers who need reliable, instant damage assessments for decision-making and documentation.",
  },
  {
    icon: Target,
    title: "Business Requirement",
    description: "The market demands standardized, unbiased damage evaluation. Manual inspection is subjective and time consuming. Businesses need automated, consistent reporting for claims processing and pricing.",
  },
  {
    icon: TrendingUp,
    title: "Preferable Outcome",
    description: "Users receive instant severity scores, accurate repair cost estimates, and insurance ready reports within seconds transforming hours of work into a 30 second automated workflow.",
  },
  {
    icon: Zap,
    title: "Reduce Manual Effort",
    description: "Eliminates the need for multiple repair shop visits, manual documentation, and subjective assessments. One photo upload replaces the entire traditional inspection process.",
  },
  {
    icon: Smartphone,
    title: "Cross-device Damage Detection",
    description: "Our AI models are trained on thousands of device types from budget phones to flagship models. Accurate detection across all screen sizes, resolutions, and display technologies.",
  },
  {
    icon: Cpu,
    title: "Phone Make & Model Detection",
    description: "Automatic device identification using image recognition. The system detects your phone's make and model to provide device specific repair pricing and part availability.",
  },
  {
    icon: Lightbulb,
    title: "Our Solution",
    description: "A comprehensive AI platform combining damage detection, severity scoring, cost estimation, and repair shop matching all accessible through a simple photo upload interface.",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4 },
  },
};

const AboutSection = () => {
  return (
    <section id="about" className="py-24 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/30 via-background to-muted/30" />
      
      {/* Decorative elements */}
      <motion.div 
        className="absolute top-20 right-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 6, repeat: Infinity }}
      />
      <motion.div 
        className="absolute bottom-20 left-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl"
        animate={{ scale: [1.2, 1, 1.2], opacity: [0.4, 0.2, 0.4] }}
        transition={{ duration: 8, repeat: Infinity }}
      />

      <div className="container mx-auto px-6 relative z-10">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <motion.span 
            className="inline-block px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4"
            initial={{ scale: 0.8, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
          >
            About Us
          </motion.span>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="gradient-text">Why ScreenScan AI?</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Understanding the problem we solve and why our solution matters.
          </p>
        </motion.div>

        <motion.div 
          className="grid md:grid-cols-2 gap-6 mb-12"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
        >
          {aboutItems.map((item, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              whileHover={{ 
                y: -5, 
                scale: 1.01,
                transition: { type: "spring", stiffness: 400 }
              }}
              className="group"
            >
              <div className="glass-card p-6 rounded-2xl hover:border-primary/40 transition-all duration-300 h-full relative overflow-hidden">
                {/* Hover glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="flex items-start gap-4 relative z-10">
                  <motion.div 
                    className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors"
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.6 }}
                  >
                    <item.icon className="w-6 h-6 text-primary" />
                  </motion.div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2 text-foreground group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Why We Need It Section */}
        <motion.div 
          className="glass-card p-8 rounded-3xl border-primary/20 relative overflow-hidden"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
          
          <div className="flex items-start gap-4 relative z-10">
            <motion.div 
              className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              <HelpCircle className="w-8 h-8 text-primary" />
            </motion.div>
            <div>
              <h3 className="text-2xl font-bold mb-4 text-foreground">Why Do We Need This?</h3>
              <div className="space-y-4 text-muted-foreground">
                <motion.p
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                >
                  <strong className="text-foreground">The Problem:</strong> Every year, millions of smartphones suffer screen damage. Users waste hours visiting multiple repair shops, getting inconsistent quotes, and struggling with insurance claims that require proper documentation.
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                >
                  <strong className="text-foreground">The Gap:</strong> There is no standardized way to assess screen damage. Repair costs vary wildly, and insurance companies often dispute claims due to lack of objective evidence.
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                >
                  <strong className="text-foreground">Our Answer:</strong> ScreenScan AI bridges this gap with AI-powered, unbiased damage assessment that benefits everyone users get fair pricing, repair shops get qualified leads, and insurers get reliable documentation.
                </motion.p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default AboutSection;
