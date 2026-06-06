import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2, Shield, Smartphone, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const AuthPage = () => {
  const [mode, setMode]             = useState<"login" | "signup">("login");
  const [showPass, setShowPass]     = useState(false);
  const [isLoading, setIsLoading]   = useState(false);
  const [form, setForm]             = useState({ name: "", email: "", password: "" });
  const navigate                    = useNavigate();

  const update = (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async () => {
    if (!form.email || !form.password) {
      toast.error("Please fill in all fields");
      return;
    }
    if (mode === "signup" && !form.name) {
      toast.error("Please enter your name");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const body = mode === "login"
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password };

      const resp = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.detail || "Something went wrong");
      }

      // Save token and user info to localStorage
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("login_time", Date.now().toString());
      

      toast.success(mode === "login" ? "Welcome back!" : "Account created!");
      navigate("/");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Authentication failed");
    }
    setIsLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--color-background-tertiary)",
      display: "flex",
      fontFamily: "var(--font-sans)",
    }}>

      {/* Left panel — branding */}
      <div style={{
        flex: 1,
        background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "3rem",
        position: "relative",
        overflow: "hidden",
      }} className="auth-left">

        {/* Background grid effect */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.05,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />

        {/* Glow orb */}
        <div style={{
          position: "absolute", top: "20%", left: "30%",
          width: 300, height: 300, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)",
          filter: "blur(40px)",
        }} />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ position: "relative", zIndex: 1 }}
        >
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "3rem" }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: "rgba(99,102,241,0.3)",
              border: "1px solid rgba(99,102,241,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Smartphone size={22} color="#a5b4fc" />
            </div>
            <span style={{ color: "white", fontSize: 20, fontWeight: 500 }}>
              ScreenAI
            </span>
          </div>

          <h1 style={{
            fontSize: "clamp(28px, 3vw, 42px)",
            fontWeight: 500,
            color: "white",
            lineHeight: 1.2,
            marginBottom: 16,
          }}>
            AI-Based Screen<br />Damage Detection
          </h1>

          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 16, lineHeight: 1.7, marginBottom: "3rem", maxWidth: 380 }}>
            Upload a photo of your damaged smartphone screen and get instant AI analysis, severity scoring, and repair cost estimates.
          </p>

          {/* Feature pills */}
          {[
            { icon: Shield, text: "Instant damage assessment" },
            { icon: Zap,    text: "Real time AI analysis" },
            { icon: Smartphone, text: "phone models supported" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} style={{
              display: "flex", alignItems: "center", gap: 12,
              marginBottom: 14,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: "rgba(99,102,241,0.2)",
                border: "1px solid rgba(99,102,241,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <Icon size={15} color="#a5b4fc" />
              </div>
              <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}>{text}</span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Right panel — form */}
      <div style={{
        width: "min(480px, 100%)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "3rem 2.5rem",
        background: "var(--color-background-primary)",
        borderLeft: "0.5px solid var(--color-border-tertiary)",
      }}>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Tab toggle */}
          <div style={{
            display: "flex",
            background: "var(--color-background-secondary)",
            borderRadius: 12,
            padding: 4,
            marginBottom: "2rem",
            border: "0.5px solid var(--color-border-tertiary)",
          }}>
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setForm({ name: "", email: "", password: "" }); }}
                style={{
                  flex: 1, padding: "10px 0",
                  border: "none", cursor: "pointer",
                  borderRadius: 9,
                  fontSize: 14, fontWeight: 500,
                  transition: "all 0.2s",
                  background: mode === m ? "var(--color-background-primary)" : "transparent",
                  color: mode === m ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                  boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {m === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 6 }}>
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: "1.75rem" }}>
            {mode === "login"
              ? "Sign in to access your damage reports and history"
              : "Start analyzing smartphone screen damage with AI"}
          </p>

          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {/* Name field (signup only) */}
              {mode === "signup" && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 6 }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="Muhammad Adnan"
                    value={form.name}
                    onChange={update("name")}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    style={{
                      width: "100%", padding: "11px 14px",
                      border: "0.5px solid var(--color-border-secondary)",
                      borderRadius: 10, fontSize: 14,
                      background: "var(--color-background-secondary)",
                      color: "var(--color-text-primary)",
                      outline: "none", boxSizing: "border-box",
                    }}
                  />
                </div>
              )}

              {/* Email */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 6 }}>
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={update("email")}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  style={{
                    width: "100%", padding: "11px 14px",
                    border: "0.5px solid var(--color-border-secondary)",
                    borderRadius: 10, fontSize: 14,
                    background: "var(--color-background-secondary)",
                    color: "var(--color-text-primary)",
                    outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 6 }}>
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPass ? "text" : "password"}
                    placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                    value={form.password}
                    onChange={update("password")}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    style={{
                      width: "100%", padding: "11px 42px 11px 14px",
                      border: "0.5px solid var(--color-border-secondary)",
                      borderRadius: 10, fontSize: 14,
                      background: "var(--color-background-secondary)",
                      color: "var(--color-text-primary)",
                      outline: "none", boxSizing: "border-box",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    style={{
                      position: "absolute", right: 12, top: "50%",
                      transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--color-text-secondary)", padding: 0,
                      display: "flex", alignItems: "center",
                    }}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit button */}
              <button
                onClick={submit}
                disabled={isLoading}
                style={{
                  width: "100%", padding: "13px 0",
                  background: isLoading ? "var(--color-border-secondary)" : "linear-gradient(135deg, #4f46e5, #7c3aed)",
                  color: "white", border: "none",
                  borderRadius: 10, fontSize: 15, fontWeight: 500,
                  cursor: isLoading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 8,
                  transition: "opacity 0.2s",
                }}
              >
                {isLoading
                  ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Processing...</>
                  : mode === "login" ? "Sign In" : "Create Account"
                }
              </button>
            </motion.div>
          </AnimatePresence>

          {/* Divider */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            margin: "20px 0",
          }}>
            <div style={{ flex: 1, height: "0.5px", background: "var(--color-border-tertiary)" }} />
            <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>or continue as</span>
            <div style={{ flex: 1, height: "0.5px", background: "var(--color-border-tertiary)" }} />
          </div>

          {/* Guest button */}
          <button
            onClick={() => navigate("/")}
            style={{
              width: "100%", padding: "11px 0",
              background: "var(--color-background-secondary)",
              border: "0.5px solid var(--color-border-secondary)",
              borderRadius: 10, fontSize: 14,
              color: "var(--color-text-secondary)",
              cursor: "pointer",
              transition: "background 0.15s",
            }}
          >
            Continue as Guest
          </button>

          <p style={{ textAlign: "center", fontSize: 12, color: "var(--color-text-tertiary)", marginTop: 24 }}>
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#6366f1", fontSize: 12, fontWeight: 500 }}
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </motion.div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) { .auth-left { display: none !important; } }
        input:focus { border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.15) !important; }
      `}</style>
    </div>
  );
};

export default AuthPage;
