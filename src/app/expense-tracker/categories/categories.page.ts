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
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  addOutline,
  pricetagOutline,
  pricetagsOutline,
  createOutline,
  trashOutline,
  closeOutline,
  refreshOutline,
  alertCircleOutline,
  searchOutline,
  checkmarkCircleOutline,
  chevronDownOutline,
} from 'ionicons/icons';
import { HeaderComponent } from '../../components/header/header.component';
import { CategoryQueryService, CreateCategoryDTO, UpdateCategoryDTO } from '../../database-queries/category.query';
import { ExpenseQueryService } from '../../database-queries/expense.query';
import { Category, Expense } from '../../models/database.types';

@Component({
  selector: 'app-categories',
  templateUrl: './categories.page.html',
  styleUrls: ['./categories.page.scss'],
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
  ],
})
export class CategoriesPage implements OnInit {
  private readonly categoryQuery = inject(CategoryQueryService);
  private readonly expenseQuery = inject(ExpenseQueryService);
  private readonly toastCtrl = inject(ToastController);

  readonly categories = signal<Category[]>([]);
  readonly loading = signal<boolean>(true);
  readonly errorMessage = signal<string | null>(null);
  readonly searchQuery = signal<string>('');

  // Expanded category IDs and their loaded expenses
  readonly expandedCategoryIds = signal<Set<string>>(new Set<string>());
  readonly categoryExpenses = signal<Record<string, Expense[]>>({});
  readonly loadingExpenses = signal<Record<string, boolean>>({});

  // Modal State for Add / Edit
  readonly isModalOpen = signal<boolean>(false);
  readonly isEditing = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  editingCategoryId: string | null = null;

  // Form Fields
  categoryName = '';
  isActive = true;

  // Filtered categories based on search query
  readonly filteredCategories = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const list = this.categories();
    if (!query) return list;

    return list.filter((cat) => cat.category_name.toLowerCase().includes(query));
  });

  // Metrics
  readonly totalCount = computed(() => this.categories().length);
  readonly activeCount = computed(() => this.categories().filter((c) => c.is_active).length);

  constructor() {
    addIcons({
      addOutline,
      pricetagOutline,
      pricetagsOutline,
      createOutline,
      trashOutline,
      closeOutline,
      refreshOutline,
      alertCircleOutline,
      searchOutline,
      checkmarkCircleOutline,
      chevronDownOutline,
    });
  }

  ngOnInit() {
    this.loadCategories();
  }

  async loadCategories() {
    this.loading.set(true);
    this.errorMessage.set(null);

    const { data, error } = await this.categoryQuery.getCategories();

    if (error) {
      this.errorMessage.set(error);
      this.categories.set([]);
    } else {
      this.categories.set(data);
    }

    this.loading.set(false);
  }

  async handleRefresh(event: CustomEvent) {
    this.categoryExpenses.set({});
    await this.loadCategories();
    (event.target as HTMLIonRefresherElement).complete();
  }

  // Toggle Category Accordion to show all expenses under this category
  async toggleCategoryExpand(cat: Category, event?: Event) {
    if (event) event.stopPropagation();

    const current = new Set(this.expandedCategoryIds());
    const isOpening = !current.has(cat.id);

    if (isOpening) {
      current.add(cat.id);
      this.expandedCategoryIds.set(current);

      // Load expenses for this category if not cached yet
      if (!this.categoryExpenses()[cat.id]) {
        this.loadingExpenses.update((m) => ({ ...m, [cat.id]: true }));
        const { data } = await this.expenseQuery.getExpensesByCategory(cat.id);
        this.categoryExpenses.update((m) => ({ ...m, [cat.id]: data }));
        this.loadingExpenses.update((m) => ({ ...m, [cat.id]: false }));
      }
    } else {
      current.delete(cat.id);
      this.expandedCategoryIds.set(current);
    }
  }

  isCategoryExpanded(catId: string): boolean {
    return this.expandedCategoryIds().has(catId);
  }

  getCategoryTotal(catId: string): number {
    const list = this.categoryExpenses()[catId] || [];
    return list.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }

  // Open modal for Adding
  openAddModal() {
    this.isEditing.set(false);
    this.editingCategoryId = null;
    this.categoryName = '';
    this.isActive = true;
    this.isModalOpen.set(true);
  }

  // Open modal for Editing
  openEditModal(cat: Category, event: Event) {
    event.stopPropagation();
    this.isEditing.set(true);
    this.editingCategoryId = cat.id;
    this.categoryName = cat.category_name;
    this.isActive = cat.is_active;
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
  }

  // Save (Create or Update)
  async onSaveCategory() {
    if (!this.categoryName.trim()) {
      this.showToast('Please enter a category name', 'warning');
      return;
    }

    this.isSubmitting.set(true);

    if (this.isEditing() && this.editingCategoryId) {
      // Update
      const updates: UpdateCategoryDTO = {
        category_name: this.categoryName.trim(),
        is_active: this.isActive,
      };

      const { data, error } = await this.categoryQuery.updateCategory(this.editingCategoryId, updates);
      this.isSubmitting.set(false);

      if (error) {
        this.showToast(`Error: ${error}`, 'danger');
      } else {
        this.showToast('Category updated successfully!', 'success');
        this.closeModal();
        await this.loadCategories();
      }
    } else {
      // Create
      const payload: CreateCategoryDTO = {
        category_name: this.categoryName.trim(),
        is_active: this.isActive,
      };

      const { data, error } = await this.categoryQuery.createCategory(payload);
      this.isSubmitting.set(false);

      if (error) {
        this.showToast(`Error: ${error}`, 'danger');
      } else {
        this.showToast('Category created successfully!', 'success');
        this.closeModal();
        await this.loadCategories();
      }
    }
  }

  // Delete
  async onDeleteCategory(cat: Category, event: Event) {
    event.stopPropagation();
    const confirmed = confirm(`Are you sure you want to delete category "${cat.category_name}"?`);
    if (!confirmed) return;

    const { success, error } = await this.categoryQuery.deleteCategory(cat.id, true);

    if (success) {
      this.showToast('Category deleted', 'success');
      await this.loadCategories();
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
