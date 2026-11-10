/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from './context/AuthContext';
import { useMoneyChallenge } from './hooks/useMoneyChallenge';
import { AuthScreen } from './components/AuthScreen';
import { EmailVerificationScreen } from './components/EmailVerificationScreen';
import { ResetPasswordScreen } from './components/ResetPasswordScreen';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DepositModal } from './components/DepositModal';
import { GoalModal } from './components/GoalModal';
import { EditGoalModal } from './components/EditGoalModal';
import { AvulsoDepositModal } from './components/AvulsoDepositModal';
import { SettingsModal } from './components/SettingsModal';
import { ProfileModal } from './components/ProfileModal';
import { MoneChatModal } from './components/MoneChatModal';
import { MoneMascot } from './components/MoneMascot';
import { getMoneMood } from './utils/moneMood';
import { CelebrationModal } from './components/CelebrationModal';
import { AchievementToast } from './components/AchievementToast';
import { FinanceDashboard } from './components/FinanceDashboard';
import { ObjectivesView } from './components/ObjectivesView';
import { NavigationDrawerModal } from './components/NavigationDrawerModal';
import { SharedAccountsView } from './components/shared/SharedAccountsView';
import { FiftyTwoWeekChallengeView } from './components/FiftyTwoWeekChallengeView';
import { FullReportView } from './components/FullReportView';
import { AccountsView } from './components/AccountsView';
import { FinancialCalendarView } from './components/FinancialCalendarView';
import { MonthlyFreedomScale } from './components/MonthlyFreedomScale';
import { RitmoDiarioView } from './components/RitmoDiarioView';
import { getCurrentMonthStr } from './utils/finance';
import { BottomNav, MainNavArea } from './components/BottomNav';
import { QuickActionFAB } from './components/QuickActionFAB';
import { VoiceLauncherFAB } from './components/VoiceLauncherFAB';
import { VoiceConfirmationSheet } from './components/VoiceConfirmationSheet';
import { useVoicePreferences } from './hooks/useVoicePreferences';
import { ParsedLancamentoItem } from './types/voice';
import { PlanningView } from './components/PlanningView';
import { GoalsCenterView } from './components/GoalsCenterView';
import { TransactionModal, TransactionType } from './components/TransactionModal';
import { TransferBetweenAccountsModal } from './components/TransferBetweenAccountsModal';
import { useAccounts } from './hooks/useAccounts';
import { useFinanceControl } from './hooks/useFinanceControl';
import { useSharedAccounts } from './hooks/useSharedAccounts';
import { useCategories } from './hooks/useCategories';
import { useFiftyTwoWeekChallenge } from './hooks/useFiftyTwoWeekChallenge';
import { Bot, Sparkles, Loader2, CheckCircle2, Undo2 } from 'lucide-react';
import { getTranslations } from './utils/i18n';
import { db } from './firebase/config';
import { collection, doc, getDocs, getDoc, setDoc } from 'firebase/firestore';

