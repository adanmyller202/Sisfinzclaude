import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { SavingGoal, AccountItem, CurrencyCode } from '../types';
import { formatCurrency } from '../utils/currency';
import { X, CalendarRange, Wallet, TrendingUp, CheckCircle2 } from 'lucide-react';

interface Props {
  goal: SavingGoal | null;
  accounts: AccountItem[];
  baseCurrency: CurrencyCode;
  onClose: () => void;
  onConfirm: (params: { goal: SavingGoal; startMonth: string; accountId: string; exchangeRate: number; dueDay: number; installmentAmount: number; months: number }) => Promise<void>;
}

const monthDiffInclusive = (start: string, end: string) => {
  const [sy, sm] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  return (ey - sy) * 12 + em - sm + 1;
};

export const RecurringInvestmentSetupModal: React.FC<Props> = ({ goal, accounts, baseCurrency, onClose, onConfirm }) => {
  const [startMonth, setStartMonth] = useState(new Date().toISOString().slice(0, 7));
  const [endDate, setEndDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [dueDay, setDueDay] = useState('5');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!goal) return;
    setStartMonth(new Date().toISOString().slice(0, 7));
    setEndDate(goal.deadline || '');
    setAccountId(accounts.find(a => a.isActive)?.id || '');
    setExchangeRate('');
    setDueDay('5');
    setError('');
  }, [goal?.id, accounts]);

  const activeAccounts = accounts.filter(a => a.isActive !== false && a.currency === baseCurrency);
  const endMonth = endDate.slice(0, 7);
  const months = startMonth && endMonth ? monthDiffInclusive(startMonth, endMonth) : 0;
  const remaining = goal ? Math.max(0, (goal.targetAmount || 0) - (goal.currentAmount || 0)) : 0;
  const installmentAmount = months > 0 ? Math.round((remaining / months) * 100) / 100 : 0;
  const rate = goal?.currency === 'ARS' ? 1 : Number(exchangeRate);
  const estimatedBase = installmentAmount * (rate > 0 ? rate : 0);
  const canSubmit = Boolean(goal && goal.hasTarget !== false && endDate && remaining > 0 && months > 0 && accountId && (goal.currency === 'ARS' || rate > 0) && Number(dueDay) >= 1 && Number(dueDay) <= 28);

  if (!goal) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) {
      setError('Confira a data final, a conta e a cotação informada.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onConfirm({ goal: { ...goal, deadline: endDate }, startMonth, accountId, exchangeRate: rate, dueDay: Number(dueDay), installmentAmount, months });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível criar o investimento recorrente.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[10030] flex items-center justify-center p-3 bg-slate-950/30" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="glass-modal w-full max-w-md max-h-[90dvh] flex flex-col overflow-hidden rounded-[2rem] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Cabeçalho fixo: fica fora da área rolável em vez de depender de position: sticky. */}
        <div className="relative z-20 flex shrink-0 items-center justify-between p-5 bg-[#D1FAEB] border-b border-emerald-200">
          <div className="min-w-0 pr-3">
            <h3 className="text-lg font-black text-slate-900">Investimento recorrente</h3>
            <p className="text-xs text-slate-600 truncate">{goal.icon || '🎯'} {goal.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="shrink-0 p-2 rounded-xl hover:bg-white/70 text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Somente o formulário rola; o cabeçalho permanece sempre visível. */}
        <form
          onSubmit={handleSubmit}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 space-y-4"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Valor que falta para a meta</div>
            <div className="text-2xl font-black text-slate-900">{formatCurrency(remaining, goal.currency || 'ARS')}</div>
            <div className="text-xs text-slate-600 mt-1">Defina quando pretende alcançar o valor da meta. Essa data será usada para calcular as parcelas mensais.</div>
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-2"><CalendarRange className="w-4 h-4 text-emerald-600"/> Até quando quer alcançar a meta?</span>
            <input type="date" value={endDate} min={new Date().toISOString().slice(0, 10)} onChange={e => setEndDate(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-900" required />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-2"><CalendarRange className="w-4 h-4 text-emerald-600"/> Quando começar?</span>
            <input type="month" value={startMonth} max={endMonth || undefined} onChange={e => setStartMonth(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-900" required />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-600"/> Conta de onde sairá o dinheiro</span>
            <select value={accountId} onChange={e => setAccountId(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-900" required>
              <option value="">Selecione uma conta</option>
              {activeAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
            </select>
          </label>
          {goal.currency !== 'ARS' && (
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-amber-600"/> Cotação inicial (1 {goal.currency} em ARS)</span>
              <input type="number" min="0.000001" step="any" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} placeholder="Ex.: 306" className="w-full rounded-xl border border-amber-200 bg-white p-3 text-slate-900" required />
              <p className="text-[11px] text-slate-500">É uma estimativa para as faturas. Ao pagar cada parcela, você informará quantos pesos realmente enviou.</p>
            </label>
          )}
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-slate-700">Dia de vencimento</span>
            <input type="number" min="1" max="28" value={dueDay} onChange={e => setDueDay(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-900" />
          </label>
          <div className="rounded-2xl bg-white/80 border border-slate-200 p-4 space-y-2">
            <div className="flex justify-between text-xs text-slate-600"><span>Parcelas</span><strong>{months > 0 ? months : '—'} meses</strong></div>
            <div className="flex justify-between text-xs text-slate-600"><span>Parcela da meta</span><strong>{formatCurrency(installmentAmount, goal.currency || 'ARS')}</strong></div>
            {goal.currency !== 'ARS' && <div className="flex justify-between text-xs text-slate-600"><span>Fatura estimada</span><strong>{formatCurrency(estimatedBase, baseCurrency)}</strong></div>}
            {endDate && months <= 0 && <p className="text-xs text-rose-600">A data inicial precisa ser anterior ou igual ao mês do prazo final.</p>}
          </div>
          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
          <button type="submit" disabled={!canSubmit || saving} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black py-3.5 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4"/> {saving ? 'CRIANDO PARCELAS...' : 'CRIAR FATURAS MENSAIS'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
};
