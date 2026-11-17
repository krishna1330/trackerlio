import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonModal,
  IonIcon,
  IonSelect,
  IonSelectOption,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  addOutline,
  pieChartOutline,
  calendarOutline,
  createOutline,
  trashOutline,
  closeOutline,
  refreshOutline,
  alertCircleOutline,
  searchOutline,
  checkmarkCircleOutline,
  walletOutline,
  trendingUpOutline,
  trendingDownOutline,
  chevronDownOutline,
  alertOutline,
} from 'ionicons/icons';
import { HeaderComponent } from '../../components/header/header.component';
import { BudgetQueryService, CreateBudgetDTO, UpdateBudgetDTO } from '../../database-queries/budget.query';
import { Budget, Category } from '../../models/database.types';

export interface MonthOption {
  value: number;
  label: string;
}

@Component({
  selector: 'app-budgets',
  templateUrl: './budgets.page.html',
  styleUrls: ['./budgets.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    HeaderComponent,
    IonContent,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    IonModal,
    IonIcon,
    IonSelect,
    IonSelectOption,
  ],
})
export class BudgetsPage implements OnInit {
  private readonly budgetQuery = inject(BudgetQueryService);
  private readonly toastCtrl = inject(ToastController);

  private readonly today = new Date();

  // Selected period
  readonly selectedYear = signal<number>(this.today.getFullYear());
  readonly selectedMonth = signal<number>(this.today.getMonth() + 1);

  // Data signals
  readonly budgets = signal<Budget[]>([]);
  readonly userCategories = signal<Category[]>([]);
  readonly categorySpending = signal<Record<string, number>>({});
  readonly loading = signal<boolean>(true);
  readonly errorMessage = signal<string | null>(null);
  readonly searchQuery = signal<string>('');

  // Modal State for Add / Edit
  readonly isModalOpen = signal<boolean>(false);
  readonly isEditing = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  editingBudgetId: string | null = null;

  // Form Fields
  formCategoryId = '';
  formAmount: number | null = null;
  formYear = this.today.getFullYear();
  formMonth = this.today.getMonth() + 1;
  formIsActive = true;

  // Years & Months
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

  // Month label
  readonly selectedMonthLabel = computed(() => {
    const found = this.months.find((m) => m.value === this.selectedMonth());
    return found ? found.label : '';
  });

  // Filtered budgets by search query
  readonly filteredBudgets = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const list = this.budgets();
    if (!query) return list;

