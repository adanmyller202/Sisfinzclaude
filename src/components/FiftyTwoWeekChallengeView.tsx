/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { FiftyTwoWeekChallenge, CurrencyCode, LanguageCode, ExpenseItem } from '../types';
import { formatCurrency } from '../utils/currency';
import { getTranslations } from '../utils/i18n';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  ArrowLeft,
  Sparkles,
  TrendingUp,
  Target,
  PiggyBank,
  Check,
  RotateCcw,
  Trash2,
  ChevronRight,
  AlertCircle,
  Award,
  Wallet,
  Loader2,
  ArrowUpRight,
  History,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FiftyTwoWeekChallengeViewProps {
  currency: CurrencyCode;
  language?: LanguageCode;
  activeChallenge: FiftyTwoWeekChallenge | null;
  challenges: FiftyTwoWeekChallenge[];
  onSelectChallenge: (id: string) => void;
  onCreateChallenge: (params: { initialAmount: number; startDate: string; title?: string }) => Promise<any>;
  onCompleteWeek: (
    challengeId: string,
    weekNumber: number,
    addExpenseFn: (exp: Omit<ExpenseItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<ExpenseItem>
  ) => Promise<void>;
  onUndoWeek: (
    challengeId: string,
    weekNumber: number,
    deleteExpenseFn: (expenseId: string) => Promise<void>
  ) => Promise<void>;
  onDeleteChallenge: (challengeId: string) => Promise<void>;
  onAddExpense: (exp: Omit<ExpenseItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<ExpenseItem>;
  onDeleteExpense: (expenseId: string) => Promise<void>;
  onReturnToFinance?: () => void;
}

export const FiftyTwoWeekChallengeView: React.FC<FiftyTwoWeekChallengeViewProps> = ({
  currency,
  language = 'pt',
  activeChallenge,
  challenges,
  onSelectChallenge,
  onCreateChallenge,
  onCompleteWeek,
  onUndoWeek,
  onDeleteChallenge,
  onAddExpense,
  onDeleteExpense,
  onReturnToFinance,
}) => {
  const t = getTranslations(language);

  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [initialAmountStr, setInitialAmountStr] = useState<string>('1000');
  const [startDateInput, setStartDateInput] = useState<string>(new Date().toISOString().slice(0, 10));
  const [titleInput, setTitleInput] = useState<string>('');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState<boolean>(false);

  const [weekToConfirm, setWeekToConfirm] = useState<number | null>(null);
  const [weekToUndo, setWeekToUndo] = useState<number | null>(null);
  const [isSubmittingWeek, setIsSubmittingWeek] = useState<boolean>(false);

  const [weekFilter, setWeekFilter] = useState<'all' | 'pending' | 'completed'>('all');

  const parsedInitialAmount = useMemo(() => {
    return parseFloat(initialAmountStr.replace(',', '.')) || 0;
  }, [initialAmountStr]);

  const creationTotalTarget = useMemo(() => {
    return Math.round(parsedInitialAmount * 1378);
  }, [parsedInitialAmount]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedInitialAmount <= 0) return;
    try {
      setIsSubmittingCreate(true);
      await onCreateChallenge({
        initialAmount: parsedInitialAmount,
        startDate: startDateInput,
        title: titleInput.trim() || undefined,
      });
      setIsCreatingNew(false);
    } catch (err) {
      console.error('Error creating 52-week challenge:', err);
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const metrics = useMemo(() => {
    if (!activeChallenge) return null;

    const completedWeeksSet = new Set(activeChallenge.completedWeeks);
    let totalSaved = 0;
    for (const w of activeChallenge.completedWeeks) {
      totalSaved += activeChallenge.initialAmount * w;
    }

    const remainingAmount = Math.max(0, activeChallenge.totalTarget - totalSaved);
    const progressPercent = activeChallenge.totalTarget > 0 ? Math.min(100, (totalSaved / activeChallenge.totalTarget) * 100) : 0;

    const startMs = new Date(activeChallenge.startDate).getTime();
    const todayMs = new Date().getTime();
    const diffDays = Math.floor((todayMs - startMs) / (1000 * 60 * 60 * 24));
    const currentCalculatedWeek = Math.max(1, Math.min(52, Math.floor(diffDays / 7) + 1));

    let nextUncompletedWeek = 1;
    for (let w = 1; w <= 52; w++) {
      if (!completedWeeksSet.has(w)) {
        nextUncompletedWeek = w;
        break;
      }
    }

    const nextWeekAmount = activeChallenge.initialAmount * nextUncompletedWeek;

    return {
      completedWeeksSet,
      completedCount: activeChallenge.completedWeeks.length,
      totalSaved,
      remainingAmount,
      progressPercent,
      currentCalculatedWeek,
      nextUncompletedWeek,
      nextWeekAmount,
    };
  }, [activeChallenge]);

  const allWeeksList = useMemo(() => {
    if (!activeChallenge) return [];
    const list = [];
    const startDateObj = new Date(activeChallenge.startDate);
    for (let w = 1; w <= 52; w++) {
      const weekAmount = Math.round(activeChallenge.initialAmount * w);
      const weekDateObj = new Date(startDateObj);
      weekDateObj.setDate(weekDateObj.getDate() + (w - 1) * 7);
      const weekDateStr = weekDateObj.toISOString().slice(0, 10);
      const formattedDate = weekDateObj.toLocaleDateString(language === 'es' ? 'es-ES' : language === 'en' ? 'en-US' : 'pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const isCompleted = activeChallenge.completedWeeks.includes(w);
      const isCurrentWeek = metrics?.currentCalculatedWeek === w;
      list.push({ weekNumber: w, amount: weekAmount, dateStr: weekDateStr, formattedDate, isCompleted, isCurrentWeek });
    }
    return list;
  }, [activeChallenge, language, metrics]);

  const filteredWeeks = useMemo(() => {
    return allWeeksList.filter((w) => {
      if (weekFilter === 'completed') return w.isCompleted;
      if (weekFilter === 'pending') return !w.isCompleted;
      return true;
    });
  }, [allWeeksList, weekFilter]);

  const handleConfirmWeekSubmit = async () => {
    if (!activeChallenge || weekToConfirm === null) return;
    try {
      setIsSubmittingWeek(true);
      await onCompleteWeek(activeChallenge.id, weekToConfirm, onAddExpense);
      setWeekToConfirm(null);
    } catch (err) {
      console.error('Error confirming week:', err);
    } finally {
      setIsSubmittingWeek(false);
    }
  };

  const handleUndoWeekSubmit = async () => {
    if (!activeChallenge || weekToUndo === null) return;
    try {
      setIsSubmittingWeek(true);
      await onUndoWeek(activeChallenge.id, weekToUndo, onDeleteExpense);
      setWeekToUndo(null);
    } catch (err) {
      console.error('Error undoing week:', err);
    } finally {
      setIsSubmittingWeek(false);
    }
  };

  const containerVariants: any = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const itemVariants: any = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } }
  };

  if (!activeChallenge || isCreatingNew) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <button
            onClick={onReturnToFinance}
            className="h-11 px-4 rounded-2xl glass-card text-slate-700 text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-white transition-all cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          {challenges.length > 0 && (
            <button onClick={() => setIsCreatingNew(false)} className="text-xs font-black text-emerald-600 uppercase tracking-widest hover:underline">
              Voltar ao Ativo
            </button>
          )}
        </div>

        <div className="glass-panel rounded-[2.5rem] p-8 sm:p-10 shadow-xl max-w-2xl mx-auto overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity">
            <Award className="w-48 h-48 text-emerald-600" />
          </div>

          <div className="flex items-center gap-4 mb-10 relative z-10">
            <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20">
              <Award className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Desafio 52 Semanas</h2>
              <p className="text-xs text-slate-600 font-medium max-w-sm mt-1">Economia progressiva para construir patrimônio com constância.</p>
            </div>
          </div>

          <form onSubmit={handleCreateSubmit} className="space-y-8 relative z-10">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Título do Desafio</label>
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                placeholder="Ex: Reserva 2026"
                className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 px-6 text-white font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all outline-none"
              />
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Valor da Semana 1 (Multiplicador)</label>
              <div className="relative">
                <input
                  type="number"
                  required
                  value={initialAmountStr}
                  onChange={(e) => setInitialAmountStr(e.target.value.replace(/^0+(?=\d)/, ''))}
                  className="w-full h-16 rounded-2xl bg-white/5 border border-white/10 pl-16 pr-6 text-2xl font-black text-emerald-400 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 transition-all outline-none font-mono"
                />
                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-600 font-black text-xl">$</div>
              </div>

              <div className="flex flex-wrap gap-2">
                {[100, 500, 1000, 2000].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setInitialAmountStr(String(p))}
                    className={`h-10 px-4 rounded-xl border text-[11px] font-black tracking-widest uppercase transition-all cursor-pointer ${
                      parsedInitialAmount === p ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    {formatCurrency(p, currency)}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 rounded-[2rem] bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-between group">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500/70 mb-1">Total do Desafio</div>
                <div className="text-3xl font-black text-white group-hover:text-emerald-400 transition-colors">{formatCurrency(creationTotalTarget, currency)}</div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-emerald-400 border border-white/10">
                <Target className="w-6 h-6" />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={isSubmittingCreate || parsedInitialAmount <= 0}
              className="w-full h-16 rounded-[1.5rem] bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isSubmittingCreate ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
              {isSubmittingCreate ? 'Lançando...' : 'Iniciar Desafio'}
            </motion.button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-20">
      {/* Cinematic Header Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-panel rounded-[2.5rem] p-8 relative overflow-hidden group shadow-md">
          <div className="absolute top-0 right-0 p-8 opacity-10"><Award className="w-32 h-32 text-emerald-600" /></div>
          
          <div className="flex items-center gap-3 mb-6">
            <button onClick={onReturnToFinance} className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 transition-all shadow-xs"><ArrowLeft className="w-5 h-5" /></button>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">{activeChallenge.title}</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 relative z-10">
            <div className="space-y-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Progresso</div>
              <div className="text-2xl font-black text-slate-900">{metrics?.progressPercent.toFixed(1)}%</div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Acumulado</div>
              <div className="text-2xl font-black text-emerald-600 font-mono">{formatCurrency(metrics?.totalSaved || 0, currency)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Semanas</div>
              <div className="text-2xl font-black text-slate-900">{metrics?.completedCount}/52</div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Restante</div>
              <div className="text-2xl font-black text-rose-600 font-mono">{formatCurrency(metrics?.remainingAmount || 0, currency)}</div>
            </div>
          </div>

          <div className="mt-8 h-3 w-full bg-slate-200/80 rounded-full overflow-hidden border border-slate-200/50">
            <motion.div 
              initial={{ width: 0 }} 
              animate={{ width: `${metrics?.progressPercent}%` }} 
              className="h-full bg-gradient-to-r from-emerald-600 to-teal-400 relative"
            >
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)] animate-shimmer" />
            </motion.div>
          </div>
        </div>

        <div className="glass-card rounded-[2.5rem] p-8 flex flex-col justify-between group shadow-md">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-amber-600">Próximo Passo</div>
              <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
            </div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">Semana {metrics?.nextUncompletedWeek}</div>
            <div className="text-4xl font-black text-slate-900 font-mono">{formatCurrency(metrics?.nextWeekAmount || 0, currency)}</div>
          </div>
          <button 
            onClick={() => setWeekToConfirm(metrics?.nextUncompletedWeek || null)}
            className="w-full h-14 mt-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-widest shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            Confirmar Depósito
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid of Weeks */}
      <div className="glass-panel rounded-[2.5rem] overflow-hidden shadow-md">
        <div className="p-6 border-b border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600"><History className="w-5 h-5" /></div>
            <h3 className="text-sm font-black text-slate-900 tracking-widest uppercase">Linha do Tempo</h3>
          </div>

          <div className="flex items-center gap-1 p-1 bg-white/5 rounded-xl border border-white/10">
            {(['all', 'pending', 'completed'] as const).map(f => (
              <button
                key={f}
                onClick={() => setWeekFilter(f)}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                  weekFilter === f ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-500 hover:text-white'
                }`}
              >
                {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendentes' : 'Feitas'}
              </button>
            ))}
          </div>
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="p-6 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3"
        >
          {filteredWeeks.map((w) => (
            <motion.button
              key={w.weekNumber}
              variants={itemVariants}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => w.isCompleted ? setWeekToUndo(w.weekNumber) : setWeekToConfirm(w.weekNumber)}
              className={`p-4 rounded-[1.5rem] border transition-all text-left flex flex-col justify-between gap-4 relative overflow-hidden ${
                w.isCompleted 
                  ? 'bg-emerald-600/10 border-emerald-500/30' 
                  : w.isCurrentWeek 
                    ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/10 ring-2 ring-amber-500/20' 
                    : 'bg-white/5 border-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[9px] font-black uppercase tracking-widest ${w.isCompleted ? 'text-emerald-400' : w.isCurrentWeek ? 'text-amber-400' : 'text-slate-600'}`}>W{w.weekNumber}</span>
                {w.isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <div>
                <div className={`text-xs font-black font-mono ${w.isCompleted ? 'text-white' : 'text-slate-300'}`}>{formatCurrency(w.amount, currency)}</div>
                <div className="text-[9px] font-bold text-slate-500 mt-0.5">{w.formattedDate}</div>
              </div>
            </motion.button>
          ))}
        </motion.div>
      </div>

      {/* Confirmation & Undo Modals */}
      <AnimatePresence>
        {(weekToConfirm || weekToUndo) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 glass-overlay" onClick={() => { setWeekToConfirm(null); setWeekToUndo(null); }} />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass-modal w-full max-w-sm p-8 rounded-[2.5rem] text-center relative z-10 shadow-2xl"
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${weekToConfirm ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                {weekToConfirm ? <CheckCircle2 className="w-8 h-8" /> : <RotateCcw className="w-8 h-8" />}
              </div>
              <h4 className="text-xl font-black text-slate-900 tracking-tight mb-2">{weekToConfirm ? `Semana ${weekToConfirm}` : `Reabrir Semana ${weekToUndo}`}</h4>
              <p className="text-sm font-medium text-slate-600 mb-8">{weekToConfirm ? 'Confirmar depósito desta semana na reserva?' : 'Isso removerá o lançamento correspondente.'}</p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={weekToConfirm ? handleConfirmWeekSubmit : handleUndoWeekSubmit}
                  className={`h-14 rounded-2xl font-black text-xs uppercase tracking-widest text-white transition-all ${weekToConfirm ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20' : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20 shadow-xl'}`}
                >
                  {isSubmittingWeek ? '...' : (weekToConfirm ? 'Confirmar' : 'Desfazer')}
                </button>
                <button onClick={() => { setWeekToConfirm(null); setWeekToUndo(null); }} className="h-14 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-black text-[10px] uppercase tracking-widest transition-all">Cancelar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
