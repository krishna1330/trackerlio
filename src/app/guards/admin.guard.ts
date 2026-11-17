import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

/**
 * Route guard that ensures only the designated administrator can access the Users route.
 * Non-admin users are redirected to /expenses.
 */
export const adminGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  // If already authenticated and recognized as admin
  if (supabase.isAdmin()) {
    return true;
  }

  // Ensure any pending session check resolves on cold page reload
  try {
    const {
      data: { session },
    } = await supabase.client.auth.getSession();

    if (session?.user) {
      supabase.currentSession.set(session);
      supabase.currentUser.set(session.user);
      await supabase.loadUserProfile(session.user.id);

      if (supabase.isAdmin()) {
        return true;
      }
    }
  } catch (err) {
    console.error('Error verifying admin session in adminGuard:', err);
  }

  // Not authorized - redirect to home
  router.navigate(['/home']);
  return false;
};
