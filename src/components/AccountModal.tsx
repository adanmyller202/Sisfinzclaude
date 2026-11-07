import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AccountItem, AccountType, CurrencyCode, LanguageCode } from '../types';
import { CURRENCIES } from '../utils/currency';
import { getTranslations } from '../utils/i18n';
import {
  X,
  Building2,
  Wallet,
  Banknote,
  Vault,
  Box,
  Check,
  AlertCircle,
  Plus,
  Minus,
} from 'lucide-react';
import { BankLogo } from './BankLogo';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency: CurrencyCode;
  language?: LanguageCode;
  editingAccount?: AccountItem | null;
  onSave: (params: {
    name: string;
    type: AccountType;
    currency: CurrencyCode;
    initialBalance: number;
    currentBalance?: number;
    notes?: string;
  }) => Promise<void>;
}

export const ACCOUNT_TYPE_CONFIG: Record<
  AccountType,
  { label: Record<LanguageCode, string>; icon: React.FC<{ className?: string }>; emoji: string }
> = {
  bank: {
    label: { pt: 'Banco', es: 'Banco', en: 'Bank' },
    icon: Building2,
    emoji: '🏦',
  },
  wallet: {
    label: { pt: 'Carteira Digital', es: 'Billetera Digital', en: 'Digital Wallet' },
    icon: Wallet,
    emoji: '💳',
  },
  cash: {
    label: { pt: 'Efectivo / Dinheiro', es: 'Efectivo', en: 'Cash' },
    icon: Banknote,
    emoji: '💵',
  },
  safe: {
    label: { pt: 'Caixa / Cofre', es: 'Caja', en: 'Safe / Box' },
    icon: Vault,
    emoji: '💰',
  },
  other: {
    label: { pt: 'Outro', es: 'Otro', en: 'Other' },
    icon: Box,
    emoji: '📦',
  },
};

