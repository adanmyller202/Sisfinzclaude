import crypto from 'node:crypto';
import { getFirestore } from 'firebase-admin/firestore';

export interface StoredPushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  subscription: {
    endpoint: string;
    expirationTime?: number | null;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
  };
  timeZone: string;
  language: 'pt' | 'es' | 'en';
  updatedAt: string;
}

export interface DueReminderDoc {
  id: string;
  title: string;
  notes?: string;
  dueDate: string;
  dueTime?: string;
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly';
  important?: boolean;
  status?: 'pending' | 'done';
  snoozedUntilIso?: string;
  lastPushKey?: string;
  lastNotifiedKey?: string;
}

const VAPID_PUBLIC_KEY_ENV = (process.env.VAPID_PUBLIC_KEY || '').trim();
const VAPID_PRIVATE_KEY_ENV = (process.env.VAPID_PRIVATE_KEY || '').trim();
const VAPID_SUBJECT_ENV = (
  process.env.VAPID_SUBJECT || 'mailto:suporte@sisfinz.app'
).trim();

let cachedVapidKeys: { publicKey: string; privateKey: string } | null = null;
let cachedWebPushModule: any = null;
let webPushConfigured = false;

function toBase64Url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

/**
 * Generates or reuses a valid P-256 VAPID keypair when env vars are not explicitly provided.
 * Note: For multi-instance Cloud Run persistence across restarts, set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.
 */
export function getVapidKeyPair(): { publicKey: string; privateKey: string } {
  if (VAPID_PUBLIC_KEY_ENV && VAPID_PRIVATE_KEY_ENV) {
    return {
      publicKey: VAPID_PUBLIC_KEY_ENV,
      privateKey: VAPID_PRIVATE_KEY_ENV,
    };
  }
  if (cachedVapidKeys) {
    return cachedVapidKeys;
  }

  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const publicKey = toBase64Url(ecdh.getPublicKey());
  const privateKey = toBase64Url(ecdh.getPrivateKey());

  cachedVapidKeys = { publicKey, privateKey };
  return cachedVapidKeys;
}

async function getConfiguredWebPush(): Promise<any | null> {
  if (cachedWebPushModule) {
    return cachedWebPushModule;
  }
  try {
    const mod: any = await (new Function('specifier', 'return import(specifier)'))('web-push');
    const wp = mod?.default || mod;
    if (wp && typeof wp.sendNotification === 'function') {
      const keys = getVapidKeyPair();
      if (!webPushConfigured && typeof wp.setVapidDetails === 'function') {
        wp.setVapidDetails(VAPID_SUBJECT_ENV, keys.publicKey, keys.privateKey);
        webPushConfigured = true;
      }
      cachedWebPushModule = wp;
      return wp;
    }
  } catch {
    // Optional dependency not installed yet
  }
  return null;
}

export function subscriptionDocIdForEndpoint(endpoint: string): string {
  return 'sub_' + crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 24);
}

export function getZonedDateAndTime(
  timeZone: string,
  now = new Date()
): { dateStr: string; hhmm: string } {
  const safeTz = timeZone || 'America/Argentina/Buenos_Aires';
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: safeTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const map: Record<string, string> = {};
    for (const p of parts) {
      if (p.type !== 'literal') map[p.type] = p.value;
    }
    const y = map.year || '2026';
    const m = map.month || '01';
    const d = map.day || '01';
    const hh = map.hour === '24' ? '00' : map.hour || '00';
    const mm = map.minute || '00';
    return {
      dateStr: `${y}-${m}-${d}`,
      hhmm: `${hh}:${mm}`,
    };
  } catch {
    return {
      dateStr: now.toISOString().slice(0, 10),
      hhmm: now.toISOString().slice(11, 16),
    };
  }
}

