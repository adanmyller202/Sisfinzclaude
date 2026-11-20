import React from 'react';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  isRepairing: boolean;
}

async function repairMissingIncomeExpectedDates(): Promise<boolean> {
  let repairedAny = false;
  const fallbackToday = new Date().toISOString().slice(0, 10);

  // 1. Repair cached incomes in localStorage immediately
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.toLowerCase().includes('income')) continue;
      const raw = localStorage.getItem(key);
      if (!raw || !raw.startsWith('[')) continue;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      let changed = false;
      const fixed = parsed.map((item: any) => {
        if (item && typeof item === 'object' && (!item.expectedDate || typeof item.expectedDate !== 'string')) {
          const month = typeof item.startMonth === 'string' && /^\d{4}-\d{2}$/.test(item.startMonth)
            ? item.startMonth
            : fallbackToday.slice(0, 7);
          const day = String(Math.max(1, Math.min(28, Number(item.expectedDay) || 5))).padStart(2, '0');
          changed = true;
          return { ...item, expectedDate: `${month}-${day}` };
        }
        return item;
      });
      if (changed) {
        localStorage.setItem(key, JSON.stringify(fixed));
        repairedAny = true;
      }
    }
  } catch {
    // ignore localStorage errors
  }

  // 2. Repair any Firestore income documents missing expectedDate
  try {
    if (typeof (auth as any).authStateReady === 'function') {
      await (auth as any).authStateReady();
    }
    const uid = auth.currentUser?.uid;
    if (uid) {
      const snap = await getDocs(collection(db, 'users', uid, 'incomes'));
      const updates: Promise<void>[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data.expectedDate || typeof data.expectedDate !== 'string') {
          const month =
            typeof data.startMonth === 'string' && /^\d{4}-\d{2}$/.test(data.startMonth)
              ? data.startMonth
              : fallbackToday.slice(0, 7);
          const day = String(Math.max(1, Math.min(28, Number(data.expectedDay) || 5))).padStart(2, '0');
          const expectedDate = `${month}-${day}`;
          updates.push(
            setDoc(
              doc(db, 'users', uid, 'incomes', docSnap.id),
              { expectedDate },
              { merge: true }
            )
          );
          repairedAny = true;
        }
      });
      if (updates.length > 0) {
        await Promise.all(updates);
      }
    }
  } catch (err) {
    console.warn('[ErrorBoundary] Auto-repair warning:', err);
  }

  return repairedAny;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      isRepairing: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      errorMessage: error?.message || 'Erro inesperado ao iniciar o aplicativo.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary] Caught error:', error);
    const msg = error?.message || '';
    if (msg.includes('expectedDate')) {
      this.runAutoRepair(true);
    }
  }

  runAutoRepair = async (autoReload: boolean) => {
    this.setState({ isRepairing: true });
    try {
      const repaired = await repairMissingIncomeExpectedDates();
      const guardKey = 'sisfinz_auto_repair_expectedDate_once';
      if (autoReload && repaired && !sessionStorage.getItem(guardKey)) {
        sessionStorage.setItem(guardKey, '1');
        window.location.reload();
        return;
      }
    } finally {
      this.setState({ isRepairing: false });
    }
  };

  handleRetry = async () => {
    if (this.state.errorMessage.includes('expectedDate')) {
      await this.runAutoRepair(false);
    }
    try {
      sessionStorage.removeItem('sisfinz_auto_repair_expectedDate_once');
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F4F8F6] p-6">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl text-center space-y-4">
            <h1 className="text-lg font-black text-slate-900">
              Error al iniciar la aplicación
            </h1>
            <p className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 font-mono text-xs text-rose-700 break-words">
              {this.state.isRepairing
                ? 'Reparando automaticamente os dados de salário sincronizados...'
                : this.state.errorMessage}
            </p>
            <button
              type="button"
              disabled={this.state.isRepairing}
              onClick={this.handleRetry}
              className="w-full rounded-2xl bg-emerald-600 py-3 text-xs font-black uppercase tracking-widest text-white shadow-md hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"
            >
              {this.state.isRepairing ? 'Reparando...' : 'Reintentar'}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
