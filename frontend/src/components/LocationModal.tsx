import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, MapPin, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

// Remember a dismissal for the session so we don't nag on every navigation.
const DISMISS_KEY = "location_prompt_dismissed";

/**
 * Global prompt shown to signed-in users whose browser location is not yet
 * granted. "Allow" triggers the native permission prompt; if location is
 * blocked, we guide the user to re-enable it from the browser's site settings.
 */
export default function LocationModal() {
  const { isAuthenticated } = useAuth();

  const [open, setOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setOpen(false);
      return;
    }
    if (!("geolocation" in navigator)) return;
    if (sessionStorage.getItem(DISMISS_KEY)) return;

    let cancelled = false;

    const evaluate = async () => {
      try {
        if (navigator.permissions?.query) {
          const status = await navigator.permissions.query({ name: "geolocation" });
          if (cancelled) return;
          if (status.state === "granted") {
            setOpen(false);
            return;
          }
          setBlocked(status.state === "denied");
          setOpen(true);
          status.onchange = () => {
            if (status.state === "granted") setOpen(false);
          };
        } else {
          // No Permissions API (older Safari) — offer the prompt anyway.
          setOpen(true);
        }
      } catch {
        if (!cancelled) setOpen(true);
      }
    };

    evaluate();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const dismiss = useCallback(() => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  }, []);

  const allow = useCallback(() => {
    if (!navigator.geolocation) {
      dismiss();
      return;
    }
    setRequesting(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        setRequesting(false);
        setOpen(false);
      },
      (error) => {
        setRequesting(false);
        if (error.code === error.PERMISSION_DENIED) {
          setBlocked(true);
        } else {
          dismiss();
        }
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [dismiss]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, dismiss]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]" onClick={dismiss} />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="location-modal-title"
            className="surface relative z-10 w-full max-w-[420px] p-7 shadow-2xl shadow-foreground/10"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <button
              type="button"
              onClick={dismiss}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
              <MapPin className="h-6 w-6" />
            </span>

            <h2 id="location-modal-title" className="mt-5 font-display text-xl font-bold tracking-tight text-foreground">
              Enable location access
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              ScreenScan uses your location to find mobile-repair shops near you and keep cost
              estimates relevant. Your location stays in your browser — it's only used to search
              nearby shops.
            </p>

            {blocked && (
              <div className="mt-4 rounded-[var(--radius)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground">
                Location is currently blocked for this site. Click the location icon in your
                browser's address bar, allow access, then reload the page.
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={dismiss}
                className="flex-1 rounded-[var(--radius)] border border-border px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                Not now
              </button>
              {blocked ? (
                <button type="button" onClick={() => window.location.reload()} className="btn-primary flex-1">
                  Reload page
                </button>
              ) : (
                <button type="button" onClick={allow} disabled={requesting} className="btn-primary flex-1 disabled:opacity-60">
                  {requesting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                  Allow location
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
