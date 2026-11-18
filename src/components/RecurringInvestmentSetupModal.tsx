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
        className="glass-modal w-full max-w-md max-h-[90dvh] flex flex-col overflow-hidden rounded-3xl border border-slate-100 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Cabeçalho fixo: fica fora da área rolável em vez de depender de position: sticky. */}
        <div className="relative z-20 flex shrink-0 items-center justify-between px-6 py-5 bg-white border-b border-slate-100">
          <div className="min-w-0 pr-3">
            <h3 className="text-xl font-extrabold tracking-tight text-slate-800">Investimento recorrente</h3>
            <span className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 truncate">{goal.icon || '🎯'} {goal.name}</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Somente o formulário rola; o cabeçalho permanece sempre visível. */}
        <form
          onSubmit={handleSubmit}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50/70 px-6 py-6 space-y-5"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Valor que falta para a meta</div>
            <div className="text-2xl font-extrabold tracking-tight text-slate-800">{formatCurrency(remaining, goal.currency || 'ARS')}</div>
            <div className="text-xs leading-relaxed text-slate-500 mt-1.5">Defina quando pretende alcançar o valor da meta. Essa data será usada para calcular as parcelas mensais.</div>
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 flex items-center gap-2"><CalendarRange className="w-4 h-4 text-emerald-600"/> Até quando quer alcançar a meta?</span>
            <input type="date" value={endDate} min={new Date().toISOString().slice(0, 10)} onChange={e => setEndDate(e.target.value)} className="w-full rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 text-slate-800 shadow-sm transition-all placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15" required />
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
              <input type="number" min="0.000001" step="any" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} placeholder="Ex.: 306" className="w-full rounded-2xl border border-amber-200/80 bg-white px-4 py-3.5 text-slate-800 shadow-sm transition-all placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15" required />
              <p className="text-[11px] text-slate-500">É uma estimativa para as faturas. Ao pagar cada parcela, você informará quantos pesos realmente enviou.</p>
            </label>
          )}
          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Dia de vencimento</span>
            <input type="number" min="1" max="28" value={dueDay} onChange={e => setDueDay(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-900" />
          </label>
          <div className="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm space-y-3">
            <div className="flex justify-between text-xs text-slate-600"><span>Parcelas</span><strong>{months > 0 ? months : '—'} meses</strong></div>
            <div className="flex justify-between text-xs text-slate-600"><span>Parcela da meta</span><strong>{formatCurrency(installmentAmount, goal.currency || 'ARS')}</strong></div>
            {goal.currency !== 'ARS' && <div className="flex justify-between text-xs text-slate-600"><span>Fatura estimada</span><strong>{formatCurrency(estimatedBase, baseCurrency)}</strong></div>}
            {endDate && months <= 0 && <p className="text-xs text-rose-600">A data inicial precisa ser anterior ou igual ao mês do prazo final.</p>}
          </div>
          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
          <button type="submit" disabled={!canSubmit || saving} className="w-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 disabled:opacity-40 text-white font-bold py-4 shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.99] flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4"/> {saving ? 'CRIANDO PARCELAS...' : 'CRIAR FATURAS MENSAIS'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
};
