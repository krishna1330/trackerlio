import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../services/supabase.service';
import { Account } from '../models/database.types';

export interface CreateAccountDTO {
  account_name: string;
  available_balance: number;
  is_credit_card?: boolean;
  is_active?: boolean;
}

export interface UpdateAccountDTO {
  account_name?: string;
  available_balance?: number;
  is_credit_card?: boolean;
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
export class AccountQueryService {
  private readonly supabase = inject(SupabaseService);

  /**
   * Fetch all accounts (active and optionally inactive)
   */
  async getAccounts(includeInactive: boolean = true): Promise<QueryListResult<Account>> {
    try {
      let query = this.supabase.client
        .from('accounts')
        .select('*')
        .order('account_name', { ascending: true });

      if (!includeInactive) {
        query = query.or('is_active.is.null,is_active.eq.true');
      }

      const { data, error } = await query;

      if (error) {
        return { data: [], count: 0, error: error.message };
      }

      const list = (data as Account[]) || [];
      return { data: list, count: list.length, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve accounts';
      return { data: [], count: 0, error: message };
    }
  }

  /**
   * Fetch single account by ID
   */
  async getAccountById(id: string): Promise<QueryResult<Account>> {
    try {
      const { data, error } = await this.supabase.client
        .from('accounts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: data as Account, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch account';
      return { data: null, error: message };
    }
  }

  /**
   * Create a new account
   */
  async createAccount(payload: CreateAccountDTO): Promise<QueryResult<Account>> {
    try {
      const currentUser = this.supabase.currentUser();
      const insertData = {
        account_name: payload.account_name.trim(),
        available_balance: Number(payload.available_balance || 0),
        is_credit_card: payload.is_credit_card ?? false,
        is_active: payload.is_active ?? true,
        created_by: currentUser?.id,
        modified_by: currentUser?.id,
      };

      const { data, error } = await this.supabase.client
        .from('accounts')
        .insert(insertData)
        .select('*')
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: data as Account, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create account';
      return { data: null, error: message };
    }
  }

  /**
   * Update an existing account
   */
  async updateAccount(id: string, updates: UpdateAccountDTO): Promise<QueryResult<Account>> {
    try {
      const currentUser = this.supabase.currentUser();
      const updateData: Partial<Account> = {
        ...updates,
        modified_by: currentUser?.id,
      };

      if (updates.account_name !== undefined) {
        updateData.account_name = updates.account_name.trim();
      }
      if (updates.available_balance !== undefined) {
        updateData.available_balance = Number(updates.available_balance);
      }

      const { data, error } = await this.supabase.client
        .from('accounts')
        .update(updateData)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: data as Account, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update account';
      return { data: null, error: message };
    }
  }

  /**
   * Delete an account (soft delete by setting is_active = false, or permanent hard delete)
   */
  async deleteAccount(id: string, softDelete: boolean = true): Promise<{ success: boolean; error: string | null }> {
    try {
      if (softDelete) {
        const currentUser = this.supabase.currentUser();
        const { error } = await this.supabase.client
          .from('accounts')
          .update({ is_active: false, modified_by: currentUser?.id })
          .eq('id', id);

        if (error) {
          return { success: false, error: error.message };
        }
      } else {
        const { error } = await this.supabase.client
          .from('accounts')
          .delete()
          .eq('id', id);

        if (error) {
          return { success: false, error: error.message };
        }
      }

      return { success: true, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete account';
      return { success: false, error: message };
    }
  }
}
