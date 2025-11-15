import { supabase } from '@/integrations/supabase/client';

/**
 * Get the current user session
 * Uses Supabase's secure httpOnly cookie storage
 */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Get the current authenticated user
 * Uses Supabase's secure httpOnly cookie storage
 */
export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Get user role from metadata
 * Roles should be stored in a separate user_roles table for proper security
 */
export async function getUserRole() {
  const user = await getUser();
  return user?.user_metadata?.role;
}
