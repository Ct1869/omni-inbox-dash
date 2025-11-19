import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import { MessageListSkeleton } from "@/components/skeletons/MessageListSkeleton";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const GmailView = lazy(() => import("./pages/GmailView"));
const OutlookView = lazy(() => import("./pages/OutlookView"));
const GmailInbox = lazy(() => import("./pages/GmailInbox"));
const OutlookInbox = lazy(() => import("./pages/OutlookInbox"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<MessageListSkeleton />}>
            <Routes>
              <Route path="/" element={<Navigate to="/auth" replace />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/dashboard/gmail" element={
                <ProtectedRoute>
                  <GmailInbox />
                </ProtectedRoute>
              } />
              <Route path="/dashboard/outlook" element={
                <ProtectedRoute>
                  <OutlookInbox />
                </ProtectedRoute>
              } />
              <Route path="/dashboard/gmail/:accountId" element={
                <ProtectedRoute>
                  <GmailView />
                </ProtectedRoute>
              } />
              <Route path="/dashboard/outlook/:accountId" element={
                <ProtectedRoute>
                  <OutlookView />
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
