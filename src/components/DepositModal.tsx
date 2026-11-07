import React from 'react';
import { CurrencyCode, ChallengeSquare, LanguageCode } from '../types';
import { formatCurrencyExact, formatShortDate } from '../utils/currency';
import { getTranslations } from '../utils/i18n';
import { CheckCircle2, AlertCircle, X, RotateCcw, Sparkles } from 'lucide-react';

interface DepositModalProps {
  isOpen: boolean;
  square: ChallengeSquare | null;
  currency: CurrencyCode;
  language?: LanguageCode;
  isCompleted: boolean;
  depositDate?: string;
  onClose: () => void;
  onConfirm: (squareId: number) => void;
  onUndo: (squareId: number) => void;
}

export const DepositModal: React.FC<DepositModalProps> = ({
  isOpen,
  square,
  currency,
  language = 'pt',
  isCompleted,
  depositDate,
  onClose,
  onConfirm,
  onUndo,
}) => {
  const t = getTranslations(language);

  if (!isOpen || !square) return null;

  const formattedAmount = formatCurrencyExact(square.value, currency);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain glass-overlay pt-safe pb-safe animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="glass-modal w-full max-w-md rounded-[2.5rem] overflow-hidden flex flex-col max-h-[calc(100dvh-2.5rem)] sm:max-h-[calc(100dvh-3.5rem)] shadow-2xl relative my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (pinned) */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-emerald-500/20 shrink-0 bg-[#D1FAEB]/80 backdrop-blur-xl z-10">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base ${
                isCompleted
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
              }`}
            >
              #{square.id}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">
                  {t.depositModalTitle} #{square.id}
                </h3>
                {square.isAdjustment && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    {t.finalAdjustmentBadge}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {isCompleted ? t.depositCompletedDesc : t.depositPendingDesc}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label={t.closeBtn}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto overscroll-contain flex-1 min-h-0">
          {/* Valor card */}
          <div className="glass-emerald rounded-2xl p-5 border border-emerald-500/20 text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              {t.requiredValueLabel}
            </span>
            <div className="text-3xl sm:text-4xl font-extrabold text-emerald-700 font-mono-numbers mt-1">
              {formattedAmount}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {t.depositInstructionsPrefix} <strong>{formattedAmount}</strong> {t.depositInstructionsSuffix}
            </p>
          </div>

          {/* Estado: Já concluído */}
          {isCompleted ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-emerald-900">
                    {t.depositAlreadyConfirmed}
                  </p>
                  {depositDate && (
                    <p className="text-xs text-emerald-700 mt-0.5">
                      {t.depositRegisteredAt} {formatShortDate(depositDate)}
                    </p>
                  )}
                  <p className="text-xs text-emerald-700/80 mt-1">
                    {t.depositSummedDescPrefix} {formattedAmount} {t.depositSummedDescSuffix}
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onUndo(square.id);
                    onClose();
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  {t.undoDepositBtn}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  {t.closeBtn}
                </button>
              </div>
            </div>
          ) : (
            /* Estado: Não concluído */
            <div className="space-y-5">
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  {t.depositPendingWarning}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="sm:w-1/3 px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onConfirm(square.id);
                    onClose();
                  }}
                  className="sm:w-2/3 px-4 py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {t.confirmDepositBtn}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
