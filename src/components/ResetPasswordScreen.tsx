import React, { useState, useEffect } from 'react';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '../firebase/config';
import { LanguageCode } from '../types';
import { LANGUAGES, getTranslations } from '../utils/i18n';
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle, Sparkles, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ResetPasswordScreenProps {
  oobCode: string;
  language?: LanguageCode;
  onSelectLanguage?: (lang: LanguageCode) => void;
  onSuccess: () => void;
}

export const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({
  oobCode,
  language = 'pt',
  onSelectLanguage,
  onSuccess,
}) => {
  const [currentLang, setCurrentLang] = useState<LanguageCode>(language);
  const t = getTranslations(currentLang);

  const [isLoadingCode, setIsLoadingCode] = useState(true);
  const [codeValid, setCodeValid] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [localError, setLocalError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    verifyPasswordResetCode(auth, oobCode)
      .then((email) => {
        if (isMounted) {
          setUserEmail(email);
          setCodeValid(true);
          setIsLoadingCode(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setCodeValid(false);
          setIsLoadingCode(false);
        }
      });
    return () => { isMounted = false; };
  }, [oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!newPassword) { setLocalError(t.authErrorPasswordRequired); return; }
    if (newPassword.length < 6) { setLocalError(t.authErrorPasswordShort); return; }
    if (newPassword !== confirmPassword) { setLocalError(t.authErrorPasswordMismatch); return; }
    setIsSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setIsSuccess(true);
    } catch (err: any) {
      setLocalError(err.message || 'Falha ao redefinir a senha.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100svh] w-full flex flex-col items-center justify-start sm:justify-center p-4 sm:p-6 pt-20 sm:pt-8 pb-8 text-slate-900 dark:text-slate-100 relative box-border overflow-x-hidden overflow-y-auto overscroll-y-auto mesh-gradient">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/10 rounded-full blur-[120px] animate-pulse" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md glass-modal rounded-[3rem] p-8 sm:p-10 space-y-8 my-4 sm:my-auto"
      >
        <div className="text-center space-y-4">
          <div className="relative mx-auto w-24 h-24 rounded-[2rem] overflow-hidden shadow-xl border border-slate-200/80">
            <img src="/assets/aistudio/image_89b2520a.jpeg" alt="SisFinz" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center justify-center gap-2">SisFinz</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/70 mt-2">{t.resetPasswordTitle}</p>
          </div>
        </div>

        {isLoadingCode ? (
          <div className="text-center py-12 space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mx-auto" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Validando Link...</p>
          </div>
        ) : !codeValid ? (
          <div className="space-y-8 text-center py-4">
            <div className="w-20 h-20 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto text-rose-500"><AlertCircle className="w-10 h-10" /></div>
            <div className="space-y-2">
              <p className="text-lg font-black text-white">{t.invalidOrExpiredLink}</p>
              <p className="text-xs font-medium text-slate-400">O link de recuperação não é mais válido ou já foi utilizado.</p>
            </div>
            <button onClick={onSuccess} className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all">Voltar ao Login</button>
          </div>
        ) : isSuccess ? (
          <div className="space-y-8 text-center py-4 animate-in zoom-in duration-500">
            <div className="w-20 h-20 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto text-emerald-400"><CheckCircle2 className="w-10 h-10" /></div>
            <div className="space-y-2">
              <p className="text-lg font-black text-white">Senha Redefinida!</p>
              <p className="text-xs font-medium text-slate-400">{t.passwordResetSuccessMsg}</p>
            </div>
            <motion.button whileTap={{ scale: 0.95 }} onClick={onSuccess} className="w-full h-16 rounded-[1.5rem] bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-[0.2em] shadow-2xl transition-all flex items-center justify-center gap-3">Acessar Conta <ArrowRight className="w-4 h-4" /></motion.button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {userEmail && <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center"><div className="text-[9px] font-black uppercase tracking-tighter text-slate-600 mb-1">Recuperando conta</div><div className="text-xs font-black text-emerald-400 font-mono">{userEmail}</div></div>}
            
            {localError && <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-start gap-3"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{localError}</span></div>}

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Nova Senha</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                <input type={showPassword ? 'text' : 'password'} required value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full h-14 pl-12 pr-12 rounded-2xl bg-white/5 border border-white/10 text-white text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-600" placeholder="Mínimo 6 caracteres" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Confirmar Nova Senha</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                <input type={showConfirmPassword ? 'text' : 'password'} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full h-14 pl-12 pr-12 rounded-2xl bg-white/5 border border-white/10 text-white text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-600" placeholder="Repita a nova senha" />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">{showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              </div>
            </div>

            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} disabled={isSubmitting} className="w-full h-16 rounded-[1.5rem] bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-3">
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Nova Senha'}
              {!isSubmitting && <ArrowRight className="w-5 h-5" />}
            </motion.button>
          </form>
        )}
      </motion.div>
    </div>
  );
};
