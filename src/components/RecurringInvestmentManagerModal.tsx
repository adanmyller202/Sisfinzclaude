import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { BillItem, SavingGoal, CurrencyCode, MonthlyStatusRecord } from '../types';
import { formatCurrency } from '../utils/currency';
import { X, Trash2, CalendarDays, ReceiptText, CheckCircle2, Clock3, AlertTriangle } from 'lucide-react';

interface Props {
  goal: SavingGoal;
  bills: BillItem[];
  statusRecords: MonthlyStatusRecord[];
  currency: CurrencyCode;
  locale: string;
  onClose: () => void;
  onSelectOccurrence: (bill: BillItem, month: string) => void;
  onDeleteAllRecurrences: (goal: SavingGoal) => Promise<void>;
}

interface Occurrence {
  bill: BillItem;
  month: string;
  dueDate: string;
  amount: number;
  installment: number;
  total: number;
  status: 'paid' | 'pending' | 'overdue';
}

const monthKey = (year: number, monthIndex: number) =>
  `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

export const RecurringInvestmentManagerModal: React.FC<Props> = ({
  goal, bills, statusRecords, currency, locale, onClose, onSelectOccurrence, onDeleteAllRecurrences,
}) => {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const occurrences = useMemo<Occurrence[]>(() => {
    const linked = bills.filter((bill) =>
      bill.id === goal.recurringInvestmentBillId ||
      bill.investmentSavingId === goal.id ||
      Object.values(bill.exceptions || {}).some((exception: any) => exception?.investmentSavingId === goal.id)
    );
    const today = new Date().toISOString().slice(0, 10);
    const result: Occurrence[] = [];

    linked.forEach((bill) => {
      const startParts = bill.startMonth.split('-').map(Number);
      const total = Number(bill.investmentPlanMonths) || Number(bill.recurrenceMonthsCount) || 0;
      if (startParts.length !== 2 || !startParts[0] || !startParts[1] || total <= 0) return;

      for (let index = 0; index < total; index += 1) {
        const date = new Date(startParts[0], startParts[1] - 1 + index, 1);
        const month = monthKey(date.getFullYear(), date.getMonth());
        const exception = bill.exceptions?.[month];
        if (exception?.isDeleted || bill.excludedMonths?.includes(month)) continue;
        const savingId = exception?.investmentSavingId ?? bill.investmentSavingId;
        if (savingId !== goal.id) continue;

        const day = Number(exception?.dueDay ?? bill.dueDay) || 1;
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        const dueDate = exception?.dueDate ?? `${month}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
        const status = statusRecords.find((record) => record.id === `bill_${bill.id}_${month}`);
        const resolvedBill: BillItem = {
          ...bill,
          name: exception?.name ?? bill.name,
          amount: Number(exception?.amount ?? bill.amount) || 0,
          dueDay: day,
          dueDate,
          category: exception?.category ?? bill.category,
          notes: exception?.notes ?? bill.notes,
          accountId: exception?.accountId ?? bill.accountId,
        };
        result.push({
          bill: resolvedBill,
          month,
          dueDate,
          amount: Number(exception?.amount ?? bill.amount) || 0,
          installment: index + 1,
          total,
          status: status?.isCompleted ? 'paid' : dueDate < today ? 'overdue' : 'pending',
        });
      }
    });

    return result.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [bills, goal.id, goal.recurringInvestmentBillId, statusRecords]);

  const handleDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      await onDeleteAllRecurrences(goal);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível excluir as recorrências.');
      setDeleting(false);
    }
  };

  const dateLabel = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return createPortal(
    <div className="fixed inset-0 z-[10040] flex items-center justify-center p-3 bg-slate-950/30" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="recurring-investment-manager-title" className="glass-modal w-full max-w-lg max-h-[88dvh] rounded-[2rem] overflow-hidden shadow-2xl flex flex-col" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between p-5 bg-[#D1FAEB]/95 border-b border-emerald-200 shrink-0">
          <div className="min-w-0">
            <h3 id="recurring-investment-manager-title" className="text-lg font-black text-slate-900">Recorrência ativa</h3>
            <p className="text-xs text-slate-600 truncate">{goal.name} · {occurrences.length} faturas</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="p-2 rounded-xl hover:bg-white/70 text-slate-600"><X className="w-5 h-5"/></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto overscroll-contain">
          {!confirmingDelete ? (
            <button type="button" onClick={() => setConfirmingDelete(true)} className="w-full rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wide py-3.5 flex items-center justify-center gap-2">
              <Trash2 className="w-4 h-4"/> Deletar todas as recorrências ativas
            </button>
          ) : (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-rose-700 font-black text-sm"><AlertTriangle className="w-5 h-5"/> Confirmar exclusão total?</div>
              <p className="text-sm text-slate-700">Esta ação vai excluir todas as faturas geradas desta meta e zerar o saldo acumulado da meta. Esta operação não poderá ser desfeita.</p>
              {error && <p className="text-xs font-semibold text-rose-700">{error}</p>}
              <div className="flex gap-2">
                <button type="button" disabled={deleting} onClick={() => setConfirmingDelete(false)} className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-slate-700 font-bold text-xs">Cancelar</button>
                <button type="button" disabled={deleting} onClick={handleDelete} className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 py-3 text-white font-black text-xs flex items-center justify-center gap-2">
                  <Trash2 className="w-4 h-4"/>{deleting ? 'Excluindo...' : 'Confirmar exclusão'}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500"><CalendarDays className="w-4 h-4 text-emerald-600"/> Faturas por vencimento</div>
            {occurrences.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-center text-sm text-slate-500">Nenhuma fatura encontrada para esta meta.</div>
            ) : occurrences.map((occurrence) => (
              <button type="button" key={`${occurrence.bill.id}_${occurrence.month}`} onClick={() => onSelectOccurrence(occurrence.bill, occurrence.month)} className="w-full rounded-2xl border border-slate-200 bg-white/85 hover:border-emerald-300 hover:bg-emerald-50/60 p-3.5 text-left transition-colors flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0"><ReceiptText className="w-5 h-5"/></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-800 truncate">{occurrence.bill.name}</span>
                  <span className="block text-xs text-slate-500 mt-0.5">Parcela {occurrence.installment}/{occurrence.total} · Vence {dateLabel(occurrence.dueDate)}</span>
                  <span className="block text-xs font-black text-slate-700 mt-1">{formatCurrency(occurrence.amount, currency)}</span>
                </span>
                <span className={`shrink-0 rounded-lg px-2 py-1 text-[9px] font-black uppercase flex items-center gap-1 ${occurrence.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : occurrence.status === 'overdue' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                  {occurrence.status === 'paid' ? <CheckCircle2 className="w-3 h-3"/> : occurrence.status === 'overdue' ? <AlertTriangle className="w-3 h-3"/> : <Clock3 className="w-3 h-3"/>}
                  {occurrence.status === 'paid' ? 'Pago' : occurrence.status === 'overdue' ? 'Atrasado' : 'Pendente'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
