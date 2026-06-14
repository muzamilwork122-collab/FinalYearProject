import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { PreferencesProvider } from "@/context/PreferencesContext";
import LoginModal from "@/components/auth/LoginModal";
import LocationModal from "@/components/LocationModal";
import Index from "./pages/Index";
import Features from "./pages/Features";
import Pricing from "./pages/Pricing";
import Dashboard from "./pages/Dashboard";
import Assistant from "./pages/Assistant";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Gate a route behind auth: bounce home and surface the login modal.
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, openLogin } = useAuth();
  useEffect(() => {
    if (!isAuthenticated) openLogin();
  }, [isAuthenticated, openLogin]);
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Legacy /login and /signup deep links: send home and open the modal.
function LoginRedirect() {
  const { openLogin } = useAuth();
  useEffect(() => {
    openLogin();
  }, [openLogin]);
  return <Navigate to="/" replace />;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/features" element={<Features />} />
    <Route path="/pricing" element={<Pricing />} />
    <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
    <Route path="/assistant" element={<RequireAuth><Assistant /></RequireAuth>} />
    <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
    <Route path="/login" element={<LoginRedirect />} />
    <Route path="/signup" element={<LoginRedirect />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <PreferencesProvider>
          <AuthProvider>
            <AppRoutes />
            <LoginModal />
            <LocationModal />
          </AuthProvider>
        </PreferencesProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
