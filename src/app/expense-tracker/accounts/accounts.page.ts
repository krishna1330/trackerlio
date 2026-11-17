import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonBadge,
  IonSpinner,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonRefresher,
  IonRefresherContent,
  IonModal,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  addOutline,
  cardOutline,
  walletOutline,
  businessOutline,
  createOutline,
  trashOutline,
  closeOutline,
  refreshOutline,
  alertCircleOutline,
  searchOutline,
  checkmarkCircleOutline,
} from 'ionicons/icons';
import { HeaderComponent } from '../../components/header/header.component';
import { AccountQueryService, CreateAccountDTO, UpdateAccountDTO } from '../../database-queries/account.query';
import { Account } from '../../models/database.types';

@Component({
  selector: 'app-accounts',
  templateUrl: './accounts.page.html',
  styleUrls: ['./accounts.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    HeaderComponent,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    IonBadge,
    IonSpinner,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonRefresher,
    IonRefresherContent,
    IonModal,
  ],
})
export class AccountsPage implements OnInit {
  private readonly accountQuery = inject(AccountQueryService);
  private readonly toastCtrl = inject(ToastController);

  readonly accounts = signal<Account[]>([]);
  readonly loading = signal<boolean>(true);
  readonly errorMessage = signal<string | null>(null);
  readonly searchQuery = signal<string>('');

  // Modal State for Add / Edit
  readonly isModalOpen = signal<boolean>(false);
  readonly isEditing = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  editingAccountId: string | null = null;

  // Form Fields
  accountName = '';
  availableBalance: number | null = null;
  isCreditCard = false;
  isActive = true;

  // Filtered accounts
  readonly filteredAccounts = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const list = this.accounts();
    if (!query) return list;

    return list.filter((acc) => acc.account_name.toLowerCase().includes(query));
  });

  // Summary Metrics
  readonly totalBalance = computed(() => {
    return this.accounts().reduce((sum, acc) => sum + Number(acc.available_balance || 0), 0);
  });

  readonly totalCount = computed(() => this.accounts().length);

  readonly creditCardCount = computed(() => {
    return this.accounts().filter((acc) => acc.is_credit_card).length;
  });

  constructor() {
    addIcons({
      addOutline,
      cardOutline,
      walletOutline,
      businessOutline,
      createOutline,
      trashOutline,
      closeOutline,
      refreshOutline,
      alertCircleOutline,
      searchOutline,
      checkmarkCircleOutline,
    });
  }

  ngOnInit() {
    this.loadAccounts();
  }

  async loadAccounts() {
    this.loading.set(true);
    this.errorMessage.set(null);

    const { data, error } = await this.accountQuery.getAccounts();

    if (error) {
      this.errorMessage.set(error);
      this.accounts.set([]);
    } else {
      this.accounts.set(data);
    }

    this.loading.set(false);
  }

  async handleRefresh(event: CustomEvent) {
    await this.loadAccounts();
    (event.target as HTMLIonRefresherElement).complete();
  }

  // Open modal for Adding
  openAddModal() {
    this.isEditing.set(false);
    this.editingAccountId = null;
    this.accountName = '';
    this.availableBalance = null;
    this.isCreditCard = false;
    this.isActive = true;
    this.isModalOpen.set(true);
  }

  // Open modal for Editing
  openEditModal(acc: Account, event: Event) {
    event.stopPropagation();
    this.isEditing.set(true);
    this.editingAccountId = acc.id;
    this.accountName = acc.account_name;
    this.availableBalance = acc.available_balance;
    this.isCreditCard = acc.is_credit_card;
    this.isActive = acc.is_active;
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
  }

  // Save (Create or Update)
  async onSaveAccount() {
    if (!this.accountName.trim()) {
      this.showToast('Please enter an account name', 'warning');
      return;
    }

    if (this.availableBalance === null || isNaN(this.availableBalance)) {
      this.showToast('Please enter a valid balance', 'warning');
      return;
    }

    this.isSubmitting.set(true);

    if (this.isEditing() && this.editingAccountId) {
      // Update
      const updates: UpdateAccountDTO = {
        account_name: this.accountName.trim(),
        available_balance: Number(this.availableBalance),
        is_credit_card: this.isCreditCard,
        is_active: this.isActive,
      };

      const { data, error } = await this.accountQuery.updateAccount(this.editingAccountId, updates);
      this.isSubmitting.set(false);

      if (error) {
        this.showToast(`Error: ${error}`, 'danger');
      } else {
        this.showToast('Account updated successfully!', 'success');
        this.closeModal();
        await this.loadAccounts();
      }
    } else {
      // Create
      const payload: CreateAccountDTO = {
        account_name: this.accountName.trim(),
        available_balance: Number(this.availableBalance),
        is_credit_card: this.isCreditCard,
        is_active: this.isActive,
      };

      const { data, error } = await this.accountQuery.createAccount(payload);
      this.isSubmitting.set(false);

      if (error) {
        this.showToast(`Error: ${error}`, 'danger');
      } else {
        this.showToast('Account created successfully!', 'success');
        this.closeModal();
        await this.loadAccounts();
      }
    }
  }

  // Delete
  async onDeleteAccount(acc: Account, event: Event) {
    event.stopPropagation();
    const confirmed = confirm(`Are you sure you want to delete "${acc.account_name}"?`);
    if (!confirmed) return;

    const { success, error } = await this.accountQuery.deleteAccount(acc.id, true);

    if (success) {
      this.showToast('Account deleted', 'success');
      await this.loadAccounts();
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
