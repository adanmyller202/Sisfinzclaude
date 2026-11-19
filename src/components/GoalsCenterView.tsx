import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AccountItem, BillItem, ChallengeGoal, CurrencyCode, LanguageCode, SavingGoal } from '../types';
import { useSavings } from '../hooks/useSavings';
import { useFinanceControl } from '../hooks/useFinanceControl';
import { useCategories } from '../hooks/useCategories';
import { SavingsSection } from './SavingsSection';
import { SavingGoalModal } from './SavingGoalModal';
import { TransferModal } from './TransferModal';
import { RecurringInvestmentSetupModal } from './RecurringInvestmentSetupModal';
import { RecurringInvestmentManagerModal } from './RecurringInvestmentManagerModal';
import { TransactionModal } from './TransactionModal';
import { formatCurrency } from '../utils/currency';
import { getCurrentMonthStr } from '../utils/finance';
import { getLocaleForLanguage } from '../utils/i18n';
import { FiftyTwoWeekChallengeView } from './FiftyTwoWeekChallengeView';
import {
  Target,
  PiggyBank,
  Award,
} from 'lucide-react';

interface GoalsCenterViewProps {
  goals: ChallengeGoal[];
  activeGoal: ChallengeGoal | null;
  activeGoalSquares: any[];
  currency: CurrencyCode;
  language?: LanguageCode;
  savedAmount: number;
  targetAmount: number;
  remainingAmount: number;
  financialProgressPercent: number;
  completedSquaresCount: number;
  totalSquaresCount: number;
  squaresProgressPercent: number;
  onSwitchGoal: (goalId: string) => void;
  onOpenNewGoalModal: () => void;
  onOpenEditGoalModal: () => void;
  onOpenAvulsoModal: () => void;
  onDeleteGoal: (goalId: string) => void;
  onSquareClick: (squareId: number) => void;
  selectedSquareId: number | null;
  fiftyTwoChallenge: any;
  accounts: AccountItem[];
  onAdjustAccountBalance: (accountId: string, amountDelta: number) => Promise<void>;
  onUpdateStorageLocation: (challengeId: string, storageLocation: string) => Promise<void>;
  onRedeemChallenge: (challenge: any, accountId: string) => Promise<void>;
  onAddExpense?: any;
  onDeleteExpense?: any;
}

