import { createContext, useCallback, useContext, useMemo, useState } from "react";

const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface AuthUser {
  id?: string;
  name?: string;
  email?: string;
  [key: string]: unknown;
}

interface LoginPayload {
  token: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loginModalOpen: boolean;
  login: (payload: LoginPayload) => void;
  logout: () => void;
  /** Merge fields into the stored user (e.g. after a profile update). */
  updateUser: (patch: Partial<AuthUser>) => void;
  openLogin: () => void;
  closeLogin: () => void;
  /** Runs `action` if signed in; otherwise opens the login modal. */
  requireAuth: (action: () => void) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem("user");
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function isSessionExpired(): boolean {
  const loginTime = localStorage.getItem("login_time");
  if (!loginTime) return false;
  return Date.now() - parseInt(loginTime, 10) > SESSION_MAX_AGE_MS;
}

/**
 * Read the persisted session synchronously. Clears an expired session.
 * Resolving this on the first render (instead of inside an effect) avoids a
 * window where a logged-in user appears signed out — which would otherwise
 * pop the login modal on auth-gated actions during initial load.
 */
function loadStoredSession(): { token: string | null; user: AuthUser | null } {
  if (isSessionExpired()) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("login_time");
    return { token: null, user: null };
  }
  return { token: localStorage.getItem("token"), user: readStoredUser() };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => loadStoredSession().token);
  const [user, setUser] = useState<AuthUser | null>(() => loadStoredSession().user);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  const login = useCallback(({ token: nextToken, user: nextUser }: LoginPayload) => {
    localStorage.setItem("token", nextToken);
    localStorage.setItem("user", JSON.stringify(nextUser));
    localStorage.setItem("login_time", Date.now().toString());
    setToken(nextToken);
    setUser(nextUser);
    setLoginModalOpen(false);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("login_time");
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setUser((prev) => {
      const next = { ...(prev ?? {}), ...patch };
      localStorage.setItem("user", JSON.stringify(next));
      return next;
    });
  }, []);

  const openLogin = useCallback(() => setLoginModalOpen(true), []);
  const closeLogin = useCallback(() => setLoginModalOpen(false), []);

  const requireAuth = useCallback(
    (action: () => void) => {
      if (token) {
        action();
        return;
      }
      setLoginModalOpen(true);
    },
    [token],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token),
      loginModalOpen,
      login,
      logout,
      updateUser,
      openLogin,
      closeLogin,
      requireAuth,
    }),
    [user, token, loginModalOpen, login, logout, updateUser, openLogin, closeLogin, requireAuth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
