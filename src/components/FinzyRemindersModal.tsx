import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  ArrowLeft,
  Bell,
  Plus,
  Check,
  Clock,
  Repeat,
  Star,
  Trash2,
  X,
  Volume2,
  Sparkles,
  Calendar,
  Briefcase,
  HeartPulse,
  UserCheck,
  AlarmClock,
} from 'lucide-react';
import { LanguageCode } from '../types';
import {
  ReminderCategory,
  ReminderItem,
  ReminderRepeat,
} from '../hooks/useReminders';
import { FinzyMascot } from './FinzyMascot';
import { getSavedFinzySkinId } from '../utils/finzyLiving';

interface FinzyRemindersModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: LanguageCode;
  reminders: ReminderItem[];
  activeAlert: ReminderItem | null;
  notifPermission: NotificationPermission;
  onAddReminder: (params: {
    title: string;
    notes?: string;
    dueDate: string;
    dueTime?: string;
    category?: ReminderCategory;
    repeat?: ReminderRepeat;
    important?: boolean;
  }) => Promise<ReminderItem>;
  onToggleComplete: (id: string) => Promise<void>;
  onSnooze: (id: string, minutesOrTomorrow: number | 'tomorrow') => Promise<void>;
  onDismissAlert: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRequestNotifPermission: () => Promise<NotificationPermission>;
  onTestAlert: () => void;
}

function getTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

