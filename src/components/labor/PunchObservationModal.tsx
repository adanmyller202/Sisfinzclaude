import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Edit3,
  Check,
  MessageSquareText,
  Clock,
  Plus,
  Trash2,
} from 'lucide-react';
import { ActiveShiftState, LaborJob, LaborShiftEntry } from '../../types/labor';

export interface DayObservationTarget {
  id: string;
  isActive: boolean;
  startTime: string;
  endTime?: string;
  shiftPart?: 1 | 2;
  rawNote: string;
  userObservation: string;
}

interface PunchObservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: LaborJob | null;
  dateStr: string;
  dayLabel: string;
  isEs: boolean;
  targets: DayObservationTarget[];
  onSaveObservation: (params: {
    targetId: string;
    isActive: boolean;
    newObservation: string;
  }) => Promise<void>;
}

const SYSTEM_NOTE_SEGMENTS = [
  /^\d+º\s*turno$/i,
  /^turno\s+extra\s*\(franco\)$/i,
  /^ponto\s+r[aá]pido\b/i,
  /^punto\s+r[aá]pido\b/i,
  /^no\s+hor[aá]rio$/i,
  /^en\s+horario$/i,
  /^atraso\s+de\b/i,
];

/**
 * Extracts only user-authored observation segments from a shift's `note` field,
 * ignoring automatic system prefixes like "1º turno" or "Ponto rápido • No horário".
 */
