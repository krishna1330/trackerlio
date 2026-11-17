export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email?: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  created_by: string;
  modified_at: string;
  modified_by: string;
}

export interface Account {
  id: string;
  account_name: string;
  available_balance: number;
  is_credit_card: boolean;
  is_active: boolean;
  created_at: string;
  created_by: string;
  modified_at: string;
  modified_by: string;
}

export interface Category {
  id: string;
  category_name: string;
  is_active: boolean;
  created_at: string;
  created_by: string;
  modified_at: string;
  modified_by: string;
}

export interface Expense {
  id: string;
  account_id: string;
  category_id: string;
  expense_name: string;
  amount: number;
  expense_date: string;
  comments: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string;
  modified_at: string;
  modified_by: string;
  category?: { category_name: string } | null;
  account?: { account_name: string } | null;
  categories?: { category_name: string } | null;
  accounts?: { account_name: string } | null;
}

export interface Budget {
  id: string;
  category_id: string;
  month: number;
  year: number;
  amount: number;
  is_active: boolean;
  created_at: string;
  created_by: string;
  modified_at: string;
  modified_by: string;
  category?: { category_name: string } | null;
  categories?: { category_name: string } | null;
}
