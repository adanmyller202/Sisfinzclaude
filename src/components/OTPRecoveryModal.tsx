import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, CheckCircle2, Loader2, X, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { LanguageCode } from '../types';
import { getTranslations } from '../utils/i18n';
import { motion, AnimatePresence } from 'motion/react';

interface OTPRecoveryModalProps {
  onClose: () => void;
  language: LanguageCode;
}

export const OTPRecoveryModal: React.FC<OTPRecoveryModalProps> = ({ onClose, language }) => {
  const t = getTranslations(language);
  const { resetPassword } = useAuth();
  
  const [step, setStep] = useState<'email' | 'success'>('email');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResetPassword = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;
    
    setLoading(true);
    setError(null);
    try {
      await resetPassword(cleanEmail);
      setStep('success');
    } catch (e: any) {
      console.error('Password reset failed:', e);
      setError(e.message || t.otpErrorRequest);
    } finally {
      setLoading(false);
    }
  };

  const successMessage = language === 'es'
    ? 'Enviamos un enlace a tu e-mail. Revisa también el spam.'
    : 'Enviamos um link para o seu e-mail. Verifique também o spam.';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 overflow-hidden overscroll-contain">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass-overlay"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="glass-modal w-full max-w-md rounded-[2.5rem] p-8 sm:p-10 space-y-8 relative z-10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 right-0 p-6">
          <button 
            onClick={onClose} 
            className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-center space-y-4 pt-4">
          <div className="w-16 h-16 rounded-[1.5rem] bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              {step === 'success' ? t.otpSuccessTitle : t.otpRecoveryTitle}
            </h2>
            <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-[240px] mx-auto mt-2">
              {step === 'email' 
                ? (language === 'es' ? 'Introduce tu correo para recuperar acceso.' : 'Informe seu e-mail para recuperar o acesso.')
                : successMessage}
            </p>
          </div>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-3"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="font-bold leading-snug">{error}</span>
          </motion.div>
        )}
        
        {step === 'email' ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">E-mail de Cadastro</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                <input 
                  type="email" 
                  placeholder={t.otpEmailPlaceholder} 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  className="w-full pl-12 pr-6 h-14 rounded-2xl bg-white/5 border border-white/10 text-white text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleResetPassword} 
              disabled={loading || !email.trim()}
              className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Mail className="w-4 h-4" /> 
                  <span>{t.authSubmitForgot || 'Enviar Link'}</span>
                </>
              )}
            </motion.button>
          </div>
        ) : (
          <div className="text-center space-y-6 pt-2">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto border-4 border-emerald-500/30">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onClose} 
              className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-600/20 transition-all flex items-center justify-center gap-3 cursor-pointer"
            >
              <span>{t.otpBackToLogin}</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </div>
        )}
        
        {step !== 'success' && (
          <button 
            onClick={onClose} 
            className="w-full text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors py-2 cursor-pointer"
          >
            {t.cancelBtn}
          </button>
        )}
      </motion.div>
    </div>
  );
};
