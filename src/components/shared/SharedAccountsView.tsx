/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  CurrencyCode,
  LanguageCode,
  SharedBill,
  SharedUserSummary,
  SharedTransferRecord,
  SharedNotification,
  SharedInvitation,
  SplitMethod,
  CategoryScope,
} from '../../types';
import { formatCurrency } from '../../utils/currency';
import { getTranslations } from '../../utils/i18n';
import { doesItemOccurInMonth, getEffectiveDateForMonth } from '../../utils/finance';
import { InvitePartnerModal } from './InvitePartnerModal';
import { SharedBillModal } from './SharedBillModal';
import { SharedNotificationsModal } from './SharedNotificationsModal';
import { StopSharingModal } from './StopSharingModal';

import {
  Users,
  UserPlus,
  Plus,
  ArrowRightLeft,
  Receipt,
  CheckCircle2,
  Check,
  AlertTriangle,
  Clock,
  Calendar,
  Tag,
  CheckSquare,
  Square,
  Bell,
  FileText,
  DollarSign,
  ChevronRight,
  ChevronLeft,
  MoreVertical,
  Trash2,
  Edit,
  ExternalLink,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Loader2,
} from 'lucide-react';

interface SharedAccountsViewProps {
  currency: CurrencyCode;
  language?: LanguageCode;
  myUserId: string;
  connections: any[];
  activePartners: SharedUserSummary[];
  receivedInvitations: SharedInvitation[];
  sentInvitations: SharedInvitation[];
  sharedBills: SharedBill[];
  sharedNotifications: SharedNotification[];
  unreadNotificationsCount: number;
  pendingReceivedInvitationsCount: number;
  onSendInvitation: (email: string) => Promise<{ success: boolean; message?: string }>;
  onRespondInvitation: (invitationId: string, accept: boolean) => Promise<void>;
  onCreateSharedBill: (params: {
    title: string;
    amount: number;
    dueDate: string;
    dueDay: number;
    category: string;
    notes?: string;
    partnerId: string;
    splitMethod: SplitMethod;
    myPercentage: number;
    partnerPercentage: number;
    recurrence?: 'none' | 'monthly';
    recurrenceMonthsCount?: number;
  }) => Promise<any>;
  onUpdateSharedBill: (
    billId: string,
    params: {
      title: string;
      amount: number;
      dueDate: string;
      dueDay: number;
      category: string;
      notes?: string;
      splitMethod: SplitMethod;
      myPercentage: number;
      partnerPercentage: number;
    }
  ) => Promise<void>;
  onDeleteSharedBill: (billId: string) => Promise<void>;
  onDeleteSharedBillOccurrence?: (
    billId: string,
    targetMonth: string,
    scope: 'this' | 'this_and_future'
  ) => Promise<void>;
  onRespondShareBillRequest?: (billId: string, accept: boolean) => Promise<void>;
  onMarkNotificationRead: (notifId: string) => Promise<void>;
  onMarkAllNotificationsRead: () => Promise<void>;
  onClearNotifications: () => Promise<void>;
  onStopSharingAndConvert: (connectionId: string, options: { conversionRule: 'total' | 'my_share'; recurrenceScope: 'this_month' | 'future' }) => Promise<void>;
  onToggleMySharePaid: (billId: string, isPaid: boolean, month: string) => Promise<void>;
  onReturnToFinance?: () => void;

  getCategoriesFor?: (scope: 'bill' | 'income' | 'expense' | 'all') => string[];
  onAddCategory?: (name: string, scope: CategoryScope) => Promise<unknown>;
  isProcessing?: boolean;
}

