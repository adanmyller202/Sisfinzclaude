import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AccountItem, AccountTransferRecord, CurrencyCode, LanguageCode } from '../types';
import { useAccounts } from '../hooks/useAccounts';
import { formatCurrency } from '../utils/currency';
import { formatDayMonthLabel } from '../utils/finance';
import { getLocaleForLanguage } from '../utils/i18n';
import { AccountModal, ACCOUNT_TYPE_CONFIG } from './AccountModal';
import { TransferBetweenAccountsModal } from './TransferBetweenAccountsModal';
import {
  Plus,
  ArrowRightLeft,
  Edit2,
  Trash2,
  ArrowRight,
  ArrowLeft,
  History,
  Loader2,
  RotateCcw,
  ChevronDown,
  Wallet,
  Power,
  Sparkles,
} from 'lucide-react';
import { BankLogo } from './BankLogo';
import { ConfirmationModal } from './ConfirmationModal';

interface AccountsViewProps {
  currency: CurrencyCode;
  language?: LanguageCode;
  onReturnToFinance?: () => void;
}

const CARD_THEMES = [
  {
    dark: true,
    surface: 'bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600 border-emerald-500/40 text-white',
    subText: 'text-emerald-100/90',
    pill: 'bg-white/15 text-white border-white/20',
    divider: 'border-white/15',
    barTrack: 'bg-black/20',
    barFill: 'bg-white',
    actionBtn: 'bg-white/15 hover:bg-white/25 text-white border-white/20',
    deleteBtn: 'bg-rose-500/25 hover:bg-rose-500/40 text-white border-rose-300/30',
  },
  {
    dark: false,
    surface: 'bg-white border-emerald-200/90 text-slate-900',
    subText: 'text-slate-500',
    pill: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
    divider: 'border-slate-100',
    barTrack: 'bg-emerald-100/70',
    barFill: 'bg-emerald-600',
    actionBtn: 'bg-emerald-50/80 hover:bg-emerald-100 text-emerald-900 border-emerald-200/70',
    deleteBtn: 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200/70',
  },
  {
    dark: false,
    surface: 'bg-gradient-to-br from-emerald-50 via-white to-emerald-100/70 border-emerald-200 text-slate-900',
    subText: 'text-emerald-800/75',
    pill: 'bg-white/90 text-emerald-800 border-emerald-200',
    divider: 'border-emerald-200/60',
    barTrack: 'bg-emerald-200/60',
    barFill: 'bg-emerald-600',
    actionBtn: 'bg-white/90 hover:bg-white text-emerald-900 border-emerald-200/80',
    deleteBtn: 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200/80',
  },
  {
    dark: true,
    surface: 'bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-800 border-emerald-700/60 text-white',
    subText: 'text-emerald-200/90',
    pill: 'bg-white/12 text-emerald-50 border-white/15',
    divider: 'border-white/12',
    barTrack: 'bg-black/25',
    barFill: 'bg-emerald-300',
    actionBtn: 'bg-white/12 hover:bg-white/22 text-white border-white/15',
    deleteBtn: 'bg-rose-500/25 hover:bg-rose-500/40 text-white border-rose-300/30',
  },
] as const;

