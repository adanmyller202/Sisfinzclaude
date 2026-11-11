import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LanguageCode } from '../types';
import { getTranslations } from '../utils/i18n';
import { Mail, RefreshCw, CheckCircle2, LogOut, AlertCircle, Loader2, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface EmailVerificationScreenProps {
  language?: LanguageCode;
  onSelectLanguage?: (lang: LanguageCode) => void;
}

export const EmailVerificationScreen: React.FC<EmailVerificationScreenProps> = ({
  language = 'pt',
}) => {
  const t = getTranslations(language);
  const { user, sendVerificationEmail, reloadUser, signOutUser, authError, clearAuthError } = useAuth();
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [isChecking, setIsChecking] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown(p => p - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;
    clearAuthError();
    setIsResending(true);
    try {
      await sendVerificationEmail();
      setSuccessMessage(t.verificationEmailSent);
      setResendCooldown(60);
    } catch {} finally { setIsResending(false); }
  };

  const handleCheckVerified = async () => {
    clearAuthError();
    setIsChecking(true);
    try { await reloadUser(); } catch {} finally { setIsChecking(false); }
  };

  return (
    <div className="min-h-[100svh] w-full flex flex-col items-center justify-start sm:justify-center p-4 sm:p-6 pt-20 sm:pt-8 pb-8 text-slate-900 dark:text-slate-100 relative box-border overflow-x-hidden overflow-y-auto overscroll-y-auto mesh-gradient">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-amber-600/10 rounded-full blur-[120px] animate-pulse" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md glass-modal rounded-[3rem] p-8 sm:p-10 space-y-10 my-4 sm:my-auto text-center"
      >
        <div className="space-y-6">
          <div className="relative mx-auto w-24 h-24 rounded-[2rem] bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shadow-xs group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/20 to-orange-500/20 opacity-50" />
            <Mail className="w-10 h-10 text-amber-600 relative z-10 group-hover:scale-110 transition-transform duration-500" />
          </div>
          
          <div className="space-y-3">
            <h1 className="text-3xl font-black tracking-tight text-slate-900">{t.verifyEmailTitle}</h1>
            <p className="text-sm font-medium text-slate-600 leading-relaxed max-w-xs mx-auto">{t.verifyEmailSubtitle}</p>
            {user?.email && (
              <div className="inline-block px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[10px] font-black font-mono text-emerald-400 uppercase tracking-widest mt-2">
                {user.email}
              </div>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {authError && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-start gap-3 text-left">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </motion.div>
          )}
          {successMessage && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-start gap-3 text-left">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={isChecking}
            onClick={handleCheckVerified}
            className="w-full h-16 rounded-[1.5rem] bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {isChecking ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            Já Verifiquei
          </motion.button>

          <button
            disabled={isResending || resendCooldown > 0}
            onClick={handleResend}
            className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2 disabled:opacity-30"
          >
            <Send className={`w-4 h-4 ${isResending ? 'animate-pulse' : ''}`} />
            {resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : 'Reenviar E-mail'}
          </button>

          <button
            onClick={signOutUser}
            className="w-full h-14 rounded-2xl text-rose-400 font-black text-[10px] uppercase tracking-widest hover:bg-rose-500/10 transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sair da Conta
          </button>
        </div>
      </motion.div>
    </div>
  );
};
