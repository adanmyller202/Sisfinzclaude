import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Briefcase,
  Plus,
  ChevronRight,
  Clock,
  Sparkles,
  X,
  Flame,
} from 'lucide-react';
import { CurrencyCode, LanguageCode } from '../../types';
import { DayOfWeekKey, TipFrequency } from '../../types/labor';
import { useLaborAgenda } from '../../hooks/useLaborAgenda';
import {
  ORDERED_WEEKDAYS,
  WEEKDAY_LABELS,
  calculateMonthSalary,
  createNewLaborJob,
  formatLocalDateYYYYMMDD,
  getScheduleForDate,
} from '../../utils/laborCalculations';
import { formatCurrency } from '../../utils/currency';
import { getCurrentMonthStr } from '../../utils/finance';
import { LaborJobDetail } from './LaborJobDetail';

interface LaborAgendaViewProps {
  isOpen: boolean;
  onClose: () => void;
  language?: LanguageCode;
}

export const LaborAgendaView: React.FC<LaborAgendaViewProps> = ({
  isOpen,
  onClose,
  language = 'pt',
}) => {
  const {
    jobs,
    accounts,
    saveJob,
    deleteJob,
    recordTipToSisFinz,
    syncSalaryToSisFinz,
  } = useLaborAgenda();

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Create job form
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState('Pizzero');
  const [baseSalary, setBaseSalary] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('ARS');
  const [weeklyHours, setWeeklyHours] = useState('48');
  const [tipFrequency, setTipFrequency] = useState<TipFrequency>('weekly');
  const [tipWeekday, setTipWeekday] = useState<DayOfWeekKey>('wed');
  const [defaultAccountId, setDefaultAccountId] = useState('');

  // Lock background scroll while full-screen Jornada Laboral view is open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // Reset selected job if it gets deleted
  useEffect(() => {
    if (selectedJobId && !jobs.some((j) => j.id === selectedJobId)) {
      setSelectedJobId(null);
    }
  }, [jobs, selectedJobId]);

  const activeJob = jobs.find((j) => j.id === selectedJobId) || null;
  const currentMonth = getCurrentMonthStr();
  const todayStr = formatLocalDateYYYYMMDD(new Date());

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !role.trim()) return;
    const newJob = createNewLaborJob({
      companyName,
      role,
      currency,
      baseSalary: Math.max(0, Number(baseSalary.replace(',', '.')) || 0),
      weeklyTargetHours: Math.max(1, Number(weeklyHours) || 48),
      tipFrequency,
      tipWeekday,
      defaultAccountId: defaultAccountId || accounts[0]?.id,
      useGastronomyPreset: true,
    });
    await saveJob(newJob);
    setCompanyName('');
    setBaseSalary('');
    setIsCreateOpen(false);
    setSelectedJobId(newJob.id);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="labor-agenda-overlay"
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 28 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          className="fixed inset-0 z-[58] flex flex-col bg-[#F4F8F6] text-slate-900 overflow-hidden"
        >
          {/* Sticky Top Bar */}
          <div
            className="flex items-center justify-between gap-3 border-b border-emerald-100/90 bg-white/90 px-4 py-3 backdrop-blur-md shrink-0"
            style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              {language === 'es' ? 'Volver' : 'Voltar'}
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white shadow-sm">
                <Briefcase className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-black tracking-tight text-slate-900">
                  Jornada Laboral
                </h1>
                <p className="truncate text-[9.5px] font-bold uppercase tracking-wider text-emerald-700">
                  Agenda & Salário
                </p>
              </div>
            </div>

            {!activeJob ? (
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Novo
              </button>
            ) : (
              <div className="w-16" />
            )}
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="mx-auto max-w-xl">
              <AnimatePresence mode="wait">
                {activeJob ? (
                  <motion.div
                    key={`job-${activeJob.id}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <LaborJobDetail
                      job={activeJob}
                      accounts={accounts}
                      language={language}
                      onBack={() => setSelectedJobId(null)}
                      onSaveJob={saveJob}
                      onDeleteJob={async (id) => {
                        await deleteJob(id);
                        setSelectedJobId(null);
                      }}
                      onRecordTipToSisFinz={recordTipToSisFinz}
                      onSyncSalaryToSisFinz={syncSalaryToSisFinz}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="jobs-list"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="space-y-4 pb-16"
                  >
                    <div className="px-1">
                      <h2 className="text-lg font-black tracking-tight text-slate-900">
                        Meus Trabalhos
                      </h2>
                      <p className="text-xs font-medium text-slate-500">
                        Toque em um trabalho para bater ponto, importar seu cronograma, controlar salário, benefícios e propinas.
                      </p>
                    </div>

                    {jobs.length === 0 ? (
                      <div className="rounded-[2rem] border border-emerald-200/80 bg-white p-6 text-center shadow-sm space-y-4">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-600/25">
                          <Flame className="h-8 w-8" />
                        </div>
                        <div>
                          <h3 className="text-base font-black text-slate-900">
                            Organize sua rotina de trabalho
                          </h3>
                          <p className="mx-auto mt-1 max-w-xs text-xs font-medium text-slate-500">
                            Cadastre sua empresa e posto (ex.: Pizzero) para controlar seu ponto, conferência de horas do RH, projeção salarial e propinas direto no seu saldo.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsCreateOpen(true)}
                          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-emerald-600/25 hover:opacity-95 cursor-pointer"
                        >
                          <Plus className="h-4 w-4 stroke-[3]" />
                          Cadastrar Primeiro Trabalho
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {jobs.map((job) => {
                          const todaySched = getScheduleForDate(job, todayStr);
                          const monthCalc = calculateMonthSalary(job, currentMonth);
                          const isRunning = Boolean(job.activeShift);

                          return (
                            <motion.button
                              key={job.id}
                              type="button"
                              whileTap={{ scale: 0.985 }}
                              onClick={() => setSelectedJobId(job.id)}
                              className="w-full rounded-[1.75rem] border border-emerald-200/80 bg-white p-4 text-left shadow-sm transition-all hover:border-emerald-400 hover:shadow-md cursor-pointer"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white shadow-sm">
                                    <Briefcase className="h-6 w-6" />
                                  </div>
                                  <div className="min-w-0">
                                    <h3 className="truncate text-base font-black text-slate-900">
                                      {job.companyName}
                                    </h3>
                                    <div className="flex items-center gap-1.5">
                                      <span className="truncate text-xs font-extrabold text-emerald-700">
                                        {job.role}
                                      </span>
                                      <span className="text-slate-300">•</span>
                                      <span className="font-mono text-xs font-black text-slate-700">
                                        {formatCurrency(monthCalc.netTotal, job.currency)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-400" />
                              </div>

                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                {isRunning ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500 px-2.5 py-1 text-[10px] font-black uppercase text-white">
                                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                                    Entrada marcada às {job.activeShift?.startTime}
                                  </span>
                                ) : todaySched.isUnset ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-500">
                                    Sem cronograma esta semana
                                  </span>
                                ) : todaySched.isOff ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-1 text-[10px] font-black uppercase text-purple-800">
                                    Hoje: Franco
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-800 border border-emerald-200/70">
                                    <Clock className="h-3 w-3 text-emerald-600" />
                                    Hoje: {todaySched.startTime} → {todaySched.endTime}
                                  </span>
                                )}

                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                                  <Sparkles className="h-3 w-3 text-emerald-600" />
                                  Propina {job.tipFrequency === 'weekly' ? 'semanal' : 'diária'}
                                </span>
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Create New Job Modal */}
          <AnimatePresence>
            {isCreateOpen && (
              <div className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center p-0 sm:p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsCreateOpen(false)}
                  className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs"
                />
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 40 }}
                  className="relative z-10 w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] bg-white p-5 shadow-2xl space-y-4 max-h-[88dvh] overflow-y-auto"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black text-slate-900">Novo Trabalho</h3>
                      <p className="text-[11px] font-medium text-slate-500">
                        Já vem com benefícios padrão de gastronomia editáveis
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCreateOpen(false)}
                      className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <form onSubmit={handleCreateJob} className="space-y-3">
                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">
                        Nome da Empresa / Pizzaria
                      </label>
                      <input
                        type="text"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Ex: Pizzaria Bella Napoli"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">
                          Posto / Cargo
                        </label>
                        <input
                          type="text"
                          required
                          value={role}
                          onChange={(e) => setRole(e.target.value)}
                          placeholder="Ex: Pizzero"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">
                          Moeda
                        </label>
                        <select
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-900"
                        >
                          <option value="ARS">ARS (Pesos)</option>
                          <option value="BRL">BRL (Reais)</option>
                          <option value="USD">USD (Dólares)</option>
                          <option value="EUR">EUR (Euros)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">
                          Salário Básico Líquido
                        </label>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={baseSalary}
                          onChange={(e) => setBaseSalary(e.target.value)}
                          placeholder="Ex: 900000"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-black text-slate-900 outline-none focus:border-emerald-500 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">
                          Horas / Semana
                        </label>
                        <input
                          type="number"
                          value={weeklyHours}
                          onChange={(e) => setWeeklyHours(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-black text-slate-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">
                          Propinas
                        </label>
                        <select
                          value={tipFrequency}
                          onChange={(e) => setTipFrequency(e.target.value as TipFrequency)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-900"
                        >
                          <option value="weekly">Semanal</option>
                          <option value="daily">Diária</option>
                        </select>
                      </div>

                      {tipFrequency === 'weekly' && (
                        <div>
                          <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">
                            Dia da Propina
                          </label>
                          <select
                            value={tipWeekday}
                            onChange={(e) => setTipWeekday(e.target.value as DayOfWeekKey)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-900"
                          >
                            {ORDERED_WEEKDAYS.map((dk) => (
                              <option key={dk} value={dk}>
                                {WEEKDAY_LABELS[dk].pt}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {accounts.length > 0 && (
                      <div>
                        <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">
                          Conta padrão para receber propinas
                        </label>
                        <select
                          value={defaultAccountId}
                          onChange={(e) => setDefaultAccountId(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-900"
                        >
                          {accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name} ({acc.currency})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-600/25 hover:opacity-95 cursor-pointer"
                    >
                      Criar Trabalho
                    </button>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