export const SharedAccountsView: React.FC<SharedAccountsViewProps> = ({
  currency,
  language = 'pt',
  myUserId,
  connections,
  activePartners,
  receivedInvitations,
  sentInvitations,
  sharedBills,
  sharedNotifications,
  unreadNotificationsCount,
  pendingReceivedInvitationsCount,
  onSendInvitation,
  onRespondInvitation,
  onCreateSharedBill,
  onUpdateSharedBill,
  onDeleteSharedBill,
  onDeleteSharedBillOccurrence,
  onRespondShareBillRequest,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onClearNotifications,
  onStopSharingAndConvert,
  onToggleMySharePaid,
  onReturnToFinance,
  getCategoriesFor,
  onAddCategory,
  isProcessing,
}) => {



  const t = getTranslations(language);

  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  // Modals state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<SharedBill | null>(null);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [isStopSharingModalOpen, setIsStopSharingModalOpen] = useState(false);
  const [partnerToStopSharing, setPartnerToStopSharing] = useState<SharedUserSummary | null>(null);

  // Recurrence Delete Prompt
  const [billToDelete, setBillToDelete] = useState<SharedBill | null>(null);
  const [isDeletingOccurrence, setIsDeletingOccurrence] = useState(false);

  // Derived: Shared bills for the selected month (handling recurrence)
  const monthSharedBillsOccurrences = useMemo(() => {
    return sharedBills
      .filter((bill) => {
        return doesItemOccurInMonth(
          bill.startMonth || bill.month || (bill.dueDate ? bill.dueDate.substring(0, 7) : ''),
          selectedMonth,
          bill.recurrence || 'none',
          bill.recurrenceMonthsCount
        );
      })
      .map((bill) => {
        const effectiveDueDate = getEffectiveDateForMonth(selectedMonth, bill.dueDay || 1);
        const monthException = bill.exceptions?.[selectedMonth];
        return {
          ...bill,
          effectiveDueDate,
          monthException,
        };
      });
  }, [sharedBills, selectedMonth]);







  // Handle delete click
  const handleDeleteClick = (bill: SharedBill) => {
    if (bill.recurrence === 'monthly') {
      setBillToDelete(bill);
    } else {
      if (confirm(`${t.deleteConfirmBill} "${bill.title}"?`)) {
        onDeleteSharedBill(bill.id);
      }
    }
  };

  const handleApplyRecurrenceDelete = async (scope: 'this' | 'this_and_future') => {
    if (!billToDelete || !onDeleteSharedBillOccurrence) return;
    try {
      setIsDeletingOccurrence(true);
      await onDeleteSharedBillOccurrence(billToDelete.id, selectedMonth, scope);
      setBillToDelete(null);
    } catch (err) {
      console.error('Error deleting shared bill occurrence:', err);
    } finally {
      setIsDeletingOccurrence(false);
    }
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* Month Filter */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-bold text-slate-500">{t.monthFilterLabel || 'Filtrar por mês:'}</span>
        <input 
          type="month" 
          value={selectedMonth} 
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white/80 text-xs font-bold text-slate-800"
        />
      </div>
      {onReturnToFinance && (
        <button
          type="button"
          onClick={onReturnToFinance}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white/80 hover:bg-white rounded-xl transition-colors cursor-pointer border border-slate-200/80"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>{language === 'es' ? 'Volver al Control Financiero' : 'Voltar ao Controle Financeiro'}</span>
        </button>
      )}

      {/* Top Banner Card */}
      <div className="p-4 sm:p-5 rounded-3xl glass-card border border-white/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                {t.sharedAccounts}
              </h1>
              <p className="text-xs text-slate-500">
                {t.sharedAccountsDesc}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => setIsNotificationsModalOpen(true)}
              className="relative p-2.5 rounded-2xl border border-slate-200 bg-white/80 text-slate-700 hover:bg-white transition-colors cursor-pointer disabled:opacity-50"
              title={t.notificationsTab}
            >
              <Bell className="w-4 h-4" />
              {(unreadNotificationsCount > 0 || pendingReceivedInvitationsCount > 0) && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white font-bold text-[10px] flex items-center justify-center animate-pulse">
                  {unreadNotificationsCount + pendingReceivedInvitationsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={() => setIsInviteModalOpen(true)}
              className="px-3.5 py-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t.invitePerson}</span>
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={() => {
                setEditingBill(null);
                setIsBillModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>{t.newSharedBill}</span>
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
            {t.sharedPartners}:
          </span>
          {activePartners.length === 0 ? (
            <span className="text-xs text-slate-400 italic">
              {t.noPartnersYet}
            </span>
          ) : (
            activePartners.map((partner) => {
              const partnerConnection = connections.find(c => c.members.includes(partner.uid));
              return (
                <div
                  key={partner.uid}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 border border-slate-200/80 text-xs shadow-2xs"
                >
                  <div className="w-5 h-5 rounded-lg bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center">
                    {partner.displayName.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-bold text-slate-800">
                    {partner.displayName}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                    ({partner.email})
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" title="Ativo" />
                  {partnerConnection && (
                    <button
                      type="button"
                      onClick={() => {
                        setPartnerToStopSharing(partner);
                        setIsStopSharingModalOpen(true);
                      }}
                      className="ml-2 p-1 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Parar de compartilhar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                </div>
              );
            })
          )}

        </div>
      </div>

      {/* Pending Invites Banner */}
      {pendingReceivedInvitationsCount > 0 && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="font-bold text-amber-900 dark:text-amber-200">
              {language === 'es'
                ? `Tienes ${pendingReceivedInvitationsCount} invitación(es) de cuenta compartida pendiente(s)`
                : language === 'en'
                ? `You have ${pendingReceivedInvitationsCount} pending shared account invite(s)`
                : `Você possui ${pendingReceivedInvitationsCount} convite(s) de conta compartilhada pendente(s)`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsNotificationsModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs cursor-pointer shadow-xs"
          >
            {language === 'es' ? 'Ver invitaciones' : 'Ver convites'}
          </button>
        </div>
      )}







          {/* List of Shared Bills */}
          {monthSharedBillsOccurrences.length === 0 ? (
            <div className="p-10 rounded-3xl glass-card border border-white/80 text-center space-y-3">
              <Receipt className="w-10 h-10 text-slate-400 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800">
                  {t.noSharedBillsYet}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {language === 'es'
                    ? 'Agrega facturas compartidas como alquiler, luz, internet o gastos comunes con porcentajes automáticos.'
                    : 'Adicione faturas compartilhadas como aluguel, luz, internet ou despesas conjuntas com divisões automáticas.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingBill(null);
                  setIsBillModalOpen(true);
                }}
                className="px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs cursor-pointer inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>{t.newSharedBill}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {monthSharedBillsOccurrences.map((bill) => {
                const partnerId = bill.members.find((m) => m !== myUserId) || '';
                const partnerSummary = activePartners.find((p) => p.uid === partnerId);
                const partnerName = partnerSummary?.displayName || 'Parceiro';

                // Month-specific status
                const mEx = bill.monthException;
                const myShare = mEx?.shares?.[myUserId] || bill.shares[myUserId];
                const partnerShare = mEx?.shares?.[partnerId] || bill.shares[partnerId];

                return (
                  <div
                    key={`${bill.id}_${selectedMonth}`}
                    className="p-3.5 sm:p-4 rounded-3xl bg-white border border-slate-200/80 hover:border-slate-300 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Checkbox + Title + Meta */}
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="mt-0.5 p-1 text-slate-300 shrink-0">
                          {myShare?.status === 'paid' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <Receipt className="w-5 h-5 text-slate-400" />
                          )}
                        </div>

                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs sm:text-sm font-bold text-slate-900">
                              {bill.title}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200/60">
                              {bill.category}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 font-bold border border-teal-200/60">
                              {bill.percentages[myUserId] || 50}% /{' '}
                              {bill.percentages[partnerId] || 50}%
                            </span>
                            {bill.recurrence === 'monthly' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                {t.recurringBadge}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>Vencimento: {bill.effectiveDueDate}</span>
                            </span>
                            <span>•</span>
                            <span>Total da Fatura: {formatCurrency(bill.amount, currency)}</span>
                            <span>•</span>
                            <span>Com: {partnerName}</span>
                          </div>

                          {/* Status explanations */}
                          <div className="pt-1 flex flex-wrap gap-1.5 text-[10px]">
                            {myShare?.status === 'paid' && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>{language === 'es' ? 'Pagaste tu parte' : 'Você pagou sua parte'}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Amounts & Actions */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                        {/* Obligations Breakdown */}
                        <div className="text-right font-mono-numbers">
                          <span className="text-[10px] text-slate-400 block font-sans">
                            {t.myObligation}:
                          </span>
                          <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(myShare?.amount || 0, currency)}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-sans">
                            {partnerName}: {formatCurrency(partnerShare?.amount || 0, currency)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">

                          {/* Pay My Share */}
                          {myShare?.status === 'pending' && (
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => onToggleMySharePaid(bill.id, true, selectedMonth)}
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50"
                              title="Marcar minha participação como paga"
                            >
                              {language === 'es' ? `Pagar Mi Parte - ${formatCurrency(myShare.amount, currency)}` : `Pagar Minha Parte - ${formatCurrency(myShare.amount, currency)}`}
                            </button>
                          )}

                          {myShare?.status === 'paid' && (
                            <div className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg font-bold border border-emerald-100 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{language === 'es' ? 'Pagaste tu parte' : 'Você pagou sua parte'}</span>
                            </div>
                          )}

                          {/* Edit Bill */}
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => {
                              setEditingBill(bill);
                              setIsBillModalOpen(true);
                            }}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                            title={t.editItem}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                           {/* Delete Bill */}
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleDeleteClick(bill)}
                            className="p-1.5 rounded-xl text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                            title={t.deleteItem}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}




      {/* Recurrence Delete Prompt Modal */}
      {billToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="glass-overlay p-2.5 sm:p-4 overflow-hidden overscroll-contain"
        >
          <div className="glass-modal rounded-3xl max-w-md w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] overflow-y-auto overscroll-contain my-auto">
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200">
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-sm text-rose-950 dark:text-rose-100">
                    {t.recurringDeletePromptTitle || 'Excluir Fatura Recorrente'}
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">
                    {t.recurringDeletePromptSubtitle || 'Esta é uma fatura mensal compartilhada. Como deseja excluí-la?'}
                  </p>
                  <p className="font-bold text-rose-700 dark:text-rose-400 mt-1 uppercase">
                    {billToDelete.title}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  disabled={isDeletingOccurrence}
                  onClick={() => handleApplyRecurrenceDelete('this')}
                  className="w-full p-3.5 rounded-2xl border-2 border-slate-200 hover:border-rose-500 bg-white/80 hover:bg-rose-50/50 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-rose-600">
                      {t.deleteOnlyThisOption || 'Excluir apenas este mês'}
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold uppercase">
                      {t.oneMonthBadge || '1 mês'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {t.deleteOnlyThisDesc || 'Remove apenas a ocorrência deste mês selecionado.'}
                  </p>
                </button>

                <button
                  type="button"
                  disabled={isDeletingOccurrence}
                  onClick={() => handleApplyRecurrenceDelete('this_and_future')}
                  className="w-full p-3.5 rounded-2xl border-2 border-rose-500 bg-rose-50/40 hover:bg-rose-100/50 text-left transition-all cursor-pointer group shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-xs sm:text-sm text-rose-700">
                      {t.deleteThisAndFutureOption || 'Excluir esta e todas as próximas'}
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-200 text-rose-800 font-bold uppercase">
                      {t.allNextBadge || 'Todas próximas'}
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-600 mt-0.5 opacity-80">
                    {t.deleteThisAndFutureDesc || 'Remove esta e todas as faturas futuras desta série.'}
                  </p>
                </button>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  disabled={isDeletingOccurrence}
                  onClick={() => setBillToDelete(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  {t.cancelBtn}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <StopSharingModal
        isOpen={isStopSharingModalOpen}
        onClose={() => setIsStopSharingModalOpen(false)}
        partnerName={partnerToStopSharing?.displayName || ''}
        language={language}
        isProcessing={isProcessing || false}
        onConfirm={async (options) => {
          if (!partnerToStopSharing) return;
          const conn = connections.find(c => c.members.includes(partnerToStopSharing.uid));
          if (conn) {
            await onStopSharingAndConvert(conn.id, options);
            setIsStopSharingModalOpen(false);
          }
        }}
      />

      <InvitePartnerModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        language={language}
        onSendInvite={onSendInvitation}
      />

      <SharedBillModal
        isOpen={isBillModalOpen}
        onClose={() => {
          setIsBillModalOpen(false);
          setEditingBill(null);
        }}
        language={language}
        currency={currency}
        myUserId={myUserId}
        activePartners={activePartners}
        editingBill={editingBill}
        onSave={async (params) => {
          if (editingBill) {
            await onUpdateSharedBill(editingBill.id, params);
          } else {
            await onCreateSharedBill({
              ...params,
              partnerId: activePartners[0]?.uid || '',
            });
          }
        }}
        getCategoriesFor={getCategoriesFor}
        onAddCategory={onAddCategory}
      />

      <SharedNotificationsModal
        isOpen={isNotificationsModalOpen}
        onClose={() => setIsNotificationsModalOpen(false)}
        language={language}
        notifications={sharedNotifications}
        receivedInvitations={receivedInvitations}
        onAcceptInvitation={(id) => onRespondInvitation(id, true)}
        onRejectInvitation={(id) => onRespondInvitation(id, false)}
        onAcceptShareBillRequest={onRespondShareBillRequest ? (id) => onRespondShareBillRequest(id, true) : undefined}
        onRejectShareBillRequest={onRespondShareBillRequest ? (id) => onRespondShareBillRequest(id, false) : undefined}
        onMarkRead={onMarkNotificationRead}
        onMarkAllRead={onMarkAllNotificationsRead}
        onClearNotifications={onClearNotifications}
      />
    </div>
  );
};

