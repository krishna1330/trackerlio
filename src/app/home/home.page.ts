import { Component, OnInit, inject, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonSpinner,
  IonIcon,
  IonModal,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  mailOutline,
  lockClosedOutline,
  eyeOutline,
  eyeOffOutline,
  wallet,
  walletOutline,
  arrowForwardOutline,
  alertCircleOutline,
  checkmarkCircleOutline,
  logOutOutline,
  addOutline,
  pieChartOutline,
  barChartOutline,
  trendingUpOutline,
  calendarOutline,
  receiptOutline,
  cardOutline,
  closeOutline,
  pricetagOutline,
  timeOutline,
  chevronDownOutline,
  micOutline,
  mic,
  sparklesOutline,
} from 'ionicons/icons';
import { SupabaseService } from '../services/supabase.service';
import { HeaderComponent } from '../components/header/header.component';
import { ExpenseQueryService, CreateExpenseDTO } from '../database-queries/expense.query';
import { CategoryQueryService } from '../database-queries/category.query';
import { AccountQueryService } from '../database-queries/account.query';
import { VoiceRecognitionService } from '../services/voice-recognition.service';
import { VoiceExpenseAiService } from '../services/voice-expense-ai.service';
import { Expense, Category, Account } from '../models/database.types';

export interface MonthlyBarData {
  year: number;
  month: number;
  label: string;
  fullLabel: string;
  total: number;
  count: number;
  heightPercent: number;
  isCurrent: boolean;
}

export interface CategoryPieSlice {
  id: string;
  name: string;
  total: number;
  percentage: number;
  count: number;
  color: string;
  dashArray: string;
  dashOffset: number;
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [
    CommonModule,
    DecimalPipe,
    FormsModule,
    HeaderComponent,
    IonContent,
    IonSpinner,
    IonIcon,
    IonModal,
  ],
})
export class HomePage implements OnInit {
  readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly expenseQuery = inject(ExpenseQueryService);
  private readonly categoryQuery = inject(CategoryQueryService);
  private readonly accountQuery = inject(AccountQueryService);
  private readonly toastCtrl = inject(ToastController);

  // Authentication State (for logged out visitors)
  email = '';
  password = '';
  showPassword = false;
  loadingAuth = signal(false);
  authMessage = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  // Dashboard Data State (for logged in users)
  readonly dashboardLoading = signal(true);
  readonly currentMonthExpenses = signal<Expense[]>([]);
  readonly monthlyBarHistory = signal<MonthlyBarData[]>([]);
  readonly activeCategorySlice = signal<CategoryPieSlice | null>(null);
  readonly activeBarData = signal<MonthlyBarData | null>(null);

  // Categories & Accounts for Add Expense Modal
  readonly categories = signal<Category[]>([]);
  readonly accounts = signal<Account[]>([]);

  // Voice AI Expense State
  readonly voiceService = inject(VoiceRecognitionService);
  private readonly voiceAiService = inject(VoiceExpenseAiService);
  readonly isVoiceModalOpen = signal(false);
  readonly isAiProcessing = signal(false);
  readonly voiceSpokenText = signal('');
  manualVoiceCommand = '';

  // Add Expense Modal State
  readonly isAddModalOpen = signal(false);
  readonly isSubmittingExpense = signal(false);
  newExpenseName = '';
  newExpenseAmount: number | null = null;
  newExpenseDate = this.getTodayDateString();
  newExpenseCategoryId = '';
  newExpenseAccountId = '';
  newExpenseComments = '';

  private readonly today = new Date();
  readonly currentYear = this.today.getFullYear();
  readonly currentMonth = this.today.getMonth() + 1;

  readonly currentMonthName = this.today.toLocaleString('default', { month: 'long' });

  // Vibrant chart palette for categories
  private readonly sliceColors = [
    '#8b5cf6', // Violet
    '#06b6d4', // Cyan
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ec4899', // Pink
    '#6366f1', // Indigo
    '#f43f5e', // Rose
    '#14b8a6', // Teal
    '#84cc16', // Lime
    '#a855f7', // Purple
  ];

  // Computed: Current month total
  readonly currentMonthTotal = computed(() => {
    return this.currentMonthExpenses().reduce((sum, e) => sum + Number(e.amount || 0), 0);
  });