export async function savePushSubscriptionForUser(params: {
  userId: string;
  subscription: StoredPushSubscription['subscription'];
  timeZone?: string;
  language?: string;
}): Promise<StoredPushSubscription> {
  const db = getFirestore();
  const endpoint = String(params.subscription?.endpoint || '').trim();
  const docId = subscriptionDocIdForEndpoint(endpoint);
  const lang =
    params.language === 'es' || params.language === 'en' ? params.language : 'pt';

  const record: StoredPushSubscription = {
    id: docId,
    userId: params.userId,
    endpoint,
    subscription: params.subscription,
    timeZone: String(params.timeZone || 'America/Argentina/Buenos_Aires').trim(),
    language: lang,
    updatedAt: new Date().toISOString(),
  };

  await db
    .collection('users')
    .doc(params.userId)
    .collection('push_subscriptions')
    .doc(docId)
    .set(record, { merge: true });

  return record;
}

export async function processDueRemindersPushDispatch(
  targetUserId?: string
): Promise<{ checkedUsers: number; sentCount: number; cleanedInvalid: number }> {
  const db = getFirestore();
  const wp = await getConfiguredWebPush();
  if (!wp) {
    return { checkedUsers: 0, sentCount: 0, cleanedInvalid: 0 };
  }

  const now = new Date();
  const nowMs = now.getTime();
  let checkedUsers = 0;
  let sentCount = 0;
  let cleanedInvalid = 0;

  const userDocs = targetUserId
    ? [{ id: targetUserId }]
    : (await db.collection('users').limit(200).get()).docs.map((d) => ({ id: d.id }));

  for (const u of userDocs) {
    const subsSnap = await db
      .collection('users')
      .doc(u.id)
      .collection('push_subscriptions')
      .get();

    if (subsSnap.empty) continue;

    const remindersSnap = await db
      .collection('users')
      .doc(u.id)
      .collection('reminders')
      .where('status', '==', 'pending')
      .get();

    if (remindersSnap.empty) continue;
    checkedUsers++;

    const subs = subsSnap.docs.map((d) => ({
      ref: d.ref,
      data: d.data() as StoredPushSubscription,
    }));

    for (const rDoc of remindersSnap.docs) {
      const rem = { id: rDoc.id, ...(rDoc.data() as DueReminderDoc) };
      if (rem.status !== 'pending') continue;

      for (const s of subs) {
        const { dateStr: localDate, hhmm: localTime } = getZonedDateAndTime(
          s.data.timeZone,
          now
        );

        let pushKey: string | null = null;
        if (rem.snoozedUntilIso) {
          const snoozeMs = new Date(rem.snoozedUntilIso).getTime();
          if (!Number.isNaN(snoozeMs) && nowMs >= snoozeMs) {
            pushKey = `snooze_${rem.snoozedUntilIso}`;
          }
        } else if (rem.dueDate <= localDate) {
          const targetTime = rem.dueTime || '09:00';
          if (rem.dueDate < localDate || localTime >= targetTime) {
            pushKey = `${rem.dueDate}_${targetTime}`;
          }
        }

        if (!pushKey || rem.lastPushKey === pushKey) continue;

        const payload = JSON.stringify({
          type: 'FINZY_REMINDER_PUSH',
          title: `Finzy • ${rem.title}`,
          body:
            rem.notes ||
            (s.data.language === 'es'
              ? `Recordatorio: ${rem.title} (${rem.dueTime || 'hoy'})`
              : `Lembrete: ${rem.title} (${rem.dueTime || 'hoje'})`),
          tag: `sisfinz_rem_${rem.id}`,
          reminderId: rem.id,
          url: '/',
        });

        try {
          await wp.sendNotification(s.data.subscription, payload);
          sentCount++;
          await rDoc.ref.set(
            {
              lastPushKey: pushKey,
              updatedAt: now.toISOString(),
            },
            { merge: true }
          );
        } catch (err: any) {
          const statusCode = Number(err?.statusCode || err?.status || 0);
          if (statusCode === 404 || statusCode === 410) {
            await s.ref.delete().catch(() => {});
            cleanedInvalid++;
          }
        }
      }
    }
  }

  return { checkedUsers, sentCount, cleanedInvalid };
}
