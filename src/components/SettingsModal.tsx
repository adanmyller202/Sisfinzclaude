import React, { useRef, useState } from 'react';
import { AppSettings, CurrencyCode, LanguageCode, BillItem, IncomeItem, ExpenseItem } from '../types';
import { CURRENCIES } from '../utils/currency';
import { LANGUAGES, getTranslations } from '../utils/i18n';
import { MonthlyReportSection } from './MonthlyReportSection';
import {
  Settings,
  X,
  Moon,
  Sun,
  DollarSign,
  Globe,
  Download,
  Upload,
  Trash2,
  Volume2,
  VolumeX,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  Layout,
  Palette,
  ShieldAlert,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onExportData: () => void;
  onImportData: (jsonString: string) => boolean | Promise<boolean>;
  onResetAllData: () => Promise<void> | void;
  bills?: BillItem[];
  incomes?: IncomeItem[];
  expenses?: ExpenseItem[];
  currency?: CurrencyCode;
  language?: LanguageCode;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onExportData,
  onImportData,
  onResetAllData,
  bills = [],
  incomes = [],
  expenses = [],
  currency,
  language,
}) => {
  const [localLang, setLocalLang] = useState<LanguageCode>(language || settings.language || 'pt');

  React.useEffect(() => {
    if (language) setLocalLang(language);
    else if (settings.language) setLocalLang(settings.language);
  }, [language, settings.language]);

  const t = getTranslations(localLang);
  const activeCurrency = currency || settings.currency || 'BRL';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<{ success: boolean; msg: string } | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showConfirmResetAll, setShowConfirmResetAll] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [isResetting, setIsResetting] = useState(false);

  React.useEffect(() => {
    let timer: any = null;
    if (showConfirmResetAll) {
      setCountdown(10);
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [showConfirmResetAll]);

  // Lock body scroll when settings modal is open
  React.useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        try {
          setIsRestoring(true);
          const success = await onImportData(content);
          if (success) {
            setImportStatus({ success: true, msg: t.restoreSuccessMsg || t.importSuccessMsg });
            setTimeout(() => setImportStatus(null), 4000);
          } else {
            setImportStatus({ success: false, msg: t.restoreErrorMsg || t.importErrorMsg });
          }
        } catch {
          setImportStatus({ success: false, msg: t.restoreErrorMsg || t.importErrorMsg });
        } finally {
          setIsRestoring(false);
        }
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const containerVariants: any = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } },
    exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.2 } }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div key="settings-modal-root" className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 overflow-hidden overscroll-contain">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 settings-backdrop"
            onClick={onClose}
          />

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="settings-panel-solid w-full sm:max-w-xl h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[90dvh] rounded-none sm:rounded-[2.5rem] shadow-2xl overflow-hidden sm:my-auto flex flex-col relative z-10 pt-safe pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between shrink-0 relative bg-[#0F172A] z-20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/5 text-white flex items-center justify-center border border-white/10">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white tracking-tight">
                    {t.settingsTitle}
                  </h3>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-0.5">
                    {t.settingsSubtitle}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-8 overflow-y-auto overscroll-contain flex-1 min-h-0 custom-scrollbar">
              {importStatus && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className={`p-4 text-xs font-bold rounded-2xl border ${
                    importStatus.success
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}
                >
                  {importStatus.msg}
                </motion.div>
              )}

              {/* Regional Preferences */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">
                  <Globe className="w-3.5 h-3.5 text-blue-500" />
                  Regional & Localização
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Idioma */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-400 ml-1">Idioma</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.keys(LANGUAGES) as LanguageCode[]).map((lang) => (
                        <button
                          key={lang}
                          onClick={() => { setLocalLang(lang); onUpdateSettings({ language: lang }); }}
                          className={`h-14 rounded-2xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                            localLang === lang 
                              ? 'bg-blue-500/20 border-blue-500/40 text-white' 
                              : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                          }`}
                        >
                          <span className="text-lg">{LANGUAGES[lang].flag}</span>
                          <span className="text-[10px] font-black uppercase tracking-tighter mt-0.5">{lang}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Moeda */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-400 ml-1">Moeda</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['BRL', 'USD', 'EUR', 'PYG'] as CurrencyCode[]).map((code) => (
                        <button
                          key={code}
                          onClick={() => onUpdateSettings({ currency: code })}
                          className={`h-14 rounded-2xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                            settings.currency === code 
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-white' 
                              : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                          }`}
                        >
                          <span className="text-sm font-black">{code}</span>
                          <span className="text-[9px] font-bold text-slate-500">{CURRENCIES[code]?.symbol}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Appearance & Sound */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">
                  <Palette className="w-3.5 h-3.5 text-amber-500" />
                  Experiência Visual
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => onUpdateSettings({ darkMode: false })}
                    className={`p-4 rounded-3xl border flex flex-col items-center gap-3 transition-all cursor-pointer ${
                      !settings.darkMode 
                        ? 'bg-white text-slate-900 border-white shadow-xl shadow-white/5' 
                        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <Sun className={`w-6 h-6 ${!settings.darkMode ? 'text-amber-500' : ''}`} />
                    <span className="text-[11px] font-black uppercase tracking-widest">Modo Claro</span>
                  </button>
                  <button
                    onClick={() => onUpdateSettings({ darkMode: true })}
                    className={`p-4 rounded-3xl border flex flex-col items-center gap-3 transition-all cursor-pointer ${
                      settings.darkMode 
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-xl shadow-emerald-600/20' 
                        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <Moon className="w-6 h-6" />
                    <span className="text-[11px] font-black uppercase tracking-widest">Modo Escuro</span>
                  </button>
                </div>

                <div className="p-4 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-emerald-400 transition-colors">
                      {settings.soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="text-sm font-black text-white">Efeitos Sonoros</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Confirmações e Toques</div>
                    </div>
                  </div>
                  <button
                    onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
                    className={`w-14 h-8 rounded-full transition-all relative ${settings.soundEnabled ? 'bg-emerald-600' : 'bg-slate-700'}`}
                  >
                    <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all shadow-md ${settings.soundEnabled ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
              </div>

              {/* Data & Analytics */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">
                  <Layout className="w-3.5 h-3.5 text-teal-500" />
                  Dados & Relatórios
                </div>

                <MonthlyReportSection
                  bills={bills}
                  incomes={incomes}
                  expenses={expenses}
                  currency={activeCurrency}
                  language={localLang}
                />

                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={onExportData}
                    className="p-4 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 flex flex-col items-center gap-2 transition-all cursor-pointer"
                  >
                    <Download className="w-5 h-5 text-emerald-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Exportar JSON</span>
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => fileInputRef.current?.click()}
                    className="p-4 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 flex flex-col items-center gap-2 transition-all cursor-pointer"
                  >
                    <Upload className="w-5 h-5 text-teal-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Restaurar</span>
                  </motion.button>
                  <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
                </div>
              </div>

              {/* Danger Zone */}
              <div className="pt-4 border-t border-white/5 space-y-4 pb-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-rose-500 px-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Zona Crítica
                </div>

                <button
                  onClick={() => { setCountdown(10); setShowConfirmResetAll(true); }}
                  className="w-full p-5 rounded-[2rem] bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/10 flex items-center justify-between transition-all group cursor-pointer"
                >
                  <div className="text-left">
                    <div className="text-sm font-black text-rose-400">Redefinir SisFinz</div>
                    <div className="text-[10px] font-bold text-rose-500/60 uppercase tracking-widest">Apagar todos os dados financeiros</div>
                  </div>
                  <Trash2 className="w-5 h-5 text-rose-500/40 group-hover:text-rose-500 transition-colors" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* Factory Reset Modal */}
    <AnimatePresence>
      {showConfirmResetAll && (
        <div key="settings-reset-modal-root" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 settings-backdrop"
              onClick={() => setShowConfirmResetAll(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="settings-confirm-solid w-full max-w-md p-8 rounded-[3rem] text-center relative z-10"
            >
              <div className="w-20 h-20 rounded-[2.5rem] bg-rose-500/20 border border-rose-500/30 flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-10 h-10 text-rose-500 animate-pulse" />
              </div>
              
              <h4 className="text-2xl font-black text-white tracking-tight mb-3">Atenção Total!</h4>
              <p className="text-sm font-medium text-slate-400 leading-relaxed mb-6">
                Você está prestes a apagar permanentemente todos os seus registros, metas, históricos e contas. Esta ação não pode ser desfeita.
              </p>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-8">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Trava de Segurança</div>
                <div className="text-2xl font-black text-rose-500 font-mono">
                  {countdown > 0 ? `00:0${countdown}` : 'DESBLOQUEADO'}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  disabled={countdown > 0 || isResetting}
                  onClick={async () => {
                    setIsResetting(true);
                    await onResetAllData();
                    setShowConfirmResetAll(false);
                    onClose();
                  }}
                  className="h-16 rounded-3xl bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-widest text-sm shadow-2xl shadow-rose-600/30 transition-all disabled:opacity-40"
                >
                  {isResetting ? 'Formatando...' : 'Confirmar Formatação'}
                </button>
                <button
                  onClick={() => setShowConfirmResetAll(false)}
                  className="h-14 rounded-3xl bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-[10px] transition-all"
                >
                  Cancelar Operação
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