  // Computed: Current month count
  readonly currentMonthCount = computed(() => this.currentMonthExpenses().length);

  // Computed: Top Category this month
  readonly topCategory = computed(() => {
    const slices = this.categorySlices();
    return slices.length > 0 ? slices[0] : null;
  });

  // Computed: Category Slices for Donut / Pie Chart
  readonly categorySlices = computed<CategoryPieSlice[]>(() => {
    const list = this.currentMonthExpenses();
    const total = this.currentMonthTotal();
    if (total <= 0 || list.length === 0) return [];

    const groupMap = new Map<string, { id: string; name: string; total: number; count: number }>();

    for (const exp of list) {
      const catId = exp.category_id || 'uncategorized';
      const catName =
        exp.categories?.category_name ||
        exp.category?.category_name ||
        this.categories().find((c) => c.id === catId)?.category_name ||
        'Miscellaneous';

      const entry = groupMap.get(catId) || { id: catId, name: catName, total: 0, count: 0 };
      entry.total += Number(exp.amount || 0);
      entry.count += 1;
      groupMap.set(catId, entry);
    }

    const sorted = Array.from(groupMap.values()).sort((a, b) => b.total - a.total);

    let cumulativeOffset = 25; // start at top (12 o'clock)
    return sorted.map((item, idx) => {
      const percentage = Math.round((item.total / total) * 100);
      const color = this.sliceColors[idx % this.sliceColors.length];
      const slicePct = (item.total / total) * 100;
      const dashArray = `${slicePct} ${100 - slicePct}`;
      const dashOffset = cumulativeOffset;
      cumulativeOffset -= slicePct;

      return {
        id: item.id,
        name: item.name,
        total: item.total,
        percentage,
        count: item.count,
        color,
        dashArray,
        dashOffset,
      };
    });
  });

  constructor() {
    addIcons({
      mailOutline,
      lockClosedOutline,
      eyeOutline,
      eyeOffOutline,
      wallet,
      walletOutline,
      arrowForwardOutline,
      alertCircleOutline,
      checkmarkCircleOutline,
      logOutOutline,
      addOutline,
      pieChartOutline,
      barChartOutline,
      trendingUpOutline,
      calendarOutline,
      receiptOutline,
      cardOutline,
      closeOutline,
      pricetagOutline,
      timeOutline,
      chevronDownOutline,
      micOutline,
      mic,
      sparklesOutline,
    });

    // Automatically load or refresh dashboard data when user logs in and is active
    effect(() => {
      const user = this.supabase.currentUser();
      const profile = this.supabase.currentProfile();
      if (user) {
        if (profile && profile.is_active === false) {
          untracked(async () => {
            await this.supabase.signOut();
            this.supabase.currentSession.set(null);
            this.supabase.currentUser.set(null);
            this.supabase.currentProfile.set(null);
            this.authMessage.set({
              type: 'error',
              text: 'Your account has been deactivated. Please contact the administrator.',
            });
          });
          return;
        }
        untracked(() => {
          this.loadDashboardData();
        });
      } else {
        // Logged out: immediately clear any lingering auth messages and credentials
        untracked(() => {
          this.authMessage.set(null);
          this.password = '';
        });
      }
    });
  }

  async ngOnInit() {
    if (this.supabase.currentUser()) {
      const profile = this.supabase.currentProfile();
      if (profile && profile.is_active === false) {
        await this.supabase.signOut();
        this.supabase.currentSession.set(null);
        this.supabase.currentUser.set(null);
        this.supabase.currentProfile.set(null);
        this.authMessage.set({
          type: 'error',
          text: 'Your account has been deactivated. Please contact the administrator.',
        });
        return;
      }
      await this.loadDashboardData();
    } else {
      try {
        const {
          data: { session },
        } = await this.supabase.client.auth.getSession();
        if (session?.user) {
          const profile = await this.supabase.loadUserProfile(session.user.id);
          if (profile && profile.is_active === false) {
            await this.supabase.signOut();
            this.supabase.currentSession.set(null);
            this.supabase.currentUser.set(null);
            this.supabase.currentProfile.set(null);
            this.authMessage.set({
              type: 'error',
              text: 'Your account has been deactivated. Please contact the administrator.',
            });
            return;
          }
          this.supabase.currentSession.set(session);
          this.supabase.currentUser.set(session.user);
          await this.loadDashboardData();
        }
      } catch (err) {
        console.error('Session restoration error on HomePage:', err);
      }
    }
  }

