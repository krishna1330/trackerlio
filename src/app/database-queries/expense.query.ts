import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../services/supabase.service';
import { Expense, Category, Account } from '../models/database.types';

export interface CreateExpenseDTO {
  expense_name: string;
  amount: number;
  expense_date?: string;
  category_id: string;
  account_id: string;
  comments?: string | null;
  is_active?: boolean;
}

export interface UpdateExpenseDTO {
  expense_name?: string;
  amount?: number;
  expense_date?: string;
  category_id?: string;
  account_id?: string;
  comments?: string | null;
  is_active?: boolean;
}

export interface ExpenseFilterOptions {
  categoryId?: string;
  accountId?: string;
  onlyActive?: boolean;
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

export interface MonthlyExpenseSummary {
  total: number;
  count: number;
  average: number;
}

@Injectable({
  providedIn: 'root',
})
export class ExpenseQueryService {
  private readonly supabase = inject(SupabaseService);

  /**
   * Helper to compute start & end ISO dates for a given year & month (1-12)
   */
  private getMonthDateBounds(year: number, month: number): { startDate: string; endDate: string } {
    const paddedMonth = String(month).padStart(2, '0');
    const startDate = `${year}-${paddedMonth}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`;
    return { startDate, endDate };
  }

  /**
   * Fetch expenses for a specific year and month, including related category and account details.
   */
  async getExpensesByMonth(
    year: number,
    month: number,
    options: ExpenseFilterOptions = { onlyActive: true }
  ): Promise<QueryListResult<Expense>> {
    const { startDate, endDate } = this.getMonthDateBounds(year, month);

    try {
      // Primary query: attempts to join categories and accounts tables
      let query = this.supabase.client
        .from('expenses')
        .select('*, categories(category_name), accounts(account_name)')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate)
        .order('expense_date', { ascending: false });

      if (options.onlyActive) {
        query = query.or('is_active.is.null,is_active.eq.true');
      }

      if (options.categoryId) {
        query = query.eq('category_id', options.categoryId);
      }

      if (options.accountId) {
        query = query.eq('account_id', options.accountId);
      }

      const { data, error } = await query;

      if (error) {
        // Fallback: If joined table query encounters a relation naming mismatch, execute direct select
        let fallbackQuery = this.supabase.client
          .from('expenses')
          .select('*')
          .gte('expense_date', startDate)
          .lte('expense_date', endDate)
          .order('expense_date', { ascending: false });

        if (options.onlyActive) {
          fallbackQuery = fallbackQuery.or('is_active.is.null,is_active.eq.true');
        }

        if (options.categoryId) {
          fallbackQuery = fallbackQuery.eq('category_id', options.categoryId);
        }

        if (options.accountId) {
          fallbackQuery = fallbackQuery.eq('account_id', options.accountId);
        }

        const { data: fallbackData, error: fallbackError } = await fallbackQuery;

        if (fallbackError) {
          return { data: [], count: 0, error: fallbackError.message };
        }

        const list = (fallbackData as Expense[]) || [];
        return { data: list, count: list.length, error: null };
      }

      const list = (data as Expense[]) || [];
      return { data: list, count: list.length, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown database error occurred';
      return { data: [], count: 0, error: message };
    }
  }

  /**
   * Retrieve a single expense by ID
   */
  async getExpenseById(id: string): Promise<QueryResult<Expense>> {
    try {
      const { data, error } = await this.supabase.client
        .from('expenses')
        .select('*, categories(category_name), accounts(account_name)')
        .eq('id', id)
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: data as Expense, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve expense';
      return { data: null, error: message };
    }
  }

  /**
   * Create a new expense record
   */
  async createExpense(expense: CreateExpenseDTO): Promise<QueryResult<Expense>> {
    try {
      const currentUser = this.supabase.currentUser();
      const payload: Partial<Expense> = {
        ...expense,
        is_active: expense.is_active ?? true,
        created_by: currentUser?.id,
        modified_by: currentUser?.id,
      };

      const { data, error } = await this.supabase.client
        .from('expenses')
        .insert(payload)
        .select('*, categories(category_name), accounts(account_name)')
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: data as Expense, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create expense';
      return { data: null, error: message };
    }
  }

  /**
   * Update an existing expense by ID
   */
  async updateExpense(id: string, updates: UpdateExpenseDTO): Promise<QueryResult<Expense>> {
    try {
      const currentUser = this.supabase.currentUser();
      const payload: Partial<Expense> = {
        ...updates,
        modified_by: currentUser?.id,
      };

      const { data, error } = await this.supabase.client
        .from('expenses')
        .update(payload)
        .eq('id', id)
        .select('*, categories(category_name), accounts(account_name)')
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: data as Expense, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update expense';
      return { data: null, error: message };
    }
  }

  /**
   * Delete an expense (supports soft-delete by default or permanent removal)
   */
  async deleteExpense(id: string, softDelete: boolean = true): Promise<{ success: boolean; error: string | null }> {
    try {
      if (softDelete) {
        const { error } = await this.supabase.client
          .from('expenses')
          .update({ is_active: false })
          .eq('id', id);

        if (error) {
          return { success: false, error: error.message };
        }
      } else {
        const { error } = await this.supabase.client
          .from('expenses')
          .delete()
          .eq('id', id);

        if (error) {
          return { success: false, error: error.message };
        }
      }

      return { success: true, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete expense';
      return { success: false, error: message };
    }
  }

  /**
   * Fetch all expenses under a specific category
   */
  async getExpensesByCategory(categoryId: string): Promise<QueryListResult<Expense>> {
    try {
      const { data, error } = await this.supabase.client
        .from('expenses')
        .select('*, categories(category_name), accounts(account_name)')
        .eq('category_id', categoryId)
        .or('is_active.is.null,is_active.eq.true')
        .order('expense_date', { ascending: false });

      if (error) {
        const { data: fallbackData, error: fallbackError } = await this.supabase.client
          .from('expenses')
          .select('*')
          .eq('category_id', categoryId)
          .or('is_active.is.null,is_active.eq.true')
          .order('expense_date', { ascending: false });

        if (fallbackError) {
          return { data: [], count: 0, error: fallbackError.message };
        }
        const fallbackList = (fallbackData as Expense[]) || [];
        return { data: fallbackList, count: fallbackList.length, error: null };
      }

      const list = (data as Expense[]) || [];
      return { data: list, count: list.length, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch expenses by category';
      return { data: [], count: 0, error: message };
    }
  }

  /**
   * Get all active categories for dropdowns/filters
   */
  async getCategories(): Promise<QueryListResult<Category>> {
    try {
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
      const message = err instanceof Error ? err.message : 'Failed to fetch categories';
      return { data: [], count: 0, error: message };
    }
  }

  /**
   * Get all active accounts for dropdowns/filters
   */
  async getAccounts(): Promise<QueryListResult<Account>> {
    try {
      const { data, error } = await this.supabase.client
        .from('accounts')
        .select('*')
        .or('is_active.is.null,is_active.eq.true')
        .order('account_name', { ascending: true });

      if (error) {
        return { data: [], count: 0, error: error.message };
      }

      const list = (data as Account[]) || [];
      return { data: list, count: list.length, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch accounts';
      return { data: [], count: 0, error: message };
    }
  }
}
