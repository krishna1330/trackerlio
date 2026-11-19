import { Component, inject, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import {
  IonApp,
  IonSplitPane,
  IonMenu,
  IonHeader,
  IonToolbar,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonAccordionGroup,
  IonAccordion,
  IonRouterOutlet,
  IonFooter,
  IonButton,
  IonBadge,
  MenuController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  homeOutline,
  wallet,
  walletOutline,
  receiptOutline,
  pricetagsOutline,
  peopleOutline,
  logOutOutline,
  chevronForwardOutline,
  personCircleOutline,
  cardOutline,
  pieChartOutline,
} from 'ionicons/icons';
import { SupabaseService } from './services/supabase.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    IonApp,
    IonSplitPane,
    IonMenu,
    IonHeader,
    IonToolbar,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    IonAccordionGroup,
    IonAccordion,
    IonRouterOutlet,
    IonFooter,
    IonButton,
    IonBadge,
  ],
})
export class AppComponent implements OnInit {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly menuCtrl = inject(MenuController);

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
      homeOutline,
      wallet,
      walletOutline,
      receiptOutline,
      pricetagsOutline,
      peopleOutline,
      logOutOutline,
      chevronForwardOutline,
      personCircleOutline,
      cardOutline,
      pieChartOutline,
    });
  }

  async ngOnInit() {
    if (Capacitor.isNativePlatform()) {
      try {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#0f101a' });
        const info = await StatusBar.getInfo();
        if (info && typeof info.height === 'number' && info.height > 0) {
          document.documentElement.style.setProperty('--app-status-bar-height', `${info.height}px`);
        }
      } catch (err) {
        console.warn('StatusBar initialization:', err);
      }
    }
  }

  async closeMenuOnMobile() {
    // Closes the drawer on mobile after clicking a link
    await this.menuCtrl.close();
  }

  async onSignOut() {
    await this.supabase.signOut();
    await this.closeMenuOnMobile();
    this.router.navigate(['/home']);
  }
}
