import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { BillItem, SavingGoal, CurrencyCode } from '../types';
import { formatCurrency } from '../utils/currency';
import { X, ArrowRightLeft, CheckCircle2, ChevronLeft, RefreshCw, LockKeyhole } from 'lucide-react';

interface Props {
  bill: BillItem;
  goal: SavingGoal;
  installmentAmount: number;
  month: string;
  currency: CurrencyCode;
  onClose: () => void;
  onConfirm: (actualBaseAmount: number, updateFutureInstallments: boolean) => Promise<void>;
}

export const RecurringInvestmentPaymentModal: React.FC<Props> = ({ bill, goal, installmentAmount, month, currency, onClose, onConfirm }) => {
  const [actualAmount, setActualAmount] = useState('');
  const [updateFutureInstallments, setUpdateFutureInstallments] = useState(false);
  const [step, setStep] = useState<'amount' | 'future'>('amount');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const parsed = Number(actualAmount);
  const rate = parsed > 0 && installmentAmount > 0 ? parsed / installmentAmount : 0;
  const originalAmount = Number(bill.investmentOriginalAmount ?? bill.amount) || 0;
  const monthLabel = useMemo(() => {
    const [year, m] = month.split('-').map(Number);
    return new Date(year, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }, [month]);

  const continueToFutureChoice = (event: React.FormEvent) => {
    event.preventDefault();
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Informe um valor em pesos maior que zero.');
      return;
    }
    setError('');
    setStep('future');
  };

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await onConfirm(parsed, updateFutureInstallments);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível confirmar o pagamento.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[10040] flex items-center justify-center p-3 bg-slate-950/30" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="glass-modal w-full max-w-md rounded-[2rem] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 bg-[#D1FAEB]/95 border-b border-emerald-200">
          <div>
            <h3 className="text-lg font-black text-slate-900">{step === 'amount' ? 'Confirmar investimento' : 'Próximas faturas'}</h3>
            <p className="text-xs text-slate-600 capitalize">{monthLabel} · {bill.name}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-white/70 text-slate-600"><X className="w-5 h-5"/></button>
        </div>

        {step === 'amount' ? (
          <form onSubmit={continueToFutureChoice} className="p-5 space-y-4">
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center">
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Sua parcela na meta</div>
              <div className="text-3xl font-black text-emerald-700">{formatCurrency(installmentAmount, goal.currency || 'ARS')}</div>
            </div>
            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-800">Quantos pesos você enviou para chegar a esse valor?</span>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-500">{currency === 'ARS' ? '$' : currency}</span>
                <input autoFocus type="number" min="0.01" step="any" value={actualAmount} onChange={e => setActualAmount(e.target.value)} placeholder="Ex.: 700000" className="w-full rounded-xl border border-slate-200 bg-white p-3 pl-14 text-lg font-black text-slate-900" required />
              </div>
            </label>
            {parsed > 0 && (
              <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-2">
                <div className="flex justify-between text-xs text-slate-600"><span>Valor debitado nesta parcela</span><strong>{formatCurrency(parsed, currency)}</strong></div>
                <div className="flex justify-between text-xs text-slate-600"><span>Cotação efetiva</span><strong>1 {goal.currency} = {formatCurrency(rate, currency)}</strong></div>
                <div className="flex justify-between text-xs text-slate-600"><span>Crédito na meta</span><strong>{formatCurrency(installmentAmount, goal.currency || 'ARS')}</strong></div>
                <div className="flex items-center gap-2 text-[11px] text-emerald-700"><ArrowRightLeft className="w-4 h-4"/> O valor real desta parcela ficará salvo no histórico.</div>
              </div>
            )}
            {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
            <button type="submit" disabled={!Number.isFinite(parsed) || parsed <= 0} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black py-3.5 flex items-center justify-center gap-2">
              CONTINUAR <CheckCircle2 className="w-4 h-4"/>
            </button>
          </form>
        ) : (
          <div className="p-5 space-y-4">
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
              <div className="text-sm font-bold text-slate-800">O pagamento foi registrado por {formatCurrency(parsed, currency)}.</div>
              <p className="text-xs text-slate-500 mt-1">Agora escolha como deseja configurar as próximas faturas recorrentes.</p>
            </div>

            <button type="button" onClick={() => setUpdateFutureInstallments(true)} className={`w-full text-left rounded-2xl border p-4 transition-all ${updateFutureInstallments ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/15' : 'border-slate-200 bg-white hover:border-emerald-200'}`}>
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center"><RefreshCw className="w-5 h-5"/></span>
                <span className="flex-1">
                  <span className="block text-sm font-bold text-slate-800">Atualizar próximas faturas</span>
                  <span className="block text-xs text-slate-500 mt-1">Usar o novo valor enviado em pesos em todas as próximas parcelas.</span>
                  <span className="block text-sm font-black text-emerald-700 mt-2">{formatCurrency(parsed, currency)} por parcela</span>
                </span>
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${updateFutureInstallments ? 'border-emerald-600' : 'border-slate-300'}`}>{updateFutureInstallments && <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"/>}</span>
              </div>
            </button>

            <button type="button" onClick={() => setUpdateFutureInstallments(false)} className={`w-full text-left rounded-2xl border p-4 transition-all ${!updateFutureInstallments ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/15' : 'border-slate-200 bg-white hover:border-emerald-200'}`}>
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center"><LockKeyhole className="w-5 h-5"/></span>
                <span className="flex-1">
                  <span className="block text-sm font-bold text-slate-800">Manter o valor original</span>
                  <span className="block text-xs text-slate-500 mt-1">Preservar o valor definido quando a recorrência foi criada.</span>
                  <span className="block text-sm font-black text-slate-700 mt-2">{formatCurrency(originalAmount, currency)} por parcela</span>
                </span>
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${!updateFutureInstallments ? 'border-emerald-600' : 'border-slate-300'}`}>{!updateFutureInstallments && <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"/>}</span>
              </div>
            </button>

            {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep('amount')} disabled={saving} className="flex-1 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold py-3 flex items-center justify-center gap-2"><ChevronLeft className="w-4 h-4"/> VOLTAR</button>
              <button type="button" onClick={submit} disabled={saving} className="flex-[1.5] rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black py-3 flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4"/> {saving ? 'REGISTRANDO...' : 'CONFIRMAR E PAGAR'}</button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
