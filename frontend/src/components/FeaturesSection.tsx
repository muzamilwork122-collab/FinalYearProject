import { Scan, Target, BarChart3, MapPin, Cpu, Shield } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: Scan,
    title: "Crack Detection",
    description: "Advanced segmentation identifies hairline cracks, spider webs, and shattered glass patterns.",
    color: "from-blue-500/20 to-cyan-500/20",
  },
  {
    icon: Target,
    title: "Dead Pixel Detection",
    description: "Precisely locates dead pixels, black spots, and display abnormalities on your screen.",
    color: "from-purple-500/20 to-pink-500/20",
  },
  {
    icon: BarChart3,
    title: "Severity Scoring",
    description: "Get a detailed severity score from 0-100 based on damage extent and type.",
    color: "from-orange-500/20 to-red-500/20",
  },
  {
    icon: MapPin,
    title: "Repair Shop Locator",
    description: "Find nearby certified repair shops with estimated costs based on your damage report.",
    color: "from-green-500/20 to-emerald-500/20",
  },
  {
    icon: Cpu,
    title: "AI-Powered Analysis",
    description: "Deep learning models trained on thousands of damaged screens for accurate detection.",
    color: "from-primary/20 to-accent/20",
  },
  {
    icon: Shield,
    title: "Insurance Ready",
    description: "Generate detailed reports suitable for insurance claims and warranty processing.",
    color: "from-indigo-500/20 to-violet-500/20",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

const FeaturesSection = () => {
  return (
    <section id="features" className="py-24 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-primary/5 to-transparent rounded-full blur-3xl" />
      </div>

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
            Features
          </motion.span>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="gradient-text">Powerful Features</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Our AI system provides comprehensive damage analysis with industry leading accuracy.
          </p>
        </motion.div>

        <motion.div 
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {features.map((feature, index) => (
            <motion.div 
              key={index}
              variants={itemVariants}
              whileHover={{ 
                y: -8, 
                scale: 1.02,
                transition: { type: "spring", stiffness: 300 }
              }}
              className="group relative"
            >
              {/* 3D card effect */}
              <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 rounded-2xl blur-xl transition-opacity duration-500 -z-10" 
                   style={{ background: `linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--accent) / 0.1))` }} />
              
              <div className="glass-card p-6 rounded-2xl hover:border-primary/40 transition-all duration-300 h-full relative overflow-hidden">
                {/* Gradient overlay */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                
                <div className="relative z-10">
                  <motion.div 
                    className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-all duration-300"
                    whileHover={{ rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 0.5 }}
                  >
                    <feature.icon className="w-7 h-7 text-primary" />
                  </motion.div>
                  <h3 className="text-lg font-semibold mb-2 text-foreground group-hover:text-primary transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturesSection;