export default function App() {
  const { user, loading: authLoading, signOutUser } = useAuth();
  const lang = 'pt';

  const {
    goals,
    activeGoal,
    activeCurrency,
    activeGoalSquares,
    savedAmount,
    targetAmount,
    remainingAmount,
    financialProgressPercent,
    completedSquaresCount,
    totalSquaresCount,
    squaresProgressPercent,
    loadingData,
    settings,
    unlockedAchievements,
    recentAchievement,
    clearRecentAchievement,
    justFinishedAll,
    clearJustFinishedAll,
    completeSquare,
    uncompleteSquare,
    addAvulsoDeposit,
    createGoal,
    updateGoal,
    deleteGoal,
    switchGoal,
    updateSettings,
    resetActiveGoal,
    resetAllData,
    exportData,
    importData,
  } = useMoneyChallenge();

  const currentLang = settings.language || 'pt';
  const t = getTranslations(currentLang);

  const { getCategoriesFor, addCategory, allDisplayCategories, updateCategory, deleteCategory, resetPredefinedCategories } = useCategories();
  const sharedAccounts = useSharedAccounts();
  const fiftyTwoChallenge = useFiftyTwoWeekChallenge();
  const { accounts, totalBalance: accountsTotalBalance, adjustAccountBalanceForFinancialItem, transferBetweenAccounts } = useAccounts();

  // Hook into finance data for Mone assistant
  const {
    bills,
    monthBills,
    incomes,
    expenses,
    currentBalance,
    forecastBalance,
    statusRecords,
    financeSettings,
    updateRitmoDiarioConfig,
    addBill,
    updateBill,
    deleteBill,
    deleteBillOccurrence,
    toggleBillPaid,
    addIncome,
    updateIncome,
    deleteIncome,
    toggleIncomeReceived,
    addExpense,
    updateExpense,
    deleteExpense,
    updateCurrentBalance,
    resetAllFinanceData,
  } = useFinanceControl(sharedAccounts.sharedBills, accounts.length > 0 ? accountsTotalBalance : undefined);

  const overdueBillsCount = useMemo(() => {
    return (monthBills || []).filter((b) => b.status === 'overdue').length;
  }, [monthBills]);

  const hasFinanceData = bills.length > 0 || expenses.length > 0 || incomes.length > 0;

  const moneMoodObj = useMemo(() => {
    return getMoneMood({
      forecastBalance,
      currentBalance,
      overdueCount: overdueBillsCount,
      hasData: hasFinanceData,
    });
  }, [forecastBalance, currentBalance, overdueBillsCount, hasFinanceData]);

  const moneMoodLabel = (t[moneMoodObj.moodLabelKey] as string) || '';

  const handleFactoryResetAll = useCallback(async () => {
    await resetAllFinanceData();
    await resetAllData();
  }, [resetAllFinanceData, resetAllData]);

  // Complete Account Backup: exports bills, incomes, expenses, categories, statusRecords, balance, goals, settings
  const handleExportCompleteBackup = useCallback(async () => {
    if (!user) return;
    try {
      let customCategories: any[] = [];
      let categoryOverrides: any = null;
      let savingsList: any[] = [];
      let savingTxList: any[] = [];
      try {
        const catSnap = await getDocs(collection(db, 'users', user.uid, 'categories'));
        catSnap.forEach((d) => customCategories.push(d.data()));
        const overridesDoc = await getDoc(doc(db, 'users', user.uid, 'settings', 'category_overrides'));
        if (overridesDoc.exists()) {
          categoryOverrides = overridesDoc.data();
        }
        const savingsSnap = await getDocs(collection(db, 'users', user.uid, 'savings'));
        savingsSnap.forEach((d) => savingsList.push(d.data()));
        const txSnap = await getDocs(collection(db, 'users', user.uid, 'saving_transactions'));
        txSnap.forEach((d) => savingTxList.push(d.data()));
      } catch (err) {
        console.warn('Could not read categories or savings for backup:', err);
      }

      const backup = {
        version: 3,
        app: 'money-challenge-finance',
        userId: user.uid,
        exportedAt: new Date().toISOString(),
        settings,
        currentBalance,
        goals,
        bills,
        incomes,
        expenses,
        savings: savingsList,
        savingTransactions: savingTxList,
        statusRecords,
        customCategories,
        categoryOverrides,
        unlockedAchievements,
      };

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(backup, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute(
        'download',
        `backup-completo-financas-${new Date().toISOString().slice(0, 10)}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      console.error('Export complete backup failed:', err);
    }
  }, [
    user,
    settings,
    currentBalance,
    goals,
    bills,
    incomes,
    expenses,
    statusRecords,
    unlockedAchievements,
  ]);

  // Complete Account Restore: restores bills, incomes, expenses, categories, statusRecords, balance, goals, settings
  const handleImportCompleteBackup = useCallback(
    async (jsonString: string): Promise<boolean> => {
      if (!user) return false;
      try {
        const parsed = JSON.parse(jsonString);
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Arquivo de backup inválido.');
        }

        const now = new Date().toISOString();

        // 1. Restore Goals
        if (Array.isArray(parsed.goals) && parsed.goals.length > 0) {
          for (const g of parsed.goals) {
            if (!g.id) continue;
            await setDoc(doc(db, 'users', user.uid, 'goals', g.id), {
              ...g,
              userId: user.uid,
              updatedAt: now,
            });
          }
        }

        // 2. Restore Bills
        if (Array.isArray(parsed.bills)) {
          for (const b of parsed.bills) {
            if (!b.id) continue;
            await setDoc(doc(db, 'users', user.uid, 'bills', b.id), {
              ...b,
              userId: user.uid,
              updatedAt: now,
            });
          }
        }

        // 3. Restore Incomes
        if (Array.isArray(parsed.incomes)) {
          for (const inc of parsed.incomes) {
            if (!inc.id) continue;
            await setDoc(doc(db, 'users', user.uid, 'incomes', inc.id), {
              ...inc,
              userId: user.uid,
              updatedAt: now,
            });
          }
        }

        // 4. Restore Expenses
        if (Array.isArray(parsed.expenses)) {
          for (const exp of parsed.expenses) {
            if (!exp.id) continue;
            await setDoc(doc(db, 'users', user.uid, 'expenses', exp.id), {
              ...exp,
              userId: user.uid,
              updatedAt: now,
            });
          }
        }

        // 5. Restore Status Records (monthly payment/receipt states)
        if (Array.isArray(parsed.statusRecords)) {
          for (const s of parsed.statusRecords) {
            if (!s.id) continue;
            await setDoc(doc(db, 'users', user.uid, 'monthly_status', s.id), {
              ...s,
              userId: user.uid,
              updatedAt: now,
            });
          }
        }

        // 6. Restore Custom Categories
        if (Array.isArray(parsed.customCategories)) {
          for (const c of parsed.customCategories) {
            if (!c.id) continue;
            await setDoc(doc(db, 'users', user.uid, 'categories', c.id), {
              ...c,
              userId: user.uid,
              updatedAt: now,
            });
          }
        }

        // 7. Restore Category Overrides
        if (parsed.categoryOverrides) {
          await setDoc(
            doc(db, 'users', user.uid, 'settings', 'category_overrides'),
            parsed.categoryOverrides
          );
        }

        // 8. Restore Balance / Finance Settings
        if (parsed.currentBalance !== undefined || parsed.financeSettings) {
          const bal = Number(parsed.currentBalance ?? parsed.financeSettings?.currentBalance ?? 0);
          await setDoc(doc(db, 'users', user.uid, 'finance_settings', 'main'), {
            userId: user.uid,
            currentBalance: bal,
            initialBalance: parsed.financeSettings?.initialBalance ?? bal,
            updatedAt: now,
          });
        }

        // 9. Restore App Settings (currency, language, theme, sound)
        if (parsed.settings && typeof parsed.settings === 'object') {
          await updateSettings(parsed.settings);
        }

        // 10. Restore achievements
        if (Array.isArray(parsed.unlockedAchievements)) {
          await setDoc(doc(db, 'users', user.uid, 'achievements', 'unlocked'), {
            list: parsed.unlockedAchievements,
            updatedAt: now,
          });
        }

        // 11. Restore Savings Goals
        if (Array.isArray(parsed.savings)) {
          for (const s of parsed.savings) {
            if (!s.id) continue;
            await setDoc(doc(db, 'users', user.uid, 'savings', s.id), {
              ...s,
              userId: user.uid,
              updatedAt: now,
            });
          }
        }

        // 12. Restore Savings Transactions
        if (Array.isArray(parsed.savingTransactions)) {
          for (const tx of parsed.savingTransactions) {
            if (!tx.id) continue;
            await setDoc(doc(db, 'users', user.uid, 'saving_transactions', tx.id), {
              ...tx,
              userId: user.uid,
            });
          }
        }

        return true;
      } catch (err) {
        console.error('Import / Restore error:', err);
        return false;
      }
    },
    [user, updateSettings]
  );

  // Navigation View: Controle financeiro, Planejar, Metas, Percepções, Contas, Contas Compartilhadas, etc.
  const [currentView, setCurrentView] = useState<
    'finance' | 'planejar' | 'goals' | 'savings' | 'categories' | 'report' | 'shared_accounts' | 'challenge_52' | 'full_report' | 'accounts' | 'financial_calendar' | 'freedom' | 'daily_pace'
  >('finance');

  const currentNavArea: MainNavArea = useMemo(() => {
    if (currentView === 'planejar' || currentView === 'financial_calendar' || currentView === 'freedom') {
      return 'planejar';
    }
    if (currentView === 'report' || currentView === 'full_report') {
      return 'report';
    }
    if (currentView === 'goals' || currentView === 'savings' || currentView === 'challenge_52') {
      return 'goals';
    }
    if (currentView === 'accounts') {
      return 'accounts';
    }
    return 'finance';
  }, [currentView]);

  const handleChangeNavArea = useCallback((area: MainNavArea) => {
    setCurrentView(area);
  }, []);

  // Global FAB Transaction & Transfer Modals
  const [isGlobalTxModalOpen, setIsGlobalTxModalOpen] = useState(false);
  const [globalTxModalType, setGlobalTxModalType] = useState<TransactionType>('expense');
  const [isGlobalTransferModalOpen, setIsGlobalTransferModalOpen] = useState(false);

  // Voice Launcher & Confirmation state
  const { userPreferences, saveCategoryPreference } = useVoicePreferences();
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);
  const [isVoiceSheetOpen, setIsVoiceSheetOpen] = useState(false);
  const [isVoiceTriggered, setIsVoiceTriggered] = useState(false);
  const [voiceRawText, setVoiceRawText] = useState('');
  const [voiceParsedItems, setVoiceParsedItems] = useState<ParsedLancamentoItem[]>([]);
  const [voiceUndoToast, setVoiceUndoToast] = useState<{
    show: boolean;
    count: number;
    addedIds: Array<{ type: 'expense' | 'income' | 'bill'; id: string }>;
  } | null>(null);

  const availableCategoriesList = useMemo(() => getCategoriesFor('all'), [getCategoriesFor]);

  const handleParsedVoiceSuccess = useCallback((items: ParsedLancamentoItem[], rawText: string) => {
    setVoiceRawText(rawText);
    setVoiceParsedItems(items);
    setIsVoiceSheetOpen(true);
  }, []);

  const handleConfirmVoiceItems = useCallback(
    async (items: ParsedLancamentoItem[]) => {
      const addedIds: Array<{ type: 'expense' | 'income' | 'bill'; id: string }> = [];

      for (const item of items) {
        if (item.tipo === 'despesa') {
          const isInstallment = Boolean(item.parcelas && item.parcelas > 1);
          const expAmount = isInstallment
            ? Math.round((item.valor / item.parcelas!) * 100) / 100
            : item.valor;

          const createdExp = await addExpense({
            name: `${item.descricao}${isInstallment ? ` (1/${item.parcelas})` : ''}`,
            amount: expAmount,
            date: item.data || new Date().toISOString().split('T')[0],
            category: item.categoria || 'Outros',
            accountId: item.contaId || undefined,
          });

          if (createdExp && createdExp.id) {
            addedIds.push({ type: 'expense', id: createdExp.id });
          }

          if (item.contaId) {
            await adjustAccountBalanceForFinancialItem(item.contaId, -expAmount);
          }
        } else if (item.tipo === 'receita') {
          const createdInc = await addIncome({
            name: item.descricao,
            amount: item.valor,
            expectedDate: item.data || new Date().toISOString().split('T')[0],
            expectedDay: parseInt((item.data || '').split('-')[2]) || 1,
            category: item.categoria || 'Outros',
            recurrence: item.recorrencia === 'monthly' ? 'monthly' : 'none',
            startMonth: (item.data || '').substring(0, 7) || getCurrentMonthStr(),
            accountId: item.contaId || undefined,
          });

          if (createdInc && createdInc.id) {
            addedIds.push({ type: 'income', id: createdInc.id });
          }
        } else if (item.tipo === 'fatura') {
          const createdBill = await addBill({
            name: item.descricao,
            amount: item.valor,
            dueDate: item.data || new Date().toISOString().split('T')[0],
            dueDay: parseInt((item.data || '').split('-')[2]) || 1,
            category: item.categoria || 'Outros',
            recurrence: item.recorrencia === 'monthly' ? 'monthly' : 'none',
            recurrenceMonthsCount: item.parcelas && item.parcelas > 1 ? item.parcelas : undefined,
            startMonth: (item.data || '').substring(0, 7) || getCurrentMonthStr(),
            accountId: item.contaId || undefined,
          });

          if (createdBill && createdBill.id) {
            addedIds.push({ type: 'bill', id: createdBill.id });
          }
        }
      }

      setVoiceUndoToast({
        show: true,
        count: items.length,
        addedIds,
      });

      setTimeout(() => {
        setVoiceUndoToast(null);
      }, 5000);
    },
    [addExpense, addIncome, addBill, adjustAccountBalanceForFinancialItem]
  );

  const handleUndoVoiceLancamentos = useCallback(async () => {
    if (!voiceUndoToast || !voiceUndoToast.addedIds) return;
    for (const item of voiceUndoToast.addedIds) {
      if (item.type === 'expense') {
        await deleteExpense(item.id);
      } else if (item.type === 'income') {
        await deleteIncome(item.id);
      } else if (item.type === 'bill') {
        await deleteBill(item.id);
      }
    }
    setVoiceUndoToast(null);
  }, [voiceUndoToast, deleteExpense, deleteIncome, deleteBill]);

  const handleReprocessVoiceText = useCallback(
    async (newText: string) => {
      if (!user) return;
      try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/parse-lancamento', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            texto: newText,
            dataAtual: new Date().toISOString().split('T')[0],
            categorias: availableCategoriesList,
            contas: accounts.map((a) => ({ id: a.id, name: a.name })),
            userPreferences,
          }),
        });

        const data = await response.json();
        if (data.lancamentos && Array.isArray(data.lancamentos)) {
          const parsedWithIds: ParsedLancamentoItem[] = data.lancamentos.map(
            (item: any, idx: number) => ({
              ...item,
              id: `v_item_${Date.now()}_${idx}`,
            })
          );
          setVoiceRawText(newText);
          setVoiceParsedItems(parsedWithIds);
        }
      } catch (err) {
        console.error('Reprocess error:', err);
      }
    },
    [user, availableCategoriesList, accounts, userPreferences]
  );

  // Ensure every account always starts with the same clean, standard financial layout on sign-in
  React.useEffect(() => {
    setCurrentView('finance');
  }, [user?.uid]);

  const handleSaveNewGoal = useCallback(
    async (params: any) => {
      const created = await createGoal(params);
      setCurrentView('goals');
      return created;
    },
    [createGoal]
  );

  // Targeted navigation state when jumping into Finance views with specific filters / months
  const [financeNavParams, setFinanceNavParams] = useState<{
    tab: 'timeline' | 'bills' | 'upcoming' | 'incomes' | 'expenses' | 'categories' | 'savings' | 'report' | 'calendar' | 'freedom';
    billFilter?: 'all' | 'pending' | 'paid' | 'overdue';
    incomeFilter?: 'all' | 'pending' | 'received';
    month?: string;
    selectedTransaction?: { type: 'bill' | 'income' | 'expense'; id: string };
  } | null>(null);

  const handleNavigateToFinanceWithParams = useCallback(
    (
      tab: 'timeline' | 'bills' | 'upcoming' | 'incomes' | 'expenses' | 'categories' | 'savings' | 'report' | 'calendar' | 'freedom',
      options?: {
        billFilter?: 'all' | 'pending' | 'paid' | 'overdue';
        incomeFilter?: 'all' | 'pending' | 'received';
        month?: string;
        selectedTransaction?: { type: 'bill' | 'income' | 'expense'; id: string };
      }
    ) => {
      setFinanceNavParams({ tab, ...options });
      setCurrentView('finance');
    },
    []
  );

  // Modals state
  const [activeSquareId, setActiveSquareId] = useState<number | null>(null);
  const [isNewGoalOpen, setIsNewGoalOpen] = useState(false);
  const [isEditGoalOpen, setIsEditGoalOpen] = useState(false);
  const [isAvulsoModalOpen, setIsAvulsoModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMoneChatOpen, setIsMoneChatOpen] = useState(false);
  const [isNavDrawerOpen, setIsNavDrawerOpen] = useState(false);

  // Close all open modals and clear active square whenever switching between views to prevent floating/orphan UI
  React.useEffect(() => {
    setActiveSquareId(null);
    setIsNewGoalOpen(false);
    setIsEditGoalOpen(false);
    setIsAvulsoModalOpen(false);
    setIsSettingsOpen(false);
    setIsProfileOpen(false);
    setIsMoneChatOpen(false);
    setIsNavDrawerOpen(false);
    setIsGlobalTxModalOpen(false);
    setIsGlobalTransferModalOpen(false);
    setIsVoiceSheetOpen(false);
  }, [currentView]);

  // Selected square clicked in grid
  const handleSquareClick = (squareId: number) => {
    setActiveSquareId(squareId);
  };

  const isSquareCompleted = useMemo(() => {
    if (!activeGoal || activeSquareId === null) return false;
    return activeGoal.completedSquares.includes(activeSquareId);
  }, [activeGoal, activeSquareId]);

  const currentSquareObj = useMemo(() => {
    if (activeSquareId === null) return null;
    const found = activeGoalSquares.find((s) => s.id === activeSquareId);
    return found || { id: activeSquareId, value: activeSquareId };
  }, [activeSquareId, activeGoalSquares]);

  const depositRecord = useMemo(() => {
    if (!activeGoal || activeSquareId === null) return undefined;
    return activeGoal.history.find((h) => h.squareNumber === activeSquareId);
  }, [activeGoal, activeSquareId]);

  const [resetCode, setResetCode] = useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      const code = params.get('oobCode');
      if (mode === 'resetPassword' && code) {
        setResetCode(code);
      }
    }
  }, []);

  if (resetCode) {
    return (
      <ResetPasswordScreen
        oobCode={resetCode}
        language={currentLang}
        onSuccess={() => {
          if (typeof window !== 'undefined') {
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
          }
          setResetCode(null);
        }}
      />
    );
  }

  // 1. Initial auth loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F8F6] text-slate-800 mesh-gradient">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mb-3" />
        <p className="text-sm font-semibold tracking-wide text-slate-700">
          {currentLang === 'pt'
            ? 'Carregando Controle Financeiro...'
            : currentLang === 'es'
            ? 'Cargando Control Financiero...'
            : 'Loading Financial Control...'}
        </p>
      </div>
    );
  }

  // 2. Not authenticated -> Render Login / Signup
  if (!user) {
    return <AuthScreen language={currentLang} />;
  }

  // 3. Authenticated but email NOT verified (Email/Password users only) -> Render Email Verification Screen
  const isGoogleUser = user.providerData.some((p) => p.providerId === 'google.com');
  if (!user.emailVerified && !isGoogleUser) {
    return <EmailVerificationScreen language={currentLang} />;
  }

  // 4. Authenticated & verified user
  return (
    <div className={`min-h-dvh flex flex-col bg-[#F4F8F6] dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased selection:bg-emerald-500/20 selection:text-emerald-700 relative mesh-gradient`}>
      {/* Top Navbar */}
      <Navbar
        onOpenMenu={() => setIsNavDrawerOpen(true)}
        currentView={currentView}
        goals={goals}
        activeGoal={activeGoal}
        language={currentLang}
        onOpenNewGoalModal={() => setIsNewGoalOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        hasPendingNotifications={sharedAccounts.pendingReceivedInvitationsCount > 0 || sharedAccounts.unreadNotificationsCount > 0}
      />

      {/* Main Content Area */}
      {loadingData ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-500 dark:text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-2" />
          <p className="text-xs font-semibold">
            {currentLang === 'pt'
              ? 'Sincronizando seus dados financeiros...'
              : currentLang === 'es'
              ? 'Sincronizando tus datos financieros...'
              : 'Synchronizing your financial data...'}
          </p>
        </div>
      ) : (
        <div className="flex-1 flex max-w-7xl w-full mx-auto">
          {/* Content Viewport: Clean, wide, space-saving layout */}
          <main className="flex-1 min-w-0 p-2 sm:p-3.5 lg:p-5 space-y-3 max-w-full overflow-x-hidden pb-28 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentView}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="w-full h-full"
              >
                {currentView === 'planejar' ? (
                  <PlanningView
                    currency={activeCurrency}
                    language={currentLang}
                    bills={bills}
                    incomes={incomes}
                    expenses={expenses}
                    sharedBills={sharedAccounts.sharedBills}
                    statusRecords={statusRecords}
                    currentBalance={accounts.length > 0 ? accountsTotalBalance : currentBalance}
                    forecastBalance={forecastBalance}
                    onOpenMoneChat={() => setIsMoneChatOpen(true)}
                    onOpenNewTransaction={(type) => {
                      setGlobalTxModalType(type);
                      setIsGlobalTxModalOpen(true);
                    }}
                    overdueBillsCount={overdueBillsCount}
                    onNavigateToFinance={handleNavigateToFinanceWithParams}
                  />
                ) : currentView === 'goals' ? (
                  <GoalsCenterView
                    goals={goals}
                    activeGoal={activeGoal}
                    activeGoalSquares={activeGoalSquares}
                    currency={activeCurrency}
                    language={currentLang}
                    savedAmount={savedAmount}
                    targetAmount={targetAmount}
                    remainingAmount={remainingAmount}
                    financialProgressPercent={financialProgressPercent}
                    completedSquaresCount={completedSquaresCount}
                    totalSquaresCount={totalSquaresCount}
                    squaresProgressPercent={squaresProgressPercent}
                    onSwitchGoal={switchGoal}
                    onOpenNewGoalModal={() => setIsNewGoalOpen(true)}
                    onOpenEditGoalModal={() => setIsEditGoalOpen(true)}
                    onOpenAvulsoModal={() => setIsAvulsoModalOpen(true)}
                    onDeleteGoal={deleteGoal}
                    onSquareClick={handleSquareClick}
                    selectedSquareId={activeSquareId}
                    fiftyTwoChallenge={fiftyTwoChallenge}
                    onAddExpense={addExpense}
                    onDeleteExpense={deleteExpense}
                  />
                ) : currentView === 'report' ? (
                  <FullReportView
                    currency={activeCurrency}
                    currentAccountBalance={accounts.length > 0 ? accountsTotalBalance : currentBalance}
                    language={currentLang}
                    bills={bills}
                    incomes={incomes}
                    expenses={expenses}
                    statusRecords={statusRecords}
                    sharedBills={sharedAccounts.sharedBills}
                    activePartners={sharedAccounts.activePartners}
                    myUserId={user.uid}
                    onReturnToFinance={() => setCurrentView('finance')}
                    onNavigateToFinance={handleNavigateToFinanceWithParams}
                  />
                ) : currentView === 'accounts' ? (
                  <AccountsView
                    currency={activeCurrency}
                    language={currentLang}
                    onReturnToFinance={() => setCurrentView('finance')}
                  />
                ) : currentView === 'shared_accounts' ? (
                  !user.emailVerified ? (
                    <div className="p-8 text-center bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-3xl space-y-3 my-6">
                      <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                        {t.sharedAccountRequiresVerification}
                      </p>
                    </div>
                  ) : (
                      <SharedAccountsView
                        currency={activeCurrency}
                        language={currentLang}
                        myUserId={user.uid}
                        connections={sharedAccounts.connections}
                        activePartners={sharedAccounts.activePartners}
                        receivedInvitations={sharedAccounts.receivedInvitations}
                        sentInvitations={sharedAccounts.sentInvitations}
                        sharedBills={sharedAccounts.sharedBills}
                        sharedNotifications={sharedAccounts.sharedNotifications}
                        unreadNotificationsCount={sharedAccounts.unreadNotificationsCount}
                        pendingReceivedInvitationsCount={sharedAccounts.pendingReceivedInvitationsCount}
                        onSendInvitation={sharedAccounts.sendInvitation}
                        onRespondInvitation={sharedAccounts.respondInvitation}
                        onCreateSharedBill={sharedAccounts.createSharedBill}
                        onUpdateSharedBill={sharedAccounts.updateSharedBill}
                        onDeleteSharedBill={sharedAccounts.deleteSharedBill}
                        onDeleteSharedBillOccurrence={sharedAccounts.deleteSharedBillOccurrence}
                        onRespondShareBillRequest={sharedAccounts.respondShareBillRequest}
                        onMarkNotificationRead={sharedAccounts.markNotificationRead}
                        onMarkAllNotificationsRead={sharedAccounts.markAllNotificationsRead}
                        onClearNotifications={sharedAccounts.clearNotifications}
                        onStopSharingAndConvert={sharedAccounts.stopSharingAndConvert}
                        onToggleMySharePaid={sharedAccounts.toggleMySharePaid}
                        onReturnToFinance={() => setCurrentView('finance')}
                        getCategoriesFor={getCategoriesFor}
                        onAddCategory={addCategory}
                      />

                  )
                ) : currentView === 'challenge_52' ? (
                  <FiftyTwoWeekChallengeView
                    currency={activeCurrency}
                    language={currentLang}
                    activeChallenge={fiftyTwoChallenge.activeChallenge}
                    challenges={fiftyTwoChallenge.challenges}
                    onSelectChallenge={fiftyTwoChallenge.setActiveChallengeId}
                    onCreateChallenge={fiftyTwoChallenge.createChallenge}
                    onCompleteWeek={fiftyTwoChallenge.completeWeek}
                    onUndoWeek={fiftyTwoChallenge.undoWeek}
                    onDeleteChallenge={fiftyTwoChallenge.deleteChallenge}
                    onAddExpense={addExpense}
                    onDeleteExpense={deleteExpense}
                    onReturnToFinance={() => setCurrentView('finance')}
                  />
                ) : currentView === 'full_report' ? (
                  <FullReportView
                    currency={activeCurrency}
                    currentAccountBalance={accounts.length > 0 ? accountsTotalBalance : currentBalance}
                    language={currentLang}
                    bills={bills}
                    incomes={incomes}
                    expenses={expenses}
                    statusRecords={statusRecords}
                    sharedBills={sharedAccounts.sharedBills}
                    activePartners={sharedAccounts.activePartners}
                    myUserId={user.uid}
                    onReturnToFinance={() => setCurrentView('finance')}
                    onNavigateToFinance={handleNavigateToFinanceWithParams}
                  />
                ) : currentView === 'financial_calendar' ? (
                  <FinancialCalendarView
                    currency={activeCurrency}
                    language={currentLang}
                    onReturnToFinance={() => setCurrentView('finance')}
                    onOpenMoneChat={() => setIsMoneChatOpen(true)}
                    onOpenTransaction={(item, month) => {
                      if (!item.originalId) return;
                      const type = item.type;
                      handleNavigateToFinanceWithParams(
                        type === 'bill' ? 'bills' : type === 'income' ? 'incomes' : 'expenses',
                        { month, selectedTransaction: { type, id: item.originalId } }
                      );
                    }}
                  />
                ) : currentView === 'freedom' ? (
                  <MonthlyFreedomScale
                    bills={bills}
                    incomes={incomes}
                    expenses={expenses}
                    sharedBills={sharedAccounts.sharedBills}
                    statusRecords={statusRecords}
                    userId={user?.uid}
                    currency={activeCurrency}
                    language={currentLang}
                    startMonth={getCurrentMonthStr()}
                    currentBalance={accounts.length > 0 ? accountsTotalBalance : currentBalance}
                    forecastBalance={forecastBalance}
                    onReturnToFinance={() => setCurrentView('finance')}
                  />
                ) : (currentView as string) === 'daily_pace' ? (
                  <RitmoDiarioView
                    bills={bills}
                    incomes={incomes}
                    expenses={expenses}
                    accounts={accounts}
                    currentBalance={accounts.length > 0 && accountsTotalBalance !== 0 ? accountsTotalBalance : currentBalance}
                    sharedBills={sharedAccounts.sharedBills}
                    statusRecords={statusRecords}
                    currency={activeCurrency}
                    language={currentLang}
                    userId={user?.uid}
                    financeSettings={financeSettings}
                    ritmoDiarioConfig={financeSettings?.ritmoDiarioConfig}
                    onUpdateConfig={updateRitmoDiarioConfig}
                    onReturnToFinance={() => setCurrentView('finance')}
                  />
                ) : (currentView as string) === 'accounts' ? (
                  <AccountsView
                    currency={activeCurrency}
                    language={currentLang}
                    onReturnToFinance={() => setCurrentView('finance')}
                  />
                ) : (
                  <FinanceDashboard
                    currency={activeCurrency}
                    language={currentLang}
                    onOpenMoneChat={() => setIsMoneChatOpen(true)}
                    goals={goals}
                    activeGoal={activeGoal}
                    onNavigateToGoals={() => setCurrentView('goals')}
                    onNavigateToAccounts={() => setCurrentView('accounts')}
                    initialTab={
                      financeNavParams?.tab ||
                      ((currentView as string) === 'savings'
                        ? 'savings'
                        : (currentView as string) === 'categories'
                        ? 'categories'
                        : 'timeline')
                    }
                    initialBillFilter={financeNavParams?.billFilter}
                    initialIncomeFilter={financeNavParams?.incomeFilter}
                    initialMonth={financeNavParams?.month}
                    initialTransaction={financeNavParams?.selectedTransaction}
                    onReturnToFinance={() => setCurrentView('finance')}
                    activePartners={sharedAccounts.activePartners}
                    onShareWithPartner={async (params) => {
                      await sharedAccounts.createSharedBill({
                        ...params,
                        splitMethod: 'fifty_fifty',
                        myPercentage: 50,
                        partnerPercentage: 50,
                        isPendingRequest: true,
                        recurrence: 'none',
                        recurrenceMonthsCount: 0,
                      });
                    }}
                    onToggleBillPaidCustom={async (billId, month, isPaid) => {
                      if (billId.startsWith('sb_')) {
                        const realId = billId.replace('sb_', '');
                        await sharedAccounts.toggleMySharePaid(realId, isPaid, month);
                      } else {
                        await toggleBillPaid(billId, month, isPaid);
                      }
                    }}
                    onDeleteBillCustom={async (billId) => {
                      if (billId.startsWith('sb_')) {
                        const realId = billId.replace('sb_', '');
                        await sharedAccounts.deleteSharedBill(realId);
                      } else {
                        await deleteBill(billId);
                      }
                    }}
                    onDeleteBillOccurrenceCustom={async (billId, month, scope) => {
                      if (billId.startsWith('sb_')) {
                        const realId = billId.replace('sb_', '');
                        await sharedAccounts.deleteSharedBillOccurrence(realId, month, scope);
                      } else {
                        await deleteBillOccurrence(billId, month, scope);
                      }
                    }}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      )}

      {/* Floating Mone Assistant Action Button */}
      <button
        type="button"
        onClick={() => setIsMoneChatOpen(true)}
        className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-40 flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-xs sm:text-sm rounded-full shadow-lg shadow-emerald-600/30 hover:shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer group print:hidden mb-[env(safe-area-inset-bottom,0px)]"
        title={`${t.askMone} • ${moneMoodLabel}`}
      >
        <div className="relative shrink-0 flex items-center justify-center">
          <MoneMascot mood={moneMoodObj.mood} size="sm" className="w-5.5 h-5.5" />
          <Sparkles className="w-2.5 h-2.5 text-amber-300 absolute -top-1 -right-1 animate-pulse" />
        </div>
        <span className="tracking-wide">Mone</span>
      </button>

      {/* Mone Financial Assistant Chat Modal */}
      <MoneChatModal
        isOpen={isMoneChatOpen}
        onClose={() => setIsMoneChatOpen(false)}
        currentBalance={currentBalance}
        bills={bills}
        incomes={incomes}
        expenses={expenses}
        statusRecords={statusRecords}
        goals={goals}
        currency={activeCurrency}
        language={currentLang}
        moneStyle={settings.moneStyle || 'direto'}
        onChangeMoneStyle={(style) => updateSettings({ moneStyle: style })}
        mood={moneMoodObj.mood}
        moodLabel={moneMoodLabel}
        onAddExpense={addExpense}
        onUpdateExpense={updateExpense}
        onDeleteExpense={deleteExpense}
        onAddBill={addBill}
        onUpdateBill={updateBill}
        onDeleteBill={deleteBill}
        onToggleBillPaid={toggleBillPaid}
        onAddIncome={addIncome}
        onUpdateIncome={updateIncome}
        onDeleteIncome={deleteIncome}
        onToggleIncomeReceived={toggleIncomeReceived}
        onUpdateCurrentBalance={updateCurrentBalance}
        onCreateGoal={handleSaveNewGoal}
      />

      {/* Deposit Modal */}
      <DepositModal
        isOpen={activeSquareId !== null}
        square={currentSquareObj}
        currency={activeCurrency}
        language={currentLang}
        isCompleted={isSquareCompleted}
        depositDate={depositRecord?.timestamp}
        onClose={() => setActiveSquareId(null)}
        onConfirm={completeSquare}
        onUndo={uncompleteSquare}
      />

      {/* Avulso Deposit Modal */}
      {activeGoal && (
        <AvulsoDepositModal
          isOpen={isAvulsoModalOpen}
          onClose={() => setIsAvulsoModalOpen(false)}
          goal={activeGoal}
          currency={activeCurrency}
          language={currentLang}
          onConfirmAvulso={addAvulsoDeposit}
        />
      )}

      {/* Goal Modal (Add new goal with dynamic calculated squares) */}
      <GoalModal
        isOpen={isNewGoalOpen}
        onClose={() => setIsNewGoalOpen(false)}
        currency={activeCurrency}
        language={currentLang}
        onSave={handleSaveNewGoal}
      />

      {/* Edit Goal Modal */}
      {activeGoal && (
        <EditGoalModal
          isOpen={isEditGoalOpen}
          onClose={() => setIsEditGoalOpen(false)}
          goal={activeGoal}
          language={currentLang}
          onSave={updateGoal}
        />
      )}

      {/* Navigation Drawer Modal (3-Bars Top-Left Menu) */}
      <NavigationDrawerModal
        isOpen={isNavDrawerOpen}
        onClose={() => setIsNavDrawerOpen(false)}
        currentView={currentView}
        onChangeView={setCurrentView}
        goalsCount={goals.length}
        savingsCount={0}
        sharedPendingCount={sharedAccounts.pendingReceivedInvitationsCount + sharedAccounts.unreadNotificationsCount}
        onOpenMoneChat={() => setIsMoneChatOpen(true)}
        onOpenSettingsModal={() => setIsSettingsOpen(true)}
        onOpenProfileModal={() => setIsProfileOpen(true)}
        language={currentLang}
        darkMode={settings.darkMode}
        onToggleDarkMode={() => updateSettings({ darkMode: !settings.darkMode })}
      />

      {/* Settings Modal (Configurações) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
        onExportData={handleExportCompleteBackup}
        onImportData={handleImportCompleteBackup}
        onResetAllData={handleFactoryResetAll}
        bills={bills}
        incomes={incomes}
        expenses={expenses}
        currency={activeCurrency}
        language={currentLang}
        categories={allDisplayCategories}
        onAddCategory={addCategory}
        onUpdateCategory={updateCategory}
        onDeleteCategory={deleteCategory}
        onResetPredefinedCategories={resetPredefinedCategories}
      />

      {/* Profile Modal (Perfil) */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        settings={settings}
        currency={activeCurrency}
        language={currentLang}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* 100% Completion Celebration Modal */}
      {activeGoal && (
        <CelebrationModal
          isOpen={justFinishedAll}
          onClose={clearJustFinishedAll}
          goal={activeGoal}
          savedAmount={savedAmount}
          currency={activeCurrency}
          language={currentLang}
        />
      )}

      {/* Global Transaction Modal (for FAB action items) */}
      <TransactionModal
        isOpen={isGlobalTxModalOpen}
        onClose={() => setIsGlobalTxModalOpen(false)}
        accounts={accounts}
        onOpenNewAccount={() => setCurrentView('accounts')}
        currency={activeCurrency}
        language={currentLang}
        selectedMonth={getCurrentMonthStr()}
        initialType={globalTxModalType}
        getCategoriesFor={getCategoriesFor}
        onAddCategory={addCategory}
        onSaveBill={addBill}
        onUpdateBill={updateBill}
        onSaveIncome={async (data) => {
          return await addIncome(data);
        }}
        onUpdateIncome={updateIncome}
        onSaveExpense={async (data) => {
          const res = await addExpense(data);
          if (data.accountId) {
            await adjustAccountBalanceForFinancialItem(data.accountId, -data.amount);
          }
          return res;
        }}
        onUpdateExpense={updateExpense}
        onDeleteExpense={deleteExpense}
      />

      {/* Global Transfer Between Accounts Modal */}
      <TransferBetweenAccountsModal
        isOpen={isGlobalTransferModalOpen}
        onClose={() => setIsGlobalTransferModalOpen(false)}
        accounts={accounts}
        currency={activeCurrency}
        language={currentLang}
        onExecuteTransfer={transferBetweenAccounts}
      />

      {/* Floating Action Button (FAB) for Voice Input */}
      <VoiceLauncherFAB
        isFabMenuOpen={isFabMenuOpen}
        categories={availableCategoriesList}
        accounts={accounts}
        userPreferences={userPreferences}
        onParsedSuccess={handleParsedVoiceSuccess}
        hideFloatingButton={true}
        externalTrigger={isVoiceTriggered}
        onTriggerComplete={() => setIsVoiceTriggered(false)}
      />

      {/* Floating Action Button (FAB) for Quick Financial Actions */}
      <QuickActionFAB
        language={currentLang}
        onMenuToggle={(isOpen) => setIsFabMenuOpen(isOpen)}
        onOpenExpense={() => {
          setGlobalTxModalType('expense');
          setIsGlobalTxModalOpen(true);
        }}
        onOpenIncome={() => {
          setGlobalTxModalType('income');
          setIsGlobalTxModalOpen(true);
        }}
        onOpenBill={() => {
          setGlobalTxModalType('bill');
          setIsGlobalTxModalOpen(true);
        }}
        onOpenTransfer={() => {
          setIsGlobalTransferModalOpen(true);
        }}
        onOpenSharedBill={() => {
          setCurrentView('shared_accounts');
        }}
        onOpenVoice={() => setIsVoiceTriggered(true)}
      />

      {/* Voice Confirmation Sheet */}
      <VoiceConfirmationSheet
        isOpen={isVoiceSheetOpen}
        onClose={() => setIsVoiceSheetOpen(false)}
        rawText={voiceRawText}
        parsedItems={voiceParsedItems}
        availableCategories={availableCategoriesList}
        accounts={accounts}
        currency={activeCurrency}
        language={currentLang}
        onReprocessText={handleReprocessVoiceText}
        onConfirmItems={handleConfirmVoiceItems}
        onCategoryChangePreference={saveCategoryPreference}
      />

      {/* 5-second Undo Toast Notification */}
      {voiceUndoToast && voiceUndoToast.show && (
        <div
          style={{
            bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))',
          }}
          className="fixed left-4 right-4 sm:left-auto sm:right-4 z-50 sm:max-w-md bg-emerald-900/90 backdrop-blur-xl text-white p-3.5 rounded-2xl shadow-2xl border border-emerald-400/30 flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-200"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
            <span className="text-xs font-semibold truncate">
              {voiceUndoToast.count === 1
                ? 'Lançamento adicionado com sucesso!'
                : `${voiceUndoToast.count} lançamentos adicionados!`}
            </span>
          </div>
          <button
            type="button"
            onClick={handleUndoVoiceLancamentos}
            className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 border border-white/30"
          >
            <Undo2 className="w-3.5 h-3.5" /> Desfazer (5s)
          </button>
        </div>
      )}

      {/* Fixed Bottom Navigation Bar */}
      <BottomNav
        currentArea={currentNavArea}
        onChangeArea={handleChangeNavArea}
        language={currentLang}
        overdueBillsCount={overdueBillsCount}
        goalsMilestoneCount={completedSquaresCount > 0 ? 1 : 0}
      />

      {/* Achievement Unlocked Toast Notification */}
      <AchievementToast
        achievement={recentAchievement}
        language={currentLang}
        onClose={clearRecentAchievement}
      />
    </div>
  );
}
