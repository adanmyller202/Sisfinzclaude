import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera,
  Image as ImageIcon,
  X,
  Check,
  Loader2,
  Receipt,
  ShoppingBag,
  Sparkles,
  RotateCcw,
  ShieldCheck,
  AlertCircle,
  Calendar,
  Tag,
  Landmark,
} from 'lucide-react';
import { AccountItem, BillItem, CurrencyCode, ExpenseItem, LanguageCode } from '../types';
import { CURRENCIES, formatCurrency } from '../utils/currency';
import { getCurrentMonthStr } from '../utils/finance';
import { ACCOUNT_TYPE_CONFIG } from './AccountModal';

interface ReceiptScannerModalProps {
  isOpen: boolean;
  onRequestOpen: () => void;
  onClose: () => void;
  accounts: AccountItem[];
  categories: Array<string | { name: string }>;
  currency: CurrencyCode;
  language?: LanguageCode;
  onSaveExpense: (
    data: Omit<ExpenseItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<any>;
  onSaveBill: (
    data: Omit<BillItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<any>;
}

function getTodayStrLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Compresses the captured ticket strictly in memory for fast AI reading.
 * Never persists any image to Storage, Firestore, or localStorage.
 */
async function compressTicketInMemory(file: File, maxDim = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem capturada.'));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => resolve(String(reader.result || ''));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
        // Release canvas memory immediately
        canvas.width = 0;
        canvas.height = 0;
        resolve(dataUrl);
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export const ReceiptScannerModal: React.FC<ReceiptScannerModalProps> = ({
  isOpen,
  onRequestOpen,
  onClose,
  accounts,
  categories,
  currency,
  language = 'pt',
  onSaveExpense,
  onSaveBill,
}) => {
  const isEs = language === 'es';
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const categoryNames = useMemo(() => {
    const names = categories
      .map((c) => (typeof c === 'string' ? c : c?.name || ''))
      .map((s) => s.trim())
      .filter(Boolean);
    return Array.from(new Set(names.length > 0 ? names : ['Alimentação', 'Supermercado', 'Outros']));
  }, [categories]);

  const activeAccounts = useMemo(
    () => accounts.filter((a) => a.isActive !== false),
    [accounts]
  );

  const [step, setStep] = useState<'capture' | 'scanning' | 'review'>('capture');
  const [txType, setTxType] = useState<'expense' | 'bill'>('expense');
  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [category, setCategory] = useState(categoryNames[0] || 'Outros');
  const [date, setDate] = useState(getTodayStrLocal());
  const [accountId, setAccountId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Allow synchronous camera trigger from QuickActionFAB or TransactionModal (critical for iOS Safari)
  useEffect(() => {
    const handleTriggerCamera = () => {
      setError(null);
      setStep('capture');
      onRequestOpen();
      try {
        cameraInputRef.current?.click();
      } catch {
        // Fallback: modal opens on 'capture' step with big camera button
      }
    };
    window.addEventListener('sisfinz:trigger-ticket-camera', handleTriggerCamera);
    return () => window.removeEventListener('sisfinz:trigger-ticket-camera', handleTriggerCamera);
  }, [onRequestOpen]);

  // Inject a clean "Escanear Ticket" button inside TransactionModal when it opens on Despesa/Fatura
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const injectScanButton = () => {
      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
      dialogs.forEach((dlg) => {
        if (dlg.dataset.sisfinzReceiptScanner === '1') return;
        const text = dlg.textContent || '';
        if (!text.includes('CENTRAL DE MOVIMENTAÇÕES')) return;
        if (dlg.querySelector('[data-sisfinz-inline-scan-btn="1"]')) return;

        const formEl = dlg.querySelector('form');
        const scrollBody = formEl?.firstElementChild as HTMLElement | null;
        if (!scrollBody) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.sisfinzInlineScanBtn = '1';
        btn.style.cssText =
          'width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 14px;border-radius:16px;border:1.5px dashed rgba(16,185,129,0.55);background:linear-gradient(135deg,rgba(236,253,245,0.95),rgba(240,253,250,0.95));color:#065f46;font-size:12px;font-weight:900;letter-spacing:0.04em;text-transform:uppercase;cursor:pointer;box-shadow:0 2px 10px rgba(16,185,129,0.08);';
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg><span>${
          isEs ? 'Escanear Ticket con Cámara' : 'Escanear Ticket pela Câmera'
        }</span>`;

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const closeBtn = dlg.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]');
          if (closeBtn) closeBtn.click();
          window.dispatchEvent(new Event('sisfinz:trigger-ticket-camera'));
        });

        scrollBody.insertBefore(btn, scrollBody.firstChild);
      });
    };

    const observer = new MutationObserver(() => injectScanButton());
    observer.observe(document.body, { childList: true, subtree: true });
    injectScanButton();

    return () => observer.disconnect();
  }, [isEs]);

  useEffect(() => {
    if (isOpen && !accountId && activeAccounts.length > 0) {
      setAccountId(activeAccounts[0].id);
    }
    if (!isOpen) {
      setError(null);
      setIsSaving(false);
    }
  }, [isOpen, activeAccounts, accountId]);

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    onRequestOpen();
    setError(null);
    setStep('scanning');

    try {
      let compressedDataUrl: string | null = await compressTicketInMemory(file);

      const resp = await fetch('/api/receipts/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl: compressedDataUrl,
          categories: categoryNames,
          language,
          today: getTodayStrLocal(),
        }),
      });

      // Discard image reference from memory immediately after sending
      compressedDataUrl = null;

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(
          data?.error ||
            (isEs
              ? 'No se pudo leer el ticket. Intenta enfocar el total.'
              : 'Não foi possível ler o ticket. Tente focar no valor total.')
        );
      }

      setTxType(data.type === 'bill' ? 'bill' : 'expense');
      setAmountStr(data.amount && Number(data.amount) > 0 ? String(data.amount) : '');
      setName(String(data.name || '').trim());
      setCategory(
        data.category && categoryNames.includes(data.category)
          ? data.category
          : categoryNames[0] || 'Outros'
      );
      setDate(
        typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date)
          ? data.date
          : getTodayStrLocal()
      );
      if (!accountId && activeAccounts.length > 0) {
        setAccountId(activeAccounts[0].id);
      }
      setStep('review');
    } catch (err: any) {
      setError(
        err?.message ||
          (isEs ? 'Error al procesar el ticket.' : 'Erro ao processar o ticket.')
      );
      setStep('capture');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const val = parseFloat(amountStr.replace(',', '.'));
    if (!name.trim()) {
      setError(isEs ? 'Ingresa una descripción.' : 'Informe uma descrição.');
      return;
    }
    if (!Number.isFinite(val) || val <= 0) {
      setError(isEs ? 'Ingresa un valor válido.' : 'Informe um valor total válido.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const safeDate = date || getTodayStrLocal();
      if (txType === 'bill') {
        await onSaveBill({
          name: name.trim(),
          amount: val,
          dueDate: safeDate,
          dueDay: parseInt(safeDate.split('-')[2]) || 1,
          category: category || categoryNames[0] || 'Outros',
          recurrence: 'none',
          startMonth: safeDate.substring(0, 7) || getCurrentMonthStr(),
          accountId: accountId || undefined,
        });
      } else {
        await onSaveExpense({
          name: name.trim(),
          amount: val,
          date: safeDate,
          category: category || categoryNames[0] || 'Outros',
          accountId: accountId || undefined,
        });
      }
      setStep('capture');
      setName('');
      setAmountStr('');
      onClose();
    } catch (err: any) {
      setError(
        err?.message || (isEs ? 'Error al guardar.' : 'Erro ao salvar lançamento.')
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (typeof document === 'undefined') return null;

  const isBill = txType === 'bill';

  return (
    <>
      {/* Always-mounted file inputs so synchronous click works on iOS Safari */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFilePicked}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFilePicked}
        className="hidden"
      />

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <div
              role="dialog"
              aria-modal="true"
              data-sisfinz-receipt-scanner="1"
              className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4"
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  if (!isSaving && step !== 'scanning') onClose();
                }}
                className="fixed inset-0 bg-emerald-950/25 backdrop-blur-[2px]"
              />

              <motion.div
                initial={{ opacity: 0, y: 32, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 28, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                className="relative z-10 w-full max-w-md max-h-[90dvh] flex flex-col overflow-hidden rounded-t-[2rem] sm:rounded-[2rem] border border-emerald-100 bg-white shadow-2xl"
              >
                {/* Header */}
                <div className="flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-4 text-white shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                      <Camera className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black tracking-tight">
                        {isEs ? 'Escanear Ticket' : 'Escanear Ticket'}
                      </h3>
                      <p className="text-[10px] font-semibold text-emerald-100">
                        {isEs
                          ? 'Lectura rápida • Sin guardar foto'
                          : 'Leitura rápida • Sem salvar foto'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSaving}
                    className="rounded-xl p-1.5 text-white/85 hover:bg-white/15 cursor-pointer"
                    aria-label="Fechar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {error && (
                    <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-700">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {step === 'capture' && (
                    <div className="space-y-4 py-2 text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600 border border-emerald-200/70">
                        <Camera className="h-8 w-8" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-base font-black text-slate-900">
                          {isEs ? 'Apunta al total del ticket' : 'Aponte para o total do ticket'}
                        </h4>
                        <p className="mx-auto max-w-xs text-xs font-medium text-slate-500">
                          {isEs
                            ? 'Detectamos el valor total y la descripción al instante. La foto no se guarda en tu dispositivo.'
                            : 'Lemos o valor total e a descrição automaticamente. A foto é descartada na hora e não ocupa espaço.'}
                        </p>
                      </div>

                      <div className="space-y-2.5 pt-1">
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-emerald-600/20 hover:opacity-95 cursor-pointer"
                        >
                          <Camera className="h-4 w-4" />
                          <span>{isEs ? 'Abrir Cámara' : 'Abrir Câmera'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => galleryInputRef.current?.click()}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 py-3 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 cursor-pointer"
                        >
                          <ImageIcon className="h-4 w-4 text-emerald-600" />
                          <span>{isEs ? 'Elegir de la Galería' : 'Escolher da Galeria'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {step === 'scanning' && (
                    <div className="flex flex-col items-center justify-center gap-3.5 py-10 text-center">
                      <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-amber-500" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-black text-slate-900">
                          {isEs ? 'Procesando ticket...' : 'Lendo ticket...'}
                        </div>
                        <p className="text-xs font-medium text-slate-500">
                          {isEs
                            ? 'Identificando valor total y descripción'
                            : 'Identificando valor total e descrição'}
                        </p>
                      </div>
                    </div>
                  )}

                  {step === 'review' && (
                    <form onSubmit={handleSave} className="space-y-4">
                      {/* Zero-storage reassurance badge */}
                      <div className="flex items-center justify-between gap-2 rounded-2xl bg-emerald-50/80 border border-emerald-200/70 px-3 py-2 text-[10.5px] font-bold text-emerald-800">
                        <span className="inline-flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          {isEs
                            ? 'Foto descartada • Solo datos guardados'
                            : 'Foto descartada • Nenhuma imagem salva'}
                        </span>
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          className="inline-flex items-center gap-1 font-black text-emerald-700 hover:underline cursor-pointer shrink-0"
                        >
                          <RotateCcw className="h-3 w-3" />
                          {isEs ? 'Reintentar' : 'Ler outro'}
                        </button>
                      </div>

                      {/* Expense vs Bill Switcher */}
                      <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-100 p-1">
                        <button
                          type="button"
                          onClick={() => setTxType('expense')}
                          className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black transition-all cursor-pointer ${
                            !isBill
                              ? 'bg-amber-600 text-white shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <ShoppingBag className="h-3.5 w-3.5" />
                          <span>{isEs ? 'Gasto' : 'Despesa'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setTxType('bill')}
                          className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black transition-all cursor-pointer ${
                            isBill
                              ? 'bg-rose-600 text-white shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Receipt className="h-3.5 w-3.5" />
                          <span>{isEs ? 'Factura' : 'Fatura'}</span>
                        </button>
                      </div>

                      {/* Total Amount */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {isEs ? 'Valor Total' : 'Valor Total'} ({CURRENCIES[currency]?.symbol || '$'})
                        </label>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          required
                          value={amountStr}
                          onChange={(e) => setAmountStr(e.target.value)}
                          placeholder="0.00"
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-lg font-mono font-black text-slate-900 outline-none focus:border-emerald-500 focus:bg-white"
                        />
                        {amountStr && Number.isFinite(parseFloat(amountStr)) && (
                          <span
                            className={`inline-block rounded-xl px-2.5 py-0.5 font-mono text-[11px] font-black ${
                              isBill ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {formatCurrency(parseFloat(amountStr), currency)}
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {isEs ? 'Descripción' : 'Descrição'}
                        </label>
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder={
                            isEs ? 'Ej: Supermercado, Farmacia...' : 'Ex: Supermercado, Farmácia...'
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-900 outline-none focus:border-emerald-500 focus:bg-white"
                        />
                      </div>

                      {/* Category & Date */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                            <Tag className="h-3 w-3" />
                            <span>{isEs ? 'Categoría' : 'Categoria'}</span>
                          </label>
                          <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-black text-slate-900 outline-none focus:border-emerald-500 focus:bg-white"
                          >
                            {categoryNames.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                            <Calendar className="h-3 w-3" />
                            <span>{isBill ? (isEs ? 'Vencimiento' : 'Vencimento') : isEs ? 'Fecha' : 'Data'}</span>
                          </label>
                          <input
                            type="date"
                            required
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-black text-slate-900 outline-none focus:border-emerald-500 focus:bg-white"
                          />
                        </div>
                      </div>

                      {/* Account */}
                      {activeAccounts.length > 0 && (
                        <div className="space-y-1">
                          <label className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                            <Landmark className="h-3 w-3" />
                            <span>{isEs ? 'Cuenta' : 'Conta'}</span>
                          </label>
                          <select
                            value={accountId}
                            onChange={(e) => setAccountId(e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-black text-slate-900 outline-none focus:border-emerald-500 focus:bg-white"
                          >
                            <option value="">{isEs ? 'Ninguna cuenta' : 'Nenhuma conta'}</option>
                            {activeAccounts.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {ACCOUNT_TYPE_CONFIG[acc.type]?.emoji} {acc.name} (
                                {formatCurrency(acc.currentBalance || 0, acc.currency)})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isSaving}
                        className={`w-full inline-flex items-center justify-center gap-2 rounded-2xl py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-lg transition-all cursor-pointer disabled:opacity-50 ${
                          isBill
                            ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                            : 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                        }`}
                      >
                        <Check className="h-4 w-4 stroke-[2.8]" />
                        <span>
                          {isSaving
                            ? isEs
                              ? 'Guardando...'
                              : 'Salvando...'
                            : isBill
                            ? isEs
                              ? 'Guardar Factura'
                              : 'Salvar Fatura'
                            : isEs
                            ? 'Guardar Gasto'
                            : 'Salvar Despesa'}
                        </span>
                      </button>
                    </form>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};
