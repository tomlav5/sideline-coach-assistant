import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { Layout } from "@/components/layout/Layout";
import Index from "./pages/Index";
import Teams from "./pages/Teams";
import Players from "./pages/Players";
import Fixtures from "./pages/Fixtures";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import ClubManagement from "./pages/ClubManagement";
import SquadSelection from "./pages/SquadSelection";
import MatchTracker from "./pages/MatchTracker";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import FixtureDetail from "./pages/FixtureDetail";
import MatchReport from "./pages/MatchReport";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="sideline-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<Layout><Index /></Layout>} />
              <Route path="/teams" element={<Layout><Teams /></Layout>} />
              <Route path="/players" element={<Layout><Players /></Layout>} />
              <Route path="/fixtures" element={<Layout><Fixtures /></Layout>} />
              <Route path="/fixture/:fixtureId" element={<Layout><FixtureDetail /></Layout>} />
              <Route path="/squad/:fixtureId" element={<Layout><SquadSelection /></Layout>} />
              <Route path="/match-day/:fixtureId" element={<Layout><MatchTracker /></Layout>} />
              <Route path="/reports" element={<Layout><Reports /></Layout>} />
              <Route path="/match-report/:fixtureId" element={<Layout><MatchReport /></Layout>} />
              <Route path="/settings" element={<Layout><Settings /></Layout>} />
              <Route path="/club-management" element={<Layout><ClubManagement /></Layout>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
