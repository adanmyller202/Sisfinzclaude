import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChallengeGoal, CurrencyCode, LanguageCode, SavingGoal } from '../types';
import { useSavings } from '../hooks/useSavings';
import { useFinanceControl } from '../hooks/useFinanceControl';
import { getTranslations } from '../utils/i18n';
import { SavingsSection } from './SavingsSection';
import { SavingGoalModal } from './SavingGoalModal';
import { TransferModal } from './TransferModal';
import { FiftyTwoWeekChallengeView } from './FiftyTwoWeekChallengeView';
import {
  Target,
  PiggyBank,
  Award,
  Plus,
  ArrowRight,
  TrendingUp,
  Sparkles,
  
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
  onAddExpense?: any;
  onDeleteExpense?: any;
}

export const GoalsCenterView: React.FC<GoalsCenterViewProps> = ({
  goals,
  activeGoal,
  activeGoalSquares,
  currency,
  language = 'pt',
  savedAmount,
  targetAmount,
  remainingAmount,
  financialProgressPercent,
  completedSquaresCount,
  totalSquaresCount,
  squaresProgressPercent,
  onSwitchGoal,
  onOpenNewGoalModal,
  onOpenEditGoalModal,
  onOpenAvulsoModal,
  onDeleteGoal,
  onSquareClick,
  selectedSquareId,
  fiftyTwoChallenge,
  onAddExpense,
  onDeleteExpense,
}) => {
  const t = getTranslations(language);
  const [activeTab, setActiveTab] = useState<'savings' | 'challenge52'>('savings');

  const {
    savings,
    transactions: savingTransactions,
    createSavingGoal,
    updateSavingGoal,
    deleteSavingGoal,
    transferToSaving,
    withdrawFromSaving,
  } = useSavings();

  const { currentBalance, addExpense, addIncome, toggleIncomeReceived, selectedMonth } = useFinanceControl();

  const [isSavingModalOpen, setIsSavingModalOpen] = useState(false);
  const [savingToEdit, setSavingToEdit] = useState<SavingGoal | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferDefaultSavingId, setTransferDefaultSavingId] = useState<string | undefined>(undefined);
  const [transferDefaultType, setTransferDefaultType] = useState<'deposit' | 'withdrawal'>('deposit');

  const tabs = [
    { id: 'savings', label: 'Cofrinhos', icon: PiggyBank, desc: 'Metas Livres' },
    { id: 'challenge52', label: '52 Semanas', icon: Award, desc: 'Poupança Progressiva' },
  ] as const;

  const containerVariants: any = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants: any = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } } };

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants} className="space-y-6 pb-24">
      {/* Premium Cinematic Header */}
      <motion.div variants={itemVariants} className="glass-panel rounded-[3rem] p-8 sm:p-10 relative overflow-hidden group">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none group-hover:bg-emerald-500/10 transition-colors duration-1000" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-xl shadow-emerald-600/20 border border-white/80">
                <Target className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Centro de Metas</h1>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mt-2">Arquitetura de Sonhos e Patrimônio</p>
              </div>
            </div>
            <p className="text-sm font-medium text-slate-400 max-w-xl leading-relaxed">Organize seus cofrinhos e acompanhe sua poupança progressiva de 52 semanas.</p>
          </div>

{activeTab === 'savings' && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => (setSavingToEdit(null), setIsSavingModalOpen(true))}
            className="h-16 px-10 rounded-2xl bg-white text-slate-950 font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-emerald-50 transition-all cursor-pointer shrink-0"
          >
            <span className="flex items-center gap-2"><Plus className="w-5 h-5 stroke-[4]" /> Criar Cofrinho</span>
          </motion.button>
          )}
        </div>

        {/* Tab Switcher Interface */}
        <div className="flex items-center justify-center gap-2 p-2 mt-12 bg-white/2 rounded-[2rem] border border-white/5 relative">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-none w-[120px] py-4 rounded-[1.5rem] transition-all cursor-pointer relative z-10 group overflow-hidden border-2 ${
                  isActive ? 'bg-white text-slate-950 border-emerald-500 shadow-xl' : 'text-slate-500 border-transparent hover:text-white'
                }`}
              >
                <div className="relative z-10 flex flex-col items-center gap-1">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-600' : 'group-hover:text-white transition-colors'}`} />
                  <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>

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
        defaultSavingId={transferDefaultSavingId}
        defaultType={transferDefaultType}
        currentBalance={currentBalance}
        currency={currency}
        language={language}
        onTransferToSaving={async (id, amt, rate, d, n) => await transferToSaving(id, amt, rate, d, n, { addExpense, currency })}
        onWithdrawFromSaving={async (id, amt, rate, d, n) => await withdrawFromSaving(id, amt, rate, d, n, { addIncome, toggleIncomeReceived, currentMonthStr: selectedMonth })}
      />
    </motion.div>
  );
};
