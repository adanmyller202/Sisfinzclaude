import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AccountItem, AccountTransferRecord, CurrencyCode, LanguageCode } from '../types';
import { useAccounts } from '../hooks/useAccounts';
import { formatCurrency } from '../utils/currency';
import { formatDayMonthLabel } from '../utils/finance';
import { getTranslations, getLocaleForLanguage } from '../utils/i18n';
import { AccountModal, ACCOUNT_TYPE_CONFIG } from './AccountModal';
import { TransferBetweenAccountsModal } from './TransferBetweenAccountsModal';
import {
  Wallet,
  Plus,
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  ArrowRight,
  ArrowLeft,
  History,
  Info,
  Loader2,
  Landmark,
  RotateCcw,
} from 'lucide-react';
import { BankLogo } from './BankLogo';

interface AccountsViewProps {
  currency: CurrencyCode;
  language?: LanguageCode;
  onReturnToFinance?: () => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  currency,
  language = 'pt',
  onReturnToFinance,
}) => {
  const t = getTranslations(language);
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
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<AccountItem | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  const activeAccountsCount = accounts.filter((a) => a.isActive !== false).length;

  const handleDeleteAccountConfirm = async (acc: AccountItem) => {
    const msg =
      language === 'es'
        ? `¿Estás seguro de que deseas eliminar la cuenta "${acc.name}"?`
        : `Tem certeza que deseja excluir a conta "${acc.name}"?`;
    if (confirm(msg)) {
      await deleteAccount(acc.id);
    }
  };

  const handleDeleteTransferConfirm = async (tx: AccountTransferRecord) => {
    const msg =
      language === 'es'
        ? `¿Deseas deshacer la transferencia de ${formatCurrency(tx.amount, currency)} de "${tx.fromAccountName}" a "${tx.toAccountName}"? Los saldos se ajustarán automáticamente.`
        : `Deseja desfazer a transferência de ${formatCurrency(tx.amount, currency)} de "${tx.fromAccountName}" para "${tx.toAccountName}"? Os saldos serão ajustados automaticamente.`;
    if (confirm(msg)) {
      await deleteTransfer(tx.id);
    }
  };

  const handleClearHistoryConfirm = async () => {
    const msg =
      language === 'es'
        ? 'Esta acción no se puede deshacer. ¿Deseas eliminar todo el historial de transferencias? Los saldos actuales de tus cuentas no serán alterados.'
        : 'Esta ação não pode ser desfeita. Deseja limpar todo o histórico de transferências? Os saldos atuais das contas não serão alterados.';
    if (confirm(msg)) {
      await clearAllTransfers();
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

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-24">
      {/* Premium Hero Banner */}
      <div className="glass-panel rounded-[2.5rem] p-8 sm:p-10 border border-white/90 shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-10 opacity-10"><Landmark className="w-48 h-48 text-emerald-600" /></div>
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <button onClick={onReturnToFinance} className="p-3 rounded-2xl bg-white/80 hover:bg-white text-slate-700 border border-slate-200/80 transition-all cursor-pointer"><ArrowLeft className="w-5 h-5" /></button>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Instituições & Saldos</div>
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1">Patrimônio Líquido Disponível</div>
              <div className="text-4xl sm:text-5xl font-black text-slate-900 font-mono tracking-tighter">
                {formatCurrency(totalBalance, currency)}
              </div>
              <div className="flex items-center gap-2 mt-4">
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-800 uppercase tracking-widest">
                  {activeAccountsCount} Contas Ativas
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setAccountToEdit(null); setIsAccountModalOpen(true); }}
              className="h-14 px-8 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-3 cursor-pointer"
            >
              <Plus className="w-5 h-5" /> Nova Conta
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={activeAccountsCount < 2}
              onClick={() => setIsTransferModalOpen(true)}
              className="h-14 px-8 rounded-2xl bg-white/80 border border-slate-200/80 text-slate-800 font-black text-xs uppercase tracking-widest hover:bg-white shadow-xs transition-all flex items-center gap-3 disabled:opacity-40 cursor-pointer"
            >
              <ArrowRightLeft className="w-5 h-5 text-emerald-600" /> Transferir
            </motion.button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 p-1.5 mt-10 bg-slate-100/80 rounded-2xl border border-slate-200/60 relative max-w-sm">
          {(['accounts', 'history'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer relative z-10 ${
                activeTab === tab ? 'text-emerald-950 font-black' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {activeTab === tab && (
                <motion.div layoutId="acc-tab-bg" className="absolute inset-0 bg-white rounded-xl shadow-md" transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }} />
              )}
              <span className="relative z-10">{tab === 'accounts' ? 'Minhas Contas' : 'Histórico'}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <AnimatePresence mode="wait">
        {activeTab === 'accounts' ? (
          <motion.div key="acc-list" variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingAccounts ? (
              <div className="col-span-full py-20 text-center"><Loader2 className="w-10 h-10 animate-spin text-emerald-600 mx-auto" /></div>
            ) : accounts.length === 0 ? (
              <div className="col-span-full py-20 glass-panel rounded-[3rem] border border-white/90 text-center space-y-6">
                <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-4xl">🏦</div>
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-slate-900">Nenhuma conta cadastrada</h3>
                  <p className="text-sm font-medium text-slate-600 max-w-xs mx-auto leading-relaxed">Adicione seus bancos, carteiras ou investimentos para gerenciar seu saldo total.</p>
                </div>
                <button onClick={() => { setAccountToEdit(null); setIsAccountModalOpen(true); }} className="h-14 px-8 rounded-2xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest shadow-md hover:bg-emerald-500 cursor-pointer">Criar Primeira Conta</button>
              </div>
            ) : (
              accounts.map((acc, idx) => {
                const typeCfg = ACCOUNT_TYPE_CONFIG[acc.type] || ACCOUNT_TYPE_CONFIG.other;
                const isInactive = acc.isActive === false;
                return (
                  <motion.div key={acc.id} variants={itemVariants} className={`glass-card rounded-[2.5rem] p-6 border transition-all flex flex-col justify-between group overflow-hidden ${isInactive ? 'opacity-40 grayscale' : 'border-white/80 hover:border-emerald-500/40 shadow-md'}`}>
                    <div className="flex items-start justify-between mb-8">
                      <div className="flex items-center gap-4">
                        <BankLogo name={acc.name} type={acc.type} size="md" fallbackEmoji={typeCfg.emoji} />
                        <div>
                          <h4 className="text-lg font-black text-slate-900 leading-none">{acc.name}</h4>
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-2 block">{typeCfg.label[language] || typeCfg.label.pt}</span>
                        </div>
                      </div>
                      <button onClick={() => toggleAccountActive(acc.id)} className={`px-2 py-1 rounded-lg text-[8px] font-black tracking-tighter border transition-all cursor-pointer ${isInactive ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-emerald-500/10 text-emerald-800 border-emerald-500/20'}`}>{isInactive ? 'OFFLINE' : 'ATIVO'}</button>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Saldo Atual</div>
                      <div className="text-3xl font-black text-slate-900 font-mono tracking-tighter group-hover:text-emerald-700 transition-colors">{formatCurrency(acc.currentBalance, acc.currency || currency)}</div>
                    </div>

                    <div className="flex items-center justify-end gap-2 mt-8 pt-4 border-t border-slate-200/60">
                      <button onClick={() => { setAccountToEdit(acc); setIsAccountModalOpen(true); }} className="p-3 rounded-xl bg-white/80 hover:bg-white text-slate-500 hover:text-slate-900 border border-slate-200/60 transition-all cursor-pointer"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteAccountConfirm(acc)} className="p-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-slate-500 hover:text-rose-600 border border-rose-200/60 transition-all cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </motion.div>
        ) : (
          <motion.div key="history-list" variants={containerVariants} initial="hidden" animate="visible" className="glass-panel rounded-[3rem] p-8 border border-white/90 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-200/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-700"><History className="w-5 h-5" /></div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    {language === 'es' ? 'Registro de Transferencias' : 'Registro de Transferências'}
                  </h3>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{transfers.length} {language === 'es' ? 'Operaciones' : 'Operações'}</span>
                </div>
              </div>
              {transfers.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistoryConfirm}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200/80 hover:border-rose-200 transition-all text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs shrink-0 self-start sm:self-auto"
                >
                  <Trash2 className="w-4 h-4 text-slate-500 hover:text-rose-600" />
                  <span>{language === 'es' ? 'Limpiar historial' : 'Limpar histórico'}</span>
                </button>
              )}
            </div>

            {transfers.length === 0 ? (
              <div className="py-20 text-center text-slate-500 font-bold">
                {language === 'es' ? 'Ningún movimiento registrado' : 'Nenhum movimento registrado'}
              </div>
            ) : (
              <div className="space-y-3">
                {transfers.map(tx => (
                  <motion.div key={tx.id} layout className="p-5 rounded-2xl bg-white/80 border border-slate-200/80 hover:border-emerald-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group shadow-xs">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shadow-xs shrink-0"><ArrowRightLeft className="w-5 h-5 text-emerald-700" /></div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5 text-sm font-black text-slate-900 flex-wrap mb-1">
                          <span className="text-rose-600 opacity-90">{tx.fromAccountName}</span>
                          <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="text-emerald-700">{tx.toAccountName}</span>
                        </div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{formatDayMonthLabel(tx.date, locale)} {tx.notes && `• ${tx.notes}`}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="text-lg sm:text-xl font-black font-mono text-slate-900 tracking-tighter">{formatCurrency(tx.amount, currency)}</div>
                      <button
                        type="button"
                        onClick={() => handleDeleteTransferConfirm(tx)}
                        title={language === 'es' ? 'Deshacer transferencia y restaurar saldos' : 'Desfazer transferência e restaurar saldos'}
                        className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-xs shrink-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                        <span>{language === 'es' ? 'Deshacer' : 'Desfazer'}</span>
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AccountModal isOpen={isAccountModalOpen} onClose={() => setIsAccountModalOpen(false)} currency={currency} language={language} editingAccount={accountToEdit} onSave={async (p) => accountToEdit ? await updateAccount(accountToEdit.id, p) : await addAccount(p)} />
      <TransferBetweenAccountsModal isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} accounts={accounts} currency={currency} language={language} onExecuteTransfer={transferBetweenAccounts} />
    </div>
  );
};