export const AccountsView: React.FC<AccountsViewProps> = ({
  currency,
  language = 'pt',
  onReturnToFinance,
}) => {
  const locale = getLocaleForLanguage(language);

  const {
    accounts,
    transfers,
    totalBalance,
    loadingAccounts,
    addAccount,
    updateAccount,
    toggleAccountActive,
    deleteAccount,
    transferBetweenAccounts,
    deleteTransfer,
    clearAllTransfers,
  } = useAccounts();

  const [activeTab, setActiveTab] = useState<'accounts' | 'history'>('accounts');
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<AccountItem | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    action: () => Promise<void>;
  } | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const activeAccountsCount = accounts.filter((a) => a.isActive !== false).length;

  const positiveTotal = useMemo(
    () =>
      accounts
        .filter((a) => a.isActive !== false && Number(a.currentBalance || 0) > 0)
        .reduce((sum, a) => sum + Number(a.currentBalance || 0), 0),
    [accounts]
  );

  const handleDeleteAccountConfirm = (acc: AccountItem) =>
    setPendingConfirmation({
      title: language === 'es' ? 'Eliminar cuenta' : 'Excluir conta',
      message:
        language === 'es'
          ? `¿Seguro que deseas eliminar "${acc.name}"? Esta acción no se puede deshacer.`
          : `Tem certeza que deseja excluir "${acc.name}"? Esta ação não pode ser desfeita.`,
      confirmLabel: language === 'es' ? 'Sí, eliminar' : 'Sim, excluir',
      action: async () => {
        await deleteAccount(acc.id);
        if (expandedAccountId === acc.id) setExpandedAccountId(null);
      },
    });

  const handleZeroAccountConfirm = (acc: AccountItem) =>
    setPendingConfirmation({
      title: language === 'es' ? 'Poner saldo en cero' : 'Zerar conta',
      message:
        language === 'es'
          ? `El saldo de "${acc.name}" se cambiará a 0. Los movimientos e historial no serán eliminados.`
          : `O saldo de "${acc.name}" será alterado para 0. Os lançamentos e o histórico não serão apagados.`,
      confirmLabel: language === 'es' ? 'Confirmar saldo 0' : 'Confirmar saldo zero',
      action: async () => {
        await updateAccount(acc.id, { currentBalance: 0, initialBalance: 0 });
      },
    });

  const handleDeleteTransferConfirm = (tx: AccountTransferRecord) =>
    setPendingConfirmation({
      title: language === 'es' ? 'Deshacer transferencia' : 'Desfazer transferência',
      message:
        language === 'es'
          ? `¿Deshacer la transferencia de ${formatCurrency(tx.amount, currency)} de "${tx.fromAccountName}" a "${tx.toAccountName}"? Los saldos se ajustarán automáticamente.`
          : `Deseja desfazer a transferência de ${formatCurrency(tx.amount, currency)} de "${tx.fromAccountName}" para "${tx.toAccountName}"? Os saldos serão ajustados automaticamente.`,
      confirmLabel: language === 'es' ? 'Deshacer' : 'Desfazer',
      action: async () => {
        await deleteTransfer(tx.id);
      },
    });

  const handleClearHistoryConfirm = () =>
    setPendingConfirmation({
      title: language === 'es' ? 'Limpiar historial' : 'Limpar histórico',
      message:
        language === 'es'
          ? 'Esta acción no se puede deshacer. ¿Deseas eliminar todo el historial de transferencias? Los saldos actuales no serán alterados.'
          : 'Esta ação não pode ser desfeita. Deseja limpar todo o histórico de transferências? Os saldos atuais não serão alterados.',
      confirmLabel: language === 'es' ? 'Limpiar' : 'Limpar histórico',
      action: async () => {
        await clearAllTransfers();
      },
    });

  const executePendingConfirmation = async () => {
    if (!pendingConfirmation || isConfirming) return;
    try {
      setIsConfirming(true);
      await pendingConfirmation.action();
      setPendingConfirmation(null);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-24">
      {/* Compact Wallet Summary Header */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[1.75rem] border border-emerald-100 bg-white/95 p-4 shadow-sm sm:p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {onReturnToFinance && (
              <button
                type="button"
                onClick={onReturnToFinance}
                aria-label={language === 'es' ? 'Volver' : 'Voltar'}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50 text-slate-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                  {language === 'es' ? 'Saldo Disponible' : 'Saldo Disponível'}
                </span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700 border border-emerald-200/70">
                  {activeAccountsCount} {activeAccountsCount === 1 ? (language === 'es' ? 'activa' : 'ativa') : (language === 'es' ? 'activas' : 'ativas')}
                </span>
              </div>
              <div className="mt-0.5 truncate font-mono-numbers text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                {formatCurrency(totalBalance, currency)}
              </div>
            </div>
          </div>

          {/* Compact Action Buttons */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              disabled={activeAccountsCount < 2}
              onClick={() => setIsTransferModalOpen(true)}
              title={language === 'es' ? 'Transferir entre cuentas' : 'Transferir entre contas'}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-black text-emerald-800 transition-colors hover:bg-emerald-100 disabled:opacity-40 cursor-pointer"
            >
              <ArrowRightLeft className="h-4 w-4 text-emerald-600" />
              <span className="hidden sm:inline">{language === 'es' ? 'Transferir' : 'Transferir'}</span>
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                setAccountToEdit(null);
                setIsAccountModalOpen(true);
              }}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-[11px] font-black text-white shadow-sm shadow-emerald-600/20 transition-colors hover:bg-emerald-700 cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[2.75]" />
              <span>{language === 'es' ? 'Nueva' : 'Nova'}</span>
            </motion.button>
          </div>
        </div>

        {/* Compact Segmented Tab Switcher */}
        <div className="mt-3.5 grid grid-cols-2 gap-1.5 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-1">
          {(['accounts', 'history'] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                type="button"
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative z-10 flex items-center justify-center gap-1.5 rounded-xl py-2 text-[10px] font-black uppercase tracking-[0.14em] transition-colors cursor-pointer ${
                  isActive ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="acc-wallet-tab"
                    className="absolute inset-0 -z-10 rounded-xl bg-emerald-600 shadow-sm shadow-emerald-600/25"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.45 }}
                  />
                )}
                {tab === 'accounts' ? <Wallet className="h-3.5 w-3.5" /> : <History className="h-3.5 w-3.5" />}
                <span>
                  {tab === 'accounts'
                    ? language === 'es'
                      ? 'Mi Billetera'
                      : 'Minha Carteira'
                    : language === 'es'
                    ? 'Historial'
                    : 'Histórico'}
                </span>
                {tab === 'history' && transfers.length > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[9px] font-black ${
                      isActive ? 'bg-white/20 text-white' : 'bg-white text-slate-600'
                    }`}
                  >
                    {transfers.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </motion.section>

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        {activeTab === 'accounts' ? (
          <motion.div
            key="wallet-deck"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {loadingAccounts ? (
              <div className="py-16 text-center">
                <Loader2 className="mx-auto h-9 w-9 animate-spin text-emerald-600" />
              </div>
            ) : accounts.length === 0 ? (
              <div className="rounded-[2rem] border-2 border-dashed border-emerald-200 bg-white/90 px-6 py-12 text-center shadow-xs">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <Wallet className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-lg font-black text-slate-900">
                  {language === 'es' ? 'Tu billetera está vacía' : 'Sua carteira está vazia'}
                </h3>
                <p className="mx-auto mt-1 max-w-xs text-xs font-medium text-slate-500 leading-relaxed">
                  {language === 'es'
                    ? 'Agrega tus bancos, billeteras o efectivo para verlos apilados aquí.'
                    : 'Adicione seus bancos, carteiras ou dinheiro para vê-los empilhados aqui.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAccountToEdit(null);
                    setIsAccountModalOpen(true);
                  }}
                  className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-6 text-xs font-black uppercase tracking-wider text-white shadow-md hover:bg-emerald-700 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  {language === 'es' ? 'Crear Primera Cuenta' : 'Criar Primeira Conta'}
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-emerald-600" />
                    {language === 'es' ? 'Toca una tarjeta para abrir' : 'Toque em um cartão para abrir'}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {accounts.length} {accounts.length === 1 ? (language === 'es' ? 'cuenta' : 'conta') : (language === 'es' ? 'cuentas' : 'contas')}
                  </span>
                </div>

                {/* Stacked Digital Wallet Deck */}
                <div className="relative pt-1">
                  {accounts.map((acc, idx) => {
                    const typeCfg = ACCOUNT_TYPE_CONFIG[acc.type] || ACCOUNT_TYPE_CONFIG.other;
                    const isInactive = acc.isActive === false;
                    const isExpanded = expandedAccountId === acc.id;
                    const theme = CARD_THEMES[idx % CARD_THEMES.length];
                    const accCurrency = acc.currency || currency;
                    const sharePct =
                      !isInactive && positiveTotal > 0 && Number(acc.currentBalance || 0) > 0
                        ? Math.min(100, Math.round((Number(acc.currentBalance) / positiveTotal) * 100))
                        : 0;

                    return (
                      <motion.div
                        key={acc.id}
                        layout
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          layout: { type: 'spring', stiffness: 360, damping: 30 },
                          delay: Math.min(idx * 0.04, 0.25),
                        }}
                        style={{ zIndex: isExpanded ? 30 : idx + 1 }}
                        className={`relative overflow-hidden rounded-[1.75rem] border transition-shadow ${
                          idx === 0 ? '' : isExpanded ? 'mt-3' : '-mt-4'
                        } ${isExpanded ? 'mb-4 shadow-xl' : 'shadow-[0_-6px_22px_rgba(15,23,42,0.08)]'} ${
                          isInactive
                            ? 'bg-slate-100 border-slate-200 text-slate-500 grayscale opacity-80'
                            : theme.surface
                        }`}
                      >
                        {/* Subtle Glass Highlight Line on Top Rim of Wallet Card */}
                        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />

                        {/* Card Top Strip (Always Visible in Stack) */}
                        <button
                          type="button"
                          onClick={() => setExpandedAccountId((prev) => (prev === acc.id ? null : acc.id))}
                          className="relative z-10 flex w-full items-center justify-between gap-3 px-4 py-4 pb-6 text-left cursor-pointer sm:px-5"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="shrink-0 rounded-2xl bg-white/95 p-0.5 shadow-sm">
                              <BankLogo name={acc.name} type={acc.type} size="sm" fallbackEmoji={typeCfg.emoji} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="truncate text-sm font-black tracking-tight sm:text-base">
                                  {acc.name}
                                </h4>
                                <span
                                  className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider ${
                                    isInactive
                                      ? 'border-slate-300 bg-slate-200 text-slate-600'
                                      : theme.pill
                                  }`}
                                >
                                  {accCurrency}
                                </span>
                              </div>
                              <p
                                className={`mt-0.5 truncate text-[10px] font-bold uppercase tracking-wider ${
                                  isInactive ? 'text-slate-400' : theme.subText
                                }`}
                              >
                                {typeCfg.label[language] || typeCfg.label.pt}
                                {isInactive ? ' • Offline' : ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <div className="text-right">
                              <div className="font-mono-numbers text-base font-black tracking-tight sm:text-lg">
                                {formatCurrency(acc.currentBalance, accCurrency)}
                              </div>
                            </div>
                            <motion.span
                              animate={{ rotate: isExpanded ? 180 : 0 }}
                              transition={{ duration: 0.25 }}
                              className={`flex h-7 w-7 items-center justify-center rounded-full ${
                                isInactive
                                  ? 'bg-slate-200 text-slate-500'
                                  : theme.dark
                                  ? 'bg-white/15 text-white'
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </motion.span>
                          </div>
                        </button>

                        {/* Expanded Card Drawer (Interactive Details & Actions) */}
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              key="card-details"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                              className="overflow-hidden"
                            >
                              <div className={`mx-4 border-t pt-3.5 pb-4 space-y-4 sm:mx-5 ${isInactive ? 'border-slate-200' : theme.divider}`}>
                                {/* Share of Wallet Progress */}
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                                    <span className={isInactive ? 'text-slate-400' : theme.subText}>
                                      {language === 'es' ? 'Participación en billetera' : 'Participação na carteira'}
                                    </span>
                                    <span className="font-mono-numbers">{sharePct}%</span>
                                  </div>
                                  <div className={`h-2 w-full overflow-hidden rounded-full ${isInactive ? 'bg-slate-200' : theme.barTrack}`}>
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${sharePct}%` }}
                                      transition={{ duration: 0.5, ease: 'easeOut' }}
                                      className={`h-full rounded-full ${isInactive ? 'bg-slate-400' : theme.barFill}`}
                                    />
                                  </div>
                                </div>

                                {/* Quick Action Buttons Row */}
                                <div className="grid grid-cols-4 gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleAccountActive(acc.id);
                                    }}
                                    className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-2.5 text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                                      isInactive
                                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                        : theme.actionBtn
                                    }`}
                                  >
                                    <Power className="h-3.5 w-3.5" />
                                    <span>{isInactive ? (language === 'es' ? 'Activar' : 'Ativar') : 'Ativa'}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAccountToEdit(acc);
                                      setIsAccountModalOpen(true);
                                    }}
                                    className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-2.5 text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                                      isInactive
                                        ? 'border-slate-200 bg-white text-slate-600'
                                        : theme.actionBtn
                                    }`}
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                    <span>{language === 'es' ? 'Editar' : 'Editar'}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleZeroAccountConfirm(acc);
                                    }}
                                    className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-2.5 text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                                      isInactive
                                        ? 'border-slate-200 bg-white text-slate-600'
                                        : theme.actionBtn
                                    }`}
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    <span>{language === 'es' ? 'Cero' : 'Zerar'}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteAccountConfirm(acc);
                                    }}
                                    className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-2.5 text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                                      isInactive
                                        ? 'border-rose-200 bg-rose-50 text-rose-600'
                                        : theme.deleteBtn
                                    }`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span>{language === 'es' ? 'Borrar' : 'Excluir'}</span>
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Slim Add Account Card at bottom of deck */}
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setAccountToEdit(null);
                    setIsAccountModalOpen(true);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-300/80 bg-emerald-50/40 py-3.5 text-xs font-black uppercase tracking-wider text-emerald-800 transition-colors hover:border-emerald-500 hover:bg-emerald-50 cursor-pointer"
                >
                  <Plus className="h-4 w-4 stroke-[2.75]" />
                  <span>{language === 'es' ? 'Agregar nueva cuenta' : 'Adicionar nova conta'}</span>
                </motion.button>
              </>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="history-list"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="rounded-[2rem] border border-emerald-100 bg-white/95 p-4 shadow-sm sm:p-6"
          >
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <History className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    {language === 'es' ? 'Transferencias' : 'Transferências'}
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {transfers.length} {language === 'es' ? 'operaciones' : 'operações'}
                  </span>
                </div>
              </div>
              {transfers.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistoryConfirm}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{language === 'es' ? 'Limpiar' : 'Limpar'}</span>
                </button>
              )}
            </div>

            {transfers.length === 0 ? (
              <div className="py-12 text-center text-xs font-bold text-slate-400">
                {language === 'es' ? 'Ningún movimiento registrado' : 'Nenhum movimento registrado'}
              </div>
            ) : (
              <div className="space-y-2.5">
                {transfers.map((tx) => (
                  <motion.div
                    key={tx.id}
                    layout
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs transition-colors hover:border-emerald-200"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                        <ArrowRightLeft className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs font-black text-slate-900 sm:text-sm">
                          <span className="truncate text-rose-600">{tx.fromAccountName}</span>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="truncate text-emerald-700">{tx.toAccountName}</span>
                        </div>
                        <div className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {formatDayMonthLabel(tx.date, locale)}
                          {tx.notes ? ` • ${tx.notes}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2.5">
                      <div className="font-mono-numbers text-sm font-black text-slate-900 sm:text-base">
                        {formatCurrency(tx.amount, currency)}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteTransferConfirm(tx)}
                        title={
                          language === 'es'
                            ? 'Deshacer transferencia y restaurar saldos'
                            : 'Desfazer transferência e restaurar saldos'
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={!!pendingConfirmation}
        title={pendingConfirmation?.title || ''}
        message={pendingConfirmation?.message || ''}
        confirmLabel={pendingConfirmation?.confirmLabel || 'Confirmar'}
        cancelLabel="Cancelar"
        loadingLabel={language === 'es' ? 'Procesando...' : 'Processando...'}
        isLoading={isConfirming}
        onConfirm={() => {
          void executePendingConfirmation();
        }}
        onCancel={() => {
          if (!isConfirming) setPendingConfirmation(null);
        }}
      />
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        currency={currency}
        language={language}
        editingAccount={accountToEdit}
        onSave={async (p) => (accountToEdit ? await updateAccount(accountToEdit.id, p) : await addAccount(p))}
      />
      <TransferBetweenAccountsModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        accounts={accounts}
        currency={currency}
        language={language}
        onExecuteTransfer={transferBetweenAccounts}
      />
    </div>
  );
};
