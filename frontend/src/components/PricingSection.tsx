import { useState } from "react";
import {
  Check, Zap, Shield, Crown, Sparkles,
  ArrowRight, Building2, User, Store
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

// ── Plans ──────────────────────────────────────────────────────────────────

const PLANS = [
  {
    id:          "free",
    name:        "Basic",
    icon:        Zap,
    tagline:     "Perfect for individuals",
    priceUSD:    0,
    pricePKR:    0,
    period:      "",
    priceLabel:  "Free",
    color:       "from-slate-500 to-slate-600",
    borderColor: "border-border",
    popular:     false,
    audience:    "End Users",
    audienceIcon: User,
    features: [
      { text: "Limited analyses per month",           included: true  },
      { text: "Basic crack detection",           included: true  },
      { text: "Severity score (Low/Med/High)",   included: true  },
      { text: "Repairability assessment",        included: true  },
      { text: "AI chat assistant (10 msg/day)",  included: true  },
      { text: "PDF report download",             included: true  },
      { text: "Repair shop locator",             included: true  },
      { text: "Unlimited analyses",              included: false },
      { text: "Priority AI processing",          included: false },
      { text: "API access",                      included: false },
      { text: "White-label reports",             included: false },
    ],
    cta:    "Get Started Free",
    ctaSub: "No credit card required",
  },
  
 
];

// ── FAQ ────────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: "How does the free plan work?",
    a: "The Basic plan gives you Limited free analyses every month. No credit card needed — just sign up and start uploading photos of damaged screens instantly.",
  },
 
  {
    q: "Can repair shops use this for their customers?",
    a: "Yes the Free plan is designed for repair shops. You can generate branded PDF reports for customers, keep analysis history, and process limited phones per day.",
  },
  
  {
    q: "Is my data private?",
    a: "Yes. Uploaded images are analyzed and then deleted within 24 hours. We never share your data with third parties. Enterprise clients can opt for on-premise deployment.",
  },
];

// ── Component ──────────────────────────────────────────────────────────────

const PricingSection = () => {
  const [currency, setCurrency]   = useState<"PKR" | "USD">("PKR");
  const [openFaq, setOpenFaq]     = useState<number | null>(null);
  const navigate                  = useNavigate();

  const handlePlanClick = (plan: typeof PLANS[0]) => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    if (plan.id === "free") {
      navigate("/");
      return;
    }
    if (plan.id === "enterprise") {
      window.open("mailto:contact@screenai.pk?subject=Enterprise Plan Inquiry", "_blank");
      return;
    }
    // For Pro — show payment modal (see below)
    navigate(`/checkout?plan=${plan.id}`);
  };

  return (
    <section className="py-24 bg-background relative overflow-hidden">

      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-6 max-w-6xl relative">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} className="text-center mb-14"
        >
          
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Plans for <span className="gradient-text">Every Need</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
            From individual users to enterprise businesses start free, upgrade when you need more
          </p>

          {/* Currency toggle */}
          
        </motion.div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {PLANS.map((plan, i) => {
            const Icon         = plan.icon;
            const AudienceIcon = plan.audienceIcon;
            const price        = currency === "PKR"
              ? (plan.pricePKR === 0 ? "Free" : `PKR ${plan.pricePKR.toLocaleString()}`)
              : (plan.priceUSD === 0 ? "Free" : `$${plan.priceUSD}`);

            return (
              <motion.div key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`relative rounded-2xl border-2 ${plan.borderColor} bg-card overflow-hidden flex flex-col ${
                  plan.popular ? "shadow-xl shadow-primary/10 scale-[1.02]" : ""
                }`}>

                {/* Popular badge */}
                {plan.popular && (
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-600" />
                )}
                {plan.popular && (
                  <div className="absolute top-4 right-4">
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="p-6 flex-1">
                  {/* Plan header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-foreground">{plan.name}</h3>
                      <div className="flex items-center gap-1.5">
                        <AudienceIcon className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{plan.audience}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mb-5">{plan.tagline}</p>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-end gap-1">
                      <span className="text-4xl font-bold text-foreground">{price}</span>
                      {plan.period && (
                        <span className="text-muted-foreground text-sm mb-1">{plan.period}</span>
                      )}
                    </div>
                    {currency === "USD" && plan.pricePKR > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        ≈ PKR {plan.pricePKR.toLocaleString()} · JazzCash / EasyPaisa accepted
                      </p>
                    )}
                    {currency === "PKR" && plan.priceUSD > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        ≈ ${plan.priceUSD} USD · International cards accepted
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-2.5">
                    {plan.features.map((f, fi) => (
                      <li key={fi} className={`flex items-center gap-2.5 text-sm ${
                        f.included ? "text-foreground" : "text-muted-foreground line-through opacity-50"
                      }`}>
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                          f.included ? "bg-green-500/15" : "bg-border"
                        }`}>
                          <Check className={`w-2.5 h-2.5 ${f.included ? "text-green-500" : "text-muted-foreground"}`} />
                        </div>
                        {f.text}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA */}
                <div className="p-6 pt-0">
                  <Button
                    onClick={() => handlePlanClick(plan)}
                    className={`w-full gap-2 ${
                      plan.popular
                        ? "bg-primary hover:bg-primary/90"
                        : plan.id === "enterprise"
                        ? "bg-amber-500 hover:bg-amber-600 text-white"
                        : "variant-outline"
                    }`}
                    variant={plan.popular || plan.id === "enterprise" ? "default" : "outline"}
                  >
                    {plan.cta}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-2">{plan.ctaSub}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        

        {/* Who uses each plan */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} className="mb-20"
        >
          <h2 className="text-2xl font-bold text-center mb-8">Who Uses ScreenAI?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                
                title: "End Users",
                plan: "Basic (Free)",
                desc: "Students, professionals, and everyday smartphone users who want to quickly assess screen damage before visiting a repair shop.",
                examples: ["Check if a crack is worsening", "Get a rough repair cost estimate", "Find nearby repair shops"],
              },
              {
                
                title: "Repair Shops",
                plan: "Basic (Free)",
                desc: "Mobile repair centers in Pakistan who process multiple phones daily and need professional, consistent damage reports for customers.",
                examples: ["Generate branded reports for customers", "Standardize damage assessments", "Reduce pricing disputes"],
              },
              {
                
                title: "Insurance & Platforms",
                plan: "Basic (Free)",
                desc: "Insurance providers, warranty companies, and resale platforms like OLX or Cashify that need automated, scalable damage verification.",
                examples: ["Validate insurance claims via API", "Automate device grading", "Prevent fraud"],
              },
            ].map((u, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="bg-card border border-border rounded-2xl p-6"
              >
                <div className="text-4xl mb-3">{u.icon}</div>
                <h3 className="font-bold text-lg mb-1">{u.title}</h3>
                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {u.plan}
                </span>
                <p className="text-sm text-muted-foreground mt-3 mb-4">{u.desc}</p>
                <ul className="space-y-1.5">
                  {u.examples.map((ex, ei) => (
                    <li key={ei} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                      {ex}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* FAQ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="max-w-2xl mx-auto space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i}
                className="border border-border rounded-xl overflow-hidden bg-card">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-secondary/50 transition-colors"
                >
                  <span className="font-medium text-sm">{faq.q}</span>
                  <span className={`text-muted-foreground text-lg transition-transform ${openFaq === i ? "rotate-45" : ""}`}>+</span>
                </button>
                {openFaq === i && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border pt-4"
                  >
                    {faq.a}
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </section>
  );
};

export default PricingSection;
