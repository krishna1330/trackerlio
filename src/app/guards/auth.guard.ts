import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

/**
 * Route guard that ensures only authenticated and active users can access protected routes.
 * Inactive (deactivated) users are immediately logged out and redirected to /home.
 */
export const authGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  // If already authenticated in memory, verify active status
  if (supabase.currentUser()) {
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

  // Check persistent session on reload
  try {
    const {
      data: { session },
    } = await supabase.client.auth.getSession();

    if (!session?.user) {
      router.navigate(['/home']);
      return false;
    }

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
    return true;
  } catch (err) {
    console.error('Error verifying auth status in authGuard:', err);
    router.navigate(['/home']);
    return false;
  }
};
