import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonContent,
  IonSpinner,
  IonIcon,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  personOutline,
  mailOutline,
  shieldCheckmarkOutline,
  lockClosedOutline,
  saveOutline,
  keyOutline,
  copyOutline,
  checkmarkOutline,
  alertCircleOutline,
  checkmarkCircleOutline,
  cardOutline,
  calendarOutline,
} from 'ionicons/icons';
import { SupabaseService } from '../services/supabase.service';
import { UserQueryService } from '../database-queries/user.query';
import { HeaderComponent } from '../components/header/header.component';
import { Profile } from '../models/database.types';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    HeaderComponent,
    IonContent,
    IonSpinner,
    IonIcon,
  ],
})
export class ProfilePage implements OnInit {
  private readonly supabase = inject(SupabaseService);
  private readonly userQuery = inject(UserQueryService);
  private readonly toastCtrl = inject(ToastController);
  private readonly router = inject(Router);

  readonly currentUser = this.supabase.currentUser;
  readonly currentProfile = this.supabase.currentProfile;
  readonly isAdmin = this.supabase.isAdmin;

  // Form fields
  firstName = '';
  lastName = '';
  email = '';
  role = 'user';
  isActive = true;
  userId = '';
  createdAt = '';

  // State signals
  readonly loading = signal<boolean>(true);
  readonly saving = signal<boolean>(false);
  readonly copiedId = signal<boolean>(false);
  readonly message = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  readonly userInitials = computed(() => {
    const f = this.firstName.trim();
    const l = this.lastName.trim();

    if (f && l) {
      return `${f.charAt(0)}${l.charAt(0)}`.toUpperCase();
    }
    if (f) {
      const parts = f.split(/\s+/);
      if (parts.length >= 2) {
        return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
      }
      return f.charAt(0).toUpperCase();
    }
    if (this.email) {
      return this.email.charAt(0).toUpperCase();
    }
    return 'U';
  });

  readonly formattedCreatedDate = computed(() => {
    if (!this.createdAt) return 'Recently';
    try {
      const d = new Date(this.createdAt);
      return d.toLocaleDateString('default', { month: 'long', year: 'numeric' });
    } catch {
      return this.createdAt;
    }
  });

  constructor() {
    addIcons({
      personOutline,
      mailOutline,
      shieldCheckmarkOutline,
      lockClosedOutline,
      saveOutline,
      keyOutline,
      copyOutline,
      checkmarkOutline,
      alertCircleOutline,
      checkmarkCircleOutline,
      cardOutline,
      calendarOutline,
    });
  }

  async ngOnInit() {
    await this.loadProfileData();
  }

  async loadProfileData() {
    this.loading.set(true);
    this.message.set(null);

    try {
      const user = this.currentUser();
      if (!user) {
        this.router.navigate(['/home']);
        return;
      }

      this.userId = user.id;
      this.email = user.email || '';

      // Load profile record
      const profile = await this.supabase.loadUserProfile(user.id);

      if (profile) {
        this.firstName = profile.first_name || '';
        this.lastName = profile.last_name || '';
        this.role = profile.role || 'user';
        this.isActive = profile.is_active !== false;
        this.createdAt = profile.created_at || '';
      } else {
        // Fallback from auth user metadata
        const meta = user.user_metadata;
        this.firstName = meta?.['first_name'] || '';
        this.lastName = meta?.['last_name'] || '';
        this.role = meta?.['role'] || 'user';
        this.isActive = true;
        this.createdAt = user.created_at || '';
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      this.message.set({ type: 'error', text: 'Failed to load profile details.' });
    } finally {
      this.loading.set(false);
    }
  }

  async onSaveProfile() {
    const trimmedFirst = this.firstName.trim();
    const trimmedLast = this.lastName.trim();

    if (!trimmedFirst) {
      this.message.set({ type: 'error', text: 'First name cannot be empty.' });
      this.showToast('Please enter your first name', 'warning');
      return;
    }

    this.saving.set(true);
    this.message.set(null);

    try {
      // 1. Update public.profiles table
      const { error: profileError } = await this.userQuery.updateProfile(this.userId, {
        first_name: trimmedFirst,
        last_name: trimmedLast,
      });

      if (profileError) {
        this.message.set({ type: 'error', text: `Failed to update profile: ${profileError}` });
        this.showToast(`Error: ${profileError}`, 'danger');
        return;
      }

      // 2. Also update auth user metadata so session metadata stays perfectly in sync
      await this.supabase.client.auth.updateUser({
        data: {
          first_name: trimmedFirst,
          last_name: trimmedLast,
        },
      });

      // 3. Reload current profile signal in SupabaseService
      await this.supabase.loadUserProfile(this.userId);

      this.message.set({ type: 'success', text: 'Profile updated successfully!' });
      this.showToast('Profile updated successfully!', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred while updating profile.';
      this.message.set({ type: 'error', text: msg });
      this.showToast(msg, 'danger');
    } finally {
      this.saving.set(false);
    }
  }

  copyUserId() {
    if (!this.userId) return;
    navigator.clipboard.writeText(this.userId);
    this.copiedId.set(true);
    this.showToast('User ID copied to clipboard!', 'success');
    setTimeout(() => this.copiedId.set(false), 2000);
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