export function extractUserObservationSegments(rawNote?: string): string[] {
  const clean = (rawNote || '').trim();
  if (!clean) return [];

  const segments = clean
    .split(/\s*•\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  return segments.filter((seg) => !SYSTEM_NOTE_SEGMENTS.some((re) => re.test(seg)));
}

export function extractUserObservationText(rawNote?: string): string {
  return extractUserObservationSegments(rawNote).join(' • ');
}

export function rebuildShiftNoteWithObservation(
  rawNote: string | undefined,
  newObservation: string,
  shiftPart?: 1 | 2
): string | undefined {
  const cleanObs = newObservation.trim();
  const existingSystemParts = (rawNote || '')
    .split(/\s*•\s*/)
    .map((s) => s.trim())
    .filter((seg) => seg && SYSTEM_NOTE_SEGMENTS.some((re) => re.test(seg)));

  const parts: string[] = [];
  if (existingSystemParts.length > 0) {
    parts.push(...existingSystemParts);
  } else if (shiftPart) {
    parts.push(`${shiftPart}º turno`);
  }

  if (cleanObs) {
    parts.push(cleanObs);
  }

  return parts.length > 0 ? parts.join(' • ') : undefined;
}

export function buildDayObservationTargets(
  job: LaborJob,
  dateStr: string
): DayObservationTarget[] {
  const targets: DayObservationTarget[] = [];

  if (job.activeShift && job.activeShift.startDate === dateStr) {
    const activeNote =
      ((job.activeShift as ActiveShiftState & { note?: string }).note || '').trim();
    targets.push({
      id: 'active_shift',
      isActive: true,
      startTime: job.activeShift.startTime,
      shiftPart: job.activeShift.shiftPart,
      rawNote: activeNote,
      userObservation: extractUserObservationText(activeNote),
    });
  }

  const dayShifts: LaborShiftEntry[] = (job.shifts || []).filter((s) => s.date === dateStr);
  for (const s of dayShifts) {
    const rawNote = (s.note || '').trim();
    targets.push({
      id: s.id,
      isActive: false,
      startTime: s.startTime,
      endTime: s.endTime,
      shiftPart: s.shiftPart,
      rawNote,
      userObservation: extractUserObservationText(rawNote),
    });
  }

  return targets;
}

export function countUserObservationsForDay(job: LaborJob, dateStr: string): number {
  const targets = buildDayObservationTargets(job, dateStr);
  return targets.reduce(
    (sum, t) => sum + extractUserObservationSegments(t.rawNote).length,
    0
  );
}

export const PunchObservationModal: React.FC<PunchObservationModalProps> = ({
  isOpen,
  onClose,
  job,
  dateStr,
  dayLabel,
  isEs,
  targets,
  onSaveObservation,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setEditingId(null);
      setDraftText('');
      setIsSaving(false);
    }
  }, [isOpen]);

  const totalCount = targets.reduce(
    (sum, t) => sum + extractUserObservationSegments(t.rawNote).length,
    0
  );

  const startEdit = (target: DayObservationTarget) => {
    setEditingId(target.id);
    setDraftText(target.userObservation);
  };

  const handleConfirmSave = async (target: DayObservationTarget, overrideValue?: string) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSaveObservation({
        targetId: target.id,
        isActive: target.isActive,
        newObservation: overrideValue !== undefined ? overrideValue : draftText,
      });
      setEditingId(null);
      setDraftText('');
    } finally {
      setIsSaving(false);
    }
  };

  if (typeof document === 'undefined') return null;

  const shortDate = dateStr && dateStr.includes('-')
    ? `${dateStr.slice(8, 10)}/${dateStr.slice(5, 7)}`
    : dateStr;

  return createPortal(
    <AnimatePresence>
      {isOpen && job && (
        <div
          id="sisfinz-punch-observation-modal"
          className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isSaving && onClose()}
            className="fixed inset-0 bg-slate-900/55 backdrop-blur-xs"
          />

          <motion.div
            initial={{ opacity: 0, y: 36, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[2rem] sm:rounded-[2rem] border border-red-200 bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 px-5 py-4 text-white shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/20 shadow-inner">
                  <MessageSquareText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-black tracking-tight">
                      {isEs ? 'Observaciones del Fichaje' : 'Observações do Ponto'}
                    </h3>
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-black">
                      {totalCount}
                    </span>
                  </div>
                  <p className="truncate text-[11px] font-semibold text-red-100">
                    {dayLabel} • {shortDate} • {job.companyName}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => !isSaving && onClose()}
                className="rounded-xl p-1.5 text-white/85 hover:bg-white/15 hover:text-white transition-colors cursor-pointer shrink-0"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {targets.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-red-200 bg-red-50/40 p-5 text-center text-xs font-bold text-slate-500">
                  {isEs
                    ? 'No hay fichajes registrados para este día.'
                    : 'Nenhum ponto registrado para este dia.'}
                </div>
              ) : (
                targets.map((target, idx) => {
                  const isEditing = editingId === target.id;
                  const segments = extractUserObservationSegments(target.rawNote);
                  const hasObs = segments.length > 0;

                  return (
                    <motion.div
                      key={target.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04, type: 'spring', stiffness: 420, damping: 30 }}
                      className={`rounded-2xl border p-3.5 transition-colors ${
                        hasObs
                          ? 'border-red-200 bg-red-50/45'
                          : 'border-slate-200 bg-slate-50/70'
                      }`}
                    >
                      {/* Shift Header */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2.5 py-0.5 font-mono text-[10.5px] font-black text-slate-800 shadow-2xs">
                            <Clock className="h-3 w-3 text-emerald-600" />
                            {target.endTime
                              ? `${target.startTime} → ${target.endTime}`
                              : `Entrada ${target.startTime}`}
                          </span>
                          {target.shiftPart && (
                            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[9.5px] font-black text-indigo-800">
                              {target.shiftPart}º turno
                            </span>
                          )}
                          {target.isActive && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[9px] font-black uppercase text-white">
                              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                              {isEs ? 'En curso' : 'Em andamento'}
                            </span>
                          )}
                        </div>

                        {!isEditing && (
                          <button
                            type="button"
                            onClick={() => startEdit(target)}
                            className="inline-flex items-center gap-1 rounded-xl border border-red-300 bg-white px-2.5 py-1 text-[10.5px] font-black text-red-700 hover:bg-red-50 active:scale-95 transition-all cursor-pointer shrink-0 shadow-2xs"
                            title={isEs ? 'Editar observación' : 'Alterar observação'}
                          >
                            {hasObs ? (
                              <>
                                <Edit3 className="h-3.5 w-3.5" />
                                <span>{isEs ? 'Editar' : 'Alterar'}</span>
                              </>
                            ) : (
                              <>
                                <Plus className="h-3.5 w-3.5" />
                                <span>{isEs ? 'Agregar' : 'Adicionar'}</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Observation Display OR Inline Animated Editor */}
                      <AnimatePresence mode="wait" initial={false}>
                        {isEditing ? (
                          <motion.div
                            key="editor"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.16 }}
                            className="space-y-2.5 pt-1"
                          >
                            <textarea
                              rows={3}
                              autoFocus
                              value={draftText}
                              onChange={(e) => setDraftText(e.target.value)}
                              placeholder={
                                isEs
                                  ? 'Ej: El jefe de cocina llegó 11:35 para abrir el restaurante...'
                                  : 'Ex: Chefe de cozinha chegou 11h35 para abrir o restaurante...'
                              }
                              className="w-full rounded-xl border-2 border-red-300 bg-white px-3 py-2.5 text-base sm:text-xs font-semibold text-slate-900 outline-none focus:border-red-500 resize-none"
                            />
                            <div className="flex items-center justify-between gap-2">
                              {hasObs ? (
                                <button
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => handleConfirmSave(target, '')}
                                  className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] font-black text-rose-700 hover:bg-rose-100 cursor-pointer"
                                  title={isEs ? 'Borrar observación' : 'Remover observação'}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>{isEs ? 'Limpiar' : 'Remover'}</span>
                                </button>
                              ) : (
                                <div />
                              )}

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => {
                                    setEditingId(null);
                                    setDraftText('');
                                  }}
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-600 hover:bg-slate-50 cursor-pointer"
                                >
                                  {isEs ? 'Cancelar' : 'Cancelar'}
                                </button>
                                <button
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => handleConfirmSave(target)}
                                  className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-white shadow-sm hover:opacity-95 disabled:opacity-60 cursor-pointer"
                                >
                                  <Check className="h-3.5 w-3.5 stroke-[2.8]" />
                                  <span>
                                    {isSaving
                                      ? isEs
                                        ? 'Guardando...'
                                        : 'Salvando...'
                                      : isEs
                                      ? 'Guardar'
                                      : 'Salvar'}
                                  </span>
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        ) : hasObs ? (
                          <motion.div
                            key="viewer"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="space-y-1.5"
                          >
                            {segments.map((seg, sIdx) => (
                              <div
                                key={`${target.id}-seg-${sIdx}`}
                                className="flex items-start justify-between gap-2 rounded-xl border border-red-200/80 bg-white px-3 py-2.5 shadow-2xs"
                              >
                                <p className="text-xs font-bold text-red-950 leading-relaxed break-words">
                                  {seg}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => startEdit(target)}
                                  className="rounded-lg p-1 text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer shrink-0"
                                  aria-label={isEs ? 'Editar observación' : 'Alterar observação'}
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </motion.div>
                        ) : (
                          <motion.div
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="rounded-xl border border-dashed border-slate-200 bg-white/80 px-3 py-2.5 text-[11px] font-semibold text-slate-500"
                          >
                            {isEs
                              ? 'Sin observaciones registradas en este fichaje. Toca "Agregar" para escribir una.'
                              : 'Nenhuma observação registrada neste ponto. Toque em "Adicionar" para escrever uma.'}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3 shrink-0">
              <button
                type="button"
                onClick={() => !isSaving && onClose()}
                className="w-full rounded-2xl bg-slate-900 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {isEs ? 'Cerrar' : 'Fechar'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
