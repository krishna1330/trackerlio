import type { Routes } from '@angular/router';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'users',
    canActivate: [adminGuard],
    loadComponent: () => import('./users/users.page').then((m) => m.UsersPage),
  },
  {
    path: 'expenses',
    loadComponent: () =>
      import('./expense-tracker/expenses/expense.page').then((m) => m.ExpensePage),
  },
  {
    path: 'categories',
    loadComponent: () =>
      import('./expense-tracker/categories/categories.page').then((m) => m.CategoriesPage),
  },
  {
    path: 'accounts',
    loadComponent: () =>
      import('./expense-tracker/accounts/accounts.page').then((m) => m.AccountsPage),
  },
  {
    path: 'budgets',
    // Budgets management
    loadComponent: () =>
      import('./expense-tracker/budgets/budgets.page').then((m) => m.BudgetsPage),
  },
  {
    path: 'expense-tracker/expenses',
    redirectTo: 'expenses',
    pathMatch: 'full',
  },
  {
    path: 'expense-tracker/categories',
    redirectTo: 'categories',
    pathMatch: 'full',
  },
  {
    path: 'expense-tracker/accounts',
    redirectTo: 'accounts',
    pathMatch: 'full',
  },
  {
    path: 'expense-tracker/budgets',
    redirectTo: 'budgets',
    pathMatch: 'full',
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
];
