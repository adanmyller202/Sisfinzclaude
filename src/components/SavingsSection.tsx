/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SavingGoal, SavingTransaction, CurrencyCode, LanguageCode } from '../types';
import { formatCurrency, CURRENCIES } from '../utils/currency';
import { getTranslations, getLocaleForLanguage } from '../utils/i18n';
import {
  PiggyBank,
  Plus,
  ArrowRightLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Edit2,
  Trash2,
  CheckCircle2,
  Target,
  Sparkles,
  TrendingUp,
  History,
  Coins,
  Lock,
  Wallet,
} from 'lucide-react';

interface SavingsSectionProps {
  savings: SavingGoal[];
  transactions?: SavingTransaction[];
  currentBalance: number;
  currency: CurrencyCode;
  language?: LanguageCode;
  onOpenCreateModal: () => void;
  onOpenEditModal: (goal: SavingGoal) => void;
  onOpenTransferModal: (goalId?: string, type?: 'deposit' | 'withdrawal') => void;
  onDeleteGoal: (goalId: string) => Promise<void>;
}

export const SavingsSection: React.FC<SavingsSectionProps> = ({
  savings = [],
  transactions = [],
  currentBalance = 0,
  currency = 'ARS',
  language = 'pt',
  onOpenCreateModal,
  onOpenEditModal,
  onOpenTransferModal,
  onDeleteGoal,
}) => {
  const t = getTranslations(language);
  const locale = getLocaleForLanguage(language);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'goals' | 'history'>('goals');
  const [selectedCurrencyFilter, setSelectedCurrencyFilter] = useState<'ALL' | CurrencyCode>('ALL');

  const safeSavings = Array.isArray(savings) ? savings : [];
  const safeTransactions = Array.isArray(transactions) ? transactions : [];

  // Group totals strictly by currency — NEVER sum different currencies directly
  const totalsByCurrency = useMemo(() => {
    const map: Record<string, { saved: number; target: number; count: number }> = {};
    safeSavings.forEach((s) => {
      const cur = s.currency || 'ARS';
      if (!map[cur]) {
        map[cur] = { saved: 0, target: 0, count: 0 };
      }
      map[cur].saved += s.currentAmount || 0;
      if (s.hasTarget !== false && s.targetAmount) {
        map[cur].target += s.targetAmount;
      }
      map[cur].count += 1;
    });
    return map;
  }, [safeSavings]);

  const activeCurrencies = Object.keys(totalsByCurrency) as CurrencyCode[];

  // Filtered goals
  const filteredSavings = useMemo(() => {
    if (selectedCurrencyFilter === 'ALL') return safeSavings;
    return safeSavings.filter((s) => (s.currency || 'ARS') === selectedCurrencyFilter);
  }, [safeSavings, selectedCurrencyFilter]);

  const handleDelete = async (goal: SavingGoal) => {
    if (confirm(`Deseja realmente excluir a reserva "${goal.name}"?`)) {
      try {
        setDeletingId(goal.id);
        await onDeleteGoal(goal.id);
      } catch (err) {
        console.error('Error deleting saving goal:', err);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const getDeadlineInfo = (deadlineStr?: string) => {
    if (!deadlineStr) return null;
    try {
      const targetDate = new Date(`${deadlineStr}T23:59:59`), now = new Date();
      const diffMs = targetDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / 86400000);
      const formatted = new Date(`${deadlineStr}T12:00:00`).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
      return { formatted, diffDays, isOverdue: diffDays < 0 };
    } catch { return null; }
  };

  const containerVariants: any = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
  const itemVariants: any = { hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 25 } } };

  return (
    <div className="space-y-6">
      {/* Premium Overview Header with Multi-Currency Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-[2.5rem] p-8 sm:p-10 shadow-md relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
          <PiggyBank className="w-48 h-48 text-emerald-600" />
        </div>
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-[1.25rem] bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-600/20">
                <PiggyBank className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none uppercase">
                  Cofrinhos & Reservas
                </h2>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mt-2">
                  GESTÃO PATRIMONIAL MULTIMOEDAS
                </p>
              </div>
            </div>

            {/* Separate Totals by Currency — Never mixed together */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-8 pt-2">
              {activeCurrencies.length === 0 ? (
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Poupado</div>
                  <div className="text-3xl font-black text-slate-900 font-mono tracking-tighter">
                    {formatCurrency(0, currency)}
                  </div>
                </div>
              ) : (
                activeCurrencies.map((cur) => {
                  const data = totalsByCurrency[cur];
                  const cfg = CURRENCIES[cur] || CURRENCIES.ARS;
                  const curPercent = data.target > 0 ? Math.min(100, Math.round((data.saved / data.target) * 100)) : null;

                  return (
                    <div key={cur} className="p-3.5 rounded-2xl bg-white/70 border border-slate-200/80 shadow-xs min-w-[140px]">
                      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                        <span>{cfg.flag}</span>
                        <span>{cur}</span>
                        <span className="text-slate-400 font-normal">({data.count})</span>
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
                        {formatCurrency(data.saved, cur)}
                      </div>
                      {curPercent !== null && (
                        <div className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mt-1">
                          {curPercent}% da meta
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onOpenCreateModal}
              className="h-14 px-8 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest shadow-md transition-all flex items-center gap-3 cursor-pointer"
            >
              <Plus className="w-5 h-5 stroke-[3]" /> Nova Reserva
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={safeSavings.length === 0}
              onClick={() => onOpenTransferModal()}
              className="h-14 px-8 rounded-2xl bg-white/80 border border-slate-200/80 text-slate-700 font-black text-xs uppercase tracking-widest hover:bg-white transition-all flex items-center gap-3 disabled:opacity-30 shadow-xs cursor-pointer"
            >
              <ArrowRightLeft className="w-5 h-5 text-emerald-600" /> Aporte / Resgate
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Tabs & Filters Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Main View Switcher: Cofrinhos vs Histórico */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white/80 border border-slate-200/80 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab('goals')}
            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'goals'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Reservas ({safeSavings.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Histórico ({safeTransactions.length})</span>
          </button>
        </div>

        {/* Currency Filter Chips (when goals tab is active) */}
        {activeTab === 'goals' && activeCurrencies.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
            <button
              type="button"
              onClick={() => setSelectedCurrencyFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer border ${
                selectedCurrencyFilter === 'ALL'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white/80 text-slate-600 border-slate-200 hover:bg-white'
              }`}
            >
              Todas
            </button>
            {activeCurrencies.map((cur) => {
              const cfg = CURRENCIES[cur] || CURRENCIES.ARS;
              return (
                <button
                  type="button"
                  key={cur}
                  onClick={() => setSelectedCurrencyFilter(cur)}
                  className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer border flex items-center gap-1 ${
                    selectedCurrencyFilter === cur
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white/80 text-slate-600 border-slate-200 hover:bg-white'
                  }`}
                >
                  <span>{cfg.flag}</span>
                  <span>{cur}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'goals' && (
          <motion.div
            key="goals-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {filteredSavings.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-20 glass-panel rounded-[3rem] text-center space-y-5 shadow-md"
              >
                <div className="w-20 h-20 bg-emerald-500/10 rounded-[2.5rem] flex items-center justify-center mx-auto text-4xl shadow-xs">
                  📦
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-slate-900">Nenhuma reserva encontrada</h3>
                  <p className="text-sm font-medium text-slate-600 max-w-sm mx-auto">
                    Crie reservas com meta ou valores livres em pesos ($), dólares (US$) ou reais (R$).
                  </p>
                </div>
                <button
                  onClick={onOpenCreateModal}
                  className="h-14 px-8 rounded-2xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest shadow-md cursor-pointer"
                >
                  Criar Nova Reserva
                </button>
              </motion.div>
            ) : (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                {filteredSavings.map((goal) => {
                  const goalCur: CurrencyCode = (goal.currency as CurrencyCode) || 'ARS';
                  const curCfg = CURRENCIES[goalCur] || CURRENCIES.ARS;
                  const current = goal.currentAmount || 0;
                  const hasTarget = goal.hasTarget !== false;
                  const target = hasTarget ? (goal.targetAmount || 1) : 0;
                  const percent = hasTarget && target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
                  const deadlineInfo = hasTarget ? getDeadlineInfo(goal.deadline) : null;

                  return (
                    <motion.div
                      key={goal.id}
                      variants={itemVariants}
                      className="glass-card rounded-[2.5rem] p-8 flex flex-col justify-between space-y-7 hover:border-emerald-500/40 transition-all group relative overflow-hidden shadow-md"
                    >
                      <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
                        <div className="text-9xl">{goal.icon || '🎯'}</div>
                      </div>
                      
                      {/* Top Bar: Icon, Name, Currency Badge, Actions */}
                      <div className="flex items-start justify-between relative z-10 gap-3">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center text-3xl shadow-xs transition-transform group-hover:scale-110">
                            {goal.icon || '🎯'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              {/* Currency Badge */}
                              <span className="px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 flex items-center gap-1">
                                <span>{curCfg.flag}</span>
                                <span>{goalCur}</span>
                              </span>
                              {/* HasTarget vs Free Badge */}
                              <span
                                className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${
                                  hasTarget
                                    ? 'bg-blue-500/10 text-blue-700 border-blue-500/20'
                                    : 'bg-amber-500/10 text-amber-800 border-amber-500/20'
                                }`}
                              >
                                {hasTarget ? 'Meta Definida' : 'Reserva Livre'}
                              </span>
                            </div>
                            <h3 className="text-lg font-black text-slate-900 leading-tight uppercase tracking-tight">
                              {goal.name}
                            </h3>
                            {deadlineInfo && (
                              <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest mt-1.5 ${deadlineInfo.isOverdue ? 'text-rose-600' : 'text-slate-500'}`}>
                                <Calendar className="w-3 h-3 text-emerald-600" /> {deadlineInfo.formatted} • {deadlineInfo.isOverdue ? 'Vencido' : `${deadlineInfo.diffDays} dias`}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => onOpenEditModal(goal)}
                            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all cursor-pointer"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(goal)}
                            disabled={deletingId === goal.id}
                            className="p-2.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-all cursor-pointer disabled:opacity-50"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Middle: Amount & Progress */}
                      <div className="space-y-4 relative z-10">
                        {hasTarget ? (
                          // With Target: Show Accumulated, Goal, Progress Bar, Percentage
                          <>
                            <div className="flex items-end justify-between">
                              <div>
                                <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Acumulado</div>
                                <div className="text-2xl font-black text-emerald-600 font-mono tracking-tighter leading-none">
                                  {formatCurrency(current, goalCur)}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Meta</div>
                                <div className="text-base font-black text-slate-700 font-mono leading-none">
                                  {formatCurrency(target, goalCur)}
                                </div>
                              </div>
                            </div>
                            
                            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/80">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${percent}%` }}
                                className="h-full bg-gradient-to-r from-emerald-600 to-teal-400"
                              />
                            </div>
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-emerald-600">
                              <span>{percent}% CONCLUÍDO</span>
                              <span className="text-slate-500">
                                {percent >= 100
                                  ? 'CONCLUÍDA 🎉'
                                  : `FALTA ${formatCurrency(Math.max(0, target - current), goalCur)}`}
                              </span>
                            </div>
                          </>
                        ) : (
                          // Sem Meta (Livre): Show Amount cleanly WITHOUT progress bars or 0%
                          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/15 space-y-2">
                            <div className="text-[9px] font-black uppercase tracking-widest text-amber-800">
                              Saldo Atual Guardado
                            </div>
                            <div className="text-2xl font-black text-emerald-600 font-mono tracking-tighter leading-none">
                              {formatCurrency(current, goalCur)}
                            </div>
                            <div className="text-[10px] font-medium text-slate-500">
                              Reserva sem valor limite. Deposite e resgate livremente a qualquer momento.
                            </div>
                          </div>
                        )}

                        {goal.notes && (
                          <p className="text-xs text-slate-500 italic bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                            "{goal.notes}"
                          </p>
                        )}
                      </div>

                      {/* Bottom Action Buttons: Aporte & Resgate */}
                      <div className="flex gap-3 relative z-10 pt-4 border-t border-slate-100">
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => onOpenTransferModal(goal.id, 'deposit')}
                          className="flex-1 h-13 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <ArrowUpRight className="w-4 h-4 stroke-[3]" /> Aporte
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => onOpenTransferModal(goal.id, 'withdrawal')}
                          disabled={current <= 0}
                          className="flex-1 h-13 rounded-2xl bg-white border border-slate-200 text-slate-700 hover:text-slate-900 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40 shadow-xs cursor-pointer"
                        >
                          <ArrowDownLeft className="w-4 h-4 text-blue-500" /> Resgate
                        </motion.button>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Histórico Completo de Movimentações */}
        {activeTab === 'history' && (
          <motion.div
            key="history-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {safeTransactions.length === 0 ? (
              <div className="py-16 glass-panel rounded-[2.5rem] text-center space-y-3">
                <History className="w-12 h-12 text-slate-300 mx-auto" />
                <h4 className="text-base font-black text-slate-800 uppercase tracking-wider">
                  Nenhuma movimentação registrada
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Faça um aporte ou resgate em qualquer cofrinho para visualizar o histórico detalhado com conversões cambiais.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {safeTransactions.map((tx) => {
                  const isDeposit = tx.type === 'deposit';
                  const txCur: CurrencyCode = (tx.currency as CurrencyCode) || 'ARS';
                  const curCfg = CURRENCIES[txCur] || CURRENCIES.ARS;
                  const isForeign = txCur !== 'ARS';

                  return (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-5 rounded-2xl bg-white/80 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                            isDeposit ? 'bg-emerald-500/10 text-emerald-600' : 'bg-blue-500/10 text-blue-600'
                          }`}
                        >
                          {isDeposit ? <ArrowUpRight className="w-6 h-6 stroke-[2.5]" /> : <ArrowDownLeft className="w-6 h-6 stroke-[2.5]" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-slate-900 uppercase">
                              {tx.savingName || 'Cofrinho'}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                                isDeposit ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                              }`}
                            >
                              {isDeposit ? 'Aporte' : 'Resgate'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">{tx.date}</span>
                          </div>
                          {tx.note && (
                            <p className="text-xs text-slate-500 mt-1 line-clamp-1">{tx.note}</p>
                          )}
                        </div>
                      </div>

                      <div className="text-left sm:text-right shrink-0">
                        <div
                          className={`text-lg font-black font-mono tracking-tight ${
                            isDeposit ? 'text-emerald-600' : 'text-blue-600'
                          }`}
                        >
                          {isDeposit ? '+' : '-'}{formatCurrency(tx.amount, txCur)}
                        </div>
                        {isForeign && tx.baseAmountARS !== undefined && (
                          <div className="text-[10px] font-black text-slate-500 font-mono mt-0.5">
                            {formatCurrency(tx.baseAmountARS, 'ARS')} • Cot: $ {tx.exchangeRate || 1}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
