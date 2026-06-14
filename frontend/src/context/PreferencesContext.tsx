import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Theme = "light" | "dark";

const THEME_KEY = "theme";

interface PreferencesContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  /** Format a PKR amount for display. All costs are in PKR. */
  formatMoney: (amountPkr: number) => string;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function readTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "dark") return "dark";
  return "light";
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readTheme());

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggleTheme = useCallback(() => setThemeState((prev) => (prev === "dark" ? "light" : "dark")), []);

  const formatMoney = useCallback((amountPkr: number) => {
    const safe = Number.isFinite(amountPkr) ? amountPkr : 0;
    return `₨ ${Math.round(safe).toLocaleString("en-PK")}`;
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({ theme, setTheme, toggleTheme, formatMoney }),
    [theme, setTheme, toggleTheme, formatMoney],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return ctx;
}
