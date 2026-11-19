import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonSelect,
  IonSelectOption,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonModal,
  IonInput,
  IonTextarea,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  addOutline,
  calendarOutline,
  calendarNumberOutline,
  walletOutline,
  cashOutline,
  receiptOutline,
  refreshOutline,
  alertCircleOutline,
  pricetagOutline,
  pricetagsOutline,
  searchOutline,
  chevronDownOutline,
  closeOutline,
  trashOutline,
  createOutline,
  ellipse,
  checkmarkCircleOutline,
  pieChartOutline,
  micOutline,
  mic,
  sparklesOutline,
} from 'ionicons/icons';
import { SupabaseService } from '../../services/supabase.service';
import { ExpenseQueryService, CreateExpenseDTO, UpdateExpenseDTO } from '../../database-queries/expense.query';
import { BudgetQueryService } from '../../database-queries/budget.query';
import { VoiceRecognitionService } from '../../services/voice-recognition.service';
import { VoiceExpenseAiService } from '../../services/voice-expense-ai.service';
import { Expense, Category, Account, Budget } from '../../models/database.types';
import { HeaderComponent } from '../../components/header/header.component';

export interface MonthOption {
  value: number;
  label: string;
}

export interface CategorySummary {
  id: string;
  name: string;
  total: number;
  count: number;
  percentage: number;
  expenses: Expense[];
  budget?: Budget | null;
  budgetAmount: number;
  budgetPercentage: number;
  budgetRemaining: number;
  isBudgetExceeded: boolean;
}

@Component({
  selector: 'app-expense',
  templateUrl: './expense.page.html',
  styleUrls: ['./expense.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    HeaderComponent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonButton,
    IonIcon,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonGrid,
    IonRow,
    IonCol,
    IonSelect,
    IonSelectOption,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    IonModal,
    IonInput,
    IonTextarea,
  ],
})
export class ExpensePage implements OnInit {
  readonly supabase = inject(SupabaseService);
  private readonly expenseQuery = inject(ExpenseQueryService);
  private readonly budgetQuery = inject(BudgetQueryService);
  private readonly toastCtrl = inject(ToastController);

  private readonly today = new Date();

  // Current logged in user from Supabase auth
  readonly currentUser = this.supabase.currentUser;

  // Selected year and month (defaults to current year & current month)
  readonly selectedYear = signal<number>(this.today.getFullYear());
  readonly selectedMonth = signal<number>(this.today.getMonth() + 1);

  // Search filter inside the period
  readonly searchQuery = signal<string>('');

  // Available year options (e.g., from 2024 to current + 2)
  readonly years: number[] = (() => {
    const current = this.today.getFullYear();
    const list: number[] = [];
    const minYear = 2024;
    const maxYear = Math.max(current + 2, 2027);
    for (let y = minYear; y <= maxYear; y++) {
      list.push(y);
    }
    return list;
  })();

  // 12 months
  readonly months: MonthOption[] = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  readonly expenses = signal<Expense[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly accounts = signal<Account[]>([]);
  readonly categoryBudgets = signal<Record<string, Budget>>({});
  readonly loading = signal<boolean>(true);
  readonly errorMessage = signal<string | null>(null);

  // Add / Edit Expense Modal state
  readonly isAddModalOpen = signal<boolean>(false);
  readonly isEditing = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);

  // Voice AI Expense State
  readonly voiceService = inject(VoiceRecognitionService);
  private readonly voiceAiService = inject(VoiceExpenseAiService);
  readonly isVoiceModalOpen = signal<boolean>(false);
  readonly isAiProcessing = signal<boolean>(false);
  readonly voiceSpokenText = signal<string>('');
  manualVoiceCommand = '';
  editingExpenseId: string | null = null;
  newExpenseName = '';
  newExpenseAmount: number | null = null;
  newExpenseDate = this.getTodayDateString();
  newExpenseCategoryId = '';
  newExpenseAccountId = '';
  newExpenseComments = '';

  // Add / Edit Budget Modal state (directly from Category View)
  readonly isBudgetModalOpen = signal<boolean>(false);
  readonly isBudgetSubmitting = signal<boolean>(false);
  budgetModalCategoryId = '';
  budgetModalCategoryName = '';
  budgetModalAmount: number | null = null;
  budgetModalExistingId: string | null = null;

  // Filtered expenses based on search query
  readonly filteredExpenses = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const list = this.expenses();
    if (!query) return list;

