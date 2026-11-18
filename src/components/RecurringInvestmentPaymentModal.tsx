import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { BillItem, SavingGoal, CurrencyCode } from '../types';
import { formatCurrency } from '../utils/currency';
import { X, ArrowRightLeft, CheckCircle2 } from 'lucide-react';

interface Props {
  bill: BillItem;
  goal: SavingGoal;
  installmentAmount: number;
  month: string;
  currency: CurrencyCode;
  onClose: () => void;
  onConfirm: (actualBaseAmount: number) => Promise<void>;
}

export const RecurringInvestmentPaymentModal: React.FC<Props> = ({ bill, goal, installmentAmount, month, currency, onClose, onConfirm }) => {
  const [actualAmount, setActualAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const parsed = Number(actualAmount);
  const rate = parsed > 0 && installmentAmount > 0 ? parsed / installmentAmount : 0;
  const monthLabel = useMemo(() => {
    const [year, m] = month.split('-').map(Number);
    return new Date(year, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }, [month]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Informe um valor em pesos maior que zero.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onConfirm(parsed);
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
            <h3 className="text-lg font-black text-slate-900">Confirmar investimento</h3>
            <p className="text-xs text-slate-600 capitalize">{monthLabel} · {bill.name}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-white/70 text-slate-600"><X className="w-5 h-5"/></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
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
              <div className="flex justify-between text-xs text-slate-600"><span>Valor debitado</span><strong>{formatCurrency(parsed, currency)}</strong></div>
              <div className="flex justify-between text-xs text-slate-600"><span>Cotação efetiva</span><strong>1 {goal.currency} = {formatCurrency(rate, currency)}</strong></div>
              <div className="flex justify-between text-xs text-slate-600"><span>Crédito na meta</span><strong>{formatCurrency(installmentAmount, goal.currency || 'ARS')}</strong></div>
              <div className="flex items-center gap-2 text-[11px] text-emerald-700"><ArrowRightLeft className="w-4 h-4"/> A cotação desta parcela será salva no histórico.</div>
            </div>
          )}
          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
          <button type="submit" disabled={saving || parsed <= 0} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black py-3.5 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4"/> {saving ? 'REGISTRANDO...' : 'CONFIRMAR E PAGAR'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
};