function getDefaultTimeStr(): string {
  const now = new Date(Date.now() + 15 * 60000);
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
    2,
    '0'
  )}`;
}

export const FinzyRemindersModal: React.FC<FinzyRemindersModalProps> = ({
  isOpen,
  onClose,
  language = 'pt',
  reminders,
  activeAlert,
  notifPermission,
  onAddReminder,
  onToggleComplete,
  onSnooze,
  onDismissAlert,
  onDelete,
  onRequestNotifPermission,
  onTestAlert,
}) => {
  const reduceMotion = useReducedMotion();
  const isEs = language === 'es';
  const skinId = getSavedFinzySkinId();
  const todayStr = getTodayStr();

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState(todayStr);
  const [dueTime, setDueTime] = useState(() => getDefaultTimeStr());
  const [category, setCategory] = useState<ReminderCategory>('routine');
  const [repeat, setRepeat] = useState<ReminderRepeat>('daily');
  const [important, setImportant] = useState(true);
  const [filterMode, setFilterMode] = useState<'pending' | 'recurring' | 'done' | 'all'>('pending');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const recurringCount = useMemo(
    () => reminders.filter((r) => r.repeat !== 'none').length,
    [reminders]
  );

  const filteredReminders = useMemo(() => {
    return reminders.filter((r) => {
      if (filterMode === 'pending') return r.status === 'pending';
      if (filterMode === 'recurring') return r.repeat !== 'none';
      if (filterMode === 'done') return r.status === 'done';
      return true;
    });
  }, [reminders, filterMode]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onAddReminder({
        title: title.trim(),
        notes: notes.trim() || undefined,
        dueDate: dueDate || todayStr,
        dueTime: dueTime || undefined,
        category,
        repeat,
        important,
      });
      setTitle('');
      setNotes('');
      setDueTime(getDefaultTimeStr());
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryBadge = (cat: ReminderCategory) => {
    switch (cat) {
      case 'work':
        return {
          label: isEs ? 'Turno' : 'Trabalho',
          icon: Briefcase,
          cls: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        };
      case 'health':
        return {
          label: isEs ? 'Salud' : 'Saúde',
          icon: HeartPulse,
          cls: 'bg-rose-100 text-rose-800 border-rose-200',
        };
      case 'personal':
        return {
          label: isEs ? 'Personal' : 'Pessoal',
          icon: UserCheck,
          cls: 'bg-amber-100 text-amber-800 border-amber-200',
        };
      default:
        return {
          label: isEs ? 'Rutina' : 'Rotina',
          icon: Sparkles,
          cls: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        };
    }
  };

  const repeatLabel = (rep: ReminderRepeat) => {
    if (rep === 'daily') return isEs ? 'Diario' : 'Diário';
    if (rep === 'weekly') return isEs ? 'Semanal' : 'Semanal';
    if (rep === 'monthly') return isEs ? 'Mensual' : 'Mensal';
    return null;
  };

  if (typeof document === 'undefined') return null;

  return (
    <>
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              key="finzy-reminders-manager"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ type: 'spring', stiffness: 330, damping: 30 }}
              className="fixed inset-0 z-[58] flex flex-col bg-[#F4F8F6] text-slate-900 overflow-hidden"
            >
              <div
                className="flex items-center justify-between gap-2 border-b border-emerald-100/90 bg-white/95 px-3.5 py-3 backdrop-blur-md shrink-0"
                style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
              >
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors cursor-pointer shrink-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {isEs ? 'Volver' : 'Voltar'}
                </button>

                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white shadow-sm">
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="truncate text-sm font-black tracking-tight text-slate-900">
                      {isEs ? 'Lembretes Importantes' : 'Lembretes Importantes'}
                    </h1>
                    <p className="truncate text-[9.5px] font-bold uppercase tracking-wider text-emerald-700">
                      {isEs
                        ? 'Avisos del Finzy • Recurrentes & Soneca'
                        : 'Avisos do Finzy • Recorrentes & Soneca'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onTestAlert}
                  className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[10.5px] font-black text-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer shrink-0"
                >
                  <Volume2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{isEs ? 'Probar' : 'Testar'}</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-3.5 py-3.5">
                <div className="mx-auto max-w-xl space-y-3.5 pb-16">
                  {/* System Notification Permission Banner */}
                  <div className="flex items-center justify-between gap-2.5 rounded-2xl border border-emerald-200/80 bg-white px-3.5 py-2.5 shadow-2xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FinzyMascot
                        mood={notifPermission === 'granted' ? 'happy' : 'calm'}
                        routineState="normal"
                        skinId={skinId}
                        size={38}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-black text-slate-900 truncate">
                          {notifPermission === 'granted'
                            ? isEs
                              ? 'Avisos en pantalla + sistema activos'
                              : 'Avisos na tela + sistema ativos'
                            : isEs
                            ? 'Avisos na tela ativos • Activa push del sistema'
                            : 'Avisos na tela ativos • Ative o push do sistema'}
                        </div>
                        <div className="text-[10px] font-semibold text-slate-500 truncate">
                          {isEs
                            ? 'Incluye recordatorios recurrentes diarios, semanales y mensuales'
                            : 'Inclui lembretes recorrentes diários, semanais e mensais'}
                        </div>
                      </div>
                    </div>

                    {notifPermission !== 'granted' && (
                      <button
                        type="button"
                        onClick={onRequestNotifPermission}
                        className="rounded-xl bg-emerald-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-emerald-700 cursor-pointer shrink-0"
                      >
                        {isEs ? 'Activar' : 'Ativar'}
                      </button>
                    )}
                  </div>

                  {/* Create Reminder Form */}
                  <form
                    onSubmit={handleCreate}
                    className="rounded-[1.75rem] border border-emerald-200/80 bg-white p-4 shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900">
                        {isEs ? 'Nuevo lembrete importante' : 'Novo lembrete importante'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setImportant((v) => !v)}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black transition-all cursor-pointer ${
                          important
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <Star
                          className={`h-3 w-3 ${
                            important ? 'fill-amber-500 text-amber-500' : ''
                          }`}
                        />
                        {isEs ? 'Importante' : 'Importante'}
                      </button>
                    </div>

                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={
                        isEs
                          ? 'Ej: Llevar cargador, confirmar turno, tomar agua...'
                          : 'Ex: Levar carregador, confirmar escala, pagar conta...'
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-emerald-500"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[9.5px] font-black uppercase text-slate-400">
                          {isEs ? 'Fecha' : 'Data'}
                        </label>
                        <input
                          type="date"
                          required
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[9.5px] font-black uppercase text-slate-400">
                          {isEs ? 'Hora del aviso' : 'Horário do aviso'}
                        </label>
                        <input
                          type="time"
                          value={dueTime}
                          onChange={(e) => setDueTime(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-900"
                        />
                      </div>
                    </div>

                    {/* Recurrence Selector Pills */}
                    <div className="space-y-1.5">
                      <span className="inline-flex items-center gap-1 text-[9.5px] font-black uppercase tracking-wider text-slate-400">
                        <Repeat className="h-3 w-3 text-emerald-600" />
                        {isEs ? 'Repetição do lembrete' : 'Repetição (Recorrente)'}
                      </span>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(
                          [
                            { id: 'none', label: isEs ? 'Único' : 'Único' },
                            { id: 'daily', label: isEs ? 'Diario' : 'Diário' },
                            { id: 'weekly', label: isEs ? 'Semanal' : 'Semanal' },
                            { id: 'monthly', label: isEs ? 'Mensual' : 'Mensal' },
                          ] as const
                        ).map((opt) => {
                          const active = repeat === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setRepeat(opt.id)}
                              className={`rounded-xl py-1.5 text-[10px] font-black transition-all cursor-pointer ${
                                active
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                      {(['routine', 'work', 'personal', 'health'] as const).map((cat) => {
                        const meta = categoryBadge(cat);
                        const active = category === cat;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setCategory(cat)}
                            className={`rounded-lg px-2.5 py-1 text-[10px] font-black transition-all cursor-pointer ${
                              active
                                ? 'bg-slate-900 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {meta.label}
                          </button>
                        );
                      })}
                    </div>

                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={
                        isEs ? 'Nota rápida (opcional)' : 'Observação rápida (opcional)'
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:bg-white focus:border-emerald-500"
                    />

                    <motion.button
                      type="submit"
                      whileTap={{ scale: 0.98 }}
                      disabled={!title.trim() || isSubmitting}
                      className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 py-3 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-emerald-600/20 hover:opacity-95 disabled:opacity-40 cursor-pointer"
                    >
                      <Plus className="h-4 w-4 stroke-[2.8]" />
                      {isEs ? 'Crear Lembrete' : 'Criar Lembrete'}
                    </motion.button>
                  </form>

                  {/* Filter Switcher (including Recorrentes) */}
                  <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-white/85 p-1 border border-slate-200/70 w-fit">
                    {(
                      [
                        {
                          id: 'pending',
                          label: isEs ? 'Activos' : 'Ativos',
                          count: reminders.filter((r) => r.status === 'pending').length,
                        },
                        {
                          id: 'recurring',
                          label: isEs ? 'Recurrentes' : 'Recorrentes',
                          count: recurringCount,
                        },
                        {
                          id: 'done',
                          label: isEs ? 'Hechos' : 'Concluídos',
                          count: reminders.filter((r) => r.status === 'done').length,
                        },
                        { id: 'all', label: isEs ? 'Todos' : 'Todos', count: reminders.length },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFilterMode(f.id)}
                        className={`rounded-xl px-2.5 py-1 text-[10px] font-black transition-all cursor-pointer ${
                          filterMode === f.id
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {f.label} ({f.count})
                      </button>
                    ))}
                  </div>

                  {/* Reminders List */}
                  <div className="space-y-2">
                    <AnimatePresence initial={false} mode="popLayout">
                      {filteredReminders.length === 0 ? (
                        <motion.div
                          key="no-rem"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="rounded-3xl border border-dashed border-slate-200 bg-white/75 p-7 text-center space-y-1.5"
                        >
                          <Bell className="mx-auto h-6 w-6 text-emerald-500" />
                          <div className="text-xs font-black text-slate-700">
                            {isEs
                              ? 'Sin lembretes en este filtro.'
                              : 'Nenhum lembrete neste filtro.'}
                          </div>
                        </motion.div>
                      ) : (
                        filteredReminders.map((rem) => {
                          const catInfo = categoryBadge(rem.category);
                          const CatIcon = catInfo.icon;
                          const repText = repeatLabel(rem.repeat);
                          const isDone = rem.status === 'done';

                          return (
                            <motion.div
                              key={rem.id}
                              layout
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className={`flex items-start justify-between gap-3 rounded-2xl border p-3.5 transition-all ${
                                isDone
                                  ? 'border-slate-200/70 bg-slate-50/80 opacity-75'
                                  : rem.important
                                  ? 'border-amber-300/90 bg-gradient-to-r from-amber-50/55 via-white to-white shadow-2xs'
                                  : 'border-slate-200/80 bg-white shadow-2xs'
                              }`}
                            >
                              <div className="flex items-start gap-3 min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={() => onToggleComplete(rem.id)}
                                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-xl border transition-all cursor-pointer ${
                                    isDone
                                      ? 'border-emerald-600 bg-emerald-600 text-white'
                                      : 'border-slate-300 bg-white text-transparent hover:border-emerald-500'
                                  }`}
                                >
                                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                                </button>

                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span
                                      className={`text-xs sm:text-sm font-black ${
                                        isDone ? 'text-slate-400 line-through' : 'text-slate-900'
                                      }`}
                                    >
                                      {rem.title}
                                    </span>
                                    {rem.important && !isDone && (
                                      <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500 shrink-0" />
                                    )}
                                  </div>

                                  {rem.notes && (
                                    <p className="text-[11px] font-medium text-slate-500">
                                      {rem.notes}
                                    </p>
                                  )}

                                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[9.5px] font-bold text-slate-700">
                                      <Calendar className="h-2.5 w-2.5" />
                                      {rem.dueDate}
                                      {rem.dueTime ? ` • ${rem.dueTime}` : ''}
                                    </span>

                                    <span
                                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black ${catInfo.cls}`}
                                    >
                                      <CatIcon className="h-2.5 w-2.5" />
                                      {catInfo.label}
                                    </span>

                                    {repText && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black text-emerald-800 border border-emerald-200/80">
                                        <Repeat className="h-2.5 w-2.5" />
                                        {repText}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => onDelete(rem.id)}
                                className="rounded-xl p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-colors cursor-pointer shrink-0"
                                aria-label="Excluir lembrete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </motion.div>
                          );
                        })
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Animated Finzy Pop-Up Alert when a Reminder Triggers */}
      {createPortal(
        <AnimatePresence>
          {activeAlert && (
            <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center p-3 sm:p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => onDismissAlert(activeAlert.id)}
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs"
              />

              <motion.div
                key={`alert-${activeAlert.id}`}
                initial={{ opacity: 0, y: 36, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 24, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                className="relative z-10 w-full max-w-sm overflow-hidden rounded-[2rem] border-2 border-emerald-300 bg-white shadow-2xl"
              >
                <div className="flex items-center justify-between bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-5 py-3.5 text-white">
                  <div className="flex items-center gap-2">
                    <motion.span
                      animate={!reduceMotion ? { rotate: [-12, 12, -8, 8, 0] } : undefined}
                      transition={{ repeat: Infinity, repeatDelay: 1.8, duration: 0.6 }}
                    >
                      <AlarmClock className="h-4 w-4 text-amber-200" />
                    </motion.span>
                    <span className="text-[10.5px] font-black uppercase tracking-widest">
                      {isEs ? 'Finzy te recuerda' : 'Finzy te lembra agora'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDismissAlert(activeAlert.id)}
                    className="rounded-xl p-1 text-white/85 hover:bg-white/15 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-5 space-y-4 text-center">
                  <div className="flex justify-center">
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 border border-emerald-200/80 shadow-xs">
                      <FinzyMascot
                        mood="happy"
                        routineState="proud_streak"
                        skinId={skinId}
                        size={62}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-base font-black text-slate-900">{activeAlert.title}</h3>
                    {activeAlert.notes && (
                      <p className="text-xs font-medium text-slate-500">{activeAlert.notes}</p>
                    )}
                    <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-[10px] font-bold text-slate-600 mt-1">
                      <Clock className="h-3 w-3 text-emerald-600" />
                      {activeAlert.dueDate}
                      {activeAlert.dueTime ? ` • ${activeAlert.dueTime}` : ''}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => onSnooze(activeAlert.id, 15)}
                      className="rounded-xl border border-slate-200 bg-slate-50 py-2 text-[10.5px] font-black text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 cursor-pointer"
                    >
                      +15 min
                    </button>
                    <button
                      type="button"
                      onClick={() => onSnooze(activeAlert.id, 60)}
                      className="rounded-xl border border-slate-200 bg-slate-50 py-2 text-[10.5px] font-black text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 cursor-pointer"
                    >
                      +1 hora
                    </button>
                    <button
                      type="button"
                      onClick={() => onSnooze(activeAlert.id, 'tomorrow')}
                      className="rounded-xl border border-slate-200 bg-slate-50 py-2 text-[10.5px] font-black text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 cursor-pointer"
                    >
                      {isEs ? 'Mañana' : 'Amanhã'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onDismissAlert(activeAlert.id)}
                      className="rounded-2xl border border-slate-200 bg-white py-3 text-xs font-black text-slate-600 hover:bg-slate-50 cursor-pointer"
                    >
                      {isEs ? 'Luego' : 'Depois'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleComplete(activeAlert.id)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 py-3 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-emerald-600/25 cursor-pointer"
                    >
                      <Check className="h-4 w-4 stroke-[3]" />
                      {isEs ? 'Listo' : 'Concluir'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};