export const GoalsCenterView: React.FC<GoalsCenterViewProps> = ({
  currency,
  language = 'pt',
  fiftyTwoChallenge,
  accounts,
  onAdjustAccountBalance,
  onUpdateStorageLocation,
  onRedeemChallenge,
  onAddExpense,
  onDeleteExpense,
}) => {
  const locale = getLocaleForLanguage(language);
  const [activeTab, setActiveTab] = useState<'savings' | 'challenge52'>('savings');
  const [weeklyPlanResetKey, setWeeklyPlanResetKey] = useState(0);
  const handleGoalsTabChange = (tab: typeof activeTab) => {
    const reset = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
    };
    reset();
    setActiveTab(tab);
    requestAnimationFrame(reset);
  };

  const {
    savings,
    transactions: savingTransactions,
    createSavingGoal,
    updateSavingGoal,
    deleteSavingGoal,
    deleteSavingTransaction,
    transferToSaving,
    reverseRecurringSavingDeposit,
    withdrawFromSaving,
  } = useSavings();

  const {
    currentBalance,
    bills,
    statusRecords,
    addExpense,
    deleteExpense: deleteFinanceExpense,
    addIncome,
    addIncomeAsReceived,
    toggleIncomeReceived,
    selectedMonth,
    addBill,
    updateBill,
    updateBillOccurrence,
    deleteBill,
  } = useFinanceControl();

  const { getCategoriesFor, addCategory } = useCategories();

  const [isSavingModalOpen, setIsSavingModalOpen] = useState(false);
  const [savingToEdit, setSavingToEdit] = useState<SavingGoal | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferDefaultSavingId, setTransferDefaultSavingId] = useState<string | undefined>(undefined);
  const [transferDefaultType, setTransferDefaultType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [recurringGoalToConfigure, setRecurringGoalToConfigure] = useState<SavingGoal | null>(null);
  const [recurringGoalToManage, setRecurringGoalToManage] = useState<SavingGoal | null>(null);
  const [editingBillOccurrence, setEditingBillOccurrence] = useState<{ bill: BillItem; month: string } | null>(null);

  const handleCreateRecurringInvestment = async (params: { goal: SavingGoal; startMonth: string; accountId: string; exchangeRate: number; dueDay: number; installmentAmount: number; months: number }) => {
    const { goal, startMonth, accountId, exchangeRate, dueDay, installmentAmount, months } = params;
    if (goal.recurringInvestmentBillId) throw new Error('Esta meta já possui um investimento recorrente configurado.');
    const selectedAccount = accounts.find((item) => item.id === accountId && item.isActive !== false);
    if (!selectedAccount) throw new Error('Selecione uma conta válida.');
    if (selectedAccount.currency !== currency) throw new Error('A conta selecionada precisa usar a moeda principal do controle financeiro.');
    if (months < 1 || installmentAmount <= 0) throw new Error('O período da meta não permite criar parcelas.');
    const goalCurrency = goal.currency || 'ARS';
    if (goalCurrency !== 'ARS' && exchangeRate <= 0) throw new Error('Informe uma cotação inicial válida.');
    const estimatedAmount = goalCurrency === 'ARS' ? installmentAmount : Math.round(installmentAmount * exchangeRate * 100) / 100;
    const planId = `goal_investment_${goal.id}_${Date.now()}`;
    const createdBill = await addBill({
      name: `Investimento mensal — ${goal.name}`,
      amount: estimatedAmount,
      dueDate: `${startMonth}-${String(dueDay).padStart(2, '0')}`,
      dueDay,
      category: 'Inversiones',
      notes: `Parcela de ${formatCurrency(installmentAmount, goalCurrency)} para a meta ${goal.name}.`,
      accountId,
      recurrence: 'monthly',
      recurrenceMonthsCount: months,
      startMonth,
      investmentSavingId: goal.id,
      investmentExchangeRate: goalCurrency === 'ARS' ? 1 : exchangeRate,
      investmentGoalAmount: installmentAmount,
      investmentGoalTotalAmount: Math.max(0, (goal.targetAmount || 0) - (goal.currentAmount || 0)),
      investmentPlanId: planId,
      investmentPlanMonths: months,
    } as any);
    await updateSavingGoal(goal.id, {
      recurringInvestmentBillId: createdBill.id,
      recurringInvestmentStartMonth: startMonth,
      recurringInvestmentAccountId: accountId,
      recurringInvestmentExchangeRate: goalCurrency === 'ARS' ? 1 : exchangeRate,
    });
  };

  const handleDeleteAllGoalRecurrences = async (goal: SavingGoal) => {
    const linkedBills = bills.filter((bill) =>
      bill.id === goal.recurringInvestmentBillId ||
      bill.investmentSavingId === goal.id ||
      Object.values(bill.exceptions || {}).some((exception: any) => exception?.investmentSavingId === goal.id)
    );

    const removeExpenseFn = onDeleteExpense || deleteFinanceExpense;

    // Refund only paid installments belonging to the live month. Historical
    // months remain isolated and must never change today's account balance.
    for (const bill of linkedBills) {
      const generatedMonths = new Set<string>();
      const start = bill.startMonth.split('-').map(Number);
      const count = Number(bill.investmentPlanMonths) || Number(bill.recurrenceMonthsCount) || 0;
      if (start.length === 2 && count > 0) {
        for (let index = 0; index < count; index += 1) {
          const date = new Date(start[0], start[1] - 1 + index, 1);
          generatedMonths.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
        }
      }
      statusRecords
        .filter((record) => record.itemType === 'bill' && record.itemId === bill.id)
        .forEach((record) => generatedMonths.add(record.month));

      for (const month of generatedMonths) {
        const status = statusRecords.find((record) => record.id === `bill_${bill.id}_${month}`);
        if (!status?.isCompleted) continue;
        const occurrence = bill.exceptions?.[month];
        const savingId = occurrence?.investmentSavingId ?? bill.investmentSavingId;
        if (savingId !== goal.id) continue;

        await reverseRecurringSavingDeposit(`investment_${bill.id}_${month}`, removeExpenseFn);
        const paidAccountId = occurrence?.accountId ?? bill.accountId;
        if (month === getCurrentMonthStr() && paidAccountId) {
          const paidAmount = Number(occurrence?.amount ?? bill.amount) || 0;
          if (paidAmount > 0) await onAdjustAccountBalance(paidAccountId, paidAmount);
        }
      }

      await deleteBill(bill.id);
    }

    const recurringTransactionIds = new Set<string>();
    linkedBills.forEach((bill) => {
      statusRecords
        .filter((record) => record.itemType === 'bill' && record.itemId === bill.id)
        .forEach((record) => recurringTransactionIds.add(`stx_investment_${bill.id}_${record.month}`));
    });
    for (const transactionId of recurringTransactionIds) {
      if (savingTransactions.some((transaction) => transaction.id === transactionId)) {
        await deleteSavingTransaction(transactionId);
      }
    }

    await updateSavingGoal(goal.id, {
      currentAmount: 0,
      recurringInvestmentBillId: null as any,
      recurringInvestmentStartMonth: null as any,
      recurringInvestmentAccountId: null as any,
      recurringInvestmentExchangeRate: null as any,
    });
    setRecurringGoalToManage(null);
  };

  const tabs = [
    { id: 'savings', label: 'Cofrinhos', icon: PiggyBank, desc: 'Metas Livres' },
    { id: 'challenge52', label: 'Frasco Semanal', icon: Award, desc: 'Economize no seu ritmo' },
  ] as const;

  const containerVariants: any = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants} className="w-full min-w-0 space-y-4 overflow-x-clip pb-24">
      {/* Compact, responsive goals header */}
      <section className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm"><Target className="h-5 w-5"/></div>
          <div className="min-w-0 flex-1"><h1 className="truncate text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">Centro de Metas</h1><p className="mt-0.5 text-xs text-slate-500 sm:text-sm">Organize seus cofrinhos e frascos de economia.</p></div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          {tabs.map((tab) => { const isActive = activeTab === tab.id; const Icon = tab.icon; return <button key={tab.id} type="button" onClick={() => handleGoalsTabChange(tab.id)} className={`flex min-w-0 items-center justify-center gap-2 rounded-lg px-2 py-3 text-xs font-extrabold transition-colors sm:text-sm ${isActive ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}><Icon className="h-4 w-4 shrink-0"/><span className="truncate">{tab.label}</span></button>; })}
        </div>
      </section>

      {/* Main Feature Viewport */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative"
        >
          {activeTab === 'savings' && (
            <SavingsSection
              savings={savings}
              transactions={savingTransactions}
              currentBalance={currentBalance}
              currency={currency}
              language={language}
              onOpenCreateModal={() => { setSavingToEdit(null); setIsSavingModalOpen(true); }}
              onOpenEditModal={(goal) => { setSavingToEdit(goal); setIsSavingModalOpen(true); }}
              onOpenTransferModal={(id, type) => { setTransferDefaultSavingId(id); setTransferDefaultType(type || 'deposit'); setIsTransferModalOpen(true); }}
              onDeleteGoal={deleteSavingGoal}
              onCreateRecurringInvestment={(goal) => setRecurringGoalToConfigure(goal)}
              onManageRecurringInvestment={(goal) => setRecurringGoalToManage(goal)}
            />
          )}

          {activeTab === 'challenge52' && (
            <FiftyTwoWeekChallengeView
              key={weeklyPlanResetKey}
              currency={currency}
              language={language}
              activeChallenge={fiftyTwoChallenge.activeChallenge}
              challenges={fiftyTwoChallenge.challenges}
              onSelectChallenge={fiftyTwoChallenge.setActiveChallengeId}
              onCreateChallenge={fiftyTwoChallenge.createChallenge}
              onCompleteWeek={fiftyTwoChallenge.completeWeek}
              onUndoWeek={fiftyTwoChallenge.undoWeek}
              onUpdateStorageLocation={onUpdateStorageLocation}
              onRedeemChallenge={onRedeemChallenge}
              onAdjustAccountBalance={onAdjustAccountBalance}
              accounts={accounts}
              onDeleteChallenge={fiftyTwoChallenge.deleteChallenge}
              onAddExpense={onAddExpense}
              onDeleteExpense={onDeleteExpense}
              onReturnToFinance={() => setWeeklyPlanResetKey((k) => k + 1)}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <SavingGoalModal
        isOpen={isSavingModalOpen}
        onClose={() => setIsSavingModalOpen(false)}
        goalToEdit={savingToEdit}
        currency={currency}
        language={language}
        onSave={async (p) => {
          if (savingToEdit) {
            await updateSavingGoal(savingToEdit.id, p);
          } else {
            await createSavingGoal(p);
          }
        }}
      />

      <RecurringInvestmentSetupModal
        goal={recurringGoalToConfigure}
        accounts={accounts}
        baseCurrency={currency}
        onClose={() => setRecurringGoalToConfigure(null)}
        onConfirm={handleCreateRecurringInvestment}
      />

      {recurringGoalToManage && (
        <RecurringInvestmentManagerModal
          goal={recurringGoalToManage}
          bills={bills}
          statusRecords={statusRecords}
          currency={currency}
          locale={locale}
          onClose={() => setRecurringGoalToManage(null)}
          onSelectOccurrence={(bill, month) => {
            setRecurringGoalToManage(null);
            setEditingBillOccurrence({ bill, month });
          }}
          onDeleteAllRecurrences={handleDeleteAllGoalRecurrences}
        />
      )}

      <TransactionModal
        isOpen={!!editingBillOccurrence}
        onClose={() => setEditingBillOccurrence(null)}
        accounts={accounts}
        currency={currency}
        language={language}
        selectedMonth={editingBillOccurrence?.month || selectedMonth}
        initialType="bill"
        editingTransaction={
          editingBillOccurrence
            ? { id: editingBillOccurrence.bill.id, type: 'bill', item: editingBillOccurrence.bill }
            : null
        }
        getCategoriesFor={getCategoriesFor}
        onAddCategory={addCategory}
        onSaveBill={addBill}
        onUpdateBill={async (id, partial) => {
          const targetMonth = editingBillOccurrence?.month || selectedMonth;
          const oldBill = bills.find((bill) => bill.id === id);
          const isPaid = Boolean(statusRecords.find((record) => record.id === `bill_${id}_${targetMonth}`)?.isCompleted);
          const isRecurringInvestment = Boolean(
            oldBill?.investmentSavingId || oldBill?.exceptions?.[targetMonth]?.investmentSavingId
          );
          if (oldBill && isPaid && (!isRecurringInvestment || targetMonth === getCurrentMonthStr())) {
            const oldAmount = Number(oldBill.exceptions?.[targetMonth]?.amount ?? oldBill.amount) || 0;
            const newAmount = partial.amount !== undefined ? Number(partial.amount) || 0 : oldAmount;
            const oldAccountId = oldBill.exceptions?.[targetMonth]?.accountId ?? oldBill.accountId;
            const newAccountId = partial.accountId !== undefined ? partial.accountId : oldAccountId;
            const deltas = new Map<string, number>();
            if (oldAccountId) deltas.set(oldAccountId, (deltas.get(oldAccountId) || 0) + oldAmount);
            if (newAccountId) deltas.set(newAccountId, (deltas.get(newAccountId) || 0) - newAmount);
            for (const [accountId, delta] of deltas) {
              if (delta !== 0) await onAdjustAccountBalance(accountId, delta);
            }
          }
          await updateBill(id, partial);
        }}
        onUpdateBillOccurrence={async (id, month, partial, scope) => {
          const oldBill = bills.find((bill) => bill.id === id);
          const isPaid = Boolean(statusRecords.find((record) => record.id === `bill_${id}_${month}`)?.isCompleted);
          const isRecurringInvestment = Boolean(
            oldBill?.investmentSavingId || oldBill?.exceptions?.[month]?.investmentSavingId
          );
          if (oldBill && isPaid && (!isRecurringInvestment || month === getCurrentMonthStr())) {
            const oldAmount = Number(oldBill.exceptions?.[month]?.amount ?? oldBill.amount) || 0;
            const newAmount = partial.amount !== undefined ? Number(partial.amount) || 0 : oldAmount;
            const oldAccountId = oldBill.exceptions?.[month]?.accountId ?? oldBill.accountId;
            const newAccountId = partial.accountId !== undefined ? partial.accountId : oldAccountId;
            const deltas = new Map<string, number>();
            if (oldAccountId) deltas.set(oldAccountId, (deltas.get(oldAccountId) || 0) + oldAmount);
            if (newAccountId) deltas.set(newAccountId, (deltas.get(newAccountId) || 0) - newAmount);
            for (const [accountId, delta] of deltas) {
              if (delta !== 0) await onAdjustAccountBalance(accountId, delta);
            }
          }
          await updateBillOccurrence(id, month, partial, scope);
        }}
        onDeleteBill={deleteBill}
      />

      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        savings={savings}
        accounts={accounts}
        defaultSavingId={transferDefaultSavingId}
        defaultType={transferDefaultType}
        currentBalance={currentBalance}
        currency={currency}
        language={language}
        onTransferToSaving={async (id, amt, rate, d, n, accountId, accountName) => await transferToSaving(id, amt, rate, d, n, { addExpense, currency, accountId, accountName, adjustAccountBalance: onAdjustAccountBalance })}
        onWithdrawFromSaving={async (id, amt, rate, d, n, accountId, accountName) => await withdrawFromSaving(id, amt, rate, d, n, { addIncome, addIncomeAsReceived, toggleIncomeReceived, currentMonthStr: selectedMonth, accountId, accountName, adjustAccountBalance: onAdjustAccountBalance })}
      />
    </motion.div>
  );
};
