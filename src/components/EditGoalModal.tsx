import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChallengeGoal, LanguageCode } from '../types';
import { getTranslations } from '../utils/i18n';
import { X, Edit3 } from 'lucide-react';

interface EditGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: ChallengeGoal;
  language?: LanguageCode;
  onSave: (goalId: string, params: { title?: string; icon?: string; notes?: string }) => void;
}

const PRESET_ICONS = ['🎯', '🏍️', '✈️', '💻', '🏠', '🚗', '🛡️', '💍', '🎒', '🏖️', '📱', '🎓', '🎸', '💰', '👟', '🎮'];

export const EditGoalModal: React.FC<EditGoalModalProps> = ({
  isOpen,
  onClose,
  goal,
  language = 'pt',
  onSave,
}) => {
  const t = getTranslations(language);
  const [title, setTitle] = useState(goal.title);
  const [icon, setIcon] = useState(goal.icon);
  const [notes, setNotes] = useState(goal.notes || '');

  useEffect(() => {
    setTitle(goal.title);
    setIcon(goal.icon);
    setNotes(goal.notes || '');
  }, [goal]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(goal.id, {
      title: title.trim() || goal.title,
      icon,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return createPortal((
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden overscroll-none glass-overlay pt-safe pb-safe animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="glass-modal w-full max-w-md rounded-[2.5rem] overflow-hidden flex flex-col max-h-[calc(100dvh-2.5rem)] sm:max-h-[calc(100dvh-3.5rem)] shadow-2xl relative my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0 bg-white/70 backdrop-blur-xl z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {t.editGoalTitle}
              </h3>
              <p className="text-xs text-slate-500">
                {t.goalNamePlaceholder}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
            aria-label={t.closeBtn}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="p-5 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t.goalNameLabel}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 outline-hidden focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t.goalIconLabel}
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_ICONS.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIcon(i)}
                  className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center border transition-all cursor-pointer ${
                    icon === i
                      ? 'border-emerald-500 bg-emerald-50 shadow-xs scale-105'
                      : 'border-slate-200 bg-white hover:bg-slate-100'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t.goalNotesLabel}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t.goalNotesPlaceholder}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 outline-hidden focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          </div>

          <div className="flex items-center justify-end gap-2 p-3 sm:p-4 border-t border-slate-100 bg-white/70 backdrop-blur-xl shrink-0 z-10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              {t.cancelBtn}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs cursor-pointer"
            >
              {t.saveGoalSubmitBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  ), document.body);
};
