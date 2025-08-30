import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { Layout } from "@/components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import Teams from "./pages/Teams";
import Players from "./pages/Players";
import Fixtures from "./pages/Fixtures";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import ClubManagement from "./pages/ClubManagement";
import SquadSelection from "./pages/SquadSelection";
import MatchDay from "./pages/MatchDay";
import Reports from "./pages/Reports";

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
              <Route path="/" element={<Layout><Dashboard /></Layout>} />
              <Route path="/teams" element={<Layout><Teams /></Layout>} />
              <Route path="/players" element={<Layout><Players /></Layout>} />
              <Route path="/fixtures" element={<Layout><Fixtures /></Layout>} />
              <Route path="/squad/:fixtureId" element={<Layout><SquadSelection /></Layout>} />
              <Route path="/match/:fixtureId" element={<Layout><MatchDay /></Layout>} />
              <Route path="/match" element={<Layout><div className="p-6"><h1 className="text-2xl font-bold">Match Day - Coming Soon</h1></div></Layout>} />
              <Route path="/reports" element={<Layout><Reports /></Layout>} />
              <Route path="/settings" element={<Layout><div className="p-6"><h1 className="text-2xl font-bold">Settings - Coming Soon</h1></div></Layout>} />
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
