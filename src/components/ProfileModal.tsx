import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { CurrencyCode, LanguageCode, AppSettings } from '../types';
import { CURRENCIES } from '../utils/currency';
import { LANGUAGES, getTranslations } from '../utils/i18n';
import {
  User,
  X,
  LogOut,
  Mail,
  Settings,
  Calendar,
  Globe,
  Coins,
  ShieldCheck,
  KeyRound,
  Trash2,
  AlertTriangle,
  Lock,
  ChevronRight,
  Camera,
  Upload,
  Check,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  currency: CurrencyCode;
  language?: LanguageCode;
  onOpenSettings: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  currency,
  language = 'pt',
  onOpenSettings,
}) => {
  const { user, signOutUser, updateDisplayName, updateUserPhoto, changeUserPassword, changeUserEmail, deleteUserAccount } = useAuth();
  const t = getTranslations(language);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoSuccess, setPhotoSuccess] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [nameInput, setNameInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [activeSecTab, setActiveSecTab] = useState<'none' | 'change_password' | 'delete_account'>('none');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [secLoading, setSecLoading] = useState(false);
  const [secError, setSecError] = useState<string | null>(null);
  const [secSuccess, setSecSuccess] = useState<string | null>(null);

  // In-modal Delete Account state
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteAcknowledged, setDeleteAcknowledged] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError(language === 'es' ? 'Selecciona una imagen válida.' : 'Selecione uma imagem válida.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = Math.min(img.width, img.height);
        const startX = (img.width - size) / 2;
        const startY = (img.height - size) / 2;
        canvas.width = 160;
        canvas.height = 160;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, startX, startY, size, size, 0, 0, 160, 160);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setPhotoPreview(dataUrl);
          setPhotoError(null);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSavePhoto = async () => {
    if (!photoPreview) return;
    try {
      setPhotoLoading(true);
      setPhotoError(null);
      await updateUserPhoto(photoPreview);
      setPhotoSuccess(language === 'es' ? '¡Foto guardada con éxito!' : 'Foto salva com sucesso!');
      setPhotoPreview(null);
      setTimeout(() => setPhotoSuccess(null), 3000);
    } catch (err: unknown) {
      setPhotoError(err instanceof Error ? err.message : 'Error al guardar foto');
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleRemovePhoto = async () => {
    try {
      setPhotoLoading(true);
      setPhotoError(null);
      setPhotoPreview(null);
      await updateUserPhoto(null);
      setPhotoSuccess(language === 'es' ? 'Foto eliminada con éxito.' : 'Foto removida com sucesso.');
      setTimeout(() => setPhotoSuccess(null), 3000);
    } catch (err: unknown) {
      setPhotoError(err instanceof Error ? err.message : 'Error al eliminar foto');
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setSecError(language === 'es' ? 'Introduce tu contraseña actual.' : 'Digite sua senha atual.');
      return;
    }
    if (newPassword.length < 6) {
      setSecError(
        language === 'es'
          ? 'La nueva contraseña debe tener al menos 6 caracteres.'
          : 'A nova senha deve ter no mínimo 6 caracteres.'
      );
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setSecError(language === 'es' ? 'Las nuevas contraseñas no coinciden.' : 'As novas senhas não coincidem.');
      return;
    }
    try {
      setSecLoading(true);
      setSecError(null);
      await changeUserPassword(currentPassword, newPassword);
      setSecSuccess(language === 'es' ? 'Contraseña actualizada con éxito.' : 'Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => {
        setSecSuccess(null);
        setActiveSecTab('none');
      }, 2500);
    } catch (err: unknown) {
      setSecError(err instanceof Error ? err.message : 'Erro ao alterar senha.');
    } finally {
      setSecLoading(false);
    }
  };

  const handleConfirmDeleteAccount = async () => {
    if (!deleteAcknowledged) {
      setDeleteError(
        t.deleteAccountAcknowledge || 'Confirme que você está ciente de que esta ação é permanente.'
      );
      return;
    }

    const isGoogle = user?.providerData.some((p) => p.providerId === 'google.com');
    if (!isGoogle && !deletePassword.trim()) {
      setDeleteError(
        language === 'es'
          ? 'Por favor, introduce tu contraseña actual.'
          : language === 'en'
          ? 'Please enter your current password.'
          : 'Por favor, digite sua senha atual.'
      );
      return;
    }

    try {
      setIsDeleting(true);
      setDeleteError(null);
      await deleteUserAccount(isGoogle ? undefined : deletePassword);
      setActiveSecTab('none');
      onClose();
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : (t.deleteAccountError || 'Erro ao excluir conta.');
      setDeleteError(errorMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Lock body scroll when profile modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (user?.displayName) setNameInput(user.displayName);
    else setNameInput('');
    setSaveSuccess(false);
    setSaveError(null);
    setActiveSecTab('none');
    setSecError(null);
    setSecSuccess(null);
    setDeletePassword('');
    setDeleteAcknowledged(false);
    setDeleteError(null);
    setIsDeleting(false);
  }, [user?.displayName, isOpen]);

  if (!user) return null;

  const isGoogleUser = user.providerData.some((p) => p.providerId === 'google.com');
  const trimmedName = nameInput.trim().replace(/\s+/g, ' ');
  const currentName = (user.displayName || '').trim().replace(/\s+/g, ' ');
  const isSaveDisabled = isSaving || !trimmedName || trimmedName === currentName;

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaveDisabled) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await updateDisplayName(trimmedName);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar nome');
    } finally {
      setIsSaving(false);
    }
  };

  const userInitial = user.displayName
    ? user.displayName.charAt(0).toUpperCase()
    : user.email?.charAt(0).toUpperCase() || 'U';

  const userJoinedDate = user.metadata.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString(
        language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-ES' : 'en-US',
        { month: 'long', year: 'numeric' }
      )
    : (language === 'pt' ? 'Recente' : language === 'es' ? 'Reciente' : 'Recent');

  const containerVariants: any = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } },
    exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.2 } }
  };

  return createPortal((
    <>
      <AnimatePresence>
        {isOpen && (
          <div key="profile-modal-root" className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 overflow-hidden overscroll-contain">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="solid-overlay"
            onClick={onClose}
          />

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="solid-container w-full sm:max-w-md h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[90dvh] rounded-none sm:rounded-[2.5rem] overflow-hidden sm:my-auto flex flex-col relative z-50 pt-safe pb-safe shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between shrink-0 relative overflow-hidden bg-white">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent" />
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/30">
                  <User className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  {t.profile}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer relative z-10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 overflow-y-auto overscroll-contain flex-1 min-h-0 custom-scrollbar">
              {/* User Identity Card with Photo Management */}
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-[2rem] blur opacity-50 group-hover:opacity-100 transition duration-1000" />
                <div className="relative p-6 rounded-[2rem] bg-white/80 border border-slate-200/80 flex flex-col items-center text-center shadow-xs">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />

                  <div className="relative mb-3">
                    <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-4xl font-black text-white shadow-xl shadow-emerald-600/20 border-4 border-white/80 overflow-hidden relative">
                      {photoPreview || user.photoURL ? (
                        <img
                          src={photoPreview || user.photoURL || ''}
                          alt="Foto de perfil"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{userInitial}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title={language === 'es' ? 'Cambiar foto de perfil' : 'Alterar foto de perfil'}
                      className="absolute bottom-0 right-0 p-2.5 rounded-xl bg-white border border-slate-200/80 text-emerald-600 shadow-md hover:scale-110 hover:bg-emerald-50 transition-all cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Photo Action Controls */}
                  {photoPreview ? (
                    <div className="w-full mb-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
                      <div className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">
                        {language === 'es' ? 'Previsualización de la foto' : 'Pré-visualização da foto'}
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          disabled={photoLoading}
                          onClick={handleSavePhoto}
                          className="px-4 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          {photoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          <span>{language === 'es' ? 'Guardar foto' : 'Salvar foto'}</span>
                        </button>
                        <button
                          type="button"
                          disabled={photoLoading}
                          onClick={() => setPhotoPreview(null)}
                          className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
                        >
                          {language === 'es' ? 'Cancelar' : 'Cancelar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[10px] font-black uppercase tracking-wider border border-emerald-200 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Upload className="w-3 h-3" />
                        <span>{user.photoURL ? (language === 'es' ? 'Cambiar foto' : 'Trocar foto') : (language === 'es' ? 'Subir foto' : 'Enviar foto')}</span>
                      </button>
                      {user.photoURL && (
                        <button
                          type="button"
                          disabled={photoLoading}
                          onClick={handleRemovePhoto}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 text-[10px] font-black uppercase tracking-wider border border-rose-200 transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>{language === 'es' ? 'Eliminar foto' : 'Remover'}</span>
                        </button>
                      )}
                    </div>
                  )}

                  {photoSuccess && (
                    <div className="mb-2 text-xs font-bold text-emerald-600 animate-in fade-in">
                      {photoSuccess}
                    </div>
                  )}
                  {photoError && (
                    <div className="mb-2 text-xs font-bold text-rose-600 animate-in fade-in">
                      {photoError}
                    </div>
                  )}
                  
                  <h4 className="text-xl font-black text-slate-900 tracking-tight mb-1">
                    {user.displayName || (language === 'pt' ? 'Explorador Financeiro' : 'Usuario')}
                  </h4>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-widest">
                    <Mail className="w-3.5 h-3.5" />
                    {user.email}
                  </div>

                  <div className="mt-4 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-700 uppercase tracking-widest">
                    Membro desde {userJoinedDate}
                  </div>
                </div>
              </div>

              {/* Editable Name Field */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                  Nome de Exibição
                </label>
                <form onSubmit={handleSaveName} className="flex gap-2">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="flex-1 h-12 bg-white/80 border border-slate-200/80 rounded-2xl px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/60 transition-all shadow-xs"
                    placeholder="Seu nome"
                  />
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    disabled={isSaveDisabled}
                    className="h-12 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest disabled:opacity-40 transition-all cursor-pointer shadow-xs"
                  >
                    {isSaving ? '...' : 'Salvar'}
                  </motion.button>
                </form>
                {saveSuccess && <p className="text-[10px] font-bold text-emerald-600 ml-1">Nome atualizado com sucesso!</p>}
              </div>

              {/* Preferences Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-white/80 border border-slate-200/80 shadow-xs">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                    <Coins className="w-3.5 h-3.5 text-emerald-600" />
                    Moeda
                  </div>
                  <div className="text-sm font-bold text-slate-900">
                    {CURRENCIES[currency]?.symbol} {currency}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-white/80 border border-slate-200/80 shadow-xs">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                    <Globe className="w-3.5 h-3.5 text-blue-600" />
                    Idioma
                  </div>
                  <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>{LANGUAGES[language]?.flag}</span>
                    <span>{LANGUAGES[language]?.name}</span>
                  </div>
                </div>
              </div>

              {/* Quick Settings Access */}
              <button
                onClick={() => { onClose(); onOpenSettings(); }}
                className="w-full p-4 rounded-2xl bg-white/80 hover:bg-white border border-slate-200/80 flex items-center justify-between transition-all group cursor-pointer shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 group-hover:text-slate-900 transition-colors">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-black text-slate-900">Configurações Gerais</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Temas, Backup e Sons</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-700 transition-colors" />
              </button>

              {/* Security & Danger Zone */}
              <div className="pt-4 border-t border-slate-200/60 space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Segurança & Privacidade
                </div>
                
                <div className="grid gap-2">
                  {!isGoogleUser && (
                    <button 
                      onClick={() => {
                        setActiveSecTab(activeSecTab === 'change_password' ? 'none' : 'change_password');
                        setSecError(null);
                        setSecSuccess(null);
                      }}
                      className="w-full p-3.5 rounded-2xl bg-white/80 border border-slate-200/80 flex items-center gap-3 text-sm font-bold text-slate-700 hover:text-slate-900 transition-all cursor-pointer shadow-xs"
                    >
                      <KeyRound className="w-4 h-4 text-emerald-600" />
                      Alterar Senha
                    </button>
                  )}

                  {activeSecTab === 'change_password' && !isGoogleUser && (
                    <form onSubmit={handleChangePassword} className="p-4 rounded-2xl bg-white border border-slate-200/80 space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          {language === 'es' ? 'Contraseña actual' : 'Senha atual'}
                        </label>
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          {language === 'es' ? 'Nueva contraseña' : 'Nova senha'}
                        </label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          {language === 'es' ? 'Confirmar nueva contraseña' : 'Confirmar nova senha'}
                        </label>
                        <input
                          type="password"
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      {secError && (
                        <div className="text-[11px] font-bold text-rose-600">
                          {secError}
                        </div>
                      )}
                      {secSuccess && (
                        <div className="text-[11px] font-bold text-emerald-600">
                          {secSuccess}
                        </div>
                      )}
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSecTab('none');
                            setSecError(null);
                          }}
                          className="flex-1 h-9 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold transition-colors cursor-pointer"
                        >
                          {language === 'es' ? 'Cancelar' : 'Cancelar'}
                        </button>
                        <button
                          type="submit"
                          disabled={secLoading}
                          className="flex-1 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {secLoading ? '...' : (language === 'es' ? 'Guardar' : 'Salvar')}
                        </button>
                      </div>
                    </form>
                  )}
                  
                  <button 
                    onClick={() => {
                      setActiveSecTab(activeSecTab === 'delete_account' ? 'none' : 'delete_account');
                      setDeleteError(null);
                      setDeletePassword('');
                      setDeleteAcknowledged(false);
                    }}
                    className={`w-full p-3.5 rounded-2xl border flex items-center justify-between text-sm font-bold transition-all cursor-pointer ${
                      activeSecTab === 'delete_account'
                        ? 'bg-rose-100/90 border-rose-300 text-rose-700'
                        : 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Trash2 className="w-4 h-4" />
                      <span>{t.deleteAccountTitle || 'Excluir Conta'}</span>
                    </div>
                    <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${activeSecTab === 'delete_account' ? 'rotate-90 text-rose-600' : 'text-rose-400'}`} />
                  </button>

                  {/* SisFinz Customized In-Modal Account Deletion Confirmation */}
                  {activeSecTab === 'delete_account' && (
                    <div className="p-4 rounded-2xl bg-rose-50/90 border border-rose-200 space-y-4">
                      {/* Warning notice */}
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-rose-200/80 text-rose-700 flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-black text-rose-950 uppercase tracking-tight">
                            {t.deleteAccountTitle}
                          </h4>
                          <p className="text-[11px] text-rose-800 leading-relaxed mt-1 font-medium">
                            {t.deleteAccountWarning}
                          </p>
                        </div>
                      </div>

                      {/* Explicit confirmation checkbox required */}
                      <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-rose-200 text-xs text-rose-950 cursor-pointer select-none shadow-xs">
                        <input
                          type="checkbox"
                          checked={deleteAcknowledged}
                          onChange={(e) => setDeleteAcknowledged(e.target.checked)}
                          disabled={isDeleting}
                          className="mt-0.5 rounded border-rose-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                        />
                        <span className="font-bold leading-snug">{t.deleteAccountAcknowledge}</span>
                      </label>

                      {/* Identity Verification Step */}
                      {isGoogleUser ? (
                        <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1.5 text-xs text-slate-700 shadow-xs">
                          <div className="flex items-center gap-2 font-bold text-slate-800">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <span>Google Account</span>
                          </div>
                          <p className="font-medium text-slate-600 leading-relaxed">{t.deleteAccountGoogleNotice}</p>
                          <p className="text-[11px] text-slate-400 leading-relaxed">{t.deleteAccountGoogleSafariTip}</p>
                        </div>
                      ) : (
                        <div className="space-y-1.5 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-slate-500" />
                            <span>{t.deleteAccountPasswordLabel}</span>
                          </label>
                          <input
                            type="password"
                            disabled={isDeleting}
                            value={deletePassword}
                            onChange={(e) => setDeletePassword(e.target.value)}
                            placeholder={t.deleteAccountPasswordPlaceholder}
                            className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs text-slate-900 focus:outline-none focus:border-rose-500 disabled:opacity-50"
                          />
                        </div>
                      )}

                      {/* Error feedback */}
                      {deleteError && (
                        <div className="p-3 rounded-xl bg-rose-100 border border-rose-300 text-xs font-bold text-rose-800 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                          <span>{deleteError}</span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => {
                            setActiveSecTab('none');
                            setDeleteError(null);
                            setDeletePassword('');
                            setDeleteAcknowledged(false);
                          }}
                          className="flex-1 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {t.deleteAccountCancel}
                        </button>
                        <button
                          type="button"
                          disabled={isDeleting || !deleteAcknowledged || (!isGoogleUser && !deletePassword.trim())}
                          onClick={handleConfirmDeleteAccount}
                          className="flex-1 h-10 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-rose-600/30 cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
                        >
                          {isDeleting ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>{t.deleteAccountDeleting}</span>
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{t.deleteAccountConfirmBtn}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer / Logout */}
            <div className="p-6 border-t border-slate-200/60 bg-white/40">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { onClose(); signOutUser(); }}
                className="w-full h-14 rounded-2xl bg-white hover:bg-rose-50 border border-slate-200/80 hover:border-rose-300 text-rose-600 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer group shadow-xs"
              >
                <LogOut className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                Sair da Conta
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  </>
  ), document.body);
};
