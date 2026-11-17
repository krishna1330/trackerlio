import { Component, Input, inject, computed } from '@angular/core';
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
    const user = this.currentUser();
    if (!user) return 'Guest';

    const meta = user.user_metadata;
    if (meta?.['first_name'] || meta?.['last_name']) {
      const full = `${meta['first_name'] || ''} ${meta['last_name'] || ''}`.trim();
      if (full) return full;
    }

    if (user.email) {
      const prefix = user.email.split('@')[0];
      return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }

    return 'User';
  });

  readonly userInitials = computed(() => {
    const name = this.displayName();
    if (!name || name === 'Guest') return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
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
    });
  }

  async onSignOut() {
    await this.supabase.signOut();
    this.router.navigate(['/home']);
  }
}