  // -----------------------------------------------------------------
  // Load Dashboard Data (Last 5 Months Bar History & Current Month Categories)
  // -----------------------------------------------------------------
  async loadDashboardData() {
    this.dashboardLoading.set(true);

    try {
      // 1. Fetch categories and accounts for modal dropdowns and name mappings
      const [catRes, accRes] = await Promise.all([
        this.categoryQuery.getCategories(),
        this.accountQuery.getAccounts(),
      ]);
      this.categories.set(catRes.data || []);
      this.accounts.set(accRes.data || []);

      // 2. Generate the last 5 months descriptors (e.g. Jul, Aug, Sep, Oct, Nov)
      const monthsList: { year: number; month: number; label: string; fullLabel: string }[] = [];
      for (let i = 4; i >= 0; i--) {
        const d = new Date(this.currentYear, this.currentMonth - 1 - i, 1);
        monthsList.push({
          year: d.getFullYear(),
          month: d.getMonth() + 1,
          label: d.toLocaleString('default', { month: 'short' }),
          fullLabel: d.toLocaleString('default', { month: 'long', year: 'numeric' }),
        });
      }

      // 3. Fetch expenses for all 5 months in parallel
      const monthPromises = monthsList.map((m) =>
        this.expenseQuery.getExpensesByMonth(m.year, m.month)
      );
      const monthResults = await Promise.all(monthPromises);

      // Current month expenses (the last item in monthsList)
      const currentExpenses = monthResults[monthResults.length - 1]?.data || [];
      this.currentMonthExpenses.set(currentExpenses);

      // 4. Calculate monthly totals for the bar graph
      const monthlyTotals = monthResults.map((res, idx) => {
        const list = res.data || [];
        const total = list.reduce((sum, e) => sum + Number(e.amount || 0), 0);
        return {
          ...monthsList[idx],
          total,
          count: list.length,
          isCurrent: idx === monthsList.length - 1,
        };
      });

      const maxSpend = Math.max(...monthlyTotals.map((m) => m.total), 100);

      const barHistory: MonthlyBarData[] = monthlyTotals.map((m) => ({
        ...m,
        heightPercent: m.total > 0 ? Math.max(Math.round((m.total / maxSpend) * 100), 6) : 3,
      }));

      this.monthlyBarHistory.set(barHistory);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      this.dashboardLoading.set(false);
    }
  }

  // -----------------------------------------------------------------
  // Interactive Hover Handlers for Graphs
  // -----------------------------------------------------------------
  onHoverSlice(slice: CategoryPieSlice | null) {
    this.activeCategorySlice.set(slice);
  }

  onHoverBar(bar: MonthlyBarData | null) {
    this.activeBarData.set(bar);
  }

  // -----------------------------------------------------------------
  // Voice AI Expense Actions
  // -----------------------------------------------------------------
  openVoiceModal() {
    this.manualVoiceCommand = '';
    this.voiceSpokenText.set('');
    this.isAiProcessing.set(false);
    this.isVoiceModalOpen.set(true);
  }

  closeVoiceModal() {
    this.voiceService.cancelListening();
    this.isVoiceModalOpen.set(false);
    this.isAiProcessing.set(false);
  }

  async startListeningVoice() {
    if (this.voiceService.isListening()) return;
    this.voiceSpokenText.set('');
    try {
      await this.voiceService.startListening();
    } catch (err: any) {
      console.warn('Voice listening start error:', err);
      this.showToast('Could not access microphone. Please check permissions.', 'warning');
    }
  }

  async stopVoiceAndProcess() {
    if (!this.voiceService.isListening()) return;
    this.isAiProcessing.set(true);
    try {
      const result = await this.voiceService.stopListening();
      await this.processVoiceResult(result);
    } catch (err: any) {
      this.isAiProcessing.set(false);
      this.showToast(err.message || 'Failed to capture voice recording', 'danger');
    }
  }

  async processTextCommand() {
    const text = this.manualVoiceCommand.trim();
    if (!text) return;
    await this.processVoiceResult({
      text,
      audioBase64: '',
      mimeType: '',
    });
  }

