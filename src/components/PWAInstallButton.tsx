import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { LanguageCode } from '../types';
import { Download, Share, X, PlusSquare } from 'lucide-react';

interface PWAInstallButtonProps {
  language?: LanguageCode;
  variant?: 'compact' | 'full';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  language = 'pt',
  variant = 'compact',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running standalone, hide button
  if (isInstalled) {
    return null;
  }

  const label =
    language === 'es' ? 'Instalar App' : language === 'pt' ? 'Instalar App' : 'Install App';

  // Desktop Chrome / Android prompt flow
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer ${className}`}
        title={label}
      >
        <Download className="w-3.5 h-3.5" />
        <span className={variant === 'compact' ? 'hidden sm:inline' : 'inline'}>{label}</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-xl border border-slate-200/80 bg-white/80 text-slate-700 hover:bg-white transition-colors cursor-pointer ${className}`}
          title={label}
        >
          <Download className="w-3.5 h-3.5 text-emerald-600" />
          <span className={variant === 'compact' ? 'hidden sm:inline' : 'inline'}>{label}</span>
        </button>

        {showIOSGuide && (
          <div className="glass-overlay p-4">
            <div className="glass-modal rounded-3xl max-w-sm w-full p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>{language === 'es' ? 'Instalar en iPhone / iPad' : 'Instalar no iPhone / iPad'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-700">
                <div className="flex items-start gap-2.5 bg-white/80 p-2.5 rounded-2xl border border-slate-200/80">
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Share className="w-3.5 h-3.5" />
                  </div>
                  <p>
                    {language === 'es'
                      ? '1. Toca el botón Compartir en la barra de Safari.'
                      : '1. Toque no botão Compartilhar na barra do Safari.'}
                  </p>
                </div>

                <div className="flex items-start gap-2.5 bg-white/80 p-2.5 rounded-2xl border border-slate-200/80">
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <PlusSquare className="w-3.5 h-3.5" />
                  </div>
                  <p>
                    {language === 'es'
                      ? '2. Desplázate hacia abajo y selecciona "Agregar a pantalla de inicio".'
                      : '2. Role para baixo e selecione "Adicionar à Tela de Início".'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2 text-xs font-bold rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 cursor-pointer transition-colors"
              >
                {language === 'es' ? 'Entendido' : 'Entendi'}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
