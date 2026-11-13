/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Users, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { getTranslations } from '../../utils/i18n';
import { LanguageCode } from '../../types';

interface StopSharingModalProps {
  isOpen: boolean;
  onClose: () => void;
  partnerName: string;
  language?: LanguageCode;
  onConfirm: (options: {
    conversionRule: 'total' | 'my_share';
    recurrenceScope: 'this_month' | 'future';
  }) => Promise<void>;
  isProcessing: boolean;
}

export const StopSharingModal: React.FC<StopSharingModalProps> = ({
  isOpen,
  onClose,
  partnerName,
  language = 'pt',
  onConfirm,
  isProcessing,
}) => {
  const t = getTranslations(language);
  const [conversionRule, setConversionRule] = useState<'total' | 'my_share'>('total');
  const [recurrenceScope, setRecurrenceScope] = useState<'this_month' | 'future'>('this_month');

  if (!isOpen) return null;

  return createPortal((
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {language === 'es' ? 'Parar de compartir' : 'Parar de compartilhar'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-6">
          {language === 'es' 
            ? `Estás por detener el intercambio con ${partnerName}. ¿Cómo quieres manejar las facturas actuales?`
            : `Você está prestes a parar de compartilhar com ${partnerName}. Como deseja lidar com as faturas atuais?`}
        </p>

        <div className="space-y-4 mb-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-slate-400">Conversão de Valor</label>
            <div className="grid grid-cols-1 gap-2">
              <button 
                onClick={() => setConversionRule('total')}
                className={`p-3 rounded-xl border text-left text-xs font-bold transition-all ${conversionRule === 'total' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}
              >
                {language === 'es' ? 'Mantener valor total como personal' : 'Manter valor total como fatura pessoal'}
              </button>
              <button 
                onClick={() => setConversionRule('my_share')}
                className={`p-3 rounded-xl border text-left text-xs font-bold transition-all ${conversionRule === 'my_share' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}
              >
                {language === 'es' ? 'Mantener solo mi parte' : 'Manter apenas minha participação (cota original)'}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-slate-400">Recorrência</label>
            <div className="grid grid-cols-1 gap-2">
              <button 
                onClick={() => setRecurrenceScope('this_month')}
                className={`p-3 rounded-xl border text-left text-xs font-bold transition-all ${recurrenceScope === 'this_month' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}
              >
                {language === 'es' ? 'Solo este mes' : 'Parar de compartilhar apenas este mês'}
              </button>
              <button 
                onClick={() => setRecurrenceScope('future')}
                className={`p-3 rounded-xl border text-left text-xs font-bold transition-all ${recurrenceScope === 'future' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}
              >
                {language === 'es' ? 'Este y futuros' : 'Parar de compartilhar este mês e os próximos'}
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={() => onConfirm({ conversionRule, recurrenceScope })}
          disabled={isProcessing}
          className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
          {language === 'es' ? 'Confirmar y detener' : 'Confirmar e Parar'}
        </button>
      </div>
    </div>
  ), document.body);
};