    return list.filter((exp) => {
      const name = (exp.expense_name || '').toLowerCase();
      const cat = this.getCategoryName(exp).toLowerCase();
      const acc = (this.getAccountName(exp) || '').toLowerCase();
      const comments = (exp.comments || '').toLowerCase();
      return name.includes(query) || cat.includes(query) || acc.includes(query) || comments.includes(query);
    });
  });

  // Computed summary values
  readonly totalExpenses = computed(() => {
    return this.filteredExpenses().reduce((sum, item) => sum + Number(item.amount || 0), 0);
  });

  readonly expenseCount = computed(() => this.filteredExpenses().length);

  readonly averageExpense = computed(() => {
    const count = this.expenseCount();
    return count > 0 ? Math.round(this.totalExpenses() / count) : 0;
  });

  readonly selectedMonthLabel = computed(() => {
    const found = this.months.find((m) => m.value === this.selectedMonth());
    return found ? found.label : '';
  });

  // Expanded category IDs in Category View
  readonly expandedCategoryIds = signal<Set<string>>(new Set<string>());

  // Category breakdown for progress bars and breakdown view
  readonly categoryBreakdown = computed<CategorySummary[]>(() => {
    const list = this.filteredExpenses();
    const total = this.totalExpenses();
    const budgets = this.categoryBudgets();
    const map = new Map<string, { id: string; name: string; total: number; count: number; expenses: Expense[] }>();

    for (const exp of list) {
      const catId = exp.category_id || 'uncategorized';
      const catName = this.getCategoryName(exp);
      const curr = map.get(catId) || { id: catId, name: catName, total: 0, count: 0, expenses: [] };
      curr.total += Number(exp.amount || 0);
      curr.count += 1;
      curr.expenses.push(exp);
      map.set(catId, curr);
    }

    // Also include any category that has a budget set for this month, even if 0 expenses logged yet
    for (const [catId, budget] of Object.entries(budgets)) {
      if (!map.has(catId) && budget.is_active) {
        const catName =
          budget.category?.category_name ||
          budget.categories?.category_name ||
          this.categories().find((c) => c.id === catId)?.category_name ||
          'Category';
        map.set(catId, { id: catId, name: catName, total: 0, count: 0, expenses: [] });
      }
    }

    return Array.from(map.values())
      .map((c) => {
        const budget = budgets[c.id] || null;
        const budgetAmount = budget ? Number(budget.amount || 0) : 0;
        const budgetPercentage = budgetAmount > 0 ? Math.round((c.total / budgetAmount) * 100) : 0;
        const budgetRemaining = budgetAmount - c.total;
        const isBudgetExceeded = budgetAmount > 0 && c.total > budgetAmount;

        return {
          ...c,
          percentage: total > 0 ? Math.round((c.total / total) * 100) : 0,
          budget,
          budgetAmount,
          budgetPercentage,
          budgetRemaining,
          isBudgetExceeded,
        };
      })
      .sort((a, b) => b.total - a.total);
  });

  readonly categoryCount = computed(() => this.categoryBreakdown().length);

  // Entire Category View collapsible card state (closed by default)
  readonly isCategoryViewExpanded = signal<boolean>(false);

  toggleCategoryViewExpand() {
    this.isCategoryViewExpanded.update((v) => !v);
  }

  toggleCategoryExpand(catId: string, event?: Event) {
    if (event) event.stopPropagation();
    const current = new Set(this.expandedCategoryIds());
    if (current.has(catId)) {
      current.delete(catId);
    } else {
      current.add(catId);
    }
    this.expandedCategoryIds.set(current);
  }

  isCategoryExpanded(catId: string): boolean {
    return this.expandedCategoryIds().has(catId);
  }

  constructor() {
    addIcons({
      addOutline,
      calendarOutline,
      calendarNumberOutline,
      walletOutline,
      cashOutline,
      receiptOutline,
      refreshOutline,
      alertCircleOutline,
      pricetagOutline,
      pricetagsOutline,
      searchOutline,
      chevronDownOutline,
      closeOutline,
      trashOutline,
      createOutline,
      ellipse,
      checkmarkCircleOutline,
      pieChartOutline,
      micOutline,
      mic,
      sparklesOutline,
    });
  }

  ngOnInit() {
    this.loadExpenses();
    this.loadMeta();
  }

  getTodayDateString(): string {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  }

  async loadMeta() {
    const [catsRes, accsRes] = await Promise.all([
      this.expenseQuery.getCategories(),
      this.expenseQuery.getAccounts(),
    ]);

    if (catsRes.data) this.categories.set(catsRes.data);
    if (accsRes.data) this.accounts.set(accsRes.data);
  }

  onYearChange(year: number) {
    if (this.selectedYear() !== year) {
      this.selectedYear.set(year);
      this.loadExpenses();
    }
  }

  onMonthChange(month: number) {
    if (this.selectedMonth() !== month) {
      this.selectedMonth.set(month);
      this.loadExpenses();
    }
  }

  async loadExpenses() {
    this.loading.set(true);
    this.errorMessage.set(null);

    const year = this.selectedYear();
    const month = this.selectedMonth();

    const [expRes, bRes] = await Promise.all([
      this.expenseQuery.getExpensesByMonth(year, month),
      this.budgetQuery.getBudgetsByMonth(year, month),
    ]);

    if (expRes.error) {
      this.errorMessage.set(expRes.error);
      this.expenses.set([]);
    } else {
      this.expenses.set(expRes.data);
    }

    if (bRes.data) {
      const bMap: Record<string, Budget> = {};
      for (const b of bRes.data) {
        bMap[b.category_id] = b;
      }
      this.categoryBudgets.set(bMap);
    } else {
      this.categoryBudgets.set({});
    }

    this.loading.set(false);
  }

  async handleRefresh(event: CustomEvent) {
    await this.loadExpenses();
    (event.target as HTMLIonRefresherElement).complete();
  }

  getCategoryName(expense: Expense): string {
    return (
      expense.category?.category_name ||
      expense.categories?.category_name ||
      'Miscellaneous'
    );
  }

  getAccountName(expense: Expense): string | null {
    return expense.account?.account_name || expense.accounts?.account_name || null;
  }

  // -----------------------------------------------------------------
  // Voice AI Expense Actions
  // -----------------------------------------------------------------
  openVoiceModal() {
    this.manualVoiceCommand = '';
    this.voiceSpokenText.set('');
    this.isAiProcessing.set(false);
    this.isVoiceModalOpen.set(true);

    if (this.voiceService.isSupported()) {
      setTimeout(() => {
        this.startListeningVoice();
      }, 300);
    }
  }

  closeVoiceModal() {
    this.voiceService.stopListening();
    this.isVoiceModalOpen.set(false);
    this.isAiProcessing.set(false);
  }

  async startListeningVoice() {
    try {
      const transcript = await this.voiceService.startListening();
      if (transcript) {
        await this.processVoiceText(transcript);
      }
    } catch (err: any) {
      if (err?.message && !err.message.includes('No speech')) {
        this.showToast(err.message, 'warning');
      }
    }
  }

  stopVoiceAndProcess() {
    this.voiceService.stopListening();
  }

  async processTextCommand() {
    const text = this.manualVoiceCommand.trim();
    if (!text) return;
    await this.processVoiceText(text);
  }

  async processVoiceText(text: string) {
    this.voiceSpokenText.set(text);
    this.isAiProcessing.set(true);

    try {
      const parsed = await this.voiceAiService.parseVoiceCommand(
        text,
        this.categories(),
        this.accounts()
      );

      this.isVoiceModalOpen.set(false);
      this.isAiProcessing.set(false);

      // Pre-fill Add Expense modal
      this.isEditing.set(false);
      this.editingExpenseId = null;
      this.newExpenseName = parsed.expense_name || 'Expense';
      this.newExpenseAmount = parsed.amount || null;
      this.newExpenseDate = parsed.expense_date || this.getTodayDateString();
      this.newExpenseCategoryId = parsed.category_id || '';
      this.newExpenseAccountId = parsed.account_id || '';
      this.newExpenseComments = parsed.comments || text;

      this.isAddModalOpen.set(true);
      this.showToast('AI filled your expense details! Review & Save.', 'success');
    } catch (err: any) {
      this.isAiProcessing.set(false);
      this.showToast(err.message || 'Failed to process voice command', 'danger');
    }
  }

  // Open modal for Adding
  openAddExpenseModal() {
    this.isEditing.set(false);
    this.editingExpenseId = null;
    this.newExpenseName = '';
    this.newExpenseAmount = null;
    this.newExpenseDate = this.getTodayDateString();
    this.newExpenseCategoryId = '';
    this.newExpenseAccountId = '';
    this.newExpenseComments = '';

    this.isAddModalOpen.set(true);
  }

  // Open modal for Editing
  openEditExpenseModal(expense: Expense, event: Event) {
    event.stopPropagation();
    this.isEditing.set(true);
    this.editingExpenseId = expense.id;
    this.newExpenseName = expense.expense_name || '';
    this.newExpenseAmount = expense.amount;
    this.newExpenseDate = expense.expense_date || this.getTodayDateString();
    this.newExpenseCategoryId = expense.category_id || '';
    this.newExpenseAccountId = expense.account_id || '';
    this.newExpenseComments = expense.comments || '';

    this.isAddModalOpen.set(true);
  }

  closeAddExpenseModal() {
    this.isAddModalOpen.set(false);
  }

  async onSaveExpense() {
    if (!this.newExpenseName.trim()) {
      this.showToast('Please enter an expense name', 'warning');
      return;
    }

    if (!this.newExpenseAmount || this.newExpenseAmount <= 0) {
      this.showToast('Please enter a valid amount (> 0)', 'warning');
      return;
    }

    if (!this.newExpenseCategoryId) {
      this.showToast('Please select a category', 'warning');
      return;
    }

    if (!this.newExpenseAccountId) {
      this.showToast('Please select an account', 'warning');
      return;
    }

    this.isSubmitting.set(true);

    if (this.isEditing() && this.editingExpenseId) {
      const updates: UpdateExpenseDTO = {
        expense_name: this.newExpenseName.trim(),
        amount: Number(this.newExpenseAmount),
        expense_date: this.newExpenseDate,
        category_id: this.newExpenseCategoryId,
        account_id: this.newExpenseAccountId,
        comments: this.newExpenseComments.trim() || null,
      };

      const { data, error } = await this.expenseQuery.updateExpense(this.editingExpenseId, updates);
      this.isSubmitting.set(false);

      if (error) {
        this.showToast(`Error: ${error}`, 'danger');
      } else {
        this.showToast('Expense updated successfully!', 'success');
        this.closeAddExpenseModal();
        await this.loadExpenses();
      }
    } else {
      const payload: CreateExpenseDTO = {
        expense_name: this.newExpenseName.trim(),
        amount: Number(this.newExpenseAmount),
        expense_date: this.newExpenseDate,
        category_id: this.newExpenseCategoryId,
        account_id: this.newExpenseAccountId,
        comments: this.newExpenseComments.trim() || null,
        is_active: true,
      };

      const { data, error } = await this.expenseQuery.createExpense(payload);
      this.isSubmitting.set(false);

      if (error) {
        this.showToast(`Error: ${error}`, 'danger');
      } else {
        this.showToast('Expense added successfully!', 'success');
        this.closeAddExpenseModal();
        await this.loadExpenses();
      }
    }
  }

  async onDeleteExpense(expense: Expense, event: Event) {
    event.stopPropagation();
    const confirmed = confirm(`Delete "${expense.expense_name}" (${expense.amount})?`);
    if (!confirmed) return;

    const { success, error } = await this.expenseQuery.deleteExpense(expense.id, true);
    if (success) {
      this.showToast('Expense removed', 'success');
      await this.loadExpenses();
    } else {
      this.showToast(`Error: ${error}`, 'danger');
    }
  }

  // -----------------------------------------------------------------
  // Category Budget Actions (Add / Edit directly from Category View)
  // -----------------------------------------------------------------
  openBudgetModal(cat: CategorySummary, event: Event) {
    event.stopPropagation();
    this.budgetModalCategoryId = cat.id;
    this.budgetModalCategoryName = cat.name;

    if (cat.budget) {
      this.budgetModalExistingId = cat.budget.id;
      this.budgetModalAmount = cat.budget.amount;
    } else {
      this.budgetModalExistingId = null;
      this.budgetModalAmount = null;
    }

    this.isBudgetModalOpen.set(true);
  }

  closeBudgetModal() {
    this.isBudgetModalOpen.set(false);
  }

  async onSaveBudgetFromCategoryView() {
    if (!this.budgetModalAmount || this.budgetModalAmount <= 0) {
      this.showToast('Please enter a valid budget amount (> 0)', 'warning');
      return;
    }

    this.isBudgetSubmitting.set(true);
    const year = this.selectedYear();
    const month = this.selectedMonth();

    if (this.budgetModalExistingId) {
      const { error } = await this.budgetQuery.updateBudget(this.budgetModalExistingId, {
        amount: Number(this.budgetModalAmount),
      });
      this.isBudgetSubmitting.set(false);

      if (error) {
        this.showToast(`Error: ${error}`, 'danger');
      } else {
        this.showToast(`Budget for ${this.budgetModalCategoryName} updated!`, 'success');
        this.closeBudgetModal();
        await this.loadExpenses();
      }
    } else {
      const { error } = await this.budgetQuery.createBudget({
        category_id: this.budgetModalCategoryId,
        year,
        month,
        amount: Number(this.budgetModalAmount),
        is_active: true,
      });
      this.isBudgetSubmitting.set(false);

      if (error) {
        this.showToast(`Error: ${error}`, 'danger');
      } else {
        this.showToast(`Budget for ${this.budgetModalCategoryName} set!`, 'success');
        this.closeBudgetModal();
        await this.loadExpenses();
      }
    }
  }

  async onDeleteBudgetFromCategoryView() {
    if (!this.budgetModalExistingId) return;
    const confirmed = confirm(`Delete budget for "${this.budgetModalCategoryName}"?`);
    if (!confirmed) return;

    this.isBudgetSubmitting.set(true);
    const { success, error } = await this.budgetQuery.deleteBudget(this.budgetModalExistingId, true);
    this.isBudgetSubmitting.set(false);

    if (success) {
      this.showToast('Budget removed', 'success');
      this.closeBudgetModal();
      await this.loadExpenses();
    } else {
      this.showToast(`Error: ${error}`, 'danger');
    }
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color,
      position: 'bottom',
    });
    await toast.present();
  }
}
