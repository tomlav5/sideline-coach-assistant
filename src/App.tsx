import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { Layout } from "@/components/layout/Layout";
import { LazyLoader } from "@/components/ui/lazy-loader";

// Lazy load pages for better performance
const Index = lazy(() => import("./pages/Index"));
const Teams = lazy(() => import("./pages/Teams"));
const Players = lazy(() => import("./pages/Players"));
const Fixtures = lazy(() => import("./pages/Fixtures"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ClubManagement = lazy(() => import("./pages/ClubManagement"));
const SquadSelection = lazy(() => import("./pages/SquadSelection"));
const MatchTracker = lazy(() => import("./pages/MatchTracker"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const FixtureDetail = lazy(() => import("./pages/FixtureDetail"));
const MatchReport = lazy(() => import("./pages/MatchReport"));

const App = () => (
  <ThemeProvider defaultTheme="dark" storageKey="sideline-theme">
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={
              <LazyLoader>
                <Auth />
              </LazyLoader>
            } />
            <Route path="/" element={
              <Layout>
                <LazyLoader>
                  <Index />
                </LazyLoader>
              </Layout>
            } />
            <Route path="/teams" element={
              <Layout>
                <LazyLoader>
                  <Teams />
                </LazyLoader>
              </Layout>
            } />
            <Route path="/players" element={
              <Layout>
                <LazyLoader>
                  <Players />
                </LazyLoader>
              </Layout>
            } />
            <Route path="/fixtures" element={
              <Layout>
                <LazyLoader>
                  <Fixtures />
                </LazyLoader>
              </Layout>
            } />
            <Route path="/fixture/:fixtureId" element={
              <Layout>
                <LazyLoader>
                  <FixtureDetail />
                </LazyLoader>
              </Layout>
            } />
            <Route path="/squad/:fixtureId" element={
              <Layout>
                <LazyLoader>
                  <SquadSelection />
                </LazyLoader>
              </Layout>
            } />
            <Route path="/match-day/:fixtureId" element={
              <Layout>
                <LazyLoader>
                  <MatchTracker />
                </LazyLoader>
              </Layout>
            } />
            <Route path="/reports" element={
              <Layout>
                <LazyLoader>
                  <Reports />
                </LazyLoader>
              </Layout>
            } />
            <Route path="/match-report/:fixtureId" element={
              <Layout>
                <LazyLoader>
                  <MatchReport />
                </LazyLoader>
              </Layout>
            } />
            <Route path="/settings" element={
              <Layout>
                <LazyLoader>
                  <Settings />
                </LazyLoader>
              </Layout>
            } />
            <Route path="/club-management" element={
              <Layout>
                <LazyLoader>
                  <ClubManagement />
                </LazyLoader>
              </Layout>
            } />
            <Route path="*" element={
              <LazyLoader>
                <NotFound />
              </LazyLoader>
            } />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </ThemeProvider>
);

export default App;
