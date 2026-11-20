import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Upload,
  Sparkles,
  FileText,
  Check,
  Loader2,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { LanguageCode } from '../../types';
import { DayOfWeekKey, WeeklySchedule } from '../../types/labor';
import {
  ORDERED_WEEKDAYS,
  WEEKDAY_LABELS,
  calculateDayScheduleMinutes,
  formatMinutesAsHours,
} from '../../utils/laborCalculations';
import { auth } from '../../firebase/config';

interface ScheduleImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSchedule: WeeklySchedule;
  language: LanguageCode;
  employeeName?: string;
  onApplySchedule: (schedule: WeeklySchedule, saveAsDefault: boolean) => void;
}

const DAY_PATTERNS: { key: DayOfWeekKey; regex: RegExp }[] = [
  { key: 'mon', regex: /\b(seg(?:unda)?|lun(?:es)?|mon(?:day)?)\b/i },
  { key: 'tue', regex: /\b(ter(?:ca|ça)?|mar(?:tes)?|tue(?:sday)?)\b/i },
  { key: 'wed', regex: /\b(qua(?:rta)?|mie(?:rcoles)?|mié(?:rcoles)?|wed(?:nesday)?)\b/i },
  { key: 'thu', regex: /\b(qui(?:nta)?|jue(?:ves)?|thu(?:rsday)?)\b/i },
  { key: 'fri', regex: /\b(sex(?:ta)?|vie(?:rnes)?|fri(?:day)?)\b/i },
  { key: 'sat', regex: /\b(sab(?:ado)?|sáb(?:ado)?|sat(?:urday)?)\b/i },
  { key: 'sun', regex: /\b(dom(?:ingo)?|sun(?:day)?)\b/i },
];

