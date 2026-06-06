import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Features from "./pages/Features";
import Pricing from "./pages/Pricing";
import NotFound from "./pages/NotFound";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";

const queryClient = new QueryClient();

// ── Protected route — redirects to /login if not logged in ────────────────
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem("token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

// ── Auth route — redirects to / if already logged in ─────────────────────
const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem("token");
  if (token) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};
// Auto-logout after 24 hours
const loginTime = localStorage.getItem("login_time");
if (loginTime) {
  const hours = (Date.now() - parseInt(loginTime)) / (1000 * 60);
  if (hours > 2) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("login_time");
  }
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Auth pages — redirect to home if already logged in */}
          <Route path="/login"  element={<AuthRoute><AuthPage /></AuthRoute>} />
          <Route path="/signup" element={<AuthRoute><AuthPage /></AuthRoute>} />


          {/* Protected pages — redirect to login if not logged in */}
          <Route path="/" element={
            <ProtectedRoute><Index /></ProtectedRoute>
          } />
          <Route path="/features" element={
            <ProtectedRoute><Features /></ProtectedRoute>
          } />
          <Route path="/pricing" element={
            <ProtectedRoute><Pricing /></ProtectedRoute>
          } />

          <Route path="*" element={<NotFound />} />
         <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;