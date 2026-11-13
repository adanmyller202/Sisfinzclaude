/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { LanguageCode } from '../../types';
import { getTranslations } from '../../utils/i18n';
import { X, UserPlus, Mail, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface InvitePartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: LanguageCode;
  onSendInvite: (email: string) => Promise<{ success: boolean; message?: string }>;
}

export const InvitePartnerModal: React.FC<InvitePartnerModalProps> = ({
  isOpen,
  onClose,
  language = 'pt',
  onSendInvite,
}) => {
  const t = getTranslations(language);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError(
        language === 'es'
          ? 'Por favor, ingresa un correo electrónico válido.'
          : language === 'en'
          ? 'Please enter a valid email address.'
          : 'Por favor, informe um e-mail válido.'
      );
      return;
    }

    try {
      setIsLoading(true);
      const res = await onSendInvite(cleanEmail);
      if (res.success) {
        setSuccess(
          language === 'es'
            ? 'Invitación enviada con éxito. Esperando respuesta de la persona.'
            : language === 'en'
            ? 'Invitation sent successfully. Awaiting partner confirmation.'
            : 'Convite enviado com sucesso! Aguardando aceite da pessoa.'
        );
        setEmail('');
        setTimeout(() => {
          onClose();
          setSuccess(null);
        }, 1800);
      } else {
        setError(res.message || 'Falha ao enviar convite.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao processar convite.');
    } finally {
      setIsLoading(false);
    }
  };

  return createPortal((
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[10010] flex items-center justify-center glass-overlay p-3 sm:p-4 overflow-hidden overscroll-none"
    >
      <div className="glass-modal rounded-3xl max-w-md w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header (pinned) */}
        <div className="p-4 sm:p-5 border-b border-slate-200/60 flex items-center justify-between shrink-0 bg-white/40 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {t.invitePerson}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'es'
                  ? 'Conectar para compartir gastos y facturas'
                  : language === 'en'
                  ? 'Connect to share bills and expenses'
                  : 'Conectar para compartilhar despesas e faturas'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Scrollable Form Body */}
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {language === 'es'
                ? 'Correo electrónico registrado'
                : language === 'en'
                ? 'Registered email'
                : 'E-mail cadastrado no SisFinz'}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.inviteEmailPlaceholder}
                autoFocus
                required
                className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl border border-slate-200/80 bg-white/80 text-slate-900 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {language === 'es'
                ? 'La persona debe tener cuenta en SisFinz con este e-mail. Recibirá una notificación interna para aceptar o rechazar.'
                : language === 'en'
                ? 'The person must have a SisFinz account with this email. They will receive an internal notification to accept or decline.'
                : 'A pessoa deve possuir conta no SisFinz com este e-mail. Ela receberá uma notificação interna para aceitar ou recusar.'}
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          </div>

          {/* Fixed Footer Actions (pinned) */}
          <div className="shrink-0 p-3 sm:p-4 border-t border-emerald-500/20 bg-white/80 backdrop-blur-xl flex items-center justify-end gap-2.5 z-10">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 text-xs font-semibold rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {language === 'es' ? 'Cancelar' : language === 'en' ? 'Cancel' : 'Cancelar'}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 text-xs font-bold rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {language === 'es'
                      ? 'Buscando...'
                      : language === 'en'
                      ? 'Searching...'
                      : 'Buscando...'}
                  </span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>{t.sendInvite}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  ), document.body);
};
