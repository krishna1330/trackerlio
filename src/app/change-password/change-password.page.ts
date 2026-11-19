import { Component, inject, signal } from '@angular/core';
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
  lockClosedOutline,
  eyeOutline,
  eyeOffOutline,
  keyOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  arrowBackOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import { SupabaseService } from '../services/supabase.service';
import { HeaderComponent } from '../components/header/header.component';

@Component({
  selector: 'app-change-password',
  templateUrl: './change-password.page.html',
  styleUrls: ['./change-password.page.scss'],
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
export class ChangePasswordPage {
  private readonly supabase = inject(SupabaseService);
  private readonly toastCtrl = inject(ToastController);
  private readonly router = inject(Router);

  readonly currentUser = this.supabase.currentUser;

  // Form Fields
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  // Visibility toggles
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  // State signals
  readonly loading = signal<boolean>(false);
  readonly message = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  constructor() {
    addIcons({
      lockClosedOutline,
      eyeOutline,
      eyeOffOutline,
      keyOutline,
      checkmarkCircleOutline,
      alertCircleOutline,
      arrowBackOutline,
      shieldCheckmarkOutline,
    });
  }

  toggleShowCurrentPassword() {
    this.showCurrentPassword = !this.showCurrentPassword;
  }

  toggleShowNewPassword() {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleShowConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  async onChangePassword() {
    this.message.set(null);

    const user = this.currentUser();
    if (!user || !user.email) {
      this.message.set({ type: 'error', text: 'You must be logged in to change your password.' });
      return;
    }

    const cur = this.currentPassword;
    const next = this.newPassword;
    const confirm = this.confirmPassword;

    // 1. Validation: Field requirements
    if (!cur) {
      this.message.set({ type: 'error', text: 'Please enter your current password.' });
      this.showToast('Please enter your current password', 'warning');
      return;
    }

    if (!next) {
      this.message.set({ type: 'error', text: 'Please enter your new password.' });
      this.showToast('Please enter your new password', 'warning');
      return;
    }

    // 2. Validation: Length requirement
    if (next.length < 6) {
      this.message.set({
        type: 'error',
        text: 'New password must be at least 6 characters long.',
      });
      this.showToast('New password must be at least 6 characters', 'warning');
      return;
    }

    // 3. Validation: Distinct password requirement
    if (cur === next) {
      this.message.set({
        type: 'error',
        text: 'New password cannot be identical to your current password.',
      });
      this.showToast('New password must be different from current password', 'warning');
      return;
    }

    // 4. Validation: Confirmation match
    if (next !== confirm) {
      this.message.set({
        type: 'error',
        text: 'New password and confirmation password do not match.',
      });
      this.showToast('Passwords do not match', 'warning');
      return;
    }

    this.loading.set(true);

    try {
      // 5. Verification: Verify current password with Supabase
      const { error: verifyError } = await this.supabase.signInWithPassword({
        email: user.email,
        password: cur,
      });

      if (verifyError) {
        this.loading.set(false);
        this.message.set({
          type: 'error',
          text: 'The current password you entered is incorrect. Please try again.',
        });
        this.showToast('Current password is incorrect', 'danger');
        return;
      }

      // 6. Update password in Supabase
      const { error: updateError } = await this.supabase.client.auth.updateUser({
        password: next,
      });

      this.loading.set(false);

      if (updateError) {
        this.message.set({
          type: 'error',
          text: `Failed to update password: ${updateError.message}`,
        });
        this.showToast(`Error: ${updateError.message}`, 'danger');
        return;
      }

      // Success: clear form fields
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';
      this.showCurrentPassword = false;
      this.showNewPassword = false;
      this.showConfirmPassword = false;

      this.message.set({
        type: 'success',
        text: 'Your password has been changed successfully! Your account is now secured with the new password.',
      });
      this.showToast('Password changed successfully!', 'success');
    } catch (err: unknown) {
      this.loading.set(false);
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred while changing password.';
      this.message.set({ type: 'error', text: msg });
      this.showToast(msg, 'danger');
    }
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'bottom',
    });
    await toast.present();
  }
}