  async processVoiceResult(result: { text: string; audioBase64: string; mimeType: string }) {
    this.isAiProcessing.set(true);
    const displayText = result.text || (result.audioBase64 ? 'Processing your voice note...' : '');
    this.voiceSpokenText.set(displayText);

    if (!result.text && !result.audioBase64) {
      this.isAiProcessing.set(false);
      this.showToast('No speech detected. Please tap and speak clearly.', 'warning');
      return;
    }

    try {
      const parsed = await this.voiceAiService.parseVoiceCommand(
        result.text,
        this.categories(),
        this.accounts(),
        result.audioBase64,
        result.mimeType
      );

      this.isVoiceModalOpen.set(false);
      this.isAiProcessing.set(false);

      // Pre-fill Add Expense form with parsed values
      this.newExpenseName = parsed.expense_name || 'Expense';
      this.newExpenseAmount = parsed.amount || null;
      this.newExpenseDate = parsed.expense_date || this.getTodayDateString();
      this.newExpenseCategoryId = parsed.category_id || '';
      this.newExpenseAccountId = parsed.account_id || '';
      this.newExpenseComments = parsed.comments || result.text;

      this.isAddModalOpen.set(true);
      this.showToast('AI filled your expense details! Review & Save.', 'success');
    } catch (err: any) {
      this.isAiProcessing.set(false);
      this.showToast(err.message || 'Failed to process voice command', 'danger');
    }
  }

  // -----------------------------------------------------------------
  // Add Expense Modal Actions
  // -----------------------------------------------------------------
  openAddExpenseModal() {
    this.newExpenseName = '';
    this.newExpenseAmount = null;
    this.newExpenseDate = this.getTodayDateString();
    this.newExpenseCategoryId = '';
    this.newExpenseAccountId = '';
    this.newExpenseComments = '';

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

    this.isSubmittingExpense.set(true);

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
    this.isSubmittingExpense.set(false);

    if (error) {
      this.showToast(`Error: ${error}`, 'danger');
    } else {
      this.showToast('Expense recorded successfully!', 'success');
      this.closeAddExpenseModal();
      await this.loadDashboardData();
    }
  }

  // -----------------------------------------------------------------
  // Auth Form (Logged Out State)
  // -----------------------------------------------------------------
  toggleShowPassword() {
    this.showPassword = !this.showPassword;
  }

  async onSignIn() {
    const trimmedEmail = this.email.trim();
    if (!trimmedEmail || !this.password) {
      this.authMessage.set({ type: 'error', text: 'Please enter both your email address and password.' });
      return;
    }

    this.loadingAuth.set(true);
    this.authMessage.set(null);

    const { data, error } = await this.supabase.signInWithPassword({
      email: trimmedEmail,
      password: this.password,
    });

    if (error) {
      this.loadingAuth.set(false);
      let friendlyError = error.message;
      if (error.message.toLowerCase().includes('invalid login credentials')) {
        friendlyError = 'Invalid email or password. Please verify your credentials and try again.';
      } else if (error.message.toLowerCase().includes('email not confirmed')) {
        friendlyError = 'Your email address has not been confirmed yet. Please contact the administrator.';
      }
      this.authMessage.set({ type: 'error', text: friendlyError });
      return;
    }

    if (data.session && data.user) {
      // Fetch profile to verify if this user account is active
      const profile = await this.supabase.loadUserProfile(data.user.id);

      if (profile && profile.is_active === false) {
        // Deactivated user: terminate auth immediately and display rejection banner!
        await this.supabase.signOut();
        this.supabase.currentSession.set(null);
        this.supabase.currentUser.set(null);
        this.supabase.currentProfile.set(null);
        this.loadingAuth.set(false);
        this.authMessage.set({
          type: 'error',
          text: 'Your account has been deactivated. Please contact the administrator.',
        });
        return;
      }

      this.loadingAuth.set(false);
      this.authMessage.set(null);
      this.password = '';
      this.supabase.currentSession.set(data.session);
      this.supabase.currentUser.set(data.user);
      await this.router.navigate(['/home']);
      await this.loadDashboardData();
    }
  }

  goToExpenses() {
    this.router.navigate(['/expenses']);
  }

  private getTodayDateString(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
