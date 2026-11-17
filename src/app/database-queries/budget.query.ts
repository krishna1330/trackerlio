import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../services/supabase.service';
import { Budget, Category, Expense } from '../models/database.types';

export interface CreateBudgetDTO {
  category_id: string;
  month: number;
  year: number;
  amount: number;
  is_active?: boolean;
}

export interface UpdateBudgetDTO {
  category_id?: string;
  month?: number;
  year?: number;
  amount?: number;
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
export class BudgetQueryService {
  private readonly supabase = inject(SupabaseService);

  /**
   * Fetch all budgets for a given year and month
   */
  async getBudgetsByMonth(
    year: number,
    month: number,
    onlyActive: boolean = true
  ): Promise<QueryListResult<Budget>> {
    try {
      let query = this.supabase.client
        .from('budgets')
        .select('*, categories(category_name)')
        .eq('year', year)
        .eq('month', month)
        .order('amount', { ascending: false });

      if (onlyActive) {
        query = query.or('is_active.is.null,is_active.eq.true');
      }

      const { data, error } = await query;

      if (error) {
        // Fallback without join if foreign key naming differs
        let fallbackQuery = this.supabase.client
          .from('budgets')
          .select('*')
          .eq('year', year)
          .eq('month', month)
          .order('amount', { ascending: false });

        if (onlyActive) {
          fallbackQuery = fallbackQuery.or('is_active.is.null,is_active.eq.true');
        }

        const { data: fallbackData, error: fallbackError } = await fallbackQuery;

        if (fallbackError) {
          return { data: [], count: 0, error: fallbackError.message };
        }

        const list = (fallbackData as Budget[]) || [];
        return { data: list, count: list.length, error: null };
      }

      const list = (data as Budget[]) || [];
      return { data: list, count: list.length, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve budgets';
      return { data: [], count: 0, error: message };
    }
  }

  /**
   * Fetch a single budget by ID
   */
  async getBudgetById(id: string): Promise<QueryResult<Budget>> {
    try {
      const { data, error } = await this.supabase.client
        .from('budgets')
        .select('*, categories(category_name)')
        .eq('id', id)
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: data as Budget, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch budget';
      return { data: null, error: message };
    }
  }

  /**
   * Create a new budget record
   */
  async createBudget(payload: CreateBudgetDTO): Promise<QueryResult<Budget>> {
    try {
      const currentUser = this.supabase.currentUser();

      // Check if a budget already exists for this category, month, and year
      const { data: existing } = await this.supabase.client
        .from('budgets')
        .select('id')
        .eq('category_id', payload.category_id)
        .eq('year', payload.year)
        .eq('month', payload.month)
        .or('is_active.is.null,is_active.eq.true')
        .maybeSingle();

      if (existing) {
        // Update existing budget amount instead of creating a duplicate
        return this.updateBudget(existing.id, { amount: payload.amount });
      }

      const insertData = {
        category_id: payload.category_id,
        year: payload.year,
        month: payload.month,
        amount: Number(payload.amount),
        is_active: payload.is_active ?? true,
        created_by: currentUser?.id,
        modified_by: currentUser?.id,
      };

      const { data, error } = await this.supabase.client
        .from('budgets')
        .insert(insertData)
        .select('*, categories(category_name)')
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: data as Budget, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create budget';
      return { data: null, error: message };
    }
  }

  /**
   * Update an existing budget record
   */
  async updateBudget(id: string, updates: UpdateBudgetDTO): Promise<QueryResult<Budget>> {
    try {
      const currentUser = this.supabase.currentUser();
      const updateData: Partial<Budget> = {
        ...updates,
        modified_by: currentUser?.id,
      };

      if (updates.amount !== undefined) {
        updateData.amount = Number(updates.amount);
      }

      const { data, error } = await this.supabase.client
        .from('budgets')
        .update(updateData)
        .eq('id', id)
        .select('*, categories(category_name)')
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: data as Budget, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update budget';
      return { data: null, error: message };
    }
  }

  /**
   * Delete a budget (soft delete or hard delete)
   */
  async deleteBudget(id: string, softDelete: boolean = true): Promise<{ success: boolean; error: string | null }> {
    try {
      if (softDelete) {
        const currentUser = this.supabase.currentUser();
        const { error } = await this.supabase.client
          .from('budgets')
          .update({ is_active: false, modified_by: currentUser?.id })
          .eq('id', id);

        if (error) {
          return { success: false, error: error.message };
        }
      } else {
        const { error } = await this.supabase.client
          .from('budgets')
          .delete()
          .eq('id', id);

        if (error) {
          return { success: false, error: error.message };
        }
      }

      return { success: true, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete budget';
      return { success: false, error: message };
    }
  }

  /**
   * Fetch user's categories for budget assignment.
   * Prioritizes categories created by current user ("his categories only"),
   * with fallback to accessible active categories.
   */
  async getUserCategories(): Promise<QueryListResult<Category>> {
    try {
      const currentUser = this.supabase.currentUser();

      if (currentUser?.id) {
        // First try to fetch categories created by the current user
        const { data: userCats, error: userCatsError } = await this.supabase.client
          .from('categories')
          .select('*')
          .eq('created_by', currentUser.id)
          .or('is_active.is.null,is_active.eq.true')
          .order('category_name', { ascending: true });

        if (!userCatsError && userCats && userCats.length > 0) {
          return { data: userCats as Category[], count: userCats.length, error: null };
        }
      }

      // Fallback: active categories visible under RLS
      const { data, error } = await this.supabase.client
        .from('categories')
        .select('*')
        .or('is_active.is.null,is_active.eq.true')
        .order('category_name', { ascending: true });

      if (error) {
        return { data: [], count: 0, error: error.message };
      }

      const list = (data as Category[]) || [];
      return { data: list, count: list.length, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve categories';
      return { data: [], count: 0, error: message };
    }
  }

  /**
   * Get total actual spent per category for a given month to compare with budget
   */
  async getCategorySpendingForMonth(year: number, month: number): Promise<Record<string, number>> {
    try {
      const paddedMonth = String(month).padStart(2, '0');
      const startDate = `${year}-${paddedMonth}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`;

      const { data, error } = await this.supabase.client
        .from('expenses')
        .select('category_id, amount')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate)
        .or('is_active.is.null,is_active.eq.true');

      if (error || !data) {
        return {};
      }

      const map: Record<string, number> = {};
      for (const item of data) {
        const catId = item.category_id;
        if (catId) {
          map[catId] = (map[catId] || 0) + Number(item.amount || 0);
        }
      }

      return map;
    } catch {
      return {};
    }
  }
}