function normalizeTime(raw: string): string {
  const cleaned = raw.replace(/[hH.]/g, ':').trim();
  const [hRaw, mRaw] = cleaned.split(':');
  const h = Math.max(0, Math.min(23, Number(hRaw) || 0));
  const m = Math.max(0, Math.min(59, Number(mRaw) || 0));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Local deterministic parser for pasted WhatsApp weekly schedule text */
function parseScheduleTextLocally(text: string, fallback: WeeklySchedule): { schedule: WeeklySchedule; matchedDays: number } {
  const next: WeeklySchedule = JSON.parse(JSON.stringify(fallback));
  const lines = text
    .split(/\r?\n|;|,/)
    .map((l) => l.trim())
    .filter(Boolean);

  let matchedDays = 0;

  for (const line of lines) {
    const normalizedLine = line.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const dayMatch = DAY_PATTERNS.find((d) => d.regex.test(normalizedLine));
    if (!dayMatch) continue;

    matchedDays++;
    if (/\b(franco|folga|libre|off|descanso|feriado)\b/i.test(normalizedLine)) {
      next[dayMatch.key] = {
        ...next[dayMatch.key],
        isOff: true,
        isSplitShift: false,
      };
      continue;
    }

    const times = [...normalizedLine.matchAll(/\b(\d{1,2}(?:[:hH.]\d{2})?)\b/g)]
      .map((m) => m[1])
      .filter((token) => token.includes(':') || /h/i.test(token) || Number(token) <= 23);

    if (times.length >= 2) {
      const startTime = normalizeTime(times[0].includes(':') || /h/i.test(times[0]) ? times[0] : `${times[0]}:00`);
      const endTime = normalizeTime(times[1].includes(':') || /h/i.test(times[1]) ? times[1] : `${times[1]}:00`);
      const isSplitShift = times.length >= 4;
      next[dayMatch.key] = {
        isOff: false,
        startTime,
        endTime,
        isSplitShift,
        splitStartTime: isSplitShift
          ? normalizeTime(times[2].includes(':') || /h/i.test(times[2]) ? times[2] : `${times[2]}:00`)
          : undefined,
        splitEndTime: isSplitShift
          ? normalizeTime(times[3].includes(':') || /h/i.test(times[3]) ? times[3] : `${times[3]}:00`)
          : undefined,
      };
    }
  }

  return { schedule: next, matchedDays };
}

/** Compress image in memory only (max 1400px, JPEG 0.8) so it is never persisted anywhere */
async function compressImageInMemory(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxSide = 1400;
        let { width, height } = img;
        if (width > maxSide || height > maxSide) {
          const ratio = Math.min(maxSide / width, maxSide / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas unavailable');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        const base64 = dataUrl.split(',')[1] || '';
        resolve({ base64, mimeType: 'image/jpeg' });
      } catch (err) {
        reject(err);
      } finally {
        // Immediately release temporary object URL from memory
        URL.revokeObjectURL(objectUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Não foi possível ler a imagem.'));
    };
    img.src = objectUrl;
  });
}

export const ScheduleImportModal: React.FC<ScheduleImportModalProps> = ({
  isOpen,
  onClose,
  currentSchedule,
  language,
  employeeName,
  onApplySchedule,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'image' | 'text'>('image');
  const [pastedText, setPastedText] = useState('');
  const [nameHint, setNameHint] = useState(employeeName || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewSchedule, setPreviewSchedule] = useState<WeeklySchedule | null>(null);
  const [saveAsDefault, setSaveAsDefault] = useState(false);

  const resetModal = () => {
    setIsAnalyzing(false);
    setErrorMsg(null);
    setPreviewSchedule(null);
    setPastedText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleSelectImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Immediately clear file input so nothing remains referenced
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    setIsAnalyzing(true);
    setErrorMsg(null);

    try {
      const { base64, mimeType } = await compressImageInMemory(file);
      const idToken = await auth.currentUser?.getIdToken().catch(() => '');

      const resp = await fetch('/api/work/parse-schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          employeeName: nameHint.trim() || undefined,
        }),
      });

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        throw new Error(
          errBody.error ||
            (resp.status === 404
              ? 'Endpoint de leitura de imagem (/api/work/parse-schedule) ainda não ativado no servidor. Você pode usar a aba "Colar Texto" ou editar manualmente!'
              : 'Não foi possível ler o cronograma da imagem.')
        );
      }

      const data = await resp.json();
      if (data?.schedule) {
        setPreviewSchedule(data.schedule as WeeklySchedule);
      } else {
        throw new Error('A IA não retornou horários válidos para esta imagem.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao analisar a imagem.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleParseText = () => {
    setErrorMsg(null);
    if (!pastedText.trim()) {
      setErrorMsg('Cole os horários da semana primeiro.');
      return;
    }
    const { schedule, matchedDays } = parseScheduleTextLocally(pastedText, currentSchedule);
    if (matchedDays === 0) {
      setErrorMsg('Não encontrei dias da semana no texto. Exemplo: "Seg 18:00-02:00, Ter Franco, Qua 18:00-02:00".');
      return;
    }
    setPreviewSchedule(schedule);
  };

  const updatePreviewDay = (day: DayOfWeekKey, patch: Partial<WeeklySchedule[DayOfWeekKey]>) => {
    setPreviewSchedule((prev) =>
      prev
        ? {
            ...prev,
            [day]: { ...prev[day], ...patch },
          }
        : prev
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs"
          />

          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="relative z-10 flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[2rem] sm:rounded-[2rem] bg-white shadow-2xl border border-emerald-100"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-4 text-white">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight">
                    {language === 'es' ? 'Importar Cronograma Semanal' : 'Importar Cronograma Semanal'}
                  </h3>
                  <p className="text-[10px] font-medium text-emerald-100">
                    {language === 'es'
                      ? 'La imagen se lee en memoria y se elimina al instante'
                      : 'A imagem é lida em memória e apagada na hora'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl p-2 text-white/80 hover:bg-white/15 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {!previewSchedule ? (
                <>
                  {/* Mode Switcher */}
                  <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('image');
                        setErrorMsg(null);
                      }}
                      className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black transition-all cursor-pointer ${
                        mode === 'image'
                          ? 'bg-white text-emerald-700 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Print / Foto (IA)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('text');
                        setErrorMsg(null);
                      }}
                      className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black transition-all cursor-pointer ${
                        mode === 'text'
                          ? 'bg-white text-emerald-700 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Colar Texto
                    </button>
                  </div>

                  {mode === 'image' ? (
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-[11px] font-black uppercase tracking-wider text-slate-500">
                          Seu nome na planilha (opcional)
                        </label>
                        <input
                          type="text"
                          value={nameHint}
                          onChange={(e) => setNameHint(e.target.value)}
                          placeholder="Ex: Adan"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-emerald-400 focus:bg-white"
                        />
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleSelectImage}
                        className="hidden"
                      />

                      <button
                        type="button"
                        disabled={isAnalyzing}
                        onClick={() => fileInputRef.current?.click()}
                        className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/60 px-4 py-8 text-center transition-colors hover:border-emerald-500 hover:bg-emerald-50 disabled:opacity-60 cursor-pointer"
                      >
                        {isAnalyzing ? (
                          <>
                            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                            <span className="text-xs font-black text-emerald-900">
                              Lendo horários com IA...
                            </span>
                          </>
                        ) : (
                          <>
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/25">
                              <Upload className="h-6 w-6" />
                            </div>
                            <span className="text-sm font-black text-emerald-950">
                              Selecionar print do cronograma
                            </span>
                            <span className="text-[11px] font-medium text-emerald-700/80">
                              PNG, JPG ou foto da escala de domingo
                            </span>
                          </>
                        )}
                      </button>

                      <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] font-medium text-slate-600">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <span>
                          <strong>Zero armazenamento:</strong> a foto é processada apenas em memória para preencher os horários e descartada imediatamente.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <textarea
                        rows={5}
                        value={pastedText}
                        onChange={(e) => setPastedText(e.target.value)}
                        placeholder={'Ex:\nSeg 18:00 - 02:00\nTer Franco\nQua 18:00 - 02:00\nQui 18:00 - 02:00\nSex 18:00 - 02:30\nSab 18:00 - 02:30\nDom 18:00 - 01:30'}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs font-bold text-slate-800 outline-none focus:border-emerald-400 focus:bg-white"
                      />
                      <button
                        type="button"
                        onClick={handleParseText}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 cursor-pointer"
                      >
                        <Sparkles className="h-4 w-4" />
                        Ler horários do texto
                      </button>
                    </div>
                  )}

                  {errorMsg && (
                    <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-800">
                      Revise antes de aplicar
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewSchedule(null)}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Refazer
                    </button>
                  </div>

                  <div className="space-y-2">
                    {ORDERED_WEEKDAYS.map((dayKey) => {
                      const d = previewSchedule[dayKey];
                      const mins = calculateDayScheduleMinutes(d);
                      return (
                        <div
                          key={dayKey}
                          className={`flex items-center justify-between gap-2 rounded-2xl border p-2.5 ${
                            d.isOff ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-10 text-xs font-black text-slate-800">
                              {language === 'es' ? WEEKDAY_LABELS[dayKey].shortEs : WEEKDAY_LABELS[dayKey].shortPt}
                            </span>
                            <button
                              type="button"
                              onClick={() => updatePreviewDay(dayKey, { isOff: !d.isOff })}
                              className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase cursor-pointer ${
                                d.isOff
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {d.isOff ? 'Franco' : 'Turno'}
                            </button>
                          </div>

                          {!d.isOff ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="time"
                                value={d.startTime}
                                onChange={(e) => updatePreviewDay(dayKey, { startTime: e.target.value })}
                                className="rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1 text-xs font-bold text-slate-800"
                              />
                              <span className="text-xs font-bold text-slate-400">→</span>
                              <input
                                type="time"
                                value={d.endTime}
                                onChange={(e) => updatePreviewDay(dayKey, { endTime: e.target.value })}
                                className="rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1 text-xs font-bold text-slate-800"
                              />
                              <span className="hidden sm:inline text-[10px] font-black text-emerald-700 w-11 text-right">
                                {formatMinutesAsHours(mins)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] font-bold text-amber-700 pr-2">Descanso</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <label className="flex items-center gap-2.5 rounded-xl bg-emerald-50/70 p-3 text-xs font-bold text-emerald-950 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveAsDefault}
                      onChange={(e) => setSaveAsDefault(e.target.checked)}
                      className="h-4 w-4 rounded accent-emerald-600"
                    />
                    <span>Definir também como minha escala padrão</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      onApplySchedule(previewSchedule, saveAsDefault);
                      handleClose();
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 cursor-pointer"
                  >
                    <Check className="h-4 w-4 stroke-[3]" />
                    Aplicar Cronograma
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
