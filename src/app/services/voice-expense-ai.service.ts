import { inject, Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Category, Account } from '../models/database.types';

export interface ParsedVoiceExpense {
  expense_name: string;
  amount: number;
  expense_date: string;
  category_id: string | null;
  account_id: string | null;
  comments: string;
}

@Injectable({
  providedIn: 'root',
})
export class VoiceExpenseAiService {
  private readonly supabase = inject(SupabaseService);

  /**
   * Invokes the Supabase Edge Function `bright-processor`
   * which accesses the secret GROQ_API_KEY server-side.
   */
  async parseVoiceCommand(
    voiceText: string,
    categories: Category[],
    accounts: Account[],
    audioBase64?: string,
    audioMimeType?: string
  ): Promise<ParsedVoiceExpense> {
    const functionName = 'bright-processor';

    const { data, error } = await this.supabase.client.functions.invoke(
      functionName,
      {
        body: {
          voiceText,
          audioBase64,
          audioMimeType,
          categories,
          accounts,
        },
      }
    );

    if (error) {
      console.error('Edge Function invocation error:', error);
      throw new Error(
        error.message ||
          'Failed to process voice command with AI. Please make sure the Edge Function is deployed.'
      );
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data as ParsedVoiceExpense;
  }
}
