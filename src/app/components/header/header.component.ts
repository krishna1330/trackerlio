import { Component, Input, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonBackButton,
  IonMenuButton,
  IonIcon,
  IonPopover,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  wallet,
  walletOutline,
  personCircleOutline,
  chevronDownOutline,
  logOutOutline,
  logInOutline,
  peopleOutline,
  receiptOutline,
  homeOutline,
  personOutline,
  keyOutline,
} from 'ionicons/icons';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  imports: [
    CommonModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonBackButton,
    IonMenuButton,
    IonIcon,
    IonPopover,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
  ],
})
export class HeaderComponent {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  @Input() pageTitle?: string;
  @Input() showBackButton: boolean = false;
  @Input() defaultBackHref: string = '/home';

  readonly currentUser = this.supabase.currentUser;
  readonly isAdmin = this.supabase.isAdmin;

  readonly displayName = computed(() => {
    const profile = this.supabase.currentProfile();
    const user = this.currentUser();
    if (!user) return 'Guest';

    const firstName = (profile?.first_name || user.user_metadata?.['first_name'] || '').trim();
    const lastName = (profile?.last_name || user.user_metadata?.['last_name'] || '').trim();

    if (firstName || lastName) {
      return `${firstName} ${lastName}`.trim();
    }

    if (user.email) {
      const prefix = user.email.split('@')[0];
      return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }

    return 'User';
  });

  readonly userInitials = computed(() => {
    const profile = this.supabase.currentProfile();
    const user = this.currentUser();
    if (!user) return 'U';

    const firstName = (profile?.first_name || user.user_metadata?.['first_name'] || '').trim();
    const lastName = (profile?.last_name || user.user_metadata?.['last_name'] || '').trim();

    // First letters of first and last name
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }

    // Single name handling
    if (firstName) {
      const parts = firstName.split(/\s+/);
      if (parts.length >= 2) {
        return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
      }
      return firstName.charAt(0).toUpperCase();
    }

    if (user.email) {
      return user.email.charAt(0).toUpperCase();
    }

    return 'U';
  });

  constructor() {
    addIcons({
      wallet,
      walletOutline,
      personCircleOutline,
      chevronDownOutline,
      logOutOutline,
      logInOutline,
      peopleOutline,
      receiptOutline,
      homeOutline,
      personOutline,
      keyOutline,
    });
  }

  readonly isPopoverOpen = signal<boolean>(false);
  readonly popoverEvent = signal<Event | undefined>(undefined);

  togglePopover(e: Event) {
    e.stopPropagation();
    if (this.isPopoverOpen()) {
      this.isPopoverOpen.set(false);
    } else {
      this.popoverEvent.set(e);
      this.isPopoverOpen.set(true);
    }
  }

  closePopover() {
    this.isPopoverOpen.set(false);
  }

  async onSignOut() {
    this.closePopover();
    await this.supabase.signOut();
    this.router.navigate(['/home']);
  }
}