const SUGGESTED_NAMES = [
  'Efectivo',
  'Banco Nación',
  'Galicia',
  'Santander',
  'BBVA',
  'Macro',
  'Provincia',
  'Ciudad',
  'ICBC',
  'HSBC',
  'Credicoop',
  'Patagonia',
  'Supervielle',
  'Hipotecario',
  'Itaú',
  'Brubank',
  'Naranja X',
  'Mercado Pago',
  'Ualá',
  'Personal Pay',
  'Lemon',
  'Belo',
  'Prex',
  'Nubank',
  'Bradesco',
  'Caixa',
];

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  currency,
  language = 'pt',
  editingAccount,
  onSave,
}) => {
  const t = getTranslations(language);

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(currency);
  const [balanceStr, setBalanceStr] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (editingAccount) {
      setName(editingAccount.name || '');
      setType(editingAccount.type || 'bank');
      setSelectedCurrency(editingAccount.currency || currency);
      setBalanceStr(String(editingAccount.currentBalance ?? editingAccount.initialBalance ?? 0));
      setNotes(editingAccount.notes || '');
    } else {
      setName('');
      setType('bank');
      setSelectedCurrency(currency);
      setBalanceStr('0');
      setNotes('');
    }
    setError(null);
  }, [isOpen, editingAccount, currency]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(
        language === 'es'
          ? 'Por favor, ingresa el nombre de la cuenta.'
          : language === 'en'
          ? 'Please enter account name.'
          : 'Por favor, informe o nome da conta.'
      );
      return;
    }

    const parsedVal = parseFloat(balanceStr.replace(',', '.'));
    const parsedBalance = isNaN(parsedVal) ? 0 : parsedVal;

    try {
      setIsSubmitting(true);

      const payload: {
        name: string;
        type: AccountType;
        currency: CurrencyCode;
        initialBalance: number;
        currentBalance: number;
        notes?: string;
      } = {
        name: name.trim(),
        type,
        currency: selectedCurrency,
        initialBalance: parsedBalance,
        currentBalance: parsedBalance,
        notes: notes.trim(),
      };

      await onSave(payload);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar conta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 glass-overlay overflow-hidden pt-safe pb-safe"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="glass-modal rounded-[2.5rem] shadow-2xl max-w-md w-full max-h-[calc(100dvh-4rem)] flex flex-col overflow-hidden relative"
          >
            {/* Header with Mesh Gradient */}
            <div className="relative p-8 shrink-0 overflow-hidden">
              <div className="absolute inset-0 mesh-gradient opacity-20" />
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <motion.div 
                    initial={{ rotate: -10, scale: 0.8 }}
                    animate={{ rotate: 0, scale: 1 }}
                    className="w-14 h-14 rounded-2xl bg-white shadow-inner border border-emerald-500/20 overflow-hidden flex items-center justify-center"
                  >
                    <BankLogo name={name} type={type} size="md" fallbackEmoji={ACCOUNT_TYPE_CONFIG[type]?.emoji || '🏦'} />
                  </motion.div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight tracking-tight">
                      {editingAccount
                        ? language === 'es' ? 'Editar Cuenta' : 'Editar Conta'
                        : language === 'es' ? 'Nova Cuenta' : 'Nova Conta'}
                    </h3>
                    <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mt-1">
                      {language === 'es' ? 'GESTIÓN DE PATRIMONIO' : 'GESTÃO DE PATRIMÔNIO'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all cursor-pointer flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="p-8 space-y-8 overflow-y-auto overscroll-contain flex-1 min-h-0 no-scrollbar">
                {/* Account Type Selector */}
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">
                    {language === 'es' ? 'Tipo de Cuenta' : 'Tipo de Conta'}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {(Object.keys(ACCOUNT_TYPE_CONFIG) as AccountType[]).map((tKey) => {
                      const cfg = ACCOUNT_TYPE_CONFIG[tKey];
                      const isSelected = type === tKey;
                      return (
                        <button
                          key={tKey}
                          type="button"
                          onClick={() => setType(tKey)}
                          className={`group p-4 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer relative overflow-hidden ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
                              : 'border-slate-200/80 bg-white/80 hover:bg-[#D1FAEB]/30'
                          }`}
                        >
                          <span className="text-2xl relative z-10 group-hover:scale-110 transition-transform">{cfg.emoji}</span>
                          <span className={`text-[11px] font-black uppercase tracking-tight relative z-10 ${
                            isSelected ? 'text-emerald-900' : 'text-slate-600'
                          }`}>
                            {cfg.label[language] || cfg.label.pt}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Account Name */}
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">
                    {language === 'es' ? 'Identificação' : 'Identificação'}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Santander Select, Mercado Pago..."
                      required
                      className="w-full px-6 py-5 rounded-2xl border border-slate-200/80 bg-white/80 text-slate-900 text-sm font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50 transition-all placeholder:text-slate-400"
                    />
                  </div>

                  {/* Suggestions */}
                  <div className="flex items-center gap-2 flex-wrap px-1">
                    {SUGGESTED_NAMES.slice(0, 10).map((sName) => (
                      <button
                        key={sName}
                        type="button"
                        onClick={() => setName(sName)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black rounded-lg bg-emerald-50 text-slate-600 hover:text-emerald-700 hover:bg-emerald-100/70 transition-all cursor-pointer uppercase tracking-widest border border-emerald-100"
                      >
                        <BankLogo name={sName} type={type} size="sm" fallbackEmoji="" />
                        {sName}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Balance & Currency */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">
                      {language === 'es' ? 'Saldo Actual' : language === 'en' ? 'Current Balance' : 'Saldo Atual'}
                    </label>
                    <div className="relative group">
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-xs font-black text-emerald-600">
                        {CURRENCIES[selectedCurrency]?.symbol || '$'}
                      </div>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={balanceStr}
                        onChange={(e) => setBalanceStr(e.target.value)}
                        required
                        className="w-full pl-10 pr-6 py-5 rounded-2xl border border-slate-200/80 bg-white/80 text-slate-900 text-sm font-mono-numbers font-black focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">
                      {t.currencySettingLabel || 'Moeda'}
                    </label>
                    <div className="relative group">
                      <select
                        value={selectedCurrency}
                        onChange={(e) => setSelectedCurrency(e.target.value as CurrencyCode)}
                        className="w-full px-6 py-5 rounded-2xl border border-slate-200/80 bg-white/80 text-slate-900 text-sm font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50 transition-all appearance-none cursor-pointer"
                      >
                        {(Object.keys(CURRENCIES) as CurrencyCode[]).map((cCode) => (
                          <option key={cCode} value={cCode}>
                            {CURRENCIES[cCode].flag} {cCode}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <Minus className="w-4 h-4 rotate-90" />
                      </div>
                    </div>
                  </div>
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] font-black flex items-center gap-3 uppercase tracking-tight"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="p-8 border-t border-slate-200/60 bg-white/80 backdrop-blur-xl flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-4 text-[10px] font-black text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer uppercase tracking-[0.3em]"
                >
                  {t.cancelBtn}
                </button>
                <motion.button
                  whileHover={{ scale: 1.02, x: 5 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black shadow-xl shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-3 cursor-pointer disabled:opacity-50 uppercase tracking-[0.2em]"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? t.savingBtn : t.saveBtn}</span>
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
