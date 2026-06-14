import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ScanLine, X } from "lucide-react";
import AuthForm from "./AuthForm";
import { useAuth } from "@/context/AuthContext";

/** Global sign-in modal. Opened by `openLogin()` / `requireAuth()` from anywhere. */
export default function LoginModal() {
  const { loginModalOpen, closeLogin } = useAuth();

  useEffect(() => {
    if (!loginModalOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeLogin();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [loginModalOpen, closeLogin]);

  return createPortal(
    <AnimatePresence>
      {loginModalOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
            onClick={closeLogin}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            className="surface relative z-10 w-full max-w-[420px] p-7 shadow-2xl shadow-foreground/10"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <button
              type="button"
              onClick={closeLogin}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-6 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius)] bg-accent text-accent-foreground">
                <ScanLine className="h-4 w-4" />
              </span>
              <span className="font-display text-sm font-semibold tracking-tight">ScreenScan</span>
            </div>

            <AuthForm onDone={closeLogin} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
