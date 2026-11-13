import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, X, AlertTriangle, CalendarClock, TrendingDown, Wallet, Target, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { BillItem, IncomeItem, ExpenseItem, MonthlyStatusRecord, MonthBillOccurrence, CurrencyCode } from '../types';
import { formatCurrency } from '../utils/currency';
import { getTodayStr, getCurrentMonthStr } from '../utils/finance';

type AlertItem = { id: string; title: string; description: string; severity: 'danger' | 'warning' | 'info' | 'success'; icon: React.ReactNode; actionLabel: string; action: () => void };
interface Props {
  bills: BillItem[]; monthBills: MonthBillOccurrence[]; incomes: IncomeItem[]; expenses: ExpenseItem[];
  statusRecords: MonthlyStatusRecord[]; currentBalance: number; forecastBalance: number;
  safetyReserveAmount?: number; currency: CurrencyCode;
  onOpenBill: (id: string, month: string) => void; onOpenDailyPace: () => void; onOpenGoals: () => void;
}
export const AlertCenter: React.FC<Props> = ({ bills, monthBills, incomes, expenses, statusRecords, currentBalance, forecastBalance, safetyReserveAmount = 0, currency, onOpenBill, onOpenDailyPace, onOpenGoals }) => {
  const [open, setOpen] = useState(false);
  const [readAlertIds, setReadAlertIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('sisfinz_read_alerts') || '[]'); } catch { return []; }
  });
  const markAlertRead = (id: string) => {
    setReadAlertIds((previous) => {
      const next = previous.includes(id) ? previous : [...previous, id];
      try { localStorage.setItem('sisfinz_read_alerts', JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const today = getTodayStr();
  const month = getCurrentMonthStr();
  const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = [tomorrowDate.getFullYear(), String(tomorrowDate.getMonth() + 1).padStart(2, '0'), String(tomorrowDate.getDate()).padStart(2, '0')].join('-');
  const alerts = useMemo<AlertItem[]>(() => {
    const result: AlertItem[] = [];
    const money = (v: number) => formatCurrency(v, currency);
    const regularIncome = incomes.filter(i => !i.isSharedGenerated && !i.isReimbursement && !i.isRefund);
    const safetyLimit = safetyReserveAmount > 0 ? safetyReserveAmount : regularIncome.filter(i => i.expectedDate.slice(0, 7) === month).reduce((s, i) => s + (Number(i.amount) || 0), 0) * 0.10;
    if (safetyLimit > 0 && currentBalance < safetyLimit) result.push({ id: 'low-balance', title: 'Saldo abaixo do limite de segurança', description: 'Seu saldo atual é ' + money(currentBalance) + ', abaixo do limite de ' + money(safetyLimit) + '.', severity: 'danger', icon: <Wallet className="w-5 h-5" />, actionLabel: 'Ver Ritmo Diário', action: onOpenDailyPace });

    const pendingBills = monthBills.filter(i => (i.status === 'pending' || i.status === 'overdue') && i.effectiveDueDate.slice(0, 7) === month);
    const reserved = pendingBills.reduce((s, i) => s + Math.max(0, Number(i.bill.amount) || 0), 0);
    const nextIncome = regularIncome.filter(i => i.expectedDate >= today).sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))[0];
    const days = nextIncome ? Math.max(1, Math.ceil((new Date(nextIncome.expectedDate + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000)) : Math.max(1, new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate() + 1);
    const dailyLimit = Math.max(0, currentBalance - reserved) / days;
    const spentToday = expenses.filter(i => i.date === today && !i.isSharedGenerated && !i.isRefund && !i.refundTransferId).reduce((s, i) => s + (Number(i.amount) || 0), 0);
    if (dailyLimit > 0 && spentToday > dailyLimit) result.push({ id: 'daily-budget', title: 'Você ultrapassou seu orçamento diário', description: 'Hoje você gastou ' + money(spentToday) + ', acima do limite estimado de ' + money(dailyLimit) + '.', severity: 'warning', icon: <TrendingDown className="w-5 h-5" />, actionLabel: 'Ver Ritmo Diário', action: onOpenDailyPace });

    monthBills.filter(i => i.effectiveDueDate === tomorrow && i.status !== 'paid').slice(0, 3).forEach(i => result.push({ id: 'due-' + i.bill.id + '-' + i.month, title: 'Uma conta vence amanhã', description: i.bill.name + ': ' + money(i.bill.amount) + '.', severity: 'warning', icon: <CalendarClock className="w-5 h-5" />, actionLabel: 'Abrir conta', action: () => onOpenBill(i.bill.id, i.month) }));

    if (forecastBalance < 0) result.push({ id: 'forecast-negative', title: 'Sua previsão de fim do mês piorou', description: 'A projeção atual indica saldo negativo de ' + money(forecastBalance) + '. Revise seus compromissos.', severity: 'danger', icon: <AlertTriangle className="w-5 h-5" />, actionLabel: 'Revisar planejamento', action: onOpenDailyPace });
    else if (forecastBalance < currentBalance) result.push({ id: 'forecast-drop', title: 'Sua previsão de fim do mês está menor que o saldo atual', description: 'Depois das entradas e contas previstas, a estimativa é ' + money(forecastBalance) + '.', severity: 'info', icon: <TrendingDown className="w-5 h-5" />, actionLabel: 'Ver planejamento', action: onOpenDailyPace });

    statusRecords.filter(r => r.itemType === 'income' && r.month === month && r.isCompleted && r.completedAt?.slice(0, 10) === today).map(r => incomes.find(i => i.id === r.itemId)).filter((i): i is IncomeItem => Boolean(i)).slice(0, 2).forEach(i => result.push({ id: 'received-' + i.id, title: 'Você recebeu um valor!', description: i.name + ': ' + money(i.amount) + '. Que tal atualizar suas metas?', severity: 'success', icon: <Target className="w-5 h-5" />, actionLabel: 'Ver minhas metas', action: onOpenGoals }));

    bills.filter(i => i.recurrence === 'monthly').forEach(i => {
      const changed = Number(i.exceptions?.[month]?.amount ?? i.amount) || 0;
      const usual = Number(i.amount) || 0;
      if (changed > usual && usual > 0) result.push({ id: 'increase-' + i.id, title: 'Uma despesa recorrente aumentou', description: i.name + ' subiu ' + money(changed - usual) + ' em relação ao valor habitual.', severity: 'warning', icon: <TrendingDown className="w-5 h-5" />, actionLabel: 'Revisar conta', action: () => onOpenBill(i.id, month) });
    });
    return result;
  }, [bills, monthBills, incomes, expenses, statusRecords, currentBalance, forecastBalance, safetyReserveAmount, currency, today, month, tomorrow, onOpenBill, onOpenDailyPace, onOpenGoals]);

  const unreadCount = alerts.filter((a) => !readAlertIds.includes(a.id)).length;
  const urgent = alerts.filter(a => a.severity === 'danger' || a.severity === 'warning').length;
  const styles = { danger: 'bg-rose-50 border-rose-200 text-rose-800', warning: 'bg-amber-50 border-amber-200 text-amber-800', info: 'bg-sky-50 border-sky-200 text-sky-800', success: 'bg-emerald-50 border-emerald-200 text-emerald-800' };
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label="Abrir central de alertas" className="relative inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/80 hover:bg-white border border-slate-200 text-slate-700 shadow-xs"><Bell className="w-5 h-5" />{unreadCount > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center ring-2 ring-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}</button>
    <AnimatePresence>{open && <motion.div className="fixed inset-0 z-[120] flex items-start sm:items-center justify-center bg-slate-950/45 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
      <motion.section role="dialog" aria-modal="true" aria-label="Central de alertas inteligentes" className="w-full max-w-lg max-h-[88dvh] overflow-hidden rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-white/70 dark:border-slate-700 flex flex-col" initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">SisFinz • Mone</p><h2 className="text-xl font-black text-slate-900 dark:text-white">Central de alertas</h2><p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{unreadCount ? unreadCount + ' alerta(s) não lido(s)' : 'Todas as notificações foram lidas'}</p></div><button type="button" onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" aria-label="Fechar"><X className="w-5 h-5" /></button></div>
        <div className="overflow-y-auto p-4 space-y-3">{alerts.length === 0 ? <div className="py-12 text-center"><div className="mx-auto mb-3 w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><CheckCircle2 className="w-7 h-7" /></div><p className="font-bold text-slate-800 dark:text-white">Nenhum alerta importante</p><p className="text-sm text-slate-500 mt-1">Vamos avisar quando algo precisar da sua atenção.</p></div> : alerts.map(a => {
          const isRead = readAlertIds.includes(a.id);
          return <article key={a.id} className={'rounded-2xl border p-3.5 ' + styles[a.severity] + (isRead ? ' opacity-60' : '')}>
            <div className="flex gap-3"><div className="shrink-0 mt-0.5">{a.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2"><h3 className="font-extrabold text-sm">{a.title}</h3>{isRead && <span className="text-[9px] font-black uppercase tracking-wider">Lida</span>}</div>
                <p className="text-xs leading-relaxed mt-1 opacity-90">{a.description}</p>
                <div className="mt-3 flex items-center gap-4 flex-wrap">
                  <button type="button" onClick={() => { setOpen(false); a.action(); }} className="inline-flex items-center gap-1 text-xs font-extrabold underline underline-offset-2">{a.actionLabel}<ArrowUpRight className="w-3.5 h-3.5" /></button>
                  {!isRead && <button type="button" onClick={() => markAlertRead(a.id)} className="text-xs font-bold underline underline-offset-2">Marcar como lida</button>}
                </div>
              </div>
            </div>
          </article>;
        })}</div>
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400"><span>Alertas calculados com seus dados financeiros</span><span>{urgent} urgentes</span></div>
      </motion.section>
    </motion.div>}</AnimatePresence>
  </>;
};
