import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

/**
 * Route guard that ensures only the designated active administrator can access the Users route.
 * Inactive users or non-admin users are redirected to /home.
 */
export const adminGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  // If already authenticated and recognized as admin
  if (supabase.isAdmin()) {
    const profile = supabase.currentProfile();
    if (profile && profile.is_active === false) {
      await supabase.signOut();
      supabase.currentSession.set(null);
      supabase.currentUser.set(null);
      supabase.currentProfile.set(null);
      router.navigate(['/home']);
      return false;
    }
    return true;
  }

  // Ensure any pending session check resolves on cold page reload
  try {
    const {
      data: { session },
    } = await supabase.client.auth.getSession();

    if (session?.user) {
      const profile = await supabase.loadUserProfile(session.user.id);
      if (profile && profile.is_active === false) {
        await supabase.signOut();
        supabase.currentSession.set(null);
        supabase.currentUser.set(null);
        supabase.currentProfile.set(null);
        router.navigate(['/home']);
        return false;
      }

      supabase.currentSession.set(session);
      supabase.currentUser.set(session.user);

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
