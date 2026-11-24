import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { LanguageCode } from '../types';

export type ReminderCategory = 'routine' | 'work' | 'personal' | 'health';
export type ReminderRepeat = 'none' | 'daily' | 'weekly' | 'monthly';
export type ReminderStatus = 'pending' | 'done';

export interface ReminderItem {
  id: string;
  title: string;
  notes?: string;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  category: ReminderCategory;
  repeat: ReminderRepeat;
  important?: boolean;
  status: ReminderStatus;
  snoozedUntilIso?: string;
  lastNotifiedKey?: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_PREFIX = 'sisfinz_reminders_v1_';
const PUSH_SUB_STORAGE_PREFIX = 'sisfinz_push_sub_v1_';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getTodayYYYYMMDD(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getCurrentHHMM(now = new Date()): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function shiftDateYYYYMMDD(dateStr: string, deltaDays: number): string {
  const [y, m, d] = (dateStr || getTodayYYYYMMDD()).split('-').map(Number);
  const dt = new Date(y || 2026, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + deltaDays);
  return getTodayYYYYMMDD(dt);
}

function advanceDateByRepeat(dateStr: string, repeat: ReminderRepeat): string {
  if (repeat === 'daily') return shiftDateYYYYMMDD(dateStr, 1);
  if (repeat === 'weekly') return shiftDateYYYYMMDD(dateStr, 7);
  if (repeat === 'monthly') {
    const [y, m, d] = (dateStr || getTodayYYYYMMDD()).split('-').map(Number);
    const nextMonthDate = new Date(y || 2026, (m || 1), 1);
    const maxDay = new Date(
      nextMonthDate.getFullYear(),
      nextMonthDate.getMonth() + 1,
      0
    ).getDate();
    const clampedDay = Math.min(d || 1, maxDay);
    return `${nextMonthDate.getFullYear()}-${String(
      nextMonthDate.getMonth() + 1
    ).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
  }
  return dateStr;
}

function playReminderChime(isImportant: boolean) {
  if (typeof window === 'undefined') return;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('settings') || key.includes('Settings'))) {
        const raw = localStorage.getItem(key);
        if (raw && raw.includes('"soundEnabled":false')) return;
      }
    }
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = isImportant ? [659.25, 880, 1174.66] : [587.33, 783.99];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t0 = now + idx * 0.11;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.06, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.24);
    });
    window.setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch {
    // ignore audio errors
  }
}

export async function dispatchSystemNotification(item: ReminderItem, language: LanguageCode) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const title = `Finzy • ${item.title}`;
  const body =
    item.notes ||
    (language === 'es'
      ? `Recordatorio programado para ${item.dueDate}${item.dueTime ? ` a las ${item.dueTime}` : ''}`
      : `Lembrete marcado para ${item.dueDate}${item.dueTime ? ` às ${item.dueTime}` : ''}`);

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration().catch(() => undefined);
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: `sisfinz_rem_${item.id}`,
          data: { reminderId: item.id, url: '/' },
        } as NotificationOptions);
        return;
      }
    }
  } catch {
    // fallback below
  }

  try {
    new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      tag: `sisfinz_rem_${item.id}`,
    });
  } catch {
    // ignore notification errors in restricted webviews
  }
}

export function useReminders(language: LanguageCode = 'pt') {
  const { user } = useAuth();
  const uid = user?.uid || auth.currentUser?.uid || null;
  const storageKey = `${STORAGE_PREFIX}${uid || 'guest'}`;
  const pushSubStorageKey = `${PUSH_SUB_STORAGE_PREFIX}${uid || 'guest'}`;

  const [reminders, setReminders] = useState<ReminderItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [alertQueue, setAlertQueue] = useState<ReminderItem[]>([]);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'default';
    return Notification.permission;
  });
  const [pushSubscribed, setPushSubscribed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return Boolean(localStorage.getItem(pushSubStorageKey));
    } catch {
      return false;
    }
  });
  const [pushInfoMessage, setPushInfoMessage] = useState<string | null>(null);

  const remindersRef = useRef<ReminderItem[]>(reminders);
  remindersRef.current = reminders;

  const saveLocal = useCallback(
    (next: ReminderItem[]) => {
      setReminders(next);
      remindersRef.current = next;
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignore
      }
    },
    [storageKey]
  );

  // Register Web Push subscription with backend if VAPID key is configured on server
  const registerWebPushSubscription = useCallback(async () => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      return false;
    }

    try {
      const vapidResp = await fetch('/api/reminders/vapid-public-key');
      if (!vapidResp.ok) return false;
      const vapidData = await vapidResp.json().catch(() => ({}));
      const publicKey = String(vapidData?.publicKey || '').trim();
      if (!publicKey) {
        setPushInfoMessage(
          language === 'es'
            ? 'Servidor Web Push aún sin clave VAPID configurada.'
            : 'Servidor Web Push ainda sem chave VAPID configurada.'
        );
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const token = await auth.currentUser?.getIdToken().catch(() => '');
      const saveResp = await fetch('/api/reminders/push-subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          language,
        }),
      });

      if (saveResp.ok) {
        setPushSubscribed(true);
        setPushInfoMessage(null);
        try {
          localStorage.setItem(pushSubStorageKey, JSON.stringify(sub.toJSON()));
        } catch {
          // ignore
        }
        return true;
      }
    } catch {
      // ignore push subscription errors in unsupported browsers
    }
    return false;
  }, [language, pushSubStorageKey]);

  // Realtime Firestore sync
  useEffect(() => {
    if (!uid) return;
    const colRef = collection(db, 'users', uid, 'reminders');
    const unsub = onSnapshot(
      colRef,
      (snap) => {
        const list: ReminderItem[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as Omit<ReminderItem, 'id'>) });
        });
        list.sort((a, b) => {
          const da = `${a.dueDate} ${a.dueTime || '09:00'}`;
          const dbStr = `${b.dueDate} ${b.dueTime || '09:00'}`;
          return da.localeCompare(dbStr);
        });
        saveLocal(list);
      },
      () => {}
    );
    return () => unsub();
  }, [uid, saveLocal]);

  // If permission was already granted, attempt background push registration silently
  useEffect(() => {
    if (!uid) return;
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      setNotifPermission('granted');
      registerWebPushSubscription().catch(() => {});
    }
  }, [uid, registerWebPushSubscription]);

  const requestSystemNotificationPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'denied' as const;
    try {
      const res = await Notification.requestPermission();
      setNotifPermission(res);
      if (res === 'granted') {
        await registerWebPushSubscription();
      }
      return res;
    } catch {
      return 'denied' as const;
    }
  }, [registerWebPushSubscription]);

  const addReminder = useCallback(
    async (params: {
      title: string;
      notes?: string;
      dueDate: string;
      dueTime?: string;
      category?: ReminderCategory;
      repeat?: ReminderRepeat;
      important?: boolean;
    }): Promise<ReminderItem> => {
      const now = new Date();
      const nowIso = now.toISOString();
      const todayStr = getTodayYYYYMMDD(now);
      const curTime = getCurrentHHMM(now);
      const targetDate = params.dueDate || todayStr;
      const targetTime = params.dueTime || '09:00';
      const isAlreadyDueNow =
        targetDate < todayStr || (targetDate === todayStr && targetTime <= curTime);

      const item: ReminderItem = {
        id: `rem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: params.title.trim(),
        notes: params.notes?.trim() || undefined,
        dueDate: targetDate,
        dueTime: params.dueTime || undefined,
        category: params.category || 'routine',
        repeat: params.repeat || 'none',
        important: Boolean(params.important),
        status: 'pending',
        lastNotifiedKey: isAlreadyDueNow ? `${targetDate}_${targetTime}` : undefined,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const next = [...remindersRef.current, item];
      saveLocal(next);

      if (uid) {
        await setDoc(doc(db, 'users', uid, 'reminders', item.id), JSON.parse(JSON.stringify(item)));
      }
      return item;
    },
    [uid, saveLocal]
  );

  const toggleCompleteReminder = useCallback(
    async (id: string) => {
      const current = remindersRef.current.find((r) => r.id === id);
      if (!current) return;
      const nowIso = new Date().toISOString();

      setAlertQueue((q) => q.filter((item) => item.id !== id));

      let updatedItem: ReminderItem;
      if (current.status === 'pending' && current.repeat !== 'none') {
        const nextDueDate = advanceDateByRepeat(current.dueDate, current.repeat);
        updatedItem = {
          ...current,
          dueDate: nextDueDate,
          status: 'pending',
          snoozedUntilIso: undefined,
          lastNotifiedKey: undefined,
          updatedAt: nowIso,
        };
      } else {
        updatedItem = {
          ...current,
          status: current.status === 'done' ? 'pending' : 'done',
          snoozedUntilIso: undefined,
          updatedAt: nowIso,
        };
      }

      const next = remindersRef.current.map((r) => (r.id === id ? updatedItem : r));
      saveLocal(next);
      if (uid) {
        await setDoc(
          doc(db, 'users', uid, 'reminders', id),
          JSON.parse(JSON.stringify(updatedItem)),
          { merge: true }
        );
      }
    },
    [uid, saveLocal]
  );

  const snoozeReminder = useCallback(
    async (id: string, minutesOrTomorrow: number | 'tomorrow') => {
      const current = remindersRef.current.find((r) => r.id === id);
      if (!current) return;
      const now = new Date();
      const nowIso = now.toISOString();

      setAlertQueue((q) => q.filter((item) => item.id !== id));

      let updatedItem: ReminderItem;
      if (minutesOrTomorrow === 'tomorrow') {
        const tomorrowStr = shiftDateYYYYMMDD(getTodayYYYYMMDD(now), 1);
        updatedItem = {
          ...current,
          dueDate: tomorrowStr,
          status: 'pending',
          snoozedUntilIso: undefined,
          lastNotifiedKey: undefined,
          updatedAt: nowIso,
        };
      } else {
        const snoozeUntil = new Date(now.getTime() + minutesOrTomorrow * 60000);
        updatedItem = {
          ...current,
          status: 'pending',
          snoozedUntilIso: snoozeUntil.toISOString(),
          lastNotifiedKey: `snoozed_${snoozeUntil.toISOString()}`,
          updatedAt: nowIso,
        };
      }

      const next = remindersRef.current.map((r) => (r.id === id ? updatedItem : r));
      saveLocal(next);
      if (uid) {
        await setDoc(
          doc(db, 'users', uid, 'reminders', id),
          JSON.parse(JSON.stringify(updatedItem)),
          { merge: true }
        );
      }
    },
    [uid, saveLocal]
  );

  const dismissAlert = useCallback(async (id: string) => {
    setAlertQueue((q) => q.filter((item) => item.id !== id));
  }, []);

  const triggerTestFinzyAlert = useCallback(
    (sampleTitle?: string) => {
      const now = new Date();
      const demo: ReminderItem = {
        id: `demo_${Date.now()}`,
        title: sampleTitle || 'Conferir mochila e carregador antes do turno',
        notes: 'Aviso interativo do Finzy — teste de som, pulso e soneca rápida',
        dueDate: getTodayYYYYMMDD(now),
        dueTime: getCurrentHHMM(now),
        category: 'work',
        repeat: 'none',
        important: true,
        status: 'pending',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      playReminderChime(true);
      dispatchSystemNotification(demo, language);
      setAlertQueue((prev) =>
        prev.some((x) => x.title === demo.title) ? prev : [...prev, demo]
      );
    },
    [language]
  );

  const deleteReminder = useCallback(
    async (id: string) => {
      setAlertQueue((q) => q.filter((item) => item.id !== id));
      const next = remindersRef.current.filter((r) => r.id !== id);
      saveLocal(next);
      if (uid) {
        await deleteDoc(doc(db, 'users', uid, 'reminders', id)).catch(() => {});
      }
    },
    [uid, saveLocal]
  );

  // Due-reminder watcher (runs on mount, every 25s, and on tab focus/visibility)
  useEffect(() => {
    const checkDueReminders = async () => {
      const now = new Date();
      const todayStr = getTodayYYYYMMDD(now);
      const curTime = getCurrentHHMM(now);
      const nowMs = now.getTime();

      const newlyDue: ReminderItem[] = [];
      let mutated = false;

      const updatedList = remindersRef.current.map((item) => {
        if (item.status !== 'pending') return item;

        if (item.snoozedUntilIso) {
          const snoozeMs = new Date(item.snoozedUntilIso).getTime();
          if (!Number.isNaN(snoozeMs) && nowMs >= snoozeMs) {
            const key = `snoozed_due_${item.snoozedUntilIso}`;
            if (item.lastNotifiedKey !== key) {
              mutated = true;
              const nextItem: ReminderItem = {
                ...item,
                snoozedUntilIso: undefined,
                lastNotifiedKey: key,
                updatedAt: now.toISOString(),
              };
              newlyDue.push(nextItem);
              return nextItem;
            }
          }
          return item;
        }

        const isTodayOrPast = item.dueDate <= todayStr;
        if (!isTodayOrPast) return item;

        const targetTime = item.dueTime || '09:00';
        const isTimeReached = item.dueDate < todayStr || curTime >= targetTime;
        if (!isTimeReached) return item;

        const notifyKey = `${item.dueDate}_${targetTime}`;
        if (item.lastNotifiedKey === notifyKey) return item;

        mutated = true;
        const nextItem: ReminderItem = {
          ...item,
          lastNotifiedKey: notifyKey,
          updatedAt: now.toISOString(),
        };
        newlyDue.push(nextItem);
        return nextItem;
      });

      if (mutated) {
        saveLocal(updatedList);
        if (uid) {
          for (const changed of newlyDue) {
            setDoc(
              doc(db, 'users', uid, 'reminders', changed.id),
              JSON.parse(JSON.stringify(changed)),
              { merge: true }
            ).catch(() => {});
          }
        }
      }

      if (newlyDue.length > 0) {
        playReminderChime(newlyDue.some((x) => x.important));
        for (const d of newlyDue) {
          dispatchSystemNotification(d, language);
        }
        setAlertQueue((prev) => {
          const existingIds = new Set(prev.map((x) => x.id));
          const uniqueAdditions = newlyDue.filter((x) => !existingIds.has(x.id));
          return uniqueAdditions.length > 0 ? [...prev, ...uniqueAdditions] : prev;
        });
      }
    };

    checkDueReminders();
    const interval = window.setInterval(checkDueReminders, 25000);
    const onFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        checkDueReminders();
      }
    };
    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
    };
  }, [uid, saveLocal, language]);

  const activeAlert = alertQueue[0] || null;
  const pendingCount = reminders.filter((r) => r.status === 'pending').length;

  return {
    reminders,
    pendingCount,
    activeAlert,
    alertQueueCount: alertQueue.length,
    notifPermission,
    pushSubscribed,
    pushInfoMessage,
    addReminder,
    toggleCompleteReminder,
    snoozeReminder,
    dismissAlert,
    deleteReminder,
    requestSystemNotificationPermission,
    triggerTestFinzyAlert,
  };
}
