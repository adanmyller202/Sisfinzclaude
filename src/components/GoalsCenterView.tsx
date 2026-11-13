import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AccountItem, ChallengeGoal, CurrencyCode, LanguageCode, SavingGoal } from '../types';
import { useSavings } from '../hooks/useSavings';
import { useFinanceControl } from '../hooks/useFinanceControl';
import { SavingsSection } from './SavingsSection';
import { SavingGoalModal } from './SavingGoalModal';
import { TransferModal } from './TransferModal';
import { FiftyTwoWeekChallengeView } from './FiftyTwoWeekChallengeView';
import {
  Target,
  PiggyBank,
  Award,
  Plus,
  
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
  const [activeTab, setActiveTab] = useState<'savings' | 'challenge52'>('savings');
  const handleGoalsTabChange = (tab: typeof activeTab) => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    setActiveTab(tab);
  };

  const {
    savings,
    transactions: savingTransactions,
    createSavingGoal,
    updateSavingGoal,
    deleteSavingGoal,
    transferToSaving,
    withdrawFromSaving,
  } = useSavings();

  const { currentBalance, addExpense, addIncome, addIncomeAsReceived, toggleIncomeReceived, selectedMonth } = useFinanceControl();

  const [isSavingModalOpen, setIsSavingModalOpen] = useState(false);
  const [savingToEdit, setSavingToEdit] = useState<SavingGoal | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferDefaultSavingId, setTransferDefaultSavingId] = useState<string | undefined>(undefined);
  const [transferDefaultType, setTransferDefaultType] = useState<'deposit' | 'withdrawal'>('deposit');

  const tabs = [
    { id: 'savings', label: 'Cofrinhos', icon: PiggyBank, desc: 'Metas Livres' },
    { id: 'challenge52', label: 'Plano Semanal', icon: Award, desc: 'Economize no seu ritmo' },
  ] as const;

  const containerVariants: any = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants: any = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } } };

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants} className="w-full min-w-0 space-y-4 overflow-x-clip pb-24">
      {/* Compact, responsive goals header */}
      <section className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm"><Target className="h-5 w-5"/></div>
          <div className="min-w-0 flex-1"><h1 className="truncate text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">Centro de Metas</h1><p className="mt-0.5 text-xs text-slate-500 sm:text-sm">Organize seus cofrinhos e planos de economia.</p></div>
          {activeTab === 'savings' && <button type="button" onClick={() => (setSavingToEdit(null), setIsSavingModalOpen(true))} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"><Plus className="h-4 w-4"/> <span className="hidden sm:inline">Cofrinho</span></button>}
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
            />
          )}

          {activeTab === 'challenge52' && (
            <FiftyTwoWeekChallengeView
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
              accounts={accounts}
                    onDeleteChallenge={fiftyTwoChallenge.deleteChallenge}
              onAddExpense={onAddExpense}
              onDeleteExpense={onDeleteExpense}
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
