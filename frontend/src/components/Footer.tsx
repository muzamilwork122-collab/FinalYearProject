import { Smartphone, Github, Twitter, Linkedin, Heart } from "lucide-react";
import { motion } from "framer-motion";

const Footer = () => {
  

  return (
    <motion.footer 
      className="border-t border-border/30 py-12 mt-12 relative overflow-hidden"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
    >
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-primary/5 blur-3xl" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <motion.div 
            className="flex items-center gap-3"
            whileHover={{ scale: 1.02 }}
          >
            <motion.div 
              className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center"
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.5 }}
            >
              <Smartphone className="w-5 h-5 text-primary" />
            </motion.div>
            <div>
              <span className="font-bold gradient-text text-lg">ScreenScan AI</span>
              <p className="text-xs text-muted-foreground">Damage Detection System</p>
            </div>
          </motion.div>

          <motion.div 
            className="text-sm text-muted-foreground text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            
            
          </motion.div>

          
        </div>

        {/* Bottom links */}
        <motion.div 
          className="flex flex-wrap justify-center gap-6 mt-8 pt-6 border-t border-border/30"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
        >
          {["Privacy Policy", "Terms of Service", "Contact Us"].map((link, index) => (
            <motion.a
              key={index}
              href="#"
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
              whileHover={{ scale: 1.05 }}
            >
              {link}
            </motion.a>
          ))}
        </motion.div>
      </div>
    </motion.footer>
  );
};

export default Footer;
