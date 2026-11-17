import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../services/supabase.service';
import { Profile } from '../models/database.types';

export interface CreateUserDTO {
  email: string;
  password: string;
  first_name: string;
  last_name?: string;
  is_active?: boolean;
}

export interface UpdateProfileDTO {
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
}

export interface QueryResult<T> {
  data: T | null;
  error: string | null;
}

export interface QueryListResult<T> {
  data: T[];
  count: number;
  error: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class UserQueryService {
  private readonly supabase = inject(SupabaseService);
  private readonly EMAIL_CACHE_KEY = 'trackerlio_user_emails';

  /**
   * Cache user email in localStorage for persistent display
   */
  cacheUserEmail(userId: string, email: string): void {
    try {
      const raw = localStorage.getItem(this.EMAIL_CACHE_KEY);
      const map: Record<string, string> = raw ? JSON.parse(raw) : {};
      map[userId] = email;
      localStorage.setItem(this.EMAIL_CACHE_KEY, JSON.stringify(map));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Retrieve cached user email
   */
  getCachedUserEmail(userId: string): string | null {
    try {
      const raw = localStorage.getItem(this.EMAIL_CACHE_KEY);
      if (!raw) return null;
      const map: Record<string, string> = JSON.parse(raw);
      return map[userId] || null;
    } catch {
      return null;
    }
  }

  /**
   * Fetch all user profiles from Supabase.
   */
  async getProfiles(): Promise<QueryListResult<Profile>> {
    try {
      const { data, error } = await this.supabase.client
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return { data: [], count: 0, error: error.message };
      }

      const currentUser = this.supabase.currentUser();

      // Ensure email is populated from auth user, profile, or cached storage
      const list: Profile[] = (data || []).map((item: Profile) => {
        let email = item.email;
        if (!email && currentUser && currentUser.id === item.id) {
          email = currentUser.email;
        }
        if (!email) {
          email = this.getCachedUserEmail(item.id);
        }
        return {
          ...item,
          email: email || 'No email synced',
        };
      });

      return { data: list, count: list.length, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve user profiles';
      return { data: [], count: 0, error: msg };
    }
  }

  /**
   * Create a new user account.
   * Uses an isolated secondary Supabase client to register the auth credentials
   * so the currently logged-in Admin is NEVER logged out.
   * Then creates/upserts the profile record with role='user'.
   */
  async createUser(payload: CreateUserDTO): Promise<QueryResult<Profile>> {
    try {
      const adminUser = this.supabase.currentUser();
      const tempClient = this.supabase.createSecondaryClient();

      const email = payload.email.trim();
      const firstName = payload.first_name.trim();
      const lastName = (payload.last_name || '').trim();
      const isActive = payload.is_active ?? true;

      // 1. Sign up user via secondary client auth
      const { data: authData, error: authError } = await tempClient.auth.signUp({
        email,
        password: payload.password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            role: 'user', // strictly regular user; only 1 admin
          },
        },
      });

      if (authError) {
        // Clear and actionable explanation if Supabase rate-limits confirmation emails
        if (
          authError.message?.toLowerCase().includes('rate limit') ||
          (authError as any).code === 'over_email_send_rate_limit'
        ) {
          return {
            data: null,
            error:
              'Email rate limit exceeded: Supabase limits confirmation emails to 3 per hour. To fix this permanently: In your Supabase Dashboard, go to Authentication > Providers > Email, and turn OFF "Confirm email".',
          };
        }
        return { data: null, error: authError.message };
      }

      const newUserId = authData?.user?.id;
      if (!newUserId) {
        return {
          data: null,
          error: 'User created in auth, but user identifier was not returned by Supabase.',
        };
      }

      // Cache email mapping for display
      this.cacheUserEmail(newUserId, email);

      // 2. Ensure profile record is inserted/upserted in public.profiles
      // Note: 'email' column does not exist in public.profiles, so we omit it from the payload
      const nowIso = new Date().toISOString();
      const profileData: Partial<Profile> = {
        id: newUserId,
        first_name: firstName,
        last_name: lastName,
        role: 'user',
        is_active: isActive,
        created_at: nowIso,
        modified_at: nowIso,
      };

      if (adminUser?.id) {
        profileData.created_by = adminUser.id;
        profileData.modified_by = adminUser.id;
      }

      const { data: upsertData, error: profileError } = await this.supabase.client
        .from('profiles')
        .upsert(profileData)
        .select('*')
        .maybeSingle();

      const upserted = upsertData as Profile | null;
      const resolvedProfile: Profile = upserted
        ? { ...upserted, email }
        : {
            id: newUserId,
            first_name: firstName,
            last_name: lastName,
            email,
            role: 'user',
            is_active: isActive,
            created_at: nowIso,
            created_by: adminUser?.id || '',
            modified_at: nowIso,
            modified_by: adminUser?.id || '',
          };

      if (profileError) {
        console.warn('Profile upsert warning:', profileError);
      }

      return {
        data: resolvedProfile,
        error: null,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create user account';
      return { data: null, error: msg };
    }
  }

  /**
   * Toggle a user's active/inactive status.
   * Updates `is_active` in the profiles table.
   */
  async toggleUserActive(userId: string, isActive: boolean): Promise<QueryResult<Profile>> {
    try {
      const adminUser = this.supabase.currentUser();
      const nowIso = new Date().toISOString();

      const updates: Record<string, unknown> = {
        is_active: isActive,
        modified_at: nowIso,
      };

      if (adminUser?.id) {
        updates['modified_by'] = adminUser.id;
      }

      const { data, error } = await this.supabase.client
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select('*')
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: data as Profile, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update user active status';
      return { data: null, error: msg };
    }
  }

  /**
   * Update profile details (first_name, last_name, is_active)
   */
  async updateProfile(userId: string, updates: UpdateProfileDTO): Promise<QueryResult<Profile>> {
    try {
      const adminUser = this.supabase.currentUser();
      const payload: Record<string, unknown> = {
        modified_at: new Date().toISOString(),
      };

      if (updates.first_name !== undefined) payload['first_name'] = updates.first_name.trim();
      if (updates.last_name !== undefined) payload['last_name'] = updates.last_name.trim();
      if (updates.is_active !== undefined) payload['is_active'] = updates.is_active;
      if (adminUser?.id) payload['modified_by'] = adminUser.id;

      const { data, error } = await this.supabase.client
        .from('profiles')
        .update(payload)
        .eq('id', userId)
        .select('*')
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: data as Profile, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile';
      return { data: null, error: msg };
    }
  }
}
