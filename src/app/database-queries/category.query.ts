import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../services/supabase.service';
import { Category } from '../models/database.types';

export interface CreateCategoryDTO {
  category_name: string;
  is_active?: boolean;
}

export interface UpdateCategoryDTO {
  category_name?: string;
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
export class CategoryQueryService {
  private readonly supabase = inject(SupabaseService);

  /**
   * Fetch all categories (by default retrieves all, or filter active only)
   */
  async getCategories(includeInactive: boolean = true): Promise<QueryListResult<Category>> {
    try {
      let query = this.supabase.client
        .from('categories')
        .select('*')
        .order('category_name', { ascending: true });

      if (!includeInactive) {
        query = query.or('is_active.is.null,is_active.eq.true');
      }

      const { data, error } = await query;

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
   * Fetch single category by ID
   */
  async getCategoryById(id: string): Promise<QueryResult<Category>> {
    try {
      const { data, error } = await this.supabase.client
        .from('categories')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: data as Category, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch category';
      return { data: null, error: message };
    }
  }

  /**
   * Create a new category record
   */
  async createCategory(payload: CreateCategoryDTO): Promise<QueryResult<Category>> {
    try {
      const currentUser = this.supabase.currentUser();
      const insertData = {
        category_name: payload.category_name.trim(),
        is_active: payload.is_active ?? true,
        created_by: currentUser?.id,
        modified_by: currentUser?.id,
      };

      const { data, error } = await this.supabase.client
        .from('categories')
        .insert(insertData)
        .select('*')
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: data as Category, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create category';
      return { data: null, error: message };
    }
  }

  /**
   * Update an existing category
   */
  async updateCategory(id: string, updates: UpdateCategoryDTO): Promise<QueryResult<Category>> {
    try {
      const currentUser = this.supabase.currentUser();
      const updateData: Partial<Category> = {
        ...updates,
        modified_by: currentUser?.id,
      };

      if (updates.category_name !== undefined) {
        updateData.category_name = updates.category_name.trim();
      }

      const { data, error } = await this.supabase.client
        .from('categories')
        .update(updateData)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: data as Category, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update category';
      return { data: null, error: message };
    }
  }

  /**
   * Delete a category (soft-delete by setting is_active = false, or permanent hard-delete)
   */
  async deleteCategory(id: string, softDelete: boolean = true): Promise<{ success: boolean; error: string | null }> {
    try {
      if (softDelete) {
        const currentUser = this.supabase.currentUser();
        const { error } = await this.supabase.client
          .from('categories')
          .update({ is_active: false, modified_by: currentUser?.id })
          .eq('id', id);

        if (error) {
          return { success: false, error: error.message };
        }
      } else {
        const { error } = await this.supabase.client
          .from('categories')
          .delete()
          .eq('id', id);

        if (error) {
          return { success: false, error: error.message };
        }
      }

      return { success: true, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete category';
      return { success: false, error: message };
    }
  }
}
