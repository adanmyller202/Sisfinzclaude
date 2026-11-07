import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase/config';
import { onSnapshotsInSync } from 'firebase/firestore';

export type SyncState = 'offline' | 'syncing' | 'synced';

// Global singleton state so all components stay consistent
let globalIsOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
let globalSyncState: SyncState = globalIsOnline ? 'synced' : 'offline';
let globalPendingCount = 0;
const listeners = new Set<(state: SyncState, isOnline: boolean) => void>();

function notifyAll() {
  listeners.forEach((l) => l(globalSyncState, globalIsOnline));
}

// Global hook to report pending writes from any hook/service
export function registerPendingWrite() {
  globalPendingCount++;
  if (globalIsOnline) {
    globalSyncState = 'syncing';
    notifyAll();
  }
}

export function registerResolvedWrite() {
  if (globalPendingCount > 0) {
    globalPendingCount--;
  }
  if (globalIsOnline && globalPendingCount === 0) {
    globalSyncState = 'synced';
    notifyAll();
  }
}

export function useSyncStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(globalIsOnline);
  const [syncState, setSyncState] = useState<SyncState>(globalSyncState);

  useEffect(() => {
    const updateFromGlobal = (state: SyncState, online: boolean) => {
      setSyncState(state);
      setIsOnline(online);
    };

    listeners.add(updateFromGlobal);

    const handleOnline = () => {
      globalIsOnline = true;
      globalSyncState = globalPendingCount > 0 ? 'syncing' : 'synced';
      setIsOnline(true);
      setSyncState(globalSyncState);
      notifyAll();
    };

    const handleOffline = () => {
      globalIsOnline = false;
      globalSyncState = 'offline';
      setIsOnline(false);
      setSyncState('offline');
      notifyAll();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen to Firestore synchronization events
    let unsubscribeSnapshots: (() => void) | null = null;
    try {
      unsubscribeSnapshots = onSnapshotsInSync(db, () => {
        if (globalIsOnline) {
          globalPendingCount = 0;
          globalSyncState = 'synced';
          notifyAll();
        }
      });
    } catch (err) {
      console.warn('onSnapshotsInSync listener not supported in current environment:', err);
    }

    return () => {
      listeners.delete(updateFromGlobal);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (unsubscribeSnapshots) {
        unsubscribeSnapshots();
      }
    };
  }, []);

  return {
    isOnline,
    syncState,
    isOffline: !isOnline || syncState === 'offline',
    isSyncing: syncState === 'syncing',
    isSynced: isOnline && syncState === 'synced',
    notifyWrite: registerPendingWrite,
    resolveWrite: registerResolvedWrite,
  };
}
