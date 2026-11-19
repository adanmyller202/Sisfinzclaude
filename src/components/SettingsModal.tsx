import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppSettings, CurrencyCode, LanguageCode, BillItem, IncomeItem, ExpenseItem } from '../types';
import { CURRENCIES } from '../utils/currency';
import { LANGUAGES, getTranslations } from '../utils/i18n';
import { CategoryManager } from './CategoryManager';
import { DisplayCategory } from '../hooks/useCategories';
import { CategoryScope, CustomCategory } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  ColorThemeId,
  FACTORY_THEME,
  PASTEL_COLOR_THEMES,
  applyColorTheme,
  getSavedColorThemeId,
} from '../utils/colorTheme';
import {
  Settings,
  X,
  Moon,
  Sun,
  Globe,
  Download,
  Upload,
  Trash2,
  Volume2,
  VolumeX,
  AlertTriangle,
  ChevronDown,
  Layout,
  Palette,
  ShieldAlert,
  Tag,
  Check,
  RotateCcw,
  Sparkles,
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
  categories?: DisplayCategory[];
  onAddCategory?: (name: string, scope: CategoryScope, color?: string) => Promise<CustomCategory>;
  onUpdateCategory?: (id: string, partial: { name?: string; scope?: CategoryScope; color?: string }) => Promise<void>;
  onDeleteCategory?: (id: string) => Promise<void>;
  onResetPredefinedCategories?: () => Promise<void>;
}

