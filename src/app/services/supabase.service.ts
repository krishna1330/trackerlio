import { Injectable, signal, computed } from '@angular/core';
import {
  createClient,
  SupabaseClient,
  User,
  Session,
  SignInWithPasswordCredentials,
  SignUpWithPasswordCredentials,
} from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { Profile } from '../models/database.types';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient;

  // Reactive state signals for modern Angular
  readonly currentUser = signal<User | null>(null);
  readonly currentSession = signal<Session | null>(null);
  readonly currentProfile = signal<Profile | null>(null);

  /**
   * Only one admin:
   * Recognizes admin by role 'admin', metadata, or verified admin account (kmandiboyina@gmail.com)
   */
  readonly isAdmin = computed(() => {
    const user = this.currentUser();
    if (!user) return false;

    // Hardened check for the primary admin user
    if (user.email === 'kmandiboyina@gmail.com') return true;
    if (user.id === 'db0c53e7-6933-4fc7-a63f-08e0aa7e25d2') return true;

    // Profile database role
    const profile = this.currentProfile();
    if (profile?.role === 'admin') return true;

    // User metadata role
    if (user.user_metadata?.['role'] === 'admin') return true;

    return false;
  });

  readonly isUserActive = computed(() => {
    const profile = this.currentProfile();
    if (!profile) return true;
    return profile.is_active !== false;
  });

  constructor() {
    const sanitizedUrl = (environment.supabaseUrl || '')
      .replace(/\/rest\/v1\/?$/, '')
      .replace(/\/+$/, '');

    this.supabase = createClient(sanitizedUrl, environment.supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

    // Initialize current session, user and profile
    this.supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user?.id) {
        const profile = await this.loadUserProfile(session.user.id);
        if (profile && profile.is_active === false) {
          await this.signOut();
          this.currentSession.set(null);
          this.currentUser.set(null);
          this.currentProfile.set(null);
          return;
        }
        this.currentSession.set(session);
        this.currentUser.set(session.user);
      } else {
        this.currentSession.set(null);
        this.currentUser.set(null);
      }
    });

    // Listen to authentication changes
    this.supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user?.id) {
        const profile = await this.loadUserProfile(session.user.id);
        if (profile && profile.is_active === false) {
          await this.signOut();
          this.currentSession.set(null);
          this.currentUser.set(null);
          this.currentProfile.set(null);
          return;
        }
        this.currentSession.set(session);
        this.currentUser.set(session.user);
      } else {
        this.currentSession.set(null);
        this.currentUser.set(null);
        this.currentProfile.set(null);
      }
    });
  }

  /**
   * Fetch and update the active user's profile record.
   * If the user account is marked inactive (is_active === false),
   * terminates the active session immediately to prevent unauthorized access.
   */
  async loadUserProfile(userId: string): Promise<Profile | null> {
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        const profile = data as Profile;
        this.currentProfile.set(profile);

        if (profile.is_active === false) {
          // Inactive user! Terminate session immediately
          await this.signOut();
          this.currentSession.set(null);
          this.currentUser.set(null);
          this.currentProfile.set(null);
        }

        return profile;
      }
      return null;
    } catch (err) {
      console.error('Failed to load user profile in SupabaseService:', err);
      return null;
    }
  }

  /**
   * Create an isolated secondary Supabase client that will NOT touch or overwrite
   * the active user's session in localStorage.
   * Useful when an Admin creates a new user account without logging themselves out.
   */
  createSecondaryClient(): SupabaseClient {
    const sanitizedUrl = (environment.supabaseUrl || '')
      .replace(/\/rest\/v1\/?$/, '')
      .replace(/\/+$/, '');

    return createClient(sanitizedUrl, environment.supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  /**
   * Direct access to the raw Supabase client for queries, realtime, and storage
   */
  get client(): SupabaseClient {
    return this.supabase;
  }

  /**
   * Register a new user with email and password
   */
  async signUp(credentials: SignUpWithPasswordCredentials) {
    return this.supabase.auth.signUp(credentials);
  }

  /**
   * Sign in an existing user with email and password
   */
  async signInWithPassword(credentials: SignInWithPasswordCredentials) {
    return this.supabase.auth.signInWithPassword(credentials);
  }

  /**
   * Sign out the current user
   */
  async signOut() {
    return this.supabase.auth.signOut();
  }

  /**
   * Send password reset email
   */
  async resetPasswordForEmail(email: string, redirectTo?: string) {
    return this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
  }
}
