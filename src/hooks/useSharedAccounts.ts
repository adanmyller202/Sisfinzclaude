/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, sanitizeForFirestore } from '../firebase/config';
import { getMonthDiff, getCurrentMonthStr } from '../utils/finance';
import { hashEmail } from '../utils/crypto';
import {
  collection,
  doc,
  query,
  where,
  onSnapshot,
  setDoc,
  getDocs,
  getDoc,
  deleteDoc,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import {
  SharedConnection,
  SharedInvitation,
  SharedBill,
  IncomeItem,
  SharedTransferRecord,
  SharedNotification,
  UserDirectoryEntry,
  SharedUserSummary,
  SplitMethod,
  FinanceSettings,
} from '../types';

export function useSharedAccounts() {
  const { user } = useAuth();
  const userId = user?.uid;

  const [connections, setConnections] = useState<SharedConnection[]>([]);
  const [receivedInvitations, setReceivedInvitations] = useState<SharedInvitation[]>([]);
  const [sentInvitations, setSentInvitations] = useState<SharedInvitation[]>([]);
  const [sharedBills, setSharedBills] = useState<SharedBill[]>([]);
  const [sharedNotifications, setSharedNotifications] = useState<SharedNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Prevent double-click execution ref guard
  const isProcessingRef = useRef<boolean>(false);

  // 1. Listen for Connections where user is a member
  useEffect(() => {
    if (!userId) {
      setConnections([]);
      return;
    }

    const q = query(
      collection(db, 'shared_connections'),
      where('members', 'array-contains', userId)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: SharedConnection[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as SharedConnection;
          if (data.status === 'active') {
            list.push(data);
          }
        });
        setConnections(list);
      },
      (err) => console.warn('Shared connections listener error:', err)
    );

    return () => unsub();
  }, [userId]);

  // 2. Listen for Received Invitations
  useEffect(() => {
    if (!userId) {
      setReceivedInvitations([]);
      return;
    }

    const q = query(
      collection(db, 'shared_invitations'),
      where('toUserId', '==', userId)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: SharedInvitation[] = [];
        snapshot.forEach((d) => list.push(d.data() as SharedInvitation));
        setReceivedInvitations(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      },
      (err) => console.warn('Received invitations listener error:', err)
    );

    return () => unsub();
  }, [userId]);

  // 3. Listen for Sent Invitations
  useEffect(() => {
    if (!userId) {
      setSentInvitations([]);
      return;
    }

    const q = query(
      collection(db, 'shared_invitations'),
      where('fromUserId', '==', userId)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: SharedInvitation[] = [];
        snapshot.forEach((d) => list.push(d.data() as SharedInvitation));
        setSentInvitations(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      },
      (err) => console.warn('Sent invitations listener error:', err)
    );

    return () => unsub();
  }, [userId]);

  // 4. Listen for Shared Bills
  useEffect(() => {
    if (!userId) {
      setSharedBills([]);
      return;
    }

    const q = query(
      collection(db, 'shared_bills'),
      where('members', 'array-contains', userId)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: SharedBill[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as SharedBill;
          if (!data.hiddenForUsers || !data.hiddenForUsers.includes(userId)) {
            list.push(data);
          }
        });
        // Sort by due date
        setSharedBills(list.sort((a, b) => a.dueDate.localeCompare(b.dueDate)));
        setLoading(false);
      },
      (err) => {
        console.warn('Shared bills listener error:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [userId]);



  // 6. Listen for Notifications
  useEffect(() => {
    if (!userId) {
      setSharedNotifications([]);
      return;
    }

    const q = query(
      collection(db, 'shared_notifications'),
      where('userId', '==', userId)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: SharedNotification[] = [];
        snapshot.forEach((d) => list.push(d.data() as SharedNotification));
        setSharedNotifications(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      },
      (err) => console.warn('Shared notifications listener error:', err)
    );

    return () => unsub();
  }, [userId]);

  // Derived: Active Partners list
  const activePartners = useMemo<SharedUserSummary[]>(() => {
    if (!userId) return [];
    const partners: SharedUserSummary[] = [];
    const seen = new Set<string>();

    for (const conn of connections) {
      const partnerId = conn.members.find((m) => m !== userId);
      if (partnerId && !seen.has(partnerId)) {
        seen.add(partnerId);
        const profile = conn.memberProfiles?.[partnerId];
        if (profile) {
          partners.push(profile);
        } else {
          partners.push({ uid: partnerId, displayName: 'Parceiro', email: '' });
        }
      }
    }
    return partners;
  }, [connections, userId]);

  // Derived: Unread notifications count
  const unreadNotificationsCount = useMemo(() => {
    return sharedNotifications.filter((n) => !n.isRead).length;
  }, [sharedNotifications]);

  // Pending invitations count for badges
  const pendingReceivedInvitationsCount = useMemo(() => {
    return receivedInvitations.filter((i) => i.status === 'pending').length;
  }, [receivedInvitations]);

  // Search user in directory by exact email (via token-authenticated and rate-limited backend)
  const searchUserByEmail = useCallback(
    async (email: string): Promise<UserDirectoryEntry | null> => {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) return null;
      if (!user) throw new Error('Usuário não autenticado.');

      try {
        const idToken = await user.getIdToken();
        const resp = await fetch('/api/search-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ email: cleanEmail }),
        });

        if (resp.status === 429) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData.error || 'Muitas tentativas de busca. Aguarde um minuto.');
        }

        if (resp.status === 401) {
          throw new Error('Sessão expirada ou autenticação inválida.');
        }

        if (resp.ok) {
          const data = await resp.json();
          if (data.found && data.user) {
            return {
              uid: data.user.uid,
              email: data.user.email,
              displayName: data.user.displayName,
              updatedAt: new Date().toISOString(),
            };
          }
          return null; // Clearly not found
        }
        
        // Handle other non-OK responses (500, etc.)
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro de servidor (${resp.status}). Tente novamente.`);
      } catch (err: any) {
        // Re-throw if it's one of our specific error messages
        if (err.message && (
          err.message.includes('Muitas tentativas') || 
          err.message.includes('Sessão') || 
          err.message.includes('Erro de servidor')
        )) {
          throw err;
        }
        console.warn('Search user error:', err);
        throw new Error('Erro na comunicação com o servidor de busca.');
      }
    },
    [user]
  );

  // Send an invitation to another user
  const sendInvitation = useCallback(
    async (targetEmail: string): Promise<{ success: boolean; message?: string }> => {
      if (!userId || !user) throw new Error('Usuário não autenticado.');
      const cleanEmail = targetEmail.trim().toLowerCase();

      if (cleanEmail === (user.email || '').toLowerCase()) {
        return { success: false, message: 'Você não pode convidar a si mesmo.' };
      }

      let targetUser: UserDirectoryEntry | null = null;
      try {
        targetUser = await searchUserByEmail(cleanEmail);
      } catch (searchErr: any) {
        return {
          success: false,
          message: searchErr.message || 'Erro ao buscar usuário no servidor.',
        };
      }

      if (!targetUser) {
        return {
          success: false,
          message: 'Usuário não encontrado. Verifique se o e-mail está cadastrado no SisFinz.',
        };
      }

      // Check if already connected
      const alreadyConnected = connections.some((c) =>
        c.members.includes(targetUser.uid)
      );
      if (alreadyConnected) {
        return { success: false, message: 'Vocês já possuem uma conta compartilhada ativa.' };
      }

      // Check if there's already a pending invitation
      const existingSent = sentInvitations.find(
        (i) => i.toUserId === targetUser.uid && i.status === 'pending'
      );
      if (existingSent) {
        return { success: false, message: 'Já existe um convite pendente para este usuário.' };
      }

      const now = new Date().toISOString();
      const invId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const myName = user.displayName || user.email?.split('@')[0] || 'Usuário';

      const invitation: SharedInvitation = {
        id: invId,
        fromUserId: userId,
        fromUserName: myName,
        fromUserEmail: user.email || '',
        toUserId: targetUser.uid,
        toUserEmail: targetUser.email,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };

      // Create invitation in Firestore
      await setDoc(doc(db, 'shared_invitations', invId), sanitizeForFirestore(invitation));

      // Create notification for target user
      const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const notif: SharedNotification = {
        id: notifId,
        userId: targetUser.uid,
        fromUserId: userId,
        fromUserName: myName,
        type: 'invitation_received',
        title: 'Novo convite de Conta Compartilhada',
        message: `${myName} (${user.email}) convidou você para compartilhar faturas e despesas no SisFinz.`,
        data: { invitationId: invId },
        isRead: false,
        status: 'pending',
        createdAt: now,
      };
      await setDoc(doc(db, 'shared_notifications', notifId), sanitizeForFirestore(notif));

      return { success: true };
    },
    [userId, user, connections, sentInvitations, searchUserByEmail]
  );

  // Accept or Reject Invitation
  const respondInvitation = useCallback(
    async (invitationId: string, accept: boolean): Promise<void> => {
      if (!userId || !user) throw new Error('Usuário não autenticado.');
      const invitation = receivedInvitations.find((i) => i.id === invitationId);
      if (!invitation) throw new Error('Convite não encontrado.');

      const now = new Date().toISOString();
      const myName = user.displayName || user.email?.split('@')[0] || 'Usuário';

      if (accept) {
        // 1. Update invitation to accepted
        await setDoc(
          doc(db, 'shared_invitations', invitationId),
          { status: 'accepted', updatedAt: now },
          { merge: true }
        );

        // 2. Create connection
        const connId = `conn_${[invitation.fromUserId, userId].sort().join('_')}`;
        const connection: SharedConnection = {
          id: connId,
          members: [invitation.fromUserId, userId],
          memberProfiles: {
            [invitation.fromUserId]: {
              uid: invitation.fromUserId,
              displayName: invitation.fromUserName,
              email: invitation.fromUserEmail,
            },
            [userId]: {
              uid: userId,
              displayName: myName,
              email: user.email || '',
            },
          },
          status: 'active',
          createdAt: now,
          updatedAt: now,
        };
        await setDoc(doc(db, 'shared_connections', connId), sanitizeForFirestore(connection));

        // 3. Notify sender
        const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const notif: SharedNotification = {
          id: notifId,
          userId: invitation.fromUserId,
          fromUserId: userId,
          fromUserName: myName,
          type: 'invitation_accepted',
          title: 'Convite Aceito!',
          message: `${myName} aceitou seu convite de Conta Compartilhada no SisFinz.`,
          data: { invitationId },
          isRead: false,
          status: 'resolved',
          createdAt: now,
        };
        await setDoc(doc(db, 'shared_notifications', notifId), sanitizeForFirestore(notif));
      } else {
        // Reject
        await setDoc(
          doc(db, 'shared_invitations', invitationId),
          { status: 'rejected', updatedAt: now },
          { merge: true }
        );

        // Notify sender
        const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const notif: SharedNotification = {
          id: notifId,
          userId: invitation.fromUserId,
          fromUserId: userId,
          fromUserName: myName,
          type: 'invitation_rejected',
          title: 'Convite Recusado',
          message: `${myName} recusou seu convite de Conta Compartilhada.`,
          data: { invitationId },
          isRead: false,
          status: 'resolved',
          createdAt: now,
        };
        await setDoc(doc(db, 'shared_notifications', notifId), sanitizeForFirestore(notif));
      }
    },
    [userId, user, receivedInvitations]
  );

  // Create a Shared Bill
  const createSharedBill = useCallback(
    async (params: {
      title: string;
      amount: number;
      dueDate: string;
      dueDay: number;
      category: string;
      notes?: string;
      partnerId: string;
      splitMethod: SplitMethod;
      myPercentage: number;
      partnerPercentage: number;
      isPendingRequest?: boolean;
      recurrence?: 'none' | 'monthly';
      recurrenceMonthsCount?: number;
    }): Promise<SharedBill> => {
      if (!userId || !user) throw new Error('Usuário não autenticado.');
      if (params.myPercentage + params.partnerPercentage !== 100) {
        throw new Error('A soma das porcentagens deve ser exatamente 100%.');
      }

      const billId = `sbill_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();
      const month = params.dueDate.substring(0, 7);

      const myShareAmount = Math.round((params.amount * params.myPercentage) / 100);
      const partnerShareAmount = params.amount - myShareAmount;

      const newBill: SharedBill = {
        id: billId,
        createdBy: userId,
        members: [userId, params.partnerId],
        title: params.title.trim(),
        amount: params.amount,
        dueDate: params.dueDate,
        dueDay: params.dueDay,
        month,
        category: params.category,
        notes: params.notes?.trim() || undefined,
        splitMethod: params.splitMethod,
        percentages: {
          [userId]: params.myPercentage,
          [params.partnerId]: params.partnerPercentage,
        },
        shares: {
          [userId]: {
            amount: myShareAmount,
            percentage: params.myPercentage,
            status: 'pending',
          },
          [params.partnerId]: {
            amount: partnerShareAmount,
            percentage: params.partnerPercentage,
            status: 'pending',
          },
        },
        status: 'pending',
        paymentResponsibility: null,
        shareRequest: params.isPendingRequest
          ? {
              status: 'pending',
              requestedTo: params.partnerId,
              requestedBy: userId,
              createdAt: now,
            }
          : undefined,
        createdAt: now,
        updatedAt: now,
        recurrence: params.recurrence || 'none',
        recurrenceMonthsCount: params.recurrenceMonthsCount,
        startMonth: month,
      };

      await setDoc(doc(db, 'shared_bills', billId), sanitizeForFirestore(newBill));

      // Send notification to partner
      const myName = user.displayName || user.email?.split('@')[0] || 'Usuário';
      const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const notif: SharedNotification = {
        id: notifId,
        userId: params.partnerId,
        fromUserId: userId,
        fromUserName: myName,
        type: params.isPendingRequest ? 'share_bill_request' : 'bill_created',
        title: params.isPendingRequest
          ? 'Solicitação para compartilhar fatura'
          : 'Nova fatura compartilhada criada',
        message: params.isPendingRequest
          ? `${myName} quer compartilhar a fatura "${params.title}" ($${params.amount.toLocaleString()} - sua parte: $${partnerShareAmount.toLocaleString()}).`
          : `${myName} adicionou a fatura compartilhada "${params.title}" (sua parte: $${partnerShareAmount.toLocaleString()}).`,
        data: { billId, amount: partnerShareAmount },
        isRead: false,
        status: params.isPendingRequest ? 'pending' : 'resolved',
        createdAt: now,
      };
      await setDoc(doc(db, 'shared_notifications', notifId), sanitizeForFirestore(notif));

      return newBill;
    },
    [userId, user]
  );

  // Update an existing Shared Bill
  const updateSharedBill = useCallback(
    async (
      billId: string,
      updates: {
        title: string;
        amount: number;
        dueDate: string;
        dueDay: number;
        category: string;
        notes?: string;
        splitMethod: SplitMethod;
        myPercentage: number;
        partnerPercentage: number;
      }
    ): Promise<void> => {
      if (!userId || !user) throw new Error('Usuário não autenticado.');
      const bill = sharedBills.find((b) => b.id === billId);
      if (!bill) throw new Error('Fatura não encontrada.');

      if (updates.myPercentage + updates.partnerPercentage !== 100) {
        throw new Error('As porcentagens devem somar 100%.');
      }

      const partnerId = bill.members.find((m) => m !== userId);
      if (!partnerId) throw new Error('Parceiro não encontrado.');

      const now = new Date().toISOString();
      const month = updates.dueDate.substring(0, 7);
      const myShareAmount = Math.round((updates.amount * updates.myPercentage) / 100);
      const partnerShareAmount = updates.amount - myShareAmount;

      const updatedShares = {
        [userId]: {
          ...bill.shares[userId],
          amount: myShareAmount,
          percentage: updates.myPercentage,
        },
        [partnerId]: {
          ...bill.shares[partnerId],
          amount: partnerShareAmount,
          percentage: updates.partnerPercentage,
        },
      };

      const updatedBillData: Partial<SharedBill> = {
        title: updates.title.trim(),
        amount: updates.amount,
        dueDate: updates.dueDate,
        dueDay: updates.dueDay,
        month,
        category: updates.category,
        notes: updates.notes?.trim() || undefined,
        splitMethod: updates.splitMethod,
        percentages: {
          [userId]: updates.myPercentage,
          [partnerId]: updates.partnerPercentage,
        },
        shares: updatedShares,
        updatedAt: now,
      };

      await setDoc(doc(db, 'shared_bills', billId), sanitizeForFirestore(updatedBillData), {
        merge: true,
      });

      // Send update notification to partner
      const myName = user.displayName || user.email?.split('@')[0] || 'Usuário';
      const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const notif: SharedNotification = {
        id: notifId,
        userId: partnerId,
        fromUserId: userId,
        fromUserName: myName,
        type: 'bill_updated',
        title: 'Fatura compartilhada atualizada',
        message: `${myName} atualizou a fatura "${updates.title}". O valor total agora é $${updates.amount.toLocaleString()} (sua parte: $${partnerShareAmount.toLocaleString()}).`,
        data: { billId, amount: partnerShareAmount },
        isRead: false,
        status: 'resolved',
        createdAt: now,
      };
      await setDoc(doc(db, 'shared_notifications', notifId), sanitizeForFirestore(notif));
    },
    [userId, user, sharedBills]
  );

  // Accept or reject a bill share request
  const respondShareBillRequest = useCallback(
    async (billId: string, accept: boolean): Promise<void> => {
      if (!userId || !user) throw new Error('Usuário não autenticado.');
      const bill = sharedBills.find((b) => b.id === billId);
      if (!bill) throw new Error('Fatura não encontrada.');

      const now = new Date().toISOString();
      const myName = user.displayName || user.email?.split('@')[0] || 'Usuário';
      const requesterId = bill.shareRequest?.requestedBy || bill.createdBy;

      if (accept) {
        await setDoc(
          doc(db, 'shared_bills', billId),
          {
            shareRequest: { status: 'accepted', requestedTo: userId, requestedBy: requesterId, createdAt: now },
            updatedAt: now,
          },
          { merge: true }
        );

        const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const notif: SharedNotification = {
          id: notifId,
          userId: requesterId,
          fromUserId: userId,
          fromUserName: myName,
          type: 'share_bill_accepted',
          title: 'Compartilhamento aceito',
          message: `${myName} aceitou compartilhar a fatura "${bill.title}".`,
          data: { billId },
          isRead: false,
          status: 'resolved',
          createdAt: now,
        };
        await setDoc(doc(db, 'shared_notifications', notifId), sanitizeForFirestore(notif));
      } else {
        // If rejected, mark request as rejected
        await setDoc(
          doc(db, 'shared_bills', billId),
          {
            shareRequest: { status: 'rejected', requestedTo: userId, requestedBy: requesterId, createdAt: now },
            updatedAt: now,
          },
          { merge: true }
        );

        const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const notif: SharedNotification = {
          id: notifId,
          userId: requesterId,
          fromUserId: userId,
          fromUserName: myName,
          type: 'share_bill_rejected',
          title: 'Compartilhamento recusado',
          message: `${myName} recusou o compartilhamento da fatura "${bill.title}".`,
          data: { billId },
          isRead: false,
          status: 'resolved',
          createdAt: now,
        };
        await setDoc(doc(db, 'shared_notifications', notifId), sanitizeForFirestore(notif));
      }
    },
    [userId, user, sharedBills]
  );


  // PAY FULL BILL TO CREDITOR (Occurrence aware)


  // SETTLE REIMBURSEMENT (Occurrence aware)


  // REFUND REIMBURSEMENT (Devolução)



  // Toggle my share status as paid/pending
  const toggleMySharePaid = useCallback(
    async (billId: string, isPaid: boolean, targetMonth?: string): Promise<void> => {
      if (!userId) throw new Error('Usuário não autenticado.');
      const bill = sharedBills.find((b) => b.id === billId);
      if (!bill) return;

      const effectiveMonth = targetMonth || bill.month || (bill.dueDate ? bill.dueDate.substring(0, 7) : '');
      const existingException = bill.exceptions?.[effectiveMonth] || {};
      const existingMonthShares = existingException.shares || bill.shares;
      const existingReimb = existingException.reimbursement || (bill.recurrence === 'none' ? bill.reimbursement : null);

      const now = new Date().toISOString();

      const updatedExceptionObj: any = {
        ...existingException,
        shares: {
          ...existingMonthShares,
          [userId]: {
            ...(existingMonthShares[userId] || {}),
            status: isPaid ? 'paid' : 'pending',
          },
        },
      };



      const payload: any = {
        exceptions: {
          ...(bill.exceptions || {}),
          [effectiveMonth]: updatedExceptionObj,
        },
        updatedAt: now,
      };

      if (bill.recurrence === 'none') {
        payload.shares = updatedExceptionObj.shares;
      }

      try {
        await runTransaction(db, async (tx) => {
          const billRef = doc(db, 'shared_bills', billId);
          const myShareAmount = updatedExceptionObj.shares[userId].amount;
          const expId = `exp_share_${bill.id}_${effectiveMonth}`;
          const expRef = doc(db, 'users', userId, 'expenses', expId);

          // Identify account
          let accountId = bill.accountId;
          if (!accountId) {
            const storedAccs = localStorage.getItem(`mc_acc_${userId}_accounts`);
            if (storedAccs) {
              const accountsList = JSON.parse(storedAccs);
              const defaultAcc = accountsList.find((a: any) => a.isActive !== false) || accountsList[0];
              accountId = defaultAcc?.id;
            }
          }

          const accRef = accountId ? doc(db, 'users', userId, 'accounts', accountId) : null;

          // UNCONDITIONAL READS FIRST (all tx.get before any writes)
          const expDoc = await tx.get(expRef);
          const accDoc = accRef ? await tx.get(accRef) : null;

          let revertAccRef: any = null;
          let revertAccountId = null;
          let revertAmount = 0;

          if (expDoc.exists()) {
            const expData = expDoc.data();
            revertAccountId = expData.accountId;
            revertAmount = Number(expData.amount) || 0;
          }

          if (revertAccountId && revertAccountId !== accountId) {
            revertAccRef = doc(db, 'users', userId, 'accounts', revertAccountId);
          }
          const revertAccDocResult = revertAccRef ? await tx.get(revertAccRef) : null;

          // WRITES NEXT
          tx.set(billRef, sanitizeForFirestore(payload), { merge: true });

          if (isPaid) {
            // Create Expense record
            tx.set(
              expRef,
              sanitizeForFirestore({
                id: expId,
                userId,
                name: `Minha parte: ${bill.title}`,
                amount: myShareAmount,
                date: now.slice(0, 10),
                category: bill.category || 'Contas Compartilhadas',
                notes: `Pagamento da minha participação na fatura compartilhada (Mês: ${effectiveMonth})`,
                accountId: accountId || null,
                isSharedGenerated: true,
                createdAt: now,
                updatedAt: now,
              })
            );

            // Update Account Balance
            if (accRef && accDoc && accDoc.exists()) {
              const currentBal = Number((accDoc.data() as any).currentBalance) || 0;
              tx.update(accRef, { 
                currentBalance: currentBal - myShareAmount,
                updatedAt: now
              });
            }

            // Create status record
            const statusId = `bill_sb_${bill.id}_${effectiveMonth}`;
            const statusRef = doc(db, 'users', userId, 'monthly_status', statusId);
            tx.set(statusRef, sanitizeForFirestore({
              id: statusId,
              userId,
              itemId: `sb_${bill.id}`,
              itemType: 'bill',
              month: effectiveMonth,
              isCompleted: true,
              completedAt: now,
            }));
          } else {
            // Revert Account Balance
            if (revertAccountId) {
              const targetRevertRef = revertAccountId === accountId ? accRef : revertAccRef;
              const targetRevertDoc = revertAccountId === accountId ? accDoc : revertAccDocResult;
              if (targetRevertRef && targetRevertDoc && targetRevertDoc.exists()) {
                const currentBal = Number((targetRevertDoc.data() as any).currentBalance) || 0;
                tx.update(targetRevertRef, { 
                  currentBalance: currentBal + revertAmount,
                  updatedAt: now
                });
              }
            }

            // Delete Expense and status
            tx.delete(expRef);
            const statusId = `bill_sb_${bill.id}_${effectiveMonth}`;
            const statusRef = doc(db, 'users', userId, 'monthly_status', statusId);
            tx.delete(statusRef);
          }
        });
        
        // Notify partner
        const partnerId = bill.members.find((m) => m !== userId);
        if (partnerId) {
            const notifId = `notif_paid_${billId}_${effectiveMonth}_${Date.now()}`;
            await setDoc(doc(db, 'shared_notifications', notifId), sanitizeForFirestore({
              id: notifId,
              userId: partnerId,
              fromUserId: userId,
              fromUserName: user?.displayName || 'Usuário',
              type: 'bill_paid',
              title: isPaid ? 'Parte da fatura paga' : 'Pagamento de parte da fatura revertido',
              message: isPaid ? `Eu marquei minha parte da fatura "${bill.title}" (${effectiveMonth}) como paga.` : `Marquei minha parte da fatura "${bill.title}" (${effectiveMonth}) como pendente novamente.`,
              isRead: false,
              status: 'resolved',
              createdAt: now,
            }));
        }
      } catch (err: any) {
        handleFirestoreError(err, OperationType.UPDATE, `shared_bills/${billId}`);
      }
    },
    [userId, sharedBills, user]
  );


  // Delete a shared bill (Creator executes global delete; participant only hides for themselves)
  const deleteSharedBill = useCallback(
    async (billId: string, skipConfirm = false): Promise<void> => {
      if (!userId) throw new Error('Usuário não autenticado.');
      if (isProcessing) return;

      const targetBill = sharedBills.find((b) => b.id === billId);
      if (!targetBill) return;

      const isCreator = targetBill.createdBy === userId;

      if (!skipConfirm) {
        if (isCreator) {
          if (
            !confirm(
              'Você é o criador desta fatura compartilhada. Deseja realmente excluí-la definitivamente para todos os participantes?'
            )
          ) {
            return;
          }
        } else {
          if (
            !confirm(
              'Como participante, esta fatura será apenas ocultada da sua visualização e continuará ativa para o criador. Deseja continuar?'
            )
          ) {
            return;
          }
        }
      }

      setIsProcessing(true);
      try {
        if (isCreator) {
          // Global delete executed only by the creator
          // 1. Delete associated expenses for this user
          const qExp = query(
            collection(db, 'users', userId, 'expenses'),
            where('id', '>=', `exp_pay_${billId}`),
            where('id', '<=', `exp_share_${billId}\uf8ff`)
          );
          const expSnap = await getDocs(qExp);
          const batch = writeBatch(db);
          expSnap.forEach((d) => batch.delete(d.ref));
          
          // 2. Delete the shared bill itself
          batch.delete(doc(db, 'shared_bills', billId));
          await batch.commit();
        } else {
          // Non-creator: hide from this user's view only, without modifying or deleting data for the creator
          const currentHidden = targetBill.hiddenForUsers || [];
          if (!currentHidden.includes(userId)) {
            const billRef = doc(db, 'shared_bills', billId);
            await setDoc(
              billRef,
              sanitizeForFirestore({
                hiddenForUsers: [...currentHidden, userId],
                updatedAt: new Date().toISOString(),
              }),
              { merge: true }
            );
          }
        }
      } catch (err: any) {
        handleFirestoreError(err, OperationType.DELETE, `shared_bills/${billId}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [userId, isProcessing, sharedBills]
  );

  const deleteSharedBillOccurrence = useCallback(
    async (
      billId: string,
      targetMonth: string,
      scope: 'this' | 'this_and_future'
    ) => {
      if (!userId) return;
      const targetBill = sharedBills.find((b) => b.id === billId);
      if (!targetBill) return;

      const now = new Date().toISOString();

      if (targetBill.recurrence === 'none') {
        await deleteSharedBill(billId, true);
        return;
      }

      if (scope === 'this') {
        const currentExceptions = targetBill.exceptions || {};
        const updatedExceptions = {
          ...currentExceptions,
          [targetMonth]: {
            ...currentExceptions[targetMonth],
            isDeleted: true,
          },
        };
        const partial = { exceptions: updatedExceptions, updatedAt: now };
        
        try {
          const billRef = doc(db, 'shared_bills', billId);
          await setDoc(billRef, sanitizeForFirestore(partial), { merge: true });
        } catch (err: any) {
          handleFirestoreError(err, OperationType.UPDATE, `shared_bills/${billId}`);
        }
        return;
      }

      // scope === 'this_and_future'
      const startM = targetBill.startMonth || targetBill.month || (targetBill.dueDate ? targetBill.dueDate.substring(0, 7) : '');
      const diff = getMonthDiff(startM, targetMonth);
      
      if (diff <= 0) {
        await deleteSharedBill(billId, true);
        return;
      }

      const cappedOriginal: Partial<SharedBill> = {
        recurrenceMonthsCount: diff,
        updatedAt: now,
      };
      
      try {
        const oldRef = doc(db, 'shared_bills', billId);
        await setDoc(oldRef, sanitizeForFirestore(cappedOriginal), { merge: true });
      } catch (err: any) {
        handleFirestoreError(err, OperationType.UPDATE, `shared_bills/${billId}`);
      }
    },
    [userId, sharedBills, deleteSharedBill]
  );

  // Mark notification as read
  const markNotificationRead = useCallback(
    async (notifId: string): Promise<void> => {
      if (!userId) return;
      try {
        await setDoc(doc(db, 'shared_notifications', notifId), { isRead: true }, { merge: true });
      } catch (err: any) {
        handleFirestoreError(err, OperationType.UPDATE, `shared_notifications/${notifId}`);
      }
    },
    [userId]
  );

  // Mark all notifications as read
  const markAllNotificationsRead = useCallback(async (): Promise<void> => {
    if (!userId) return;
    try {
      const unread = sharedNotifications.filter((n) => !n.isRead);
      if (unread.length === 0) return;
      
      const promises = unread.map((n) =>
        setDoc(doc(db, 'shared_notifications', n.id), { isRead: true }, { merge: true })
      );
      await Promise.all(promises);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, 'shared_notifications/all');
    }
  }, [userId, sharedNotifications]);

  const clearNotifications = useCallback(async (): Promise<void> => {
    if (!userId) return;
    try {
      const q = query(collection(db, 'shared_notifications'), where('userId', '==', userId));
      const snap = await getDocs(q);
      const promises = snap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(promises);
      setSharedNotifications([]);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, 'shared_notifications');
    }
  }, [userId]);



  const stopSharingAndConvert = useCallback(
    async (
      connectionId: string,
      options: { conversionRule: 'total' | 'my_share'; recurrenceScope: 'this_month' | 'future' }
    ): Promise<void> => {
      if (!userId || !user) throw new Error('Usuário não autenticado.');
      
      const conn = connections.find((c) => c.id === connectionId);
      if (!conn) throw new Error('Conexão não encontrada.');

      const now = new Date().toISOString();
      const partnerId = conn.members.find((m) => m !== userId);
      const currentMonth = getCurrentMonthStr();

      await runTransaction(db, async (tx) => {
        // 1. Only cancel connection if stopping future/permanent sharing
        if (options.recurrenceScope === 'future') {
          const connRef = doc(db, 'shared_connections', connectionId);
          tx.update(connRef, { status: 'cancelled', updatedAt: now });
        }

        // 2. Convert bills
        const billsToConvert = sharedBills.filter((b) => b.members.includes(userId) && b.members.includes(partnerId!));
        for (const bill of billsToConvert) {
          const myShare = bill.shares[userId];
          const amount = options.conversionRule === 'total' ? bill.amount : (myShare?.amount || bill.amount);
          
          if (options.recurrenceScope === 'this_month') {
            // Stop sharing ONLY this month:
            // 1. Create personal bill for this single month
            const personalBillId = `bill_${bill.id}_${currentMonth}`;
            const billRef = doc(db, 'users', userId, 'bills', personalBillId);
            tx.set(billRef, {
              id: personalBillId,
              userId,
              name: bill.title,
              amount,
              dueDate: bill.dueDate,
              dueDay: bill.dueDay,
              category: bill.category,
              recurrence: 'none',
              startMonth: currentMonth,
              createdAt: now,
              updatedAt: now,
            });

            // 2. Mark this month occurrence as deleted only for this user
            const sBillRef = doc(db, 'shared_bills', bill.id);
            const currentEx = bill.exceptions?.[currentMonth] || {};
            const deletedUsers = Array.isArray(currentEx.deletedForUsers) ? currentEx.deletedForUsers : [];
            const nextDeletedUsers = deletedUsers.includes(userId) ? deletedUsers : [...deletedUsers, userId];
            const updatedExceptions = {
              ...(bill.exceptions || {}),
              [currentMonth]: {
                ...currentEx,
                deletedForUsers: nextDeletedUsers,
              },
            };
            tx.update(sBillRef, { exceptions: updatedExceptions, updatedAt: now });
          } else {
            // Stop sharing future/permanent: create personal recurring bill and hide shared series
            const billRef = doc(db, 'users', userId, 'bills', `bill_${bill.id}`);
            tx.set(billRef, {
              id: `bill_${bill.id}`,
              userId,
              name: bill.title,
              amount,
              dueDate: bill.dueDate,
              dueDay: bill.dueDay,
              category: bill.category,
              recurrence: bill.recurrence || 'none',
              startMonth: bill.month || currentMonth,
              createdAt: now,
              updatedAt: now,
            });

            const sBillRef = doc(db, 'shared_bills', bill.id);
            tx.update(sBillRef, { hiddenForUsers: [...(bill.hiddenForUsers || []), userId], updatedAt: now });
          }
        }
      });
    },
    [userId, user, connections, sharedBills]
  );

  const memoizedSharedBills = useMemo(() => sharedBills.filter(b => !b.hiddenForUsers?.includes(userId!)), [sharedBills, userId]);

  return useMemo(() => ({
    connections,
    activePartners,
    receivedInvitations,
    sentInvitations,
    sharedBills: memoizedSharedBills,
    sharedNotifications,
    unreadNotificationsCount,
    pendingReceivedInvitationsCount,
    loading,
    isProcessing,
    searchUserByEmail,
    sendInvitation,
    respondInvitation,
    createSharedBill,
    updateSharedBill,
    respondShareBillRequest,
    deleteSharedBill,
    deleteSharedBillOccurrence,
    toggleMySharePaid,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    stopSharingAndConvert,
  }), [
    connections,
    activePartners,
    receivedInvitations,
    sentInvitations,
    memoizedSharedBills,
    sharedNotifications,
    unreadNotificationsCount,
    pendingReceivedInvitationsCount,
    loading,
    isProcessing,
    searchUserByEmail,
    sendInvitation,
    respondInvitation,
    createSharedBill,
    updateSharedBill,
    respondShareBillRequest,
    deleteSharedBill,
    deleteSharedBillOccurrence,
    toggleMySharePaid,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    stopSharingAndConvert
  ]);
}




// ==========================================
// Firestore Error Handling
// ==========================================

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: 'authenticated', // Simplified for client side
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
