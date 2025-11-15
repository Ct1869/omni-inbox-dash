import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';
import { MessageListSkeleton } from '@/components/skeletons/MessageListSkeleton';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * ProtectedRoute component ensures authentication before rendering child routes
 * Redirects to /auth if user is not authenticated
 * Uses Supabase session management for secure authentication checks
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Show loading state while checking authentication
  if (loading) {
    return <MessageListSkeleton />;
  }

  // Redirect to auth page if not authenticated
  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  // Render protected content
  return <>{children}</>;
}
