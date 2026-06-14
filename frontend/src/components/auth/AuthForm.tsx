import { useEffect, useState } from "react";
import { Check, Eye, EyeOff, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type Mode = "login" | "signup" | "forgot";

interface GoogleButtonOptions {
  theme: string;
  size: string;
  width: number;
  text: string;
  shape: string;
}

interface GoogleIdentity {
  accounts?: {
    id?: {
      initialize: (config: {
        client_id: string;
        callback: (response: { credential: string }) => void;
      }) => void;
      renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void;
    };
  };
}

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

// Letters (incl. accented), spaces, hyphens, apostrophes — no digits/symbols.
const NAME_RE = /^[A-Za-z\u00C0-\u024F]+(?:[ '-][A-Za-z\u00C0-\u024F]+)*$/;

// Placeholder / disposable domains that look valid but cannot receive real mail.
const FAKE_EMAIL_DOMAINS = new Set([
  "nomail.com", "example.com", "example.org", "example.net", "test.com",
  "mailinator.com", "tempmail.com", "temp-mail.org", "guerrillamail.com",
  "10minutemail.com", "fakeinbox.com", "trashmail.com", "yopmail.com",
  "getnada.com", "dispostable.com", "throwawaymail.com", "sharklasers.com",
  "maildrop.cc", "mailnesia.com", "discard.email", "fake.com", "nowhere.com",
]);

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (value: string) => value.length >= 8 },
  { label: "An uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { label: "A lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { label: "A number", test: (value: string) => /\d/.test(value) },
  { label: "A special character", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

function validateName(name: string): string | null {
  const value = name.trim();
  if (!value) return "Please enter your name";
  if (/\d/.test(value)) return "Name cannot contain numbers";
  if (!NAME_RE.test(value)) return "Name can only contain letters, spaces, hyphens and apostrophes";
  if (value.length > 50) return "Name is too long (max 50 characters)";
  return null;
}

function validateEmail(email: string): string | null {
  const value = email.trim().toLowerCase();
  if (!EMAIL_RE.test(value)) return "Please enter a valid email address";
  const domain = value.split("@")[1];
  if (FAKE_EMAIL_DOMAINS.has(domain))
    return `"${domain}" is not a real email domain. Please use a valid email address.`;
  return null;
}

function validatePassword(password: string): string | null {
  const failed = PASSWORD_RULES.find((rule) => !rule.test(password));
  return failed ? `Password needs: ${failed.label.toLowerCase()}` : null;
}

/** Live checklist of password-strength requirements. */
function PasswordChecklist({ password }: { password: string }) {
  if (!password) return null;
  return (
    <ul className="mt-2 grid gap-1">
      {PASSWORD_RULES.map((rule) => {
        const passed = rule.test(password);
        return (
          <li
            key={rule.label}
            className={`flex items-center gap-1.5 text-xs ${
              passed ? "text-success" : "text-muted-foreground"
            }`}
          >
            {passed ? <Check size={13} /> : <X size={13} className="text-muted-foreground/60" />}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}

const inputClass =
  "w-full rounded-[var(--radius)] border border-input bg-card px-3.5 py-2.5 text-sm text-foreground " +
  "placeholder:text-muted-foreground/60 outline-none transition-colors " +
  "focus:border-accent focus:ring-2 focus:ring-accent/30";

const labelClass = "block text-xs font-medium text-foreground mb-1.5";

/** Shared sign-in / sign-up / reset form. Used inside the login modal. */
export default function AuthForm({ onDone }: { onDone?: () => void }) {
  const { login } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [forgotEmail, setForgotEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleGoogleResponse = async (response: { credential: string }) => {
    setIsLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.detail || "Google authentication failed");
      login({ token: data.token, user: data.user });
      toast.success("Signed in with Google");
      onDone?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google login failed");
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (mode === "forgot") return;
    const timer = setTimeout(() => {
      const client = (window as unknown as { google?: GoogleIdentity }).google;
      const container = document.getElementById("googleBtn");
      if (!client?.accounts?.id || !container) return;
      client.accounts.id.initialize({
        client_id:
          import.meta.env.VITE_GOOGLE_CLIENT_ID ||
          "your-google-client-id-here.apps.googleusercontent.com",
        callback: handleGoogleResponse,
      });
      container.innerHTML = "";
      client.accounts.id.renderButton(container, {
        theme: "outline",
        size: "large",
        width: container.clientWidth || 360,
        text: mode === "login" ? "signin_with" : "signup_with",
        shape: "rectangular",
      });
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const submit = async () => {
    if (mode === "signup") {
      const nameError = validateName(form.name);
      if (nameError) return toast.error(nameError);
    }
    const emailError = validateEmail(form.email);
    if (emailError) return toast.error(emailError);
    if (mode === "signup") {
      const passwordError = validatePassword(form.password);
      if (passwordError) return toast.error(passwordError);
    } else if (!form.password) {
      return toast.error("Please enter your password");
    }

    setIsLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const body =
        mode === "login"
          ? { email: form.email, password: form.password }
          : { name: form.name, email: form.email, password: form.password };
      const resp = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.detail || "Something went wrong");
      login({ token: data.token, user: data.user });
      toast.success(mode === "login" ? "Welcome back" : "Account created");
      onDone?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    }
    setIsLoading(false);
  };

  const submitForgot = async () => {
    const emailError = validateEmail(forgotEmail);
    if (emailError) return toast.error(emailError);
    const passwordError = validatePassword(newPassword);
    if (passwordError) return toast.error(passwordError);
    if (newPassword !== confirmPassword) return toast.error("Passwords do not match");

    setIsLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail, new_password: newPassword }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.detail || "Password reset failed");
      toast.success("Password reset. Please sign in with your new password.");
      setNewPassword("");
      setConfirmPassword("");
      setMode("login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Password reset failed");
    }
    setIsLoading(false);
  };

  const headings: Record<Mode, { title: string; sub: string }> = {
    login: { title: "Sign in", sub: "Access your damage reports and analysis history." },
    signup: { title: "Create account", sub: "Start analyzing phone-screen damage for free." },
    forgot: { title: "Reset password", sub: "Enter your email and choose a new password." },
  };

  return (
    <div>
      {mode !== "forgot" && (
        <div className="mb-6 inline-flex rounded-[var(--radius)] border border-border bg-secondary p-1">
          {(["login", "signup"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setMode(value);
                setForm({ name: "", email: "", password: "" });
              }}
              className={`rounded-[calc(var(--radius)-3px)] px-4 py-1.5 text-sm font-medium transition-colors ${
                mode === value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {value === "login" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>
      )}

      <h2 className="font-display text-2xl font-semibold text-foreground">{headings[mode].title}</h2>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">{headings[mode].sub}</p>

      {mode === "forgot" ? (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Email address</label>
            <input
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitForgot()}
              placeholder="you@email.com"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>New password</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitForgot()}
                placeholder="Create a strong password"
                className={`${inputClass} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <PasswordChecklist password={newPassword} />
          </div>
          <div>
            <label className={labelClass}>Confirm password</label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitForgot()}
                placeholder="Re-enter new password"
                className={`${inputClass} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={submitForgot}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
            Reset password
          </button>
          <button
            type="button"
            onClick={() => setMode("login")}
            className="w-full rounded-[var(--radius)] border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Back to sign in
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className={labelClass}>Full name</label>
              <input
                type="text"
                value={form.name}
                onChange={update("name")}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Your name"
                className={inputClass}
              />
            </div>
          )}
          <div>
            <label className={labelClass}>Email address</label>
            <input
              type="email"
              value={form.email}
              onChange={update("email")}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="you@email.com"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Password</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={form.password}
                onChange={update("password")}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder={mode === "signup" ? "Create a strong password" : "Your password"}
                className={`${inputClass} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {mode === "signup" && <PasswordChecklist password={form.password} />}
          </div>

          {mode === "login" && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(form.email);
                  setMode("forgot");
                }}
                className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Forgot password?
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
            {mode === "login" ? "Sign in" : "Create account"}
          </button>

          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div id="googleBtn" className="flex h-10 w-full justify-center overflow-hidden" />

          <p className="text-center text-xs text-muted-foreground">
            {mode === "login" ? "New here? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="font-medium text-foreground underline underline-offset-2"
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
