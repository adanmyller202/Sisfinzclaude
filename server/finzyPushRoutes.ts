import express from 'express';
import {
  getVapidKeyPair,
  processDueRemindersPushDispatch,
  savePushSubscriptionForUser,
} from './finzyPush.js';

export function mountFinzyPushRoutes(
  app: express.Express,
  verifyFirebaseToken?: (req: express.Request) => Promise<{ uid?: string } | null>
) {
  app.get('/api/reminders/vapid-public-key', (_req, res) => {
    const { publicKey } = getVapidKeyPair();
    res.json({ publicKey });
  });

  app.post('/api/reminders/push-subscribe', async (req, res) => {
    try {
      const authHeader = String(req.headers.authorization || '');
      let uid = String(req.body?.userId || '').trim();

      if (verifyFirebaseToken && authHeader.startsWith('Bearer ')) {
        const verified = await verifyFirebaseToken(req).catch(() => null);
        if (verified?.uid) {
          uid = verified.uid;
        }
      }

      if (!uid) {
        return res.status(401).json({ error: 'Usuário não autenticado para push.' });
      }

      const subscription = req.body?.subscription;
      if (!subscription?.endpoint) {
        return res.status(400).json({ error: 'Assinatura de push inválida.' });
      }

      const saved = await savePushSubscriptionForUser({
        userId: uid,
        subscription,
        timeZone: req.body?.timeZone,
        language: req.body?.language,
      });

      return res.json({ ok: true, id: saved.id });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Falha ao registrar push.' });
    }
  });

  app.post('/api/reminders/dispatch-due', async (req, res) => {
    try {
      const cronSecret = (process.env.REMINDER_CRON_SECRET || '').trim();
      const providedSecret = String(req.headers['x-reminder-cron-secret'] || '').trim();
      if (cronSecret && providedSecret !== cronSecret) {
        return res.status(403).json({ error: 'Segredo de agendamento inválido.' });
      }

      const targetUserId = String(req.body?.userId || '').trim() || undefined;
      const summary = await processDueRemindersPushDispatch(targetUserId);
      return res.json({ ok: true, ...summary });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao disparar lembretes.' });
    }
  });

  const tickInterval = setInterval(() => {
    processDueRemindersPushDispatch().catch(() => {});
  }, 45000);
  if (typeof (tickInterval as any).unref === 'function') {
    (tickInterval as any).unref();
  }
}