    return list.filter((b) => {
      const catName = this.getCategoryName(b).toLowerCase();
      return catName.includes(query);
    });
  });

  // Summary Metrics
  readonly totalBudget = computed(() => {
    return this.filteredBudgets().reduce((sum, b) => sum + Number(b.amount || 0), 0);
  });

  readonly totalSpent = computed(() => {
    const spending = this.categorySpending();
    return this.filteredBudgets().reduce((sum, b) => {
      return sum + Number(spending[b.category_id] || 0);
    }, 0);
  });

  readonly totalRemaining = computed(() => {
    return this.totalBudget() - this.totalSpent();
  });

  readonly overallPercentage = computed(() => {
    const budget = this.totalBudget();
    if (budget <= 0) return 0;
    return Math.round((this.totalSpent() / budget) * 100);
  });

  constructor() {
    addIcons({
      addOutline,
      pieChartOutline,
      calendarOutline,
      createOutline,
      trashOutline,
      closeOutline,
      refreshOutline,
      alertCircleOutline,
      searchOutline,
      checkmarkCircleOutline,
      walletOutline,
      trendingUpOutline,
      trendingDownOutline,
      chevronDownOutline,
      alertOutline,
    });
  }

  ngOnInit() {
    this.loadData();
    this.loadUserCategories();
  }

  async loadUserCategories() {
    const { data } = await this.budgetQuery.getUserCategories();
    if (data) {
      this.userCategories.set(data);
      if (data.length > 0 && !this.formCategoryId) {
        this.formCategoryId = data[0].id;
      }
    }
  }

  async loadData() {
    this.loading.set(true);
    this.errorMessage.set(null);

    const year = this.selectedYear();
    const month = this.selectedMonth();

    const [budgetRes, spendingMap] = await Promise.all([
      this.budgetQuery.getBudgetsByMonth(year, month),
      this.budgetQuery.getCategorySpendingForMonth(year, month),
    ]);

    if (budgetRes.error) {
      this.errorMessage.set(budgetRes.error);
      this.budgets.set([]);
    } else {
      this.budgets.set(budgetRes.data);
    }

    this.categorySpending.set(spendingMap);
    this.loading.set(false);
  }

  async handleRefresh(event: CustomEvent) {
    await Promise.all([this.loadData(), this.loadUserCategories()]);
    (event.target as HTMLIonRefresherElement).complete();
  }

  onYearChange(year: number) {
    if (this.selectedYear() !== year) {
      this.selectedYear.set(year);
      this.loadData();
    }
  }

  onMonthChange(month: number) {
    if (this.selectedMonth() !== month) {
      this.selectedMonth.set(month);
      this.loadData();
    }
  }

  getCategoryName(b: Budget): string {
    return (
      b.category?.category_name ||
      b.categories?.category_name ||
      this.userCategories().find((c) => c.id === b.category_id)?.category_name ||
      'Category'
    );
  }

  getSpent(b: Budget): number {
    return this.categorySpending()[b.category_id] || 0;
  }

  getRemaining(b: Budget): number {
    return Number(b.amount || 0) - this.getSpent(b);
  }

  getPercentage(b: Budget): number {
    const amount = Number(b.amount || 0);
    if (amount <= 0) return 0;
    const spent = this.getSpent(b);
    return Math.round((spent / amount) * 100);
  }

  isExceeded(b: Budget): boolean {
    return this.getSpent(b) > Number(b.amount || 0);
  }

  getAbsoluteRemaining(b: Budget): number {
    return Math.abs(this.getRemaining(b));
  }

  getExceededAmount(b: Budget): number {
    return Math.max(0, this.getSpent(b) - Number(b.amount || 0));
  }

  getAbsoluteTotalRemaining(): number {
    return Math.abs(this.totalRemaining());
  }

  // Open modal for Adding
  openAddModal() {
    this.isEditing.set(false);
    this.editingBudgetId = null;
    this.formAmount = null;
    this.formYear = this.selectedYear();
    this.formMonth = this.selectedMonth();
    this.formIsActive = true;

    if (this.userCategories().length > 0 && !this.formCategoryId) {
      this.formCategoryId = this.userCategories()[0].id;
    }

    this.isModalOpen.set(true);
  }

  // Open modal for Editing
  openEditModal(budget: Budget, event: Event) {
    event.stopPropagation();
    this.isEditing.set(true);
    this.editingBudgetId = budget.id;
    this.formCategoryId = budget.category_id;
    this.formAmount = budget.amount;
    this.formYear = budget.year;
    this.formMonth = budget.month;
    this.formIsActive = budget.is_active;
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
  }

  // Save (Create or Update)
  async onSaveBudget() {
    if (!this.formCategoryId) {
      this.showToast('Please select a category', 'warning');
      return;
    }

    if (!this.formAmount || this.formAmount <= 0) {
      this.showToast('Please enter a valid budget amount (> 0)', 'warning');
      return;
    }

    this.isSubmitting.set(true);

    if (this.isEditing() && this.editingBudgetId) {
      const updates: UpdateBudgetDTO = {
        category_id: this.formCategoryId,
        year: Number(this.formYear),
        month: Number(this.formMonth),
        amount: Number(this.formAmount),
        is_active: this.formIsActive,
      };

      const { data, error } = await this.budgetQuery.updateBudget(this.editingBudgetId, updates);
      this.isSubmitting.set(false);

      if (error) {
        this.showToast(`Error: ${error}`, 'danger');
      } else {
        this.showToast('Budget updated successfully!', 'success');
        this.closeModal();
        await this.loadData();
      }
    } else {
      const payload: CreateBudgetDTO = {
        category_id: this.formCategoryId,
        year: Number(this.formYear),
        month: Number(this.formMonth),
        amount: Number(this.formAmount),
        is_active: this.formIsActive,
      };

      const { data, error } = await this.budgetQuery.createBudget(payload);
      this.isSubmitting.set(false);

      if (error) {
        this.showToast(`Error: ${error}`, 'danger');
      } else {
        this.showToast('Budget set successfully!', 'success');
        this.closeModal();
        await this.loadData();
      }
    }
  }

  // Delete
  async onDeleteBudget(budget: Budget, event: Event) {
    event.stopPropagation();
    const catName = this.getCategoryName(budget);
    const confirmed = confirm(`Delete budget for "${catName}" (₹${budget.amount})?`);
    if (!confirmed) return;

    const { success, error } = await this.budgetQuery.deleteBudget(budget.id, true);

    if (success) {
      this.showToast('Budget deleted', 'success');
      await this.loadData();
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
