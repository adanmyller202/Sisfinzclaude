import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LanguageCode } from '../types';
import { LANGUAGES, getTranslations } from '../utils/i18n';
import { OTPRecoveryModal } from './OTPRecoveryModal';
import { Lock, Mail, User as UserIcon, ArrowRight, Sparkles, CheckCircle2, AlertCircle, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type AuthMode = 'login' | 'signup' | 'forgot_password';

interface AuthScreenProps {
  language?: LanguageCode;
  onSelectLanguage?: (lang: LanguageCode) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  language = 'pt',
  onSelectLanguage,
}) => {
  const [currentLang, setCurrentLang] = useState<LanguageCode>(language);
  const t = getTranslations(currentLang);

  const { signUp, signIn, signInWithGoogle, resetPassword, authError, clearAuthError } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setLocalError(null);
    setResetSuccess(null);
    clearAuthError();
  };

  const handleLanguageChange = (l: LanguageCode) => {
    setCurrentLang(l);
    onSelectLanguage?.(l);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setResetSuccess(null);
    clearAuthError();

    if (!email.trim()) {
      setLocalError(t.authErrorEmailRequired);
      return;
    }

    if (mode === 'signup') {
      if (!name.trim()) {
        setLocalError(t.authErrorNameRequired);
        return;
      }
      if (password.length < 6) {
        setLocalError(t.authErrorPasswordShort);
        return;
      }
      if (password !== confirmPassword) {
        setLocalError(t.authErrorPasswordMismatch);
        return;
      }
      setIsSubmitting(true);
      try {
        await signUp(name, email, password, keepSignedIn);
      } catch {} finally {
        setIsSubmitting(false);
      }
    } else if (mode === 'login') {
      if (!password) {
        setLocalError(t.authErrorPasswordRequired);
        return;
      }
      setIsSubmitting(true);
      try {
        await signIn(email, password, keepSignedIn);
      } catch {} finally {
        setIsSubmitting(false);
      }
    } else if (mode === 'forgot_password') {
      setIsSubmitting(true);
      try {
        await resetPassword(email);
        setResetSuccess(t.authResetLinkSent);
      } catch {} finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setLocalError(null);
    setIsSubmitting(true);
    try {
      await signInWithGoogle(keepSignedIn);
    } catch {} finally {
      setIsSubmitting(false);
    }
  };

  const displayError = localError || authError;

  return (
    <div className="min-h-[100svh] w-full flex flex-col items-center justify-start sm:justify-center p-4 sm:p-6 pt-20 sm:pt-8 pb-8 text-slate-900 relative box-border overflow-x-hidden overflow-y-auto overscroll-y-auto mesh-gradient selection:bg-emerald-500/20">
      {/* Cinematic Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/15 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-teal-500/15 rounded-full blur-[120px] animate-pulse duration-7000" />
      </div>

      {/* Header Language Switcher */}
      <div className="absolute top-6 right-6 z-20 flex items-center gap-1.5 p-1 bg-white/70 backdrop-blur-xl rounded-2xl border border-white/80 shadow-md">
        {(Object.keys(LANGUAGES) as LanguageCode[]).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => handleLanguageChange(l)}
            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer ${
              currentLang === l
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {LANGUAGES[l].flag} {l}
          </button>
        ))}
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative w-full max-w-md bg-white/90 backdrop-blur-2xl rounded-[2rem] sm:rounded-[3rem] shadow-[0_30px_70px_rgba(16,185,129,0.12)] p-5 sm:p-10 space-y-6 sm:space-y-8 my-4 sm:my-auto border border-white/90"
      >
        {/* Brand Header */}
        <div className="text-center space-y-4">
          <div className="relative mx-auto w-24 h-24 rounded-[2rem] overflow-hidden shadow-xl border border-white/90 group">
            <img src="/assets/aistudio/image_89b2520a.jpeg" alt="SisFinz" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-600/10 to-transparent pointer-events-none" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center justify-center gap-2">
              SisFinz
              <Sparkles className="w-5 h-5 text-emerald-500" />
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700 mt-2 leading-none">
              {mode === 'login' ? 'Bem-vindo de volta' : mode === 'signup' ? 'Crie sua conta' : 'Recupere sua senha'}
            </p>
          </div>
        </div>

        {/* Temporary GitHub-to-AI-Studio sync test */}
        {mode === 'login' && (
          <div className="w-full rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-center text-sm font-black tracking-widest text-emerald-800">
            teste
          </div>
        )}

        {/* Tab Switcher */}
        {mode !== 'forgot_password' && (
          <div className="flex p-1 bg-slate-100/70 backdrop-blur-md rounded-2xl border border-slate-200/60">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer ${
                mode === 'login' ? 'bg-white text-emerald-950 shadow-md font-black' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer ${
                mode === 'signup' ? 'bg-white text-emerald-950 shadow-md font-black' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Criar Conta
            </button>
          </div>
        )}

        {/* Alerts */}
        <AnimatePresence mode="wait">
          {displayError && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 text-[11px] font-bold flex items-start gap-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{displayError}</span>
            </motion.div>
          )}
          {resetSuccess && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 text-[11px] font-bold flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{resetSuccess}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        {mode !== 'forgot_password' ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-5">
              {mode === 'signup' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 ml-1">Nome Completo</label>
                  <div className="relative group">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                    <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full h-14 pl-12 pr-6 rounded-2xl bg-white/70 border border-slate-200/80 text-slate-900 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400" placeholder="Seu nome" />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 ml-1">E-mail</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full h-14 pl-12 pr-6 rounded-2xl bg-white/70 border border-slate-200/80 text-slate-900 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400" placeholder="exemplo@email.com" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-600">Senha</label>
                  {mode === 'login' && <button type="button" onClick={() => switchMode('forgot_password')} className="text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 transition-colors">Esqueceu?</button>}
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                  <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full h-14 pl-12 pr-6 rounded-2xl bg-white/70 border border-slate-200/80 text-slate-900 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400" placeholder="••••••••" />
                </div>
              </div>

              {mode === 'signup' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 ml-1">Confirmar Senha</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                    <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full h-14 pl-12 pr-6 rounded-2xl bg-white/70 border border-slate-200/80 text-slate-900 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400" placeholder="••••••••" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 px-1">
              <input type="checkbox" id="keepSignedIn" checked={keepSignedIn} onChange={e => setKeepSignedIn(e.target.checked)} className="w-5 h-5 rounded-lg border-slate-300 bg-white text-emerald-600 focus:ring-emerald-500/20 cursor-pointer" />
              <label htmlFor="keepSignedIn" className="text-[11px] font-bold text-slate-600 cursor-pointer select-none">Manter conectado</label>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={isSubmitting}
              className="w-full h-16 rounded-[1.5rem] bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-emerald-600/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : mode === 'login' ? 'Acessar Conta' : 'Criar Conta'}
              {!isSubmitting && <ArrowRight className="w-5 h-5" />}
            </motion.button>
          </form>
        ) : (
          <OTPRecoveryModal onClose={() => switchMode('login')} language={currentLang} />
        )}

        {/* OAuth & Social */}
        {mode !== 'forgot_password' && (
          <div className="space-y-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200/80" /></div>
              <div className="relative flex justify-center text-[9px] font-black uppercase tracking-widest text-slate-500"><span className="bg-[#F4F8F6] px-4 rounded-full">Ou continue com</span></div>
            </div>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleGoogleSignIn}
              className="w-full h-14 rounded-2xl bg-white/80 border border-slate-200/80 hover:bg-white transition-all flex items-center justify-center gap-3 text-slate-800 text-xs font-black uppercase tracking-widest cursor-pointer group shadow-sm disabled:opacity-50"
            >
              <GoogleIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
              Google Workspace
            </button>
          </div>
        )}

        <div className="text-center pt-2">
          {mode === 'forgot_password' ? (
            <button onClick={() => switchMode('login')} className="text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 cursor-pointer">Voltar ao Login</button>
          ) : mode === 'login' ? (
            <button onClick={() => switchMode('signup')} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-800 transition-colors cursor-pointer">Não tem conta? <span className="text-emerald-600 font-black ml-1">Cadastre-se</span></button>
          ) : (
            <button onClick={() => switchMode('login')} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-800 transition-colors cursor-pointer">Já possui conta? <span className="text-emerald-600 font-black ml-1">Fazer Login</span></button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" opacity="0.8" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" opacity="0.6" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="currentColor" opacity="0.8" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
);

const Loader2 = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
);
