import React, { Suspense } from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import AboutPage from "@/pages/about";
import AskPage from "@/pages/ask";  
import AuthPage from "@/pages/auth-page";
import LandingPage from "@/pages/landing-page";
import Dashboard from "@/pages/dashboard";
import ProfilePage from "@/pages/profile";
import HealthStatsPage from "@/pages/health-stats";
import SupplementHistory from "@/pages/supplement-history";
import TermsOfService from "@/pages/terms-of-service";
import PrivacyPolicy from "@/pages/privacy-policy";
import AdminSupplements from "@/pages/admin/supplements";
import AdminUsers from "@/pages/admin/users";
import CookieConsent from "@/components/cookie-consent";
import { useUser } from "@/hooks/use-user";
import { Loader2 } from "lucide-react";
import LearnPage from "./pages/learn";
import BlogPostPage from "./pages/learn/[slug]";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import SubscriptionPage from "@/pages/subscription-page";
import PaymentSuccessPage from "@/pages/payment-success";
import Research from "./pages/research";
import Labs from "./pages/labs";
import Genetics from "./pages/genetics";

/**
 * AdminRoute Component
 * Higher-order component that protects admin-only routes
 * Checks for user authentication and admin status before rendering
 */
function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect to NotFound if user is not an admin
  if (!user?.isAdmin) {
    return <NotFound />;
  }

  return <Component />;
}

/**
 * AppRouter Component
 * Handles application routing and authentication logic
 * Manages three types of routes:
 * 1. Public routes (accessible to all users)
 * 2. Authentication routes (login/signup)
 * 3. Protected routes (require authentication)
 */
function AppRouter() {
  const { user, isLoading } = useUser();
  const [location] = useLocation();

  // Show loading spinner while checking authentication status
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Define routes that should be accessible without authentication
  const isPublicRoute = [
    "/terms-of-service",
    "/privacy-policy",
    "/about",
    "/learn",
    "/ask",
    "/research",
    "/contact",
    location.startsWith("/learn/") ? location : null,
    location.startsWith("/research/") ? location : null
  ].filter(Boolean).includes(location);

  // Always render public routes regardless of authentication status
  // This ensures legal pages and learn section are always accessible
  if (isPublicRoute) {
    return (
      <Switch>
        <Route path="/terms-of-service" component={TermsOfService} />
        <Route path="/privacy-policy" component={PrivacyPolicy} />
        <Route path="/about" component={AboutPage} />
        <Route path="/learn" component={LearnPage} />
        <Route path="/learn/:slug" component={BlogPostPage} />
        <Route path="/ask" component={AskPage} />
        <Route path="/contact">
          <ErrorBoundary>
            <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
              {React.createElement(React.lazy(() => import("@/pages/contact")))}
            </React.Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/research">
          <ErrorBoundary>
            <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
              {React.createElement(React.lazy(() => import("@/pages/research")))}
            </React.Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/research/:slug">
          <ErrorBoundary>
            <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
              {React.createElement(React.lazy(() => import("@/pages/research/[slug]")))}
            </React.Suspense>
          </ErrorBoundary>
        </Route>
      </Switch>
    );
  }

  // Show landing page or auth page for non-authenticated users
  if (!user) {
    return (
      <Switch>
        <Route path="/subscription" component={SubscriptionPage} />
        <Route path="/payment-success" component={PaymentSuccessPage} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/" component={LandingPage} />
        <Route component={LandingPage} />
      </Switch>
    );
  }

  // Protected routes for authenticated users
  return (
    <Switch>
      <Route path="/subscription" component={SubscriptionPage} />
      <Route path="/payment-success" component={PaymentSuccessPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/health-stats" component={HealthStatsPage} />
      <Route path="/supplement-history" component={SupplementHistory} />
      <Route path="/research" component={React.lazy(() => import("@/pages/research"))} />
      <Route path="/research/:slug" component={React.lazy(() => import("@/pages/research/[slug]"))} />
      <Route path="/labs" component={Labs} />
      <Route path="/genetics" component={Genetics} />
      <Route path="/" component={Dashboard} />
      {/* Admin routes with lazy loading for better performance */}
      <Route path="/admin" component={(props) => {
        const AdminDashboard = React.lazy(() => import("@/pages/admin"));
        return (
          <AdminRoute 
            component={() => (
              <ErrorBoundary>
                <React.Suspense fallback={<div>Loading...</div>}>
                  <AdminDashboard />
                </React.Suspense>
              </ErrorBoundary>
            )} 
            {...props} 
          />
        );
      }} />
      <Route path="/admin/supplements" component={(props) => <AdminRoute component={AdminSupplements} {...props} />} />
      <Route path="/admin/users" component={(props) => <AdminRoute component={AdminUsers} {...props} />} />
      <Route path="/admin/blog" component={(props) => {
        const AdminBlog = React.lazy(() => import("@/pages/admin/blog"));
        return (
          <AdminRoute 
            component={() => (
              <ErrorBoundary>
                <React.Suspense fallback={<div>Loading...</div>}>
                  <AdminBlog />
                </React.Suspense>
              </ErrorBoundary>
            )} 
            {...props} 
          />
        );
      }} />
      <Route path="/learn" component={LearnPage} />
      <Route path="/learn/:slug" component={BlogPostPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

/**
 * Main App Component
 * Initializes core application providers and renders the router
 */
function App() {
  return (
    <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <AppRouter />
        </ErrorBoundary>
        <CookieConsent />
        <Toaster />
    </QueryClientProvider>
  );
}

export default App;
