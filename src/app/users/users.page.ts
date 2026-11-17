import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonButton,
  IonIcon,
  IonSpinner,
  IonSearchbar,
  IonRefresher,
  IonRefresherContent,
  IonModal,
  IonToggle,
  ToastController,
  AlertController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  copyOutline,
  personOutline,
  personAddOutline,
  mailOutline,
  checkmarkOutline,
  refreshOutline,
  shieldCheckmarkOutline,
  shieldOutline,
  alertCircleOutline,
  closeOutline,
  lockClosedOutline,
  eyeOutline,
  eyeOffOutline,
  createOutline,
  checkmarkCircleOutline,
  powerOutline,
} from 'ionicons/icons';
import { SupabaseService } from '../services/supabase.service';
import { Profile } from '../models/database.types';
import { HeaderComponent } from '../components/header/header.component';
import { UserQueryService, CreateUserDTO } from '../database-queries/user.query';

@Component({
  selector: 'app-users',
  templateUrl: './users.page.html',
  styleUrls: ['./users.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    HeaderComponent,
    IonContent,
    IonButton,
    IonIcon,
    IonSpinner,
    IonSearchbar,
    IonRefresher,
    IonRefresherContent,
    IonModal,
    IonToggle,
  ],
})
export class UsersPage implements OnInit {
  private readonly supabase = inject(SupabaseService);
  private readonly userQuery = inject(UserQueryService);
  private readonly toastCtrl = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);

  readonly isAdmin = this.supabase.isAdmin;

  // Data signals
  readonly profiles = signal<Profile[]>([]);
  readonly loading = signal<boolean>(true);
  readonly errorMessage = signal<string | null>(null);
  readonly searchTerm = signal<string>('');
  readonly copiedId = signal<string | null>(null);
  readonly statusUpdatingId = signal<string | null>(null);

  // Add User Modal State
  readonly isAddModalOpen = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  readonly modalErrorMessage = signal<string | null>(null);
  newFirstName = '';
  newLastName = '';
  newEmail = '';
  newPassword = '';
  newIsActive = true;
  showPassword = false;

  // Edit User Modal State
  readonly isEditModalOpen = signal<boolean>(false);
  readonly isEditSubmitting = signal<boolean>(false);
  editingUserId: string | null = null;
  editFirstName = '';
  editLastName = '';
  editIsActive = true;

  // Filtered profiles based on search term
  readonly filteredProfiles = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const list = this.profiles();

    if (!term) return list;

    return list.filter((p) => {
      const fullName = `${p.first_name ?? ''} ${p.last_name ?? ''}`.toLowerCase();
      const email = (p.email ?? '').toLowerCase();
      const id = p.id.toLowerCase();
      const role = (p.role ?? '').toLowerCase();
      return fullName.includes(term) || email.includes(term) || id.includes(term) || role.includes(term);
    });
  });

  readonly activeCount = computed(() => {
    return this.profiles().filter((p) => p.is_active).length;
  });

  readonly inactiveCount = computed(() => {
    return this.profiles().filter((p) => !p.is_active).length;
  });

  constructor() {
    addIcons({
      copyOutline,
      personOutline,
      personAddOutline,
      mailOutline,
      checkmarkOutline,
      refreshOutline,
      shieldCheckmarkOutline,
      shieldOutline,
      alertCircleOutline,
      closeOutline,
      lockClosedOutline,
      eyeOutline,
      eyeOffOutline,
      createOutline,
      checkmarkCircleOutline,
      powerOutline,
    });
  }

  ngOnInit() {
    this.fetchProfiles();
  }

  async fetchProfiles() {
    this.loading.set(true);
    this.errorMessage.set(null);

    const { data, error } = await this.userQuery.getProfiles();
    this.loading.set(false);

    if (error) {
      this.errorMessage.set(error);
      this.profiles.set([]);
    } else {
      this.profiles.set(data);
    }
  }

  async handleRefresh(event: CustomEvent) {
    await this.fetchProfiles();
    (event.target as HTMLIonRefresherElement).complete();
  }

  // -----------------------------------------------------------------
  // User Helpers
  // -----------------------------------------------------------------
  getUserInitials(profile: Profile): string {
    const first = profile.first_name?.[0]?.toUpperCase() ?? '';
    const last = profile.last_name?.[0]?.toUpperCase() ?? '';
    if (first || last) return first + last;
    return (profile.email?.[0]?.toUpperCase() ?? '?');
  }

  getFullName(profile: Profile): string {
    const first = profile.first_name?.trim() ?? '';
    const last = profile.last_name?.trim() ?? '';
    const full = `${first} ${last}`.trim();
    return full.length > 0 ? full : (profile.email?.split('@')[0] ?? 'User');
  }

  isAdminUser(profile: Profile): boolean {
    return (
      profile.role === 'admin' ||
      profile.email === 'kmandiboyina@gmail.com' ||
      profile.id === 'db0c53e7-6933-4fc7-a63f-08e0aa7e25d2'
    );
  }

  async copyUserId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      this.copiedId.set(id);
      setTimeout(() => {
        if (this.copiedId() === id) {
          this.copiedId.set(null);
        }
      }, 2000);
    } catch {
      this.copiedId.set(id);
    }
  }

  // -----------------------------------------------------------------
  // Active / Inactive Status Management
  // -----------------------------------------------------------------
  async onToggleUserStatus(profile: Profile, event?: Event) {
    if (event) {
      event.stopPropagation();
    }

    // Safety: Admin cannot deactivate themselves
    if (this.isAdminUser(profile)) {
      this.showToast('The Primary Admin account cannot be deactivated.', 'warning');
      return;
    }

    const newStatus = !profile.is_active;

    // Show quick confirmation alert for deactivation
    if (!newStatus) {
      const alert = await this.alertCtrl.create({
        header: 'Deactivate User',
        message: `Are you sure you want to deactivate "${this.getFullName(profile)}"? Inactive users cannot log in.`,
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
          },
          {
            text: 'Deactivate',
            role: 'destructive',
            handler: () => {
              this.applyStatusChange(profile, newStatus);
            },
          },
        ],
      });
      await alert.present();
      return;
    }

    // Direct activation
    await this.applyStatusChange(profile, newStatus);
  }

  private async applyStatusChange(profile: Profile, newStatus: boolean) {
    this.statusUpdatingId.set(profile.id);

    const { data, error } = await this.userQuery.toggleUserActive(profile.id, newStatus);
    this.statusUpdatingId.set(null);

    if (error) {
      this.showToast(`Error: ${error}`, 'danger');
    } else {
      // Optimistically update local profile signal
      this.profiles.update((list) =>
        list.map((p) => (p.id === profile.id ? { ...p, is_active: newStatus } : p))
      );

      const statusText = newStatus ? 'activated' : 'deactivated';
      this.showToast(
        `User "${this.getFullName(profile)}" has been ${statusText}!`,
        newStatus ? 'success' : 'warning'
      );
    }
  }

  // -----------------------------------------------------------------
  // Add User Modal Actions
  // -----------------------------------------------------------------
  openAddUserModal() {
    this.newFirstName = '';
    this.newLastName = '';
    this.newEmail = '';
    this.newPassword = '';
    this.newIsActive = true;
    this.showPassword = false;
    this.modalErrorMessage.set(null);
    this.isAddModalOpen.set(true);
  }

  closeAddUserModal() {
    this.modalErrorMessage.set(null);
    this.isAddModalOpen.set(false);
  }

  toggleShowPassword() {
    this.showPassword = !this.showPassword;
  }

  async onSaveUser() {
    this.modalErrorMessage.set(null);
    const firstName = this.newFirstName.trim();
    const email = this.newEmail.trim().toLowerCase();
    const password = this.newPassword;

    if (!firstName) {
      this.modalErrorMessage.set('Please enter the user\'s first name.');
      this.showToast('Please enter the user\'s first name', 'warning');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      this.modalErrorMessage.set('Please enter a valid email address.');
      this.showToast('Please enter a valid email address', 'warning');
      return;
    }

    if (!password || password.length < 6) {
      this.modalErrorMessage.set('Password must be at least 6 characters long.');
      this.showToast('Password must be at least 6 characters long', 'warning');
      return;
    }

    this.isSubmitting.set(true);

    const payload: CreateUserDTO = {
      first_name: firstName,
      last_name: this.newLastName.trim(),
      email,
      password,
      is_active: this.newIsActive,
    };

    const { data, error } = await this.userQuery.createUser(payload);
    this.isSubmitting.set(false);

    if (error) {
      this.modalErrorMessage.set(error);
      this.showToast(error, 'danger');
    } else {
      this.showToast(`User "${firstName}" created successfully!`, 'success');
      this.closeAddUserModal();
      await this.fetchProfiles();
    }
  }

  // -----------------------------------------------------------------
  // Edit User Modal Actions
  // -----------------------------------------------------------------
  openEditModal(profile: Profile, event?: Event) {
    if (event) event.stopPropagation();

    this.editingUserId = profile.id;
    this.editFirstName = profile.first_name || '';
    this.editLastName = profile.last_name || '';
    this.editIsActive = profile.is_active;
    this.isEditModalOpen.set(true);
  }

  closeEditModal() {
    this.isEditModalOpen.set(false);
  }

  async onUpdateUser() {
    if (!this.editingUserId) return;

    const firstName = this.editFirstName.trim();
    if (!firstName) {
      this.showToast('Please enter first name', 'warning');
      return;
    }

    this.isEditSubmitting.set(true);

    const targetUser = this.profiles().find((p) => p.id === this.editingUserId);
    const isTargetAdmin = targetUser ? this.isAdminUser(targetUser) : false;

    // Safety: Admin is always active
    const finalIsActive = isTargetAdmin ? true : this.editIsActive;

    const { data, error } = await this.userQuery.updateProfile(this.editingUserId, {
      first_name: firstName,
      last_name: this.editLastName.trim(),
      is_active: finalIsActive,
    });

    this.isEditSubmitting.set(false);

    if (error) {
      this.showToast(`Error: ${error}`, 'danger');
    } else {
      this.showToast('User updated successfully!', 'success');
      this.closeEditModal();
      await this.fetchProfiles();
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
