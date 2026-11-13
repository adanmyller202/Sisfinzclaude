/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { CurrencyCode, LanguageCode, SharedBill, SharedUserSummary } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { getTranslations } from '../../utils/i18n';
import { X, ArrowRightLeft, AlertTriangle, Check, Loader2, Receipt } from 'lucide-react';

interface TransferConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency: CurrencyCode;
  language?: LanguageCode;
  selectedBills: SharedBill[];
  partner: SharedUserSummary | null;
  myUserId: string;
  selectedMonth?: string;
  onConfirmTransfer: () => Promise<void>;
}

export const TransferConfirmationModal: React.FC<TransferConfirmationModalProps> = ({
  isOpen,
  onClose,
  currency,
  language = 'pt',
  selectedBills,
  partner,
  myUserId,
  selectedMonth,
  onConfirmTransfer,
}) => {
  const t = getTranslations(language);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || selectedBills.length === 0) return null;

  const totalTransferAmount = selectedBills.reduce((sum, bill) => {
    const mEx = selectedMonth ? bill.exceptions?.[selectedMonth] : null;
    const share = mEx?.shares?.[myUserId] || bill.shares[myUserId];
    return sum + (share?.amount || 0);
  }, 0);

  const partnerName = partner?.displayName || 'Parceiro';

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setError(null);
    try {
      setIsSubmitting(true);
      await onConfirmTransfer();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao processar transferência.');
      setIsSubmitting(false);
    }
  };

  return createPortal((
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[10010] flex items-center justify-center glass-overlay p-3 sm:p-4 overflow-hidden overscroll-none"
    >
      <div className="glass-modal rounded-3xl max-w-lg w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header (pinned) */}
        <div className="p-4 sm:p-5 border-b border-slate-200/60 flex items-center justify-between shrink-0 bg-emerald-50/50 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {t.confirmTransferTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'es'
                  ? `Destinatario: ${partnerName}`
                  : language === 'en'
                  ? `Recipient: ${partnerName}`
                  : `Destinatário: ${partnerName}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
          {/* Important Warning Callout */}
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs flex gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">
                {language === 'es'
                  ? `Estás transfiriendo ${formatCurrency(totalTransferAmount, currency)} para ${partnerName}`
                  : language === 'en'
                  ? `You are transferring ${formatCurrency(totalTransferAmount, currency)} to ${partnerName}`
                  : `Você está transferindo ${formatCurrency(totalTransferAmount, currency)} para ${partnerName}`}
              </span>
              <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                {t.transferWarningNote}
              </p>
            </div>
          </div>

          {/* Selected Bills Breakdown List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {language === 'es'
                  ? `Faturas a transferir (${selectedBills.length})`
                  : language === 'en'
                  ? `Bills to transfer (${selectedBills.length})`
                  : `Faturas a transferir (${selectedBills.length})`}
              </span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono-numbers">
                {selectedBills.length} {t.billsSelectedCount}
              </span>
            </div>

            <div className="max-h-52 overflow-y-auto space-y-2 rounded-2xl border border-slate-200/70 p-2.5 bg-white/60">
              {selectedBills.map((bill) => {
                const myShare = bill.shares[myUserId];
                const shareAmount = myShare?.amount || 0;
                return (
                  <div
                    key={bill.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/70 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                        <Receipt className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 truncate block">
                          {bill.title} {selectedMonth && <span className="text-[10px] text-slate-400 font-normal">({selectedMonth})</span>}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {language === 'es' ? 'Total: ' : language === 'en' ? 'Total: ' : 'Total: '}
                          {formatCurrency(bill.amount, currency)} • {bill.category}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 font-mono-numbers">
                      <span className="font-bold text-emerald-700 text-xs">
                        {formatCurrency(shareAmount, currency)}
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        ({(selectedMonth ? bill.exceptions?.[selectedMonth]?.shares?.[myUserId]?.percentage : null) || bill.shares[myUserId]?.percentage || 50}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Total Summary Row */}
          <div className="p-3.5 rounded-2xl glass-emerald border border-emerald-500/20 flex items-center justify-between">
            <span className="text-xs sm:text-sm font-bold text-slate-800">
              {t.totalToTransfer}:
            </span>
            <span className="text-base sm:text-lg font-black text-emerald-800 font-mono-numbers">
              {formatCurrency(totalTransferAmount, currency)}
            </span>
          </div>

          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

        </div>

        {/* Fixed Footer Actions (pinned) */}
        <div className="shrink-0 p-3 sm:p-4 border-t border-emerald-500/20 bg-white/80 backdrop-blur-xs flex items-center justify-end gap-2.5 z-10">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 text-xs font-semibold rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {language === 'es' ? 'Cancelar' : language === 'en' ? 'Cancel' : 'Cancelar'}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="px-5 py-2.5 text-xs font-bold rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/25 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                  {language === 'es'
                    ? 'Procesando transferencia...'
                    : language === 'en'
                    ? 'Processing transfer...'
                    : 'Processando transferência...'}
                </span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>
                  {language === 'es'
                    ? `Transferir ${formatCurrency(totalTransferAmount, currency)}`
                    : language === 'en'
                    ? `Transfer ${formatCurrency(totalTransferAmount, currency)}`
                    : `Transferir ${formatCurrency(totalTransferAmount, currency)}`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  ), document.body);
};
