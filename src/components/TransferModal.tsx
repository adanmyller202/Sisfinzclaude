/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { SavingGoal, CurrencyCode, LanguageCode, AccountItem } from '../types';
import { getTranslations } from '../utils/i18n';
import { formatCurrency, CURRENCIES } from '../utils/currency';
import { getTodayStr } from '../utils/finance';
import {
  X,
  ArrowRightLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  Target,
  Calendar,
  AlertCircle,
  Check,
  Plus,
  MessageSquare,
  TrendingUp,
  Info,
} from 'lucide-react';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  savings: SavingGoal[];
  accounts: AccountItem[];
  currentBalance: number;
  currency: CurrencyCode;
  language?: LanguageCode;
  defaultSavingId?: string;
  defaultType?: 'deposit' | 'withdrawal';
  onTransferToSaving: (
    savingId: string,
    amount: number,
    exchangeRate: number,
    date?: string,
    note?: string,
    accountId?: string,
    accountName?: string
  ) => Promise<void>;
  onWithdrawFromSaving: (
    savingId: string,
    amount: number,
    exchangeRate: number,
    date?: string,
    note?: string,
    accountId?: string,
    accountName?: string
  ) => Promise<void>;
  onOpenCreateSaving?: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  savings = [],
  accounts = [],
  currentBalance = 0,
  currency = 'ARS',
  language = 'pt',
  defaultSavingId,
  defaultType = 'deposit',
  onTransferToSaving,
  onWithdrawFromSaving,
  onOpenCreateSaving,
}) => {
  const t = getTranslations(language);

  const safeSavings = Array.isArray(savings) ? savings : [];
  const [mode, setMode] = useState<'deposit' | 'withdrawal'>(defaultType);
  const [selectedSavingId, setSelectedSavingId] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [accountAmount, setAccountAmount] = useState<string>('');
  const [exchangeRate, setExchangeRate] = useState<string>('1');
  const [date, setDate] = useState<string>(getTodayStr());
  const [note, setNote] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(defaultType);
      if (defaultSavingId && safeSavings.some((s) => s.id === defaultSavingId)) {
        setSelectedSavingId(defaultSavingId);
      } else if (safeSavings.length > 0) {
        setSelectedSavingId(safeSavings[0].id);
      } else {
        setSelectedSavingId('');
      }
      setAmount('');
      setAccountAmount('');
      setExchangeRate('');
      setSelectedAccountId(accounts.find((a) => a.isActive !== false && (a.currency || 'ARS') === 'ARS')?.id || '');
      setDate(getTodayStr());
      setNote('');
      setError(null);
    }
  }, [isOpen, defaultSavingId, defaultType, safeSavings, accounts]);

  const selectedGoal = safeSavings.find((s) => s.id === selectedSavingId);
  const availableAccounts = accounts.filter((a) => a.isActive !== false && (a.currency || 'ARS') === 'ARS');
  const selectedAccount = availableAccounts.find((a) => a.id === selectedAccountId);
  const goalCurrency: CurrencyCode = (selectedGoal?.currency as CurrencyCode) || 'ARS';
  const isForeignCurrency = goalCurrency !== 'ARS';
  const goalConfig = CURRENCIES[goalCurrency] || CURRENCIES.ARS;

  // Set default exchange rate suggestion when switching goal
  useEffect(() => {
    if (isForeignCurrency) {
      setExchangeRate('');
    } else {
      setExchangeRate('1');
    }
  }, [goalCurrency, isForeignCurrency]);

  const parsedAmount = parseFloat(amount.replace(/[^0-9.-]/g, '')) || 0;
  const parsedRate = isForeignCurrency
    ? parseFloat(exchangeRate.replace(/[^0-9.-]/g, '')) || 0
    : 1;

  // Converted base amount in ARS
  const baseAmountARS = isForeignCurrency
    ? Math.round(parsedAmount * parsedRate * 100) / 100
    : parsedAmount;
  const accountBalance = selectedAccount?.currentBalance ?? currentBalance;
  const handleGoalAmountChange = (value: string) => { setAmount(value); setAccountAmount(String(Math.round((parseFloat(value) || 0) * parsedRate * 100) / 100)); };
  const handleAccountAmountChange = (value: string) => { setAccountAmount(value); setAmount(String(parsedRate > 0 ? Math.round(((parseFloat(value) || 0) / parsedRate) * 100000000) / 100000000 : 0)); };
  const handleRateChange = (value: string) => { setExchangeRate(value); setAccountAmount(String(Math.round((parseFloat(amount) || 0) * (parseFloat(value) || 0) * 100) / 100)); };

  // Impact on base financial balance (in ARS)
  const afterBalanceARS =
    mode === 'deposit'
      ? accountBalance - baseAmountARS
      : accountBalance + baseAmountARS;

  // Impact on saving goal (in goal's own currency)
  const afterSavingAmount = selectedGoal
    ? mode === 'deposit'
      ? (selectedGoal.currentAmount || 0) + parsedAmount
      : Math.max(0, (selectedGoal.currentAmount || 0) - parsedAmount)
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSavingId || !selectedGoal) {
      setError(language === 'es' ? 'Selecciona una reserva.' : 'Selecione uma reserva.');
      return;
    }

    if (!selectedAccount) { setError('Selecione uma conta ativa em pesos argentinos para esta movimentação.'); return; }

    if (parsedAmount <= 0) {
      setError(language === 'es' ? 'Ingresa un monto válido mayor que cero.' : 'Informe um valor maior que zero.');
      return;
    }

    if (isForeignCurrency && parsedRate <= 0) {
      setError(
        language === 'es'
          ? 'Por favor, ingresa una cotización válida en pesos.'
          : 'Por favor, informe uma cotação válida em pesos.'
      );
      return;
    }

    if (mode === 'deposit' && baseAmountARS > accountBalance) {
      setError(`O valor debitado (${formatCurrency(baseAmountARS, 'ARS')}) supera o saldo da conta ${selectedAccount.name} (${formatCurrency(accountBalance, 'ARS')}).`);
      return;
    }

    if (mode === 'withdrawal') {
      const saved = selectedGoal?.currentAmount || 0;
      if (parsedAmount > saved) {
        setError(
          language === 'es'
            ? `No puedes retirar más de lo ahorrado (${formatCurrency(saved, goalCurrency)}).`
            : `Não é possível retirar mais do que o guardado (${formatCurrency(saved, goalCurrency)}).`
        );
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (mode === 'deposit') {
        await onTransferToSaving(
          selectedSavingId,
          parsedAmount,
          parsedRate,
          date,
          note.trim() || undefined,
          selectedAccount.id,
          selectedAccount.name
        );
      } else {
        await onWithdrawFromSaving(
          selectedSavingId,
          parsedAmount,
          parsedRate,
          date,
          note.trim() || undefined,
          selectedAccount.id,
          selectedAccount.name
        );
      }

      onClose();
    } catch (err: any) {
      console.error('Error in transfer/withdrawal:', err);
      setError(err?.message || 'Erro ao processar movimentação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAmount = (val: number) => {
    handleGoalAmountChange(String(val));
  };

  const handleMaxAmount = () => {
    if (mode === 'deposit') {
      if (accountBalance > 0) {
        if (!isForeignCurrency) handleGoalAmountChange(String(accountBalance));
        else if (parsedRate > 0) { const maxForeign = Math.floor((accountBalance / parsedRate) * 100) / 100; if (maxForeign > 0) handleGoalAmountChange(String(maxForeign)); }
      }
    } else {
      if (selectedGoal && (selectedGoal.currentAmount || 0) > 0) {
        handleGoalAmountChange(String(selectedGoal.currentAmount));
      }
    }
  };

  // Quick suggestion chips based on goal currency
  const quickSuggestions =
    goalCurrency === 'USD'
      ? [10, 20, 50, 100]
      : goalCurrency === 'BRL'
      ? [50, 100, 200, 500]
      : [10000, 50000, 100000, 200000];

  return createPortal((
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[10001] flex items-center justify-center p-3 sm:p-4 overflow-hidden overscroll-none bg-slate-950/25 pt-safe pb-safe"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="glass-modal rounded-[2.5rem] max-w-lg w-full max-h-[calc(100dvh-2.5rem)] sm:max-h-[calc(100dvh-3.5rem)] flex flex-col overflow-hidden relative shadow-2xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Mesh Gradient */}
            <div className="relative p-8 shrink-0 overflow-hidden">
              <motion.div 
                layout
                className={`absolute inset-0 mesh-gradient opacity-20 transition-colors duration-700 ${
                  mode === 'deposit' ? 'from-emerald-500/40' : 'from-blue-500/40'
                }`} 
              />
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <motion.div 
                    key={mode}
                    initial={{ rotate: -15, scale: 0.8 }}
                    animate={{ rotate: 0, scale: 1 }}
                    className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-inner border transition-colors duration-500 ${
                      mode === 'deposit' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                    }`}
                  >
                    <ArrowRightLeft className="w-8 h-8" />
                  </motion.div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-tight tracking-tight">
                      {mode === 'deposit' ? 'Aporte no Cofrinho' : 'Resgate do Cofrinho'}
                    </h3>
                    <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em] mt-1">
                      MOVIMENTAÇÃO DE SALDO SISFINZ
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-12 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all cursor-pointer flex items-center justify-center"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }}
                className="mx-8 mt-2 p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-[11px] font-black uppercase tracking-widest flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-8 space-y-7 no-scrollbar">
                
                {/* Direction Toggle */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">
                    {t.transferTypeLabel || 'TIPO DE MOVIMENTAÇÃO'}
                  </label>
                  <div className="grid grid-cols-2 gap-3 p-1.5 rounded-[1.25rem] bg-[#D1FAEB]/60 border border-emerald-500/20 relative overflow-hidden backdrop-blur-md">
                    <button
                      type="button"
                      onClick={() => setMode('deposit')}
                      className={`flex items-center justify-center gap-2 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all cursor-pointer relative z-10 ${
                        mode === 'deposit' ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {mode === 'deposit' && (
                        <motion.div layoutId="transfer-mode-bg" className="absolute inset-0 bg-emerald-600 rounded-xl shadow-lg shadow-emerald-600/20" />
                      )}
                      <ArrowUpRight className="w-4 h-4 relative z-10" />
                      <span className="relative z-10">APORTE</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode('withdrawal')}
                      className={`flex items-center justify-center gap-2 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all cursor-pointer relative z-10 ${
                        mode === 'withdrawal' ? 'text-white' : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {mode === 'withdrawal' && (
                        <motion.div layoutId="transfer-mode-bg" className="absolute inset-0 bg-blue-600 rounded-xl shadow-lg shadow-blue-600/20" />
                      )}
                      <ArrowDownLeft className="w-4 h-4 relative z-10" />
                      <span className="relative z-10">RESGATE</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">{mode === 'deposit' ? 'CONTA DE ONDE SAIRÁ O DINHEIRO' : 'CONTA QUE RECEBERÁ O RESGATE'}</label>
                  <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} className="w-full px-5 py-4 text-sm font-black bg-white border border-slate-200 rounded-2xl text-slate-900" required>
                    <option value="">Selecione uma conta em pesos</option>
                    {availableAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} — Saldo: {formatCurrency(account.currentBalance || 0, 'ARS')}</option>)}
                  </select>
                </div>

                {/* Meta Selection */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
                      COFRINHO DE DESTINO / ORIGEM
                    </label>
                    {onOpenCreateSaving && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenCreateSaving();
                        }}
                        className="text-[10px] font-black text-emerald-600 flex items-center gap-1.5 cursor-pointer uppercase tracking-[0.2em] hover:scale-105 transition-transform bg-emerald-500/5 px-3 py-1 rounded-xl border border-emerald-500/20"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>NOVA RESERVA</span>
                      </button>
                    )}
                  </div>

                  {safeSavings.length === 0 ? (
                    <div className="p-8 rounded-[2rem] border-2 border-dashed border-slate-200 text-center space-y-4 bg-white/80">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Nenhuma reserva criada</p>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenCreateSaving?.();
                        }}
                        className="px-6 py-3 text-[10px] font-black text-white bg-emerald-600 rounded-xl uppercase tracking-widest shadow-md shadow-emerald-600/20"
                      >
                        Criar Agora
                      </button>
                    </div>
                  ) : (
                    <div className="relative group">
                      <select
                        value={selectedSavingId}
                        onChange={(e) => { setSelectedSavingId(e.target.value); setAmount(''); setAccountAmount(''); setExchangeRate(''); }}
                        className="w-full px-5 py-4 text-sm font-black bg-white/80 border border-slate-200/80 rounded-[1.25rem] focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 text-slate-900 cursor-pointer transition-all appearance-none"
                        required
                      >
                        {safeSavings.map((s) => {
                          const sCur = s.currency || 'ARS';
                          const curCfg = CURRENCIES[sCur] || CURRENCIES.ARS;
                          return (
                            <option key={s.id} value={s.id}>
                              {s.icon || '🎯'} {s.name} [{curCfg.flag} {sCur}] — Saldo: {formatCurrency(s.currentAmount, sCur)}
                            </option>
                          );
                        })}
                      </select>
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 flex items-center gap-2">
                        <span className="text-base">{goalConfig.flag}</span>
                        <Target className="w-4 h-4" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Foreign Currency Conversion Field */}
                {isForeignCurrency && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 rounded-[1.5rem] bg-amber-500/5 border border-amber-500/20 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-amber-900 uppercase tracking-[0.25em] flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                        {mode === 'deposit' ? 'COTAÇÃO UTILIZADA (EM PESOS)' : 'COTAÇÃO DO RESGATE (EM PESOS)'}
                      </label>
                      <span className="text-[9px] font-black uppercase text-amber-700">
                        1 {goalCurrency} = ? $
                      </span>
                    </div>

                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-amber-700">
                        $
                      </span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={exchangeRate}
                        onChange={(e) => handleRateChange(e.target.value)}
                        placeholder="Ex: 1575.00"
                        className="w-full pl-16 pr-4 py-3.5 text-sm font-mono-numbers font-black bg-white border border-amber-300/80 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 text-slate-900 transition-all"
                        required={isForeignCurrency}
                      />
                    </div>
                    <p className="text-[10px] font-medium text-amber-800 flex items-center gap-1">
                      <Info className="w-3 h-3 text-amber-600 shrink-0" />
                      {mode === 'deposit'
                        ? 'O valor em pesos correspondente será debitado da conta selecionada.'
                        : 'O valor em pesos correspondente será creditado na conta selecionada.'}
                    </p>
                  </motion.div>
                )}

                {/* Amount fields appear after the exchange quote is supplied. */}
                {(!isForeignCurrency || parsedRate > 0) && (
                  <div className="space-y-3">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
                      {mode === 'deposit' ? 'VALOR A APORTAR' : 'VALOR A RESGATAR'} ({goalCurrency})
                    </label>
                    <button
                      type="button"
                      onClick={handleMaxAmount}
                      className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] hover:scale-105 transition-transform bg-blue-500/5 px-2.5 py-1 rounded-lg border border-blue-500/20"
                    >
                      MÁXIMO ({mode === 'deposit' ? (isForeignCurrency && parsedRate > 0 ? `${goalConfig.symbol} ${(Math.floor((accountBalance / parsedRate) * 100) / 100).toLocaleString()}` : formatCurrency(accountBalance, 'ARS')) : formatCurrency(selectedGoal?.currentAmount || 0, goalCurrency)})
                    </button>
                  </div>

                  <div className="relative group">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-sm font-black text-emerald-600 flex items-center gap-1">
                      <span>{goalConfig.flag}</span>
                      <span>{goalConfig.symbol}</span>
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={amount}
                      onChange={(e) => handleGoalAmountChange(e.target.value)}
                      placeholder="0.00"
                      className={`w-full pl-20 pr-5 py-4 text-base font-mono-numbers font-black bg-white/80 border border-slate-200/80 rounded-[1.25rem] focus:outline-hidden focus:ring-2 transition-all text-slate-900 ${
                        mode === 'deposit' ? 'focus:ring-emerald-500/30' : 'focus:ring-blue-500/30'
                      }`}
                      required
                    />
                  </div>
                  {isForeignCurrency && <div className="space-y-2">
                    <div className="flex justify-center text-emerald-600"><ArrowRightLeft className="w-5 h-5" /></div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">VALOR EM PESOS {mode === 'deposit' ? 'A DESCONTAR' : 'A CREDITAR'} NA CONTA</label>
                    <div className="relative"><span className="absolute left-5 top-1/2 -translate-y-1/2 text-sm font-black text-emerald-700">$</span>
                      <input type="number" step="any" min="0" value={accountAmount} onChange={(e) => handleAccountAmountChange(e.target.value)} placeholder="0.00" className="w-full pl-12 pr-5 py-4 text-base font-mono-numbers font-black bg-white border border-emerald-200 rounded-[1.25rem] text-slate-900" required />
                    </div>
                    <p className="text-[10px] text-slate-500">Edite qualquer um dos valores; o outro será convertido automaticamente.</p>
                  </div>}

                  <div className="flex items-center gap-2 flex-wrap pt-1 px-1">
                    {quickSuggestions.map((val) => (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        key={val}
                        onClick={() => handleQuickAmount(val)}
                        className="px-3.5 py-1.5 text-[10px] font-black font-mono-numbers rounded-xl bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 transition-all cursor-pointer border border-emerald-100 shadow-xs uppercase tracking-wider"
                      >
                        +{goalConfig.symbol} {val.toLocaleString()}
                      </motion.button>
                    ))}
                  </div>
                </div>
                )}
                {isForeignCurrency && parsedRate <= 0 && <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs font-semibold text-amber-800">Informe a cotação utilizada para liberar os dois campos de conversão.</p>}

                {/* Impact Preview Card */}
                <AnimatePresence>
                  {selectedGoal && parsedAmount > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      className={`p-6 rounded-[2rem] text-slate-900 space-y-5 shadow-sm border relative overflow-hidden ${
                        mode === 'deposit' ? 'bg-[#D1FAEB]/50 border-emerald-500/20' : 'bg-blue-50/60 border-blue-500/20'
                      }`}
                    >
                      <div className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">
                        RESUMO DA OPERAÇÃO
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600">
                            <Wallet className="w-3.5 h-3.5 text-emerald-600" /> SALDO DA CONTA {selectedAccount?.name || ''}
                          </div>
                          <div className="text-lg font-black font-mono-numbers tracking-tight text-slate-900">
                            {formatCurrency(afterBalanceARS, 'ARS')}
                          </div>
                          <div className={`text-[10px] font-bold ${mode === 'deposit' ? 'text-rose-600' : 'text-emerald-700'}`}>
                            {mode === 'deposit' ? '-' : '+'}{formatCurrency(baseAmountARS, 'ARS')}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600">
                            <Target className="w-3.5 h-3.5 text-emerald-600" /> {selectedGoal.name}
                          </div>
                          <div className="text-lg font-black font-mono-numbers tracking-tight text-emerald-700">
                            {formatCurrency(afterSavingAmount, goalCurrency)}
                          </div>
                          <div className="text-[10px] font-bold text-emerald-700">
                            {mode === 'deposit' ? '+' : '-'}{formatCurrency(parsedAmount, goalCurrency)}
                          </div>
                        </div>
                      </div>

                      {isForeignCurrency && (
                        <div className="pt-3 border-t border-slate-200/80 text-[10px] font-black text-slate-700 flex items-center justify-between">
                          <span>COTAÇÃO APLICADA:</span>
                          <span className="font-mono">1 {goalCurrency} = {formatCurrency(parsedRate, 'ARS')}</span>
                        </div>
                      )}

                      <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.25em] italic">
                        {mode === 'deposit' 
                          ? '• Registrado como despesa em Investimentos (pesos)' 
                          : '• Creditado como receita confirmada em Investimentos (pesos)'}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Date & Note */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
                      <Calendar className={`w-3.5 h-3.5 ${mode === 'deposit' ? 'text-emerald-500' : 'text-blue-500'}`} /> DATA
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-5 py-3.5 text-sm font-black bg-white/80 border border-slate-200/80 rounded-[1.25rem] focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 transition-all appearance-none text-slate-900"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-400" /> OBSERVAÇÃO
                    </label>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Ex: Câmbio, aporte mensal..."
                      className="w-full px-5 py-3.5 text-sm font-black bg-white/80 border border-slate-200/80 rounded-[1.25rem] focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 transition-all text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>

              {/* Fixed Bottom Action Bar */}
              <div className="shrink-0 p-6 border-t border-slate-200/60 bg-white/80 backdrop-blur-2xl flex items-center justify-between gap-4 z-10">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-5 py-3 text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-[0.3em] transition-colors cursor-pointer"
                >
                  {t.cancelBtn}
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSubmitting || safeSavings.length === 0}
                  className={`px-8 py-4 text-[11px] font-black text-white rounded-2xl shadow-xl transition-all uppercase tracking-[0.25em] cursor-pointer flex items-center gap-2.5 active:scale-95 ${
                    mode === 'deposit' ? 'bg-emerald-600 shadow-emerald-600/30' : 'bg-blue-600 shadow-blue-600/30'
                  }`}
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>
                    {isSubmitting ? 'PROCESSANDO...' : (mode === 'deposit' ? 'CONFIRMAR APORTE' : 'CONFIRMAR RESGATE')}
                  </span>
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  ), document.body);
};
