import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { CurrencyCode, LanguageCode, ChallengeSquare } from '../types';
import {
  CURRENCIES,
  INITIAL_VALUE_SUGGESTIONS,
  formatCurrency,
  generateDynamicSquares,
  generateEqualSquares,
} from '../utils/currency';
import { getTranslations } from '../utils/i18n';
import { Target, X, Calculator, Sparkles, Check, ArrowRight, Grid3X3, TrendingUp, Layers } from 'lucide-react';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency: CurrencyCode;
  language?: LanguageCode;
  onSave: (goalData: {
    title: string;
    icon: string;
    targetAmount: number;
    initialValue: number;
    currency: CurrencyCode;
    notes?: string;
    squaresMode?: 'equal' | 'progressive';
    squaresCount?: number;
    squares?: ChallengeSquare[];
    totalSquares?: number;
  }) => Promise<unknown> | void;
}

const PRESET_ICONS = ['🎯', '🏍️', '✈️', '💻', '🏠', '🚗', '🛡️', '💍', '🎒', '🏖️', '📱', '🎓', '🎸', '💰', '👟', '🎮'];
const PRESET_SQUARE_COUNTS = [20, 30, 50, 100];

export const GoalModal: React.FC<GoalModalProps> = ({
  isOpen,
  onClose,
  currency: initialGlobalCurrency,
  language = 'pt',
  onSave,
}) => {
  const t = getTranslations(language);

  // Form inputs
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('🎯');
  const [currency, setCurrency] = useState<CurrencyCode>(initialGlobalCurrency || 'BRL');
  const [targetInput, setTargetInput] = useState<string>('20000');

  // Mode: 'byCount' or 'progressive'
  const [divisionMode, setDivisionMode] = useState<'byCount' | 'progressive'>('byCount');

  // By Count mode states
  const [squaresCount, setSquaresCount] = useState<number>(20);
  const [isCustomCount, setIsCustomCount] = useState<boolean>(false);
  const [customCountInput, setCustomCountInput] = useState<string>('20');
  const [useFixedValueDirectly, setUseFixedValueDirectly] = useState<boolean>(false);
  const [fixedValueInput, setFixedValueInput] = useState<string>('200');

  // Progressive mode states
  const [initialValue, setInitialValue] = useState<number>(100);
  const [customInitialInput, setCustomInitialInput] = useState<string>('');
  const [isCustomInitial, setIsCustomInitial] = useState<boolean>(false);

  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleCurrencyChange = (newCur: CurrencyCode) => {
    setCurrency(newCur);
    if (newCur === 'ARS') {
      setTargetInput('250000');
      setInitialValue(10000);
      setFixedValueInput('10000');
    } else if (newCur === 'BRL') {
      setTargetInput('20000');
      setInitialValue(100);
      setFixedValueInput('1000');
    } else {
      setTargetInput('5000');
      setInitialValue(20);
      setFixedValueInput('250');
    }
    setIsCustomInitial(false);
    setCustomInitialInput('');
  };

  useEffect(() => {
    if (isOpen) {
      handleCurrencyChange(initialGlobalCurrency || 'BRL');
      setTitle('');
      setNotes('');
      setError(null);
      setDivisionMode('byCount');
      setSquaresCount(20);
      setIsCustomCount(false);
      setUseFixedValueDirectly(false);
    }
  }, [isOpen, initialGlobalCurrency]);

  const numericTarget = Math.max(1, parseFloat(targetInput.replace(/[^0-9]/g, '')) || 0);

  const effectiveCount = useMemo(() => {
    if (useFixedValueDirectly) {
      const parsedVal = parseFloat(fixedValueInput.replace(/[^0-9]/g, '')) || 0;
      if (parsedVal > 0 && numericTarget > 0) {
        return Math.max(1, Math.min(1500, Math.round(numericTarget / parsedVal)));
      }
      return 20;
    }
    if (isCustomCount) {
      return Math.max(1, Math.min(1500, parseInt(customCountInput.replace(/[^0-9]/g, ''), 10) || 1));
    }
    return squaresCount;
  }, [useFixedValueDirectly, fixedValueInput, numericTarget, isCustomCount, customCountInput, squaresCount]);

  const effectiveInitial = isCustomInitial
    ? Math.max(1, parseFloat(customInitialInput.replace(/[^0-9]/g, '')) || 1)
    : initialValue;

  const calculatedSquares = useMemo<ChallengeSquare[]>(() => {
    if (numericTarget <= 0) return [];
    if (divisionMode === 'byCount') return generateEqualSquares(numericTarget, effectiveCount);
    if (effectiveInitial <= 0) return [];
    return generateDynamicSquares(numericTarget, effectiveInitial);
  }, [numericTarget, divisionMode, effectiveCount, effectiveInitial]);

  const totalCalculated = useMemo(() => {
    return calculatedSquares.reduce((sum, s) => sum + s.value, 0);
  }, [calculatedSquares]);

  const firstSquare = calculatedSquares[0];
  const lastSquare = calculatedSquares[calculatedSquares.length - 1];

  const equalValuePerSquare = useMemo(() => {
    if (calculatedSquares.length === 0) return 0;
    return Math.round(numericTarget / calculatedSquares.length);
  }, [numericTarget, calculatedSquares.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError(language === 'pt' ? 'Por favor, digite um nome para o seu objetivo.' : language === 'es' ? 'Por favor, ingresa un nombre para tu meta.' : 'Please enter a title for your goal.');
      return;
    }
    if (numericTarget < 10) {
      setError(language === 'pt' ? 'O valor da meta deve ser de pelo menos 10.' : language === 'es' ? 'El monto de la meta debe ser de al menos 10.' : 'Goal target must be at least 10.');
      return;
    }
    if (divisionMode === 'progressive' && effectiveInitial > numericTarget) {
      setError(language === 'pt' ? 'O valor inicial não pode ser maior que o valor total da meta.' : language === 'es' ? 'El valor inicial no puede ser mayor que el monto total de la meta.' : 'Initial starting step cannot be greater than the goal target.');
      return;
    }
    if (calculatedSquares.length === 0) {
      setError(language === 'pt' ? 'Não foi possível gerar os quadrados com os valores inseridos.' : language === 'es' ? 'No fue posible gerar los quadrados con estos valores.' : 'Could not generate squares with the provided values.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        title: title.trim(),
        icon,
        targetAmount: numericTarget,
        initialValue: divisionMode === 'byCount' ? equalValuePerSquare : effectiveInitial,
        currency,
        notes: notes.trim() || undefined,
        squaresMode: divisionMode === 'byCount' ? 'equal' : 'progressive',
        squaresCount: calculatedSquares.length,
        squares: calculatedSquares,
        totalSquares: calculatedSquares.length,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating goal.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currencyConfig = CURRENCIES[currency] || CURRENCIES.BRL;
  const suggestions = INITIAL_VALUE_SUGGESTIONS[currency] || INITIAL_VALUE_SUGGESTIONS.BRL;

  return createPortal((
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 glass-overlay overflow-y-auto overscroll-contain pt-safe pb-safe"
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="glass-modal rounded-[2.5rem] shadow-2xl max-w-xl w-full max-h-[min(90dvh,820px)] flex flex-col overflow-hidden my-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200/50 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20 text-3xl shadow-inner">
                  {icon}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                    {t.newGoalTitle}
                  </h3>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                    {language === 'pt' ? 'Planejamento de Objetivo' : 'Planificación de Meta'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Form Container */}
            <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="p-6 space-y-6 overflow-y-auto overscroll-contain flex-1 min-h-0 no-scrollbar">
                {error && (
                  <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-bold flex items-center gap-3">
                    <X className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Name & Icon */}
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                    {t.goalNameLabel}
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      placeholder={t.goalNamePlaceholder}
                      value={title}
                      onChange={(e) => { setTitle(e.target.value); setError(null); }}
                      className="flex-1 px-4 py-3.5 rounded-2xl border border-slate-200/80 bg-white/80 text-slate-900 text-sm font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
                    />
                    <select
                      value={icon}
                      onChange={(e) => setIcon(e.target.value)}
                      className="px-4 py-3.5 text-2xl rounded-2xl border border-slate-200/80 bg-white/80 text-slate-900 focus:ring-2 focus:ring-emerald-500/50 outline-hidden cursor-pointer"
                    >
                      {PRESET_ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                </div>

                {/* Target & Currency */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                      {t.goalTargetLabel}
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-emerald-600 font-mono-numbers">
                        {currencyConfig.symbol}
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={targetInput}
                        onChange={(e) => { setTargetInput(e.target.value.replace(/[^0-9]/g, '')); setError(null); }}
                        className="w-full pl-10 pr-4 py-3.5 rounded-2xl border border-slate-200/80 bg-white/80 text-slate-900 font-mono-numbers font-black text-lg focus:ring-2 focus:ring-emerald-500/50 outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                      {t.currency}
                    </label>
                    <div className="grid grid-cols-4 gap-1 p-1.5 bg-[#D1FAEB]/60 rounded-2xl border border-emerald-500/20">
                      {(['BRL', 'ARS', 'USD', 'EUR'] as CurrencyCode[]).map((c) => {
                        const isSel = currency === c;
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => handleCurrencyChange(c)}
                            className={`py-2 text-[11px] font-black rounded-xl transition-all cursor-pointer relative ${
                              isSel ? 'text-emerald-800' : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {isSel && (
                              <motion.div layoutId="currency-tab-bg" className="absolute inset-0 bg-white rounded-xl shadow-xs" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
                            )}
                            <span className="relative z-10">{c}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Division Mode */}
                <div className="space-y-3">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center justify-between">
                    <span>{t.divisionModeLabel}</span>
                    <span className="text-emerald-700 font-bold">{divisionMode === 'byCount' ? t.modeByCountShort : t.modeProgressiveShort}</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => { setDivisionMode('byCount'); setError(null); }}
                      className={`p-4 rounded-2xl border transition-all flex items-center gap-3 cursor-pointer relative group ${
                        divisionMode === 'byCount' ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-200/80 bg-white/60 hover:bg-emerald-50/50'
                      }`}
                    >
                      {divisionMode === 'byCount' && <motion.div layoutId="mode-tab-bg" className="absolute inset-0 bg-emerald-500/10 rounded-2xl" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />}
                      <Grid3X3 className={`w-5 h-5 relative z-10 ${divisionMode === 'byCount' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <div className="text-left relative z-10">
                        <span className={`text-xs font-black block ${divisionMode === 'byCount' ? 'text-emerald-900' : 'text-slate-700'}`}>{t.modeByCountShort}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Valores Fixos</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setDivisionMode('progressive'); setError(null); }}
                      className={`p-4 rounded-2xl border transition-all flex items-center gap-3 cursor-pointer relative group ${
                        divisionMode === 'progressive' ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-200/80 bg-white/60 hover:bg-emerald-50/50'
                      }`}
                    >
                      {divisionMode === 'progressive' && <motion.div layoutId="mode-tab-bg" className="absolute inset-0 bg-emerald-500/10 rounded-2xl" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />}
                      <TrendingUp className={`w-5 h-5 relative z-10 ${divisionMode === 'progressive' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <div className="text-left relative z-10">
                        <span className={`text-xs font-black block ${divisionMode === 'progressive' ? 'text-emerald-900' : 'text-slate-700'}`}>{t.modeProgressiveShort}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Crescente</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Configuration Sub-Panel */}
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 rounded-3xl bg-[#D1FAEB]/40 border border-emerald-500/20 space-y-4"
                >
                  {divisionMode === 'byCount' ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {PRESET_SQUARE_COUNTS.map((cnt) => {
                          const isSel = !isCustomCount && squaresCount === cnt && !useFixedValueDirectly;
                          return (
                            <button
                              key={cnt}
                              type="button"
                              onClick={() => { setSquaresCount(cnt); setIsCustomCount(false); setUseFixedValueDirectly(false); setError(null); }}
                              className={`px-4 py-2.5 rounded-xl border font-black text-[11px] transition-all cursor-pointer flex flex-col items-center min-w-[85px] uppercase tracking-widest ${
                                isSel ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-500/50'
                              }`}
                            >
                              <span>{cnt} UN</span>
                              <span className={`text-[9px] font-mono-numbers opacity-70`}>{formatCurrency(Math.round(numericTarget/cnt), currency)}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="pt-3 border-t border-emerald-500/20">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input type="checkbox" checked={useFixedValueDirectly} onChange={(e) => { setUseFixedValueDirectly(e.target.checked); setError(null); }} className="w-5 h-5 rounded-lg border-slate-300 text-emerald-600 focus:ring-emerald-500/50" />
                          <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{t.orFixedValuePerSquare}</span>
                        </label>
                        {useFixedValueDirectly && (
                          <div className="mt-3 relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">{currencyConfig.symbol}</span>
                            <input type="text" inputMode="numeric" value={fixedValueInput} onChange={(e) => { setFixedValueInput(e.target.value.replace(/[^0-9]/g, '')); setError(null); }} className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-900 font-mono-numbers font-black focus:ring-2 focus:ring-emerald-500/50 outline-hidden" />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {suggestions.map((val) => {
                          const isSel = !isCustomInitial && initialValue === val;
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => { setInitialValue(val); setIsCustomInitial(false); setError(null); }}
                              className={`px-4 py-2.5 rounded-xl border font-black text-[11px] transition-all cursor-pointer min-w-[85px] uppercase tracking-widest ${
                                isSel ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-500/50'
                              }`}
                            >
                              {formatCurrency(val, currency)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </motion.div>

                {/* Calculation Summary Card */}
                <div className="p-6 rounded-[2rem] glass-emerald text-slate-900 border border-emerald-500/20 shadow-xl space-y-5 relative overflow-hidden backdrop-blur-xl">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="flex items-center justify-between pb-4 border-b border-emerald-500/20">
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-800 flex items-center gap-2">
                      <Calculator className="w-4 h-4" />
                      Resumo do Desafio
                    </span>
                    <span className="text-xs font-black px-3 py-1 rounded-full bg-emerald-600/10 text-emerald-800 border border-emerald-500/20 font-mono-numbers">
                      {calculatedSquares.length} QUADRADOS
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-y-5 gap-x-8">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Total Meta</span>
                      <span className="text-xl font-black font-mono-numbers text-slate-900">{formatCurrency(numericTarget, currency)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Valor Médio</span>
                      <span className="text-xl font-black font-mono-numbers text-emerald-700">
                        {formatCurrency(divisionMode === 'byCount' ? equalValuePerSquare : effectiveInitial, currency)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">1º Quadrado</span>
                      <span className="text-sm font-black font-mono-numbers text-slate-800">{firstSquare ? formatCurrency(firstSquare.value, currency) : '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Último Quadrado</span>
                      <span className="text-sm font-black font-mono-numbers text-slate-800 flex items-center gap-2">
                        {lastSquare ? formatCurrency(lastSquare.value, currency) : '—'}
                        {lastSquare?.isAdjustment && <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-700 text-[8px] font-black uppercase">Ajuste</span>}
                      </span>
                    </div>
                  </div>

                  {calculatedSquares.length > 0 && (
                    <div className="pt-4 border-t border-emerald-500/20">
                      <div className="flex flex-wrap gap-1.5">
                        {calculatedSquares.slice(0, 8).map((sq) => (
                          <div key={sq.id} className="px-2 py-1 rounded-lg bg-white border border-emerald-200/60 text-[10px] font-mono-numbers text-slate-700 shadow-xs">
                            <span className="text-emerald-600 font-bold block text-[8px]">#{sq.id}</span>
                            {formatCurrency(sq.value, currency)}
                          </div>
                        ))}
                        {calculatedSquares.length > 8 && <div className="px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-800 flex items-center font-black">+{calculatedSquares.length-8}</div>}
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                    {t.goalNotesLabel}
                  </label>
                  <textarea
                    rows={2}
                    placeholder={t.goalNotesPlaceholder}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200/80 bg-white/80 text-slate-900 text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 resize-none"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-200/60 flex items-center justify-end gap-4 bg-white/80 backdrop-blur-xl shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 text-xs font-black text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer uppercase tracking-widest"
                >
                  {t.cancelBtn}
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={calculatedSquares.length === 0 || isSubmitting}
                  className="px-8 py-4 rounded-[1.25rem] bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-xl shadow-emerald-600/30 disabled:opacity-50 flex items-center gap-3 cursor-pointer uppercase tracking-[0.1em]"
                >
                  {isSubmitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span>{t.createGoalSubmitBtn}</span>}
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  ), document.body);
};
