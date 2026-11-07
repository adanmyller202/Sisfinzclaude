/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { LanguageCode, SharedNotification, SharedInvitation } from '../../types';
import { getTranslations } from '../../utils/i18n';
import {
  X,
  Bell,
  Check,
  UserPlus,
  ArrowRightLeft,
  Receipt,
  AlertTriangle,
  Clock,
  CheckCheck,
  Trash2,
} from 'lucide-react';

interface SharedNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: LanguageCode;
  notifications: SharedNotification[];
  receivedInvitations: SharedInvitation[];
  onAcceptInvitation: (invitationId: string) => Promise<void>;
  onRejectInvitation: (invitationId: string) => Promise<void>;
  onAcceptShareBillRequest?: (billId: string) => Promise<void>;
  onRejectShareBillRequest?: (billId: string) => Promise<void>;
  onMarkRead: (notifId: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onClearNotifications: () => Promise<void>;
}

export const SharedNotificationsModal: React.FC<SharedNotificationsModalProps> = ({
  isOpen,
  onClose,
  language = 'pt',
  notifications,
  receivedInvitations,
  onAcceptInvitation,
  onRejectInvitation,
  onAcceptShareBillRequest,
  onRejectShareBillRequest,
  onMarkRead,
  onMarkAllRead,
  onClearNotifications,
}) => {
  const t = getTranslations(language);

  if (!isOpen) return null;

  const pendingInvites = receivedInvitations.filter((i) => i.status === 'pending');

  const getIconForType = (type: string) => {
    switch (type) {
      case 'invitation_received':
      case 'invitation_accepted':
      case 'invitation_rejected':
        return <UserPlus className="w-4 h-4 text-emerald-500" />;
      case 'transfer_received':
      case 'transfer_sent':
        return <ArrowRightLeft className="w-4 h-4 text-teal-500" />;
      case 'reimbursement_created':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'bill_paid':
      case 'bill_created':
      case 'bill_updated':
      case 'share_bill_request':
      case 'share_bill_accepted':
      case 'share_bill_rejected':
      default:
        return <Receipt className="w-4 h-4 text-emerald-600" />;
    }
  };

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(language === 'es' ? 'es-ES' : language === 'en' ? 'en-US' : 'pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="glass-overlay p-2.5 sm:p-4 overflow-hidden overscroll-contain"
    >
      <div className="glass-modal rounded-3xl max-w-lg w-full overflow-hidden my-auto animate-in zoom-in-95 duration-200 flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)]">
        {/* Header (pinned) */}
        <div className="p-4 sm:p-5 border-b border-slate-200/60 flex items-center justify-between shrink-0 bg-white/40 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {t.notificationsTab}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'es'
                  ? 'Avisos de invitaciones, transferencias y facturas'
                  : language === 'en'
                  ? 'Notices for invites, transfers, and bills'
                  : 'Avisos de convites, transferências e faturas'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <button
                type="button"
                 onClick={() => {
                    if (confirm('Tem certeza que deseja limpar suas notificações?')) {
                      onClearNotifications();
                    }
                 }}
                 className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 cursor-pointer"
                 title="Limpar notificações"
               >
                 <Trash2 className="w-3.5 h-3.5" />
                 <span className="hidden sm:inline">Limpar</span>
               </button>


            )}
            {notifications.some((n) => !n.isRead) && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                title={t.markAllRead}
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.markAllRead}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Notifications list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Pending Invitations Section */}
          {pendingInvites.length > 0 && (
            <div className="space-y-2 mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {t.pendingInvitations} ({pendingInvites.length})
                </span>
              </span>

              {pendingInvites.map((inv) => (
                <div
                  key={inv.id}
                  className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-300 flex items-center justify-center font-bold">
                      {inv.fromUserName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">
                        {inv.fromUserName}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                        {inv.fromUserEmail}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => onRejectInvitation(inv.id)}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 font-semibold text-xs cursor-pointer"
                    >
                      {t.rejectInvite}
                    </button>
                    <button
                      type="button"
                      onClick={() => onAcceptInvitation(inv.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{t.acceptInvite}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Regular Notifications List */}
          {notifications.length === 0 && pendingInvites.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>
                {language === 'es'
                  ? 'No tienes notificaciones en este momento.'
                  : language === 'en'
                  ? 'No notifications right now.'
                  : 'Nenhuma notificação no momento.'}
              </p>
            </div>
          ) : (
            notifications.map((notif) => {
              const isActionableShare =
                notif.type === 'share_bill_request' &&
                notif.status === 'pending' &&
                notif.data?.billId;

              return (
                <div
                  key={notif.id}
                  onClick={() => onMarkRead(notif.id)}
                  className={`p-3 rounded-2xl border transition-all text-xs flex gap-3 ${
                    notif.isRead
                      ? 'bg-white/60 border-slate-200/70 opacity-80'
                      : 'bg-[#D1FAEB]/60 border-emerald-300 shadow-xs ring-1 ring-emerald-500/10'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/60 flex items-center justify-center shrink-0 mt-0.5">
                    {getIconForType(notif.type)}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 truncate">
                        {notif.title}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono-numbers shrink-0">
                        {formatTimestamp(notif.createdAt)}
                      </span>
                    </div>

                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      {notif.message}
                    </p>

                    {/* Actionable bill request accept/reject buttons */}
                    {isActionableShare && onAcceptShareBillRequest && onRejectShareBillRequest && notif.data?.billId && (
                      <div className="pt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (notif.data?.billId) {
                              onRejectShareBillRequest(notif.data.billId);
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-[11px] hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          {t.rejectInvite}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (notif.data?.billId) {
                              onAcceptShareBillRequest(notif.data.billId);
                            }
                          }}
                          className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] shadow-xs hover:bg-emerald-500 flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          <span>{t.acceptInvite}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