interface SettingsAccordionProps {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const SettingsAccordion: React.FC<SettingsAccordionProps> = ({
  id,
  title,
  subtitle,
  icon: Icon,
  open,
  onToggle,
  children,
}) => {
  const sectionRef = useRef<HTMLElement>(null);
  React.useEffect(() => {
    if (open) sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [open]);

  return (
    <section
      ref={sectionRef}
      className="rounded-3xl border border-emerald-100 bg-white shadow-sm overflow-hidden"
      data-section={id}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={`w-full flex items-center gap-3 p-4 text-left transition-colors active:bg-emerald-50 hover:bg-emerald-50/70 cursor-pointer ${
          open ? 'bg-emerald-50/70' : 'bg-white'
        }`}
      >
        <span className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-black text-slate-900">{title}</span>
          <span className="block text-[10px] font-medium text-slate-500 mt-0.5">{subtitle}</span>
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="text-emerald-700"
        >
          <ChevronDown className="w-5 h-5" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="accordion-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: { duration: 0.38, ease: [0.16, 1, 0.3, 1] }, opacity: { duration: 0.22 } }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-5 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onExportData,
  onImportData,
  onResetAllData,
  language,
  categories = [],
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onResetPredefinedCategories,
}) => {
  const [localLang, setLocalLang] = useState<LanguageCode>(language || settings.language || 'pt');
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [activeThemeId, setActiveThemeId] = useState<ColorThemeId>(() => getSavedColorThemeId());
  const { user } = useAuth();
  const contentRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setOpenSection(null);
      setActiveThemeId(getSavedColorThemeId());
      requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: 'auto' }));
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (language) setLocalLang(language);
    else if (settings.language) setLocalLang(settings.language);
  }, [language, settings.language]);

  const t = getTranslations(localLang);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<{ success: boolean; msg: string } | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showConfirmResetAll, setShowConfirmResetAll] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [isResetting, setIsResetting] = useState(false);

  const handleSelectColorTheme = (id: ColorThemeId) => {
    setActiveThemeId(id);
    applyColorTheme(id);
  };

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
    return () => {
      if (timer) clearInterval(timer);
    };
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
    exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.2 } },
  };

  const getThemeName = (theme: typeof FACTORY_THEME) =>
    localLang === 'es' ? theme.nameEs : localLang === 'en' ? theme.nameEn : theme.name;
  const getThemeSub = (theme: typeof FACTORY_THEME) =>
    localLang === 'es' ? theme.subtitleEs : localLang === 'en' ? theme.subtitleEn : theme.subtitle;

  return createPortal(
    <>
      <AnimatePresence>
        {isOpen && (
          <div
            key="settings-modal-root"
            className="fixed inset-0 z-[70] flex items-center justify-center p-0 sm:p-4 overflow-hidden overscroll-contain"
          >
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
              className="settings-panel-solid w-full sm:max-w-2xl h-[100dvh] max-h-[100dvh] sm:h-[92dvh] sm:max-h-[92dvh] rounded-none sm:rounded-[2rem] shadow-2xl overflow-hidden sm:my-auto flex flex-col relative z-10 pt-safe pb-safe touch-pan-y"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-emerald-100 flex items-center justify-between shrink-0 relative bg-[#ECFDF5] z-20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white text-emerald-700 flex items-center justify-center border border-emerald-100 shadow-sm">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">{t.settingsTitle}</h3>
                    <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mt-0.5">
                      {t.settingsSubtitle}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-xl text-slate-500 hover:text-emerald-800 hover:bg-emerald-100 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div
                ref={contentRef}
                className="p-5 sm:p-6 space-y-5 overflow-y-auto overscroll-y-contain flex-1 min-h-0 custom-scrollbar touch-pan-y"
                style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
              >
                <div className="flex items-center gap-3 rounded-3xl border border-emerald-100 bg-[#F0FDF7] p-4">
                  <div className="w-12 h-12 rounded-2xl overflow-hidden bg-emerald-600 text-white flex items-center justify-center text-lg font-black shrink-0 border border-white shadow-sm">
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt="Foto de perfil" className="w-full h-full object-cover" />
                    ) : (
                      (user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U').toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-black text-slate-900 truncate">
                      {user?.displayName || (localLang === 'es' ? 'Mi perfil' : 'Meu perfil')}
                    </div>
                    <div className="text-xs text-slate-600 truncate">{user?.email || ''}</div>
                  </div>
                </div>

                {importStatus && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className={`p-4 text-xs font-bold rounded-2xl border ${
                      importStatus.success
                        ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-700 border-rose-500/20'
                    }`}
                  >
                    {importStatus.msg}
                  </motion.div>
                )}

                {/* Styles Color Accordion */}
                <SettingsAccordion
                  id="styles-color"
                  title="Styles Color"
                  subtitle={
                    localLang === 'es'
                      ? '10 paletas pastel + estilo original de fábrica'
                      : localLang === 'en'
                      ? '10 pastel palettes + original factory default'
                      : '10 paletas pastéis + padrão original de fábrica'
                  }
                  icon={Sparkles}
                  open={openSection === 'styles-color'}
                  onToggle={() => setOpenSection((current) => (current === 'styles-color' ? null : 'styles-color'))}
                >
                  <div className="space-y-4 pt-2">
                    {/* Factory Default Card */}
                    <div
                      data-theme-preview
                      className="rounded-2xl border-2 p-3.5 transition-all"
                      style={{
                        backgroundColor: FACTORY_THEME.preview.bg,
                        borderColor: activeThemeId === 'factory' ? FACTORY_THEME.preview.accent : '#D1FAE5',
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            data-theme-preview
                            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-white"
                            style={{
                              background: `linear-gradient(135deg, ${FACTORY_THEME.preview.accent}, ${FACTORY_THEME.preview.accentDark})`,
                            }}
                          >
                            {activeThemeId === 'factory' ? (
                              <Check className="w-5 h-5 text-white stroke-[3]" />
                            ) : (
                              <RotateCcw className="w-5 h-5 text-white" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-slate-900 truncate">
                                {getThemeName(FACTORY_THEME)}
                              </span>
                              <span
                                data-theme-preview
                                className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
                                style={{
                                  backgroundColor: FACTORY_THEME.preview.soft,
                                  color: FACTORY_THEME.preview.accentDark,
                                }}
                              >
                                {localLang === 'es' ? 'Fábrica' : localLang === 'en' ? 'Factory' : 'Fábrica'}
                              </span>
                            </div>
                            <p className="text-[11px] font-medium text-slate-600 truncate mt-0.5">
                              {getThemeSub(FACTORY_THEME)}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSelectColorTheme('factory')}
                          disabled={activeThemeId === 'factory'}
                          data-theme-preview
                          className="shrink-0 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer disabled:cursor-default"
                          style={{
                            backgroundColor:
                              activeThemeId === 'factory' ? FACTORY_THEME.preview.soft : FACTORY_THEME.preview.accent,
                            color: activeThemeId === 'factory' ? FACTORY_THEME.preview.accentDark : '#FFFFFF',
                          }}
                        >
                          {activeThemeId === 'factory'
                            ? localLang === 'es'
                              ? 'Activo'
                              : localLang === 'en'
                              ? 'Active'
                              : 'Ativo'
                            : localLang === 'es'
                            ? 'Restaurar'
                            : localLang === 'en'
                            ? 'Restore'
                            : 'Restaurar'}
                        </button>
                      </div>
                    </div>

                    {/* 10 Pastel Palettes Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {PASTEL_COLOR_THEMES.map((theme) => {
                        const isSelected = activeThemeId === theme.id;
                        return (
                          <motion.button
                            type="button"
                            key={theme.id}
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => handleSelectColorTheme(theme.id)}
                            data-theme-preview
                            className="group relative rounded-2xl border-2 p-3 text-left transition-all cursor-pointer overflow-hidden shadow-2xs"
                            style={{
                              backgroundColor: theme.preview.bg,
                              borderColor: isSelected ? theme.preview.accent : theme.preview.soft,
                              boxShadow: isSelected ? `0 8px 20px -6px rgba(${theme.accentRgb}, 0.35)` : undefined,
                            }}
                          >
                            {/* Mini App Preview */}
                            <div
                              data-theme-preview
                              className="rounded-xl p-2 border mb-2.5 space-y-1.5"
                              style={{
                                backgroundColor: '#FFFFFF',
                                borderColor: theme.preview.soft,
                              }}
                            >
                              <div className="flex items-center justify-between gap-1.5">
                                <div
                                  data-theme-preview
                                  className="h-2 w-12 rounded-full"
                                  style={{ backgroundColor: theme.preview.accent }}
                                />
                                <div
                                  data-theme-preview
                                  className="h-3 w-3 rounded-full"
                                  style={{ backgroundColor: theme.preview.soft }}
                                />
                              </div>
                              <div
                                data-theme-preview
                                className="h-5 w-full rounded-lg flex items-center justify-between px-1.5"
                                style={{ backgroundColor: theme.preview.soft }}
                              >
                                <span
                                  data-theme-preview
                                  className="h-1.5 w-8 rounded-full"
                                  style={{ backgroundColor: theme.preview.accentDark }}
                                />
                                <span
                                  data-theme-preview
                                  className="h-2.5 w-6 rounded-md"
                                  style={{ backgroundColor: theme.preview.accent }}
                                />
                              </div>
                            </div>

                            {/* Palette Label */}
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="min-w-0">
                                <div className="text-xs font-black text-slate-900 truncate">
                                  {getThemeName(theme)}
                                </div>
                                <div className="text-[10px] font-medium text-slate-500 truncate">
                                  {getThemeSub(theme)}
                                </div>
                              </div>

                              <span
                                data-theme-preview
                                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 border-white shadow-xs transition-transform"
                                style={{
                                  backgroundColor: isSelected ? theme.preview.accent : theme.preview.soft,
                                }}
                              >
                                {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                              </span>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                </SettingsAccordion>

                <SettingsAccordion
                  id="regional"
                  title="Idiomas e Moeda"
                  subtitle="Idioma e moeda principal do aplicativo"
                  icon={Globe}
                  open={openSection === 'regional'}
                  onToggle={() => setOpenSection((current) => (current === 'regional' ? null : 'regional'))}
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">
                      <Globe className="w-3.5 h-3.5 text-blue-500" />
                      Regional & Localização
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Idioma */}
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-500 ml-1">Idioma</label>
                        <div className="grid grid-cols-3 gap-2">
                          {(Object.keys(LANGUAGES) as LanguageCode[]).map((lang) => (
                            <button
                              type="button"
                              key={lang}
                              onClick={() => {
                                setLocalLang(lang);
                                onUpdateSettings({ language: lang });
                              }}
                              className={`h-14 rounded-2xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                                localLang === lang
                                  ? 'bg-blue-50 border-blue-400 text-blue-800'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-emerald-50'
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
                        <label className="text-[11px] font-bold text-slate-500 ml-1">Moeda</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(['BRL', 'USD', 'EUR', 'PYG'] as CurrencyCode[]).map((code) => (
                            <button
                              type="button"
                              key={code}
                              onClick={() => onUpdateSettings({ currency: code })}
                              className={`h-14 rounded-2xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                                settings.currency === code
                                  ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-emerald-50'
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
                </SettingsAccordion>

                <SettingsAccordion
                  id="appearance"
                  title="Aparência e Sons"
                  subtitle="Tema visual e efeitos sonoros"
                  icon={Palette}
                  open={openSection === 'appearance'}
                  onToggle={() => setOpenSection((current) => (current === 'appearance' ? null : 'appearance'))}
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">
                      <Palette className="w-3.5 h-3.5 text-amber-500" />
                      Experiência Visual
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => onUpdateSettings({ darkMode: false })}
                        className={`p-4 rounded-3xl border flex flex-col items-center gap-3 transition-all cursor-pointer ${
                          !settings.darkMode
                            ? 'bg-white text-slate-900 border-emerald-300 shadow-sm'
                            : 'bg-white/5 border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <Sun className={`w-6 h-6 ${!settings.darkMode ? 'text-amber-500' : ''}`} />
                        <span className="text-[11px] font-black uppercase tracking-widest">Modo Claro</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateSettings({ darkMode: true })}
                        className={`p-4 rounded-3xl border flex flex-col items-center gap-3 transition-all cursor-pointer ${
                          settings.darkMode
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                            : 'bg-white/5 border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <Moon className="w-6 h-6" />
                        <span className="text-[11px] font-black uppercase tracking-widest">Modo Escuro</span>
                      </button>
                    </div>

                    <div className="p-4 rounded-3xl bg-[#F0FDF7] border border-emerald-100 flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-emerald-700 group-hover:text-emerald-800 transition-colors border border-emerald-100">
                          {settings.soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="text-sm font-black text-slate-900">Efeitos Sonoros</div>
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            Confirmações e Toques
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
                        className={`w-14 h-8 rounded-full transition-all relative cursor-pointer ${
                          settings.soundEnabled ? 'bg-emerald-600' : 'bg-slate-400'
                        }`}
                      >
                        <div
                          className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all shadow-md ${
                            settings.soundEnabled ? 'right-1' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </SettingsAccordion>

                <SettingsAccordion
                  id="categories"
                  title="Categorias"
                  subtitle="Gerencie categorias de receitas e despesas"
                  icon={Tag}
                  open={openSection === 'categories'}
                  onToggle={() => setOpenSection((current) => (current === 'categories' ? null : 'categories'))}
                >
                  {onAddCategory && onUpdateCategory && onDeleteCategory && (
                    <section className="space-y-4">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-800 px-1">
                        <Tag className="w-3.5 h-3.5 text-emerald-600" />
                        Categorias
                      </div>
                      <CategoryManager
                        language={localLang}
                        allCategories={categories}
                        onAddCategory={onAddCategory}
                        onUpdateCategory={onUpdateCategory}
                        onDeleteCategory={onDeleteCategory}
                        onResetPredefined={onResetPredefinedCategories}
                      />
                    </section>
                  )}
                </SettingsAccordion>

                <SettingsAccordion
                  id="data"
                  title="Dados e Relatórios"
                  subtitle="Exportar e restaurar seus dados"
                  icon={Layout}
                  open={openSection === 'data'}
                  onToggle={() => setOpenSection((current) => (current === 'data' ? null : 'data'))}
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">
                      <Layout className="w-3.5 h-3.5 text-teal-500" />
                      Dados & Relatórios
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        onClick={onExportData}
                        className="p-4 rounded-3xl bg-emerald-50/60 border border-emerald-100 hover:bg-emerald-50 flex flex-col items-center gap-2 transition-all cursor-pointer text-slate-800"
                      >
                        <Download className="w-5 h-5 text-emerald-600" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Exportar JSON</span>
                      </motion.button>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        disabled={isRestoring}
                        onClick={() => fileInputRef.current?.click()}
                        className="p-4 rounded-3xl bg-emerald-50/60 border border-emerald-100 hover:bg-emerald-50 flex flex-col items-center gap-2 transition-all cursor-pointer text-slate-800 disabled:opacity-50"
                      >
                        <Upload className="w-5 h-5 text-teal-600" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          {isRestoring ? 'Restaurando...' : 'Restaurar'}
                        </span>
                      </motion.button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </div>
                  </div>
                </SettingsAccordion>

                <SettingsAccordion
                  id="danger"
                  title="Zona Crítica"
                  subtitle="Ações permanentes sobre seus dados"
                  icon={ShieldAlert}
                  open={openSection === 'danger'}
                  onToggle={() => setOpenSection((current) => (current === 'danger' ? null : 'danger'))}
                >
                  <div className="pt-2 space-y-4 pb-2">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-rose-500 px-1">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Zona Crítica
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setCountdown(10);
                        setShowConfirmResetAll(true);
                      }}
                      className="w-full p-5 rounded-[2rem] bg-rose-500/5 border border-rose-500/15 hover:bg-rose-500/10 flex items-center justify-between transition-all group cursor-pointer"
                    >
                      <div className="text-left">
                        <div className="text-sm font-black text-rose-600">Redefinir SisFinz</div>
                        <div className="text-[10px] font-bold text-rose-500/70 uppercase tracking-widest">
                          Apagar todos os dados financeiros
                        </div>
                      </div>
                      <Trash2 className="w-5 h-5 text-rose-500/50 group-hover:text-rose-600 transition-colors" />
                    </button>
                  </div>
                </SettingsAccordion>
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
              className="settings-confirm-solid w-full max-w-md p-8 rounded-[2rem] text-center relative z-10"
            >
              <div className="w-20 h-20 rounded-[2.5rem] bg-rose-500/20 border border-rose-500/30 flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-10 h-10 text-rose-500 animate-pulse" />
              </div>

              <h4 className="text-2xl font-black text-white tracking-tight mb-3">Atenção Total!</h4>
              <p className="text-sm font-medium text-slate-400 leading-relaxed mb-6">
                Você está prestes a apagar permanentemente todos os seus registros, metas, históricos e contas. Esta
                ação não pode ser desfeita.
              </p>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-8">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                  Trava de Segurança
                </div>
                <div className="text-2xl font-black text-rose-500 font-mono">
                  {countdown > 0 ? `00:0${countdown}` : 'DESBLOQUEADO'}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  disabled={countdown > 0 || isResetting}
                  onClick={async () => {
                    setIsResetting(true);
                    await onResetAllData();
                    setShowConfirmResetAll(false);
                    onClose();
                  }}
                  className="h-16 rounded-3xl bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-widest text-sm shadow-2xl shadow-rose-600/30 transition-all disabled:opacity-40 cursor-pointer"
                >
                  {isResetting ? 'Formatando...' : 'Confirmar Formatação'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmResetAll(false)}
                  className="h-14 rounded-3xl bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-[10px] transition-all cursor-pointer"
                >
                  Cancelar Operação
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
};
