import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChallengeGoal,
  DepositRecord,
  AppSettings,
  CurrencyCode,
  Achievement,
} from '../types';
import {
  triggerCelebration,
  playSuccessChime,
} from '../utils/storage';
import {
  calculateChallengeSum,
  generateDynamicSquares,
  generateEqualSquares,
  getGoalSquares,
  getGoalSavedAmount,
  recalculatePendingSquares,
  detectUserCurrency,
} from '../utils/currency';
import { ACHIEVEMENTS } from '../utils/achievements';
import { useAuth } from '../context/AuthContext';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, sanitizeForFirestore } from '../firebase/config';
import { registerPendingWrite, registerResolvedWrite } from './useSyncStatus';

const DEFAULT_SETTINGS: AppSettings = {
  currency: detectUserCurrency(),
  darkMode: false,
  soundEnabled: true,
  language: 'pt',
};

export function useMoneyChallenge() {
  const { user } = useAuth();
  const userId = user?.uid;

  const getLocalKey = useCallback(
    (sub: string) => (userId ? `mc_ch_${userId}_${sub}` : `mc_ch_anon_${sub}`),
    [userId]
  );

  const [goals, setGoals] = useState<ChallengeGoal[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('mc_ch_anon_goals');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [activeGoalId, setActiveGoalId] = useState<string>('');
  const [settings, setSettings] = useState<AppSettings>(() => {
    // Check initial dark mode from localStorage, system, or default
    let initialDark = false;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('mone_dark_mode');
      if (stored !== null) {
        initialDark = stored === 'true';
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        initialDark = true;
      }
    }
    return { ...DEFAULT_SETTINGS, darkMode: initialDark };
  });
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  const [recentAchievement, setRecentAchievement] = useState<Achievement | null>(null);
  const [justFinishedAll, setJustFinishedAll] = useState(false);

  // Sync dark mode class on <html> and <body> and persist locally
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
      document.body?.classList.add('dark');
      try {
        localStorage.setItem('mone_dark_mode', 'true');
      } catch {}
    } else {
      document.documentElement.classList.remove('dark');
      document.body?.classList.remove('dark');
      try {
        localStorage.setItem('mone_dark_mode', 'false');
      } catch {}
    }
  }, [settings.darkMode]);

  // Real-time synchronization with Firestore for the authenticated user
  useEffect(() => {
    if (!userId) {
      setGoals([]);
      setActiveGoalId('');
      setUnlockedAchievements([]);
      setLoadingData(false);
      return;
    }

    // Immediately hydrate from local storage so UI renders immediately offline!
    try {
      const storedGoals = localStorage.getItem(getLocalKey('goals'));
      if (storedGoals) {
        const parsed = JSON.parse(storedGoals);
        setGoals(parsed);
        const storedActiveId = localStorage.getItem(getLocalKey('activeGoalId'));
        if (storedActiveId && parsed.some((g: ChallengeGoal) => g.id === storedActiveId)) {
          setActiveGoalId(storedActiveId);
        } else if (parsed.length > 0) {
          setActiveGoalId(parsed[0].id);
        }
      }
      const storedSettings = localStorage.getItem(getLocalKey('settings'));
      if (storedSettings) {
        setSettings((prev) => ({ ...prev, ...JSON.parse(storedSettings) }));
      }
      const storedAch = localStorage.getItem(getLocalKey('achievements'));
      if (storedAch) {
        setUnlockedAchievements(JSON.parse(storedAch));
      }
    } catch {}

    setLoadingData(true);

    const goalsPath = `users/${userId}/goals`;
    const goalsColRef = collection(db, 'users', userId, 'goals');

    // Subscribe to user goals
    const unsubscribeGoals = onSnapshot(
      goalsColRef,
      (snapshot) => {
        const loadedGoals: ChallengeGoal[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as ChallengeGoal;
          loadedGoals.push({
            ...data,
            id: docSnap.id,
            completedSquares: data.completedSquares || [],
            history: data.history || [],
          });
        });

        // Sort by createdAt descending
        loadedGoals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        setGoals(loadedGoals);
        try {
          localStorage.setItem(getLocalKey('goals'), JSON.stringify(loadedGoals));
        } catch {}

        setActiveGoalId((prev) => {
          const nextId = prev && loadedGoals.some((g) => g.id === prev)
            ? prev
            : (loadedGoals.length > 0 ? loadedGoals[0].id : '');
          try {
            if (nextId) localStorage.setItem(getLocalKey('activeGoalId'), nextId);
          } catch {}
          return nextId;
        });
        setLoadingData(false);
      },
      (error) => {
        console.warn('Goals offline / cached load:', error);
        setLoadingData(false);
      }
    );

    // Subscribe to user settings
    const settingsPath = `users/${userId}/settings/user_settings`;
    const settingsDocRef = doc(db, 'users', userId, 'settings', 'user_settings');

    const unsubscribeSettings = onSnapshot(
      settingsDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const sData = docSnap.data();
          if (
            sData.currency ||
            sData.darkMode !== undefined ||
            sData.soundEnabled !== undefined ||
            sData.language
          ) {
            setSettings((prev) => {
              const updated = {
                currency: sData.currency || prev.currency,
                darkMode: sData.darkMode !== undefined ? sData.darkMode : prev.darkMode,
                soundEnabled: sData.soundEnabled !== undefined ? sData.soundEnabled : prev.soundEnabled,
                language: sData.language || prev.language || 'pt',
              };
              try {
                localStorage.setItem(getLocalKey('settings'), JSON.stringify(updated));
              } catch {}
              return updated;
            });
          }
          if (Array.isArray(sData.unlockedAchievements)) {
            setUnlockedAchievements(sData.unlockedAchievements);
            try {
              localStorage.setItem(getLocalKey('achievements'), JSON.stringify(sData.unlockedAchievements));
            } catch {}
          }
          if (sData.activeGoalId) {
            setActiveGoalId(sData.activeGoalId);
            try {
              localStorage.setItem(getLocalKey('activeGoalId'), sData.activeGoalId);
            } catch {}
          }
        }
      },
      (error) => {
        console.warn('Settings offline / cached load:', error);
      }
    );

    return () => {
      unsubscribeGoals();
      unsubscribeSettings();
    };
  }, [userId, getLocalKey]);

  // Current active goal
  const activeGoal = useMemo<ChallengeGoal | null>(() => {
    if (goals.length === 0) return null;
    const found = goals.find((g) => g.id === activeGoalId);
    return found || goals[0] || null;
  }, [goals, activeGoalId]);

  // Active currency: ALWAYS prioritize user's settings.currency so that changes in settings propagate across the entire application immediately!
  const activeCurrency = useMemo<CurrencyCode>(() => {
    return settings.currency || activeGoal?.currency || detectUserCurrency();
  }, [settings.currency, activeGoal?.currency]);

  // Active goal squares
  const activeGoalSquares = useMemo(() => {
    if (!activeGoal) return [];
    return getGoalSquares(activeGoal);
  }, [activeGoal]);

  // Financial calculations
  const savedAmount = useMemo(() => {
    if (!activeGoal) return 0;
    return getGoalSavedAmount(activeGoal);
  }, [activeGoal]);

  const targetAmount = activeGoal?.totalTarget || 0;

  const remainingAmount = useMemo(() => {
    return Math.max(0, targetAmount - savedAmount);
  }, [targetAmount, savedAmount]);

  const financialProgressPercent = useMemo(() => {
    if (targetAmount <= 0) return 0;
    const pct = (savedAmount / targetAmount) * 100;
    return Math.min(100, Number(pct.toFixed(2)));
  }, [savedAmount, targetAmount]);

  // Squares calculations
  const completedSquaresCount = activeGoal?.completedSquares?.length || 0;
  const totalSquaresCount = activeGoal?.totalSquares || activeGoalSquares.length || 0;

  const squaresProgressPercent = useMemo(() => {
    if (totalSquaresCount <= 0) return 0;
    const pct = (completedSquaresCount / totalSquaresCount) * 100;
    return Math.min(100, Number(pct.toFixed(2)));
  }, [completedSquaresCount, totalSquaresCount]);

  const isCompleted = completedSquaresCount >= totalSquaresCount && totalSquaresCount > 0;

  // Check achievements after goal updates
  const checkAchievements = useCallback(
    async (updatedGoal: ChallengeGoal, currentUnlocked: string[]) => {
      if (!user) return currentUnlocked;

      const newlyUnlocked: Achievement[] = [];
      const updatedList = [...currentUnlocked];

      for (const achievement of ACHIEVEMENTS) {
        const key = `${updatedGoal.id}_${achievement.id}`;
        if (!updatedList.includes(key)) {
          if (achievement.isUnlocked(updatedGoal)) {
            updatedList.push(key);
            newlyUnlocked.push(achievement);
          }
        }
      }

      if (newlyUnlocked.length > 0) {
        const latest = newlyUnlocked[newlyUnlocked.length - 1];
        setRecentAchievement(latest);
        if (settings.soundEnabled) {
          playSuccessChime();
        }
        triggerCelebration(latest.id === 'completed_all' ? 'major' : 'small');

        // Persist unlocked achievements in Firestore and localStorage
        try {
          localStorage.setItem(getLocalKey('achievements'), JSON.stringify(updatedList));
        } catch {}

        registerPendingWrite();
        const settingsPath = `users/${user.uid}/settings/user_settings`;
        try {
          await setDoc(
            doc(db, 'users', user.uid, 'settings', 'user_settings'),
            { unlockedAchievements: updatedList },
            { merge: true }
          );
        } catch (err) {
          console.warn('Achievements saved locally, will sync when online:', err);
        } finally {
          registerResolvedWrite();
        }
      }

      return updatedList;
    },
    [user, settings.soundEnabled, getLocalKey]
  );

  // Complete a square (deposit made)
  const completeSquare = useCallback(
    async (squareId: number) => {
      if (!user || !activeGoal) return;
      if (activeGoal.completedSquares.includes(squareId)) return;

      const squares = getGoalSquares(activeGoal);
      const squareObj = squares.find((s) => s.id === squareId);
      const exactAmount = squareObj ? squareObj.value : squareId;

      const record: DepositRecord = {
        id: `dep-${Date.now()}-${squareId}`,
        squareNumber: squareId,
        amount: exactAmount,
        timestamp: new Date().toISOString(),
      };

      const nextCompleted = [...activeGoal.completedSquares, squareId];
      const nextHistory = [record, ...activeGoal.history];

      const updatedGoal: ChallengeGoal = {
        ...activeGoal,
        completedSquares: nextCompleted,
        history: nextHistory,
        updatedAt: new Date().toISOString(),
      };

      // Optimistic state update & immediate localStorage persistence
      setGoals((prev) => {
        const updated = prev.map((g) => (g.id === activeGoal.id ? updatedGoal : g));
        try {
          localStorage.setItem(getLocalKey('goals'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      const path = `users/${user.uid}/goals/${activeGoal.id}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'goals', activeGoal.id), sanitizeForFirestore(updatedGoal));
      } catch (err) {
        console.warn('Square completion saved locally, will sync when online:', err);
      } finally {
        registerResolvedWrite();
      }

      await checkAchievements(updatedGoal, unlockedAchievements);

      const total = updatedGoal.totalSquares || getGoalSquares(updatedGoal).length;
      if (nextCompleted.length >= total) {
        setJustFinishedAll(true);
        triggerCelebration('major');
      } else if (settings.soundEnabled) {
        playSuccessChime();
      }
    },
    [user, activeGoal, checkAchievements, unlockedAchievements, settings.soundEnabled, getLocalKey]
  );

  // Uncomplete a square (undo deposit)
  const uncompleteSquare = useCallback(
    async (squareId: number) => {
      if (!user || !activeGoal) return;

      const nextCompleted = activeGoal.completedSquares.filter((n) => n !== squareId);
      const nextHistory = activeGoal.history.filter((h) => h.squareNumber !== squareId);

      const updatedGoal: ChallengeGoal = {
        ...activeGoal,
        completedSquares: nextCompleted,
        history: nextHistory,
        updatedAt: new Date().toISOString(),
      };

      // Optimistic state update & immediate localStorage persistence
      setGoals((prev) => {
        const updated = prev.map((g) => (g.id === activeGoal.id ? updatedGoal : g));
        try {
          localStorage.setItem(getLocalKey('goals'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      const path = `users/${user.uid}/goals/${activeGoal.id}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'goals', activeGoal.id), sanitizeForFirestore(updatedGoal));
      } catch (err) {
        console.warn('Square undo saved locally, will sync when online:', err);
      } finally {
        registerResolvedWrite();
      }
    },
    [user, activeGoal, getLocalKey]
  );

  // Add ad-hoc avulso deposit of ANY amount and recalculate remaining squares
  const addAvulsoDeposit = useCallback(
    async (amount: number, note?: string) => {
      if (!user || !activeGoal || amount <= 0) return;

      const record: DepositRecord = {
        id: `dep-avulso-${Date.now()}`,
        squareNumber: 0,
        amount,
        timestamp: new Date().toISOString(),
        isAvulso: true,
        note: note || 'Depósito Avulso',
      };

      const nextHistory = [record, ...activeGoal.history];
      const tempGoal: ChallengeGoal = {
        ...activeGoal,
        history: nextHistory,
      };
      const newSaved = getGoalSavedAmount(tempGoal);
      const newRemaining = Math.max(0, activeGoal.totalTarget - newSaved);

      const updatedSquares = recalculatePendingSquares(tempGoal, newRemaining);

      const updatedGoal: ChallengeGoal = {
        ...activeGoal,
        history: nextHistory,
        squares: updatedSquares,
        totalSquares: updatedSquares.length,
        updatedAt: new Date().toISOString(),
      };

      // Optimistic state update & immediate localStorage persistence
      setGoals((prev) => {
        const updated = prev.map((g) => (g.id === activeGoal.id ? updatedGoal : g));
        try {
          localStorage.setItem(getLocalKey('goals'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      const path = `users/${user.uid}/goals/${activeGoal.id}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'goals', activeGoal.id), sanitizeForFirestore(updatedGoal));
      } catch (err) {
        console.warn('Avulso deposit saved locally, will sync when online:', err);
      } finally {
        registerResolvedWrite();
      }

      await checkAchievements(updatedGoal, unlockedAchievements);

      if (newRemaining <= 0) {
        setJustFinishedAll(true);
        triggerCelebration('major');
      } else {
        triggerCelebration('small');
        if (settings.soundEnabled) {
          playSuccessChime();
        }
      }
    },
    [user, activeGoal, checkAchievements, unlockedAchievements, settings.soundEnabled, getLocalKey]
  );

  // Undo an avulso deposit
  const undoAvulsoDeposit = useCallback(
    async (recordId: string) => {
      if (!user || !activeGoal) return;

      const nextHistory = activeGoal.history.filter((h) => h.id !== recordId);
      const tempGoal: ChallengeGoal = {
        ...activeGoal,
        history: nextHistory,
      };
      const newSaved = getGoalSavedAmount(tempGoal);
      const newRemaining = Math.max(0, activeGoal.totalTarget - newSaved);

      const updatedSquares = recalculatePendingSquares(tempGoal, newRemaining);

      const updatedGoal: ChallengeGoal = {
        ...activeGoal,
        history: nextHistory,
        squares: updatedSquares,
        totalSquares: updatedSquares.length,
        updatedAt: new Date().toISOString(),
      };

      // Optimistic state update & immediate localStorage persistence
      setGoals((prev) => {
        const updated = prev.map((g) => (g.id === activeGoal.id ? updatedGoal : g));
        try {
          localStorage.setItem(getLocalKey('goals'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      const path = `users/${user.uid}/goals/${activeGoal.id}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'goals', activeGoal.id), sanitizeForFirestore(updatedGoal));
      } catch (err) {
        console.warn('Undo avulso deposit saved locally, will sync when online:', err);
      } finally {
        registerResolvedWrite();
      }
    },
    [user, activeGoal, getLocalKey]
  );

  // Create a new goal for the authenticated user
  const createGoal = useCallback(
    async (params: {
      title: string;
      icon: string;
      targetAmount?: number;
      initialValue?: number;
      currency?: CurrencyCode;
      notes?: string;
      startNumber?: number;
      endNumber?: number;
      squaresMode?: 'equal' | 'progressive';
      squaresCount?: number;
      squares?: ReturnType<typeof generateDynamicSquares>;
      totalSquares?: number;
    }) => {
      if (!user) {
        throw new Error('Você precisa estar autenticado para criar um objetivo.');
      }

      let squares: ReturnType<typeof generateDynamicSquares> | undefined;
      let totalTarget = 0;
      let totalSquares = 0;
      const currency = params.currency || settings.currency || 'BRL';

      if (params.squares && params.squares.length > 0) {
        squares = params.squares;
        totalSquares = params.totalSquares || squares.length;
        totalTarget = params.targetAmount || squares.reduce((sum, s) => sum + s.value, 0);
      } else if (params.squaresMode === 'equal' && params.targetAmount && params.squaresCount) {
        squares = generateEqualSquares(params.targetAmount, params.squaresCount);
        totalTarget = params.targetAmount;
        totalSquares = squares.length;
      } else if (params.targetAmount && params.initialValue) {
        squares = generateDynamicSquares(params.targetAmount, params.initialValue);
        totalTarget = params.targetAmount;
        totalSquares = squares.length;
      } else {
        const start = Math.max(1, Math.min(params.startNumber || 1, params.endNumber || 200));
        const end = Math.max(start, params.endNumber || 200);
        totalTarget = calculateChallengeSum(start, end);
        totalSquares = end - start + 1;
      }

      const goalId = `goal-${Date.now()}`;
      const newGoal: ChallengeGoal = {
        id: goalId,
        userId: user.uid,
        title: params.title.trim() || `Meta ${params.icon || '🎯'}`,
        icon: params.icon || '🎯',
        currency,
        targetAmount: params.targetAmount || totalTarget,
        startAmount: params.initialValue || (squares && squares.length > 0 ? squares[0].value : 1),
        squaresMode: params.squaresMode || (params.squaresCount ? 'equal' : 'progressive'),
        squaresCount: params.squaresCount || totalSquares,
        totalTarget,
        totalSquares,
        squares: squares || [],
        completedSquares: [],
        history: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (params.notes?.trim()) {
        newGoal.notes = params.notes.trim();
      }
      if (params.startNumber !== undefined) {
        newGoal.startNumber = params.startNumber;
      }
      if (params.endNumber !== undefined) {
        newGoal.endNumber = params.endNumber;
      }

      // Optimistic update & immediate localStorage persistence
      setGoals((prev) => {
        const updated = [newGoal, ...prev.filter((g) => g.id !== goalId)];
        try {
          localStorage.setItem(getLocalKey('goals'), JSON.stringify(updated));
          localStorage.setItem(getLocalKey('activeGoalId'), goalId);
        } catch {}
        return updated;
      });
      setActiveGoalId(goalId);

      registerPendingWrite();
      const path = `users/${user.uid}/goals/${goalId}`;
      try {
        const payload = sanitizeForFirestore(newGoal);
        await setDoc(doc(db, 'users', user.uid, 'goals', goalId), payload);
      } catch (err) {
        console.warn('Goal saved locally, will sync when online:', err);
      } finally {
        registerResolvedWrite();
      }

      return newGoal;
    },
    [user, settings.currency, getLocalKey]
  );

  // Edit current goal details
  const updateGoal = useCallback(
    async (goalId: string, params: { title?: string; icon?: string; notes?: string }) => {
      if (!user) return;

      const targetG = goals.find((g) => g.id === goalId);
      if (!targetG) return;

      const updatedGoal: ChallengeGoal = {
        ...targetG,
        title: params.title !== undefined ? params.title.trim() || targetG.title : targetG.title,
        icon: params.icon !== undefined ? params.icon : targetG.icon,
        notes: params.notes !== undefined ? params.notes : targetG.notes,
        updatedAt: new Date().toISOString(),
      };

      // Optimistic update & immediate localStorage persistence
      setGoals((prev) => {
        const updated = prev.map((g) => (g.id === goalId ? updatedGoal : g));
        try {
          localStorage.setItem(getLocalKey('goals'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      const path = `users/${user.uid}/goals/${goalId}`;
      try {
        const payload = sanitizeForFirestore(updatedGoal);
        await setDoc(doc(db, 'users', user.uid, 'goals', goalId), payload);
      } catch (err) {
        console.warn('Goal update saved locally, will sync when online:', err);
      } finally {
        registerResolvedWrite();
      }
    },
    [user, goals, getLocalKey]
  );

  // Delete a goal
  const deleteGoal = useCallback(
    async (goalId: string) => {
      if (!user) return;

      // Optimistic removal & immediate localStorage persistence
      setGoals((prev) => {
        const updated = prev.filter((g) => g.id !== goalId);
        try {
          localStorage.setItem(getLocalKey('goals'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      const path = `users/${user.uid}/goals/${goalId}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'goals', goalId));
      } catch (err) {
        console.warn('Goal delete saved locally, will sync when online:', err);
      } finally {
        registerResolvedWrite();
      }

      // Also clean up any goal dream photo
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'goal_images', goalId));
      } catch (err) {
        console.warn('Could not delete goal image doc:', err);
      }
    },
    [user, getLocalKey]
  );

  // Switch active goal
  const switchGoal = useCallback(
    async (goalId: string) => {
      setActiveGoalId(goalId);
      try {
        localStorage.setItem(getLocalKey('activeGoalId'), goalId);
      } catch {}

      if (user) {
        registerPendingWrite();
        try {
          await setDoc(
            doc(db, 'users', user.uid, 'settings', 'user_settings'),
            { activeGoalId: goalId },
            { merge: true }
          );
        } catch {
          // Non-critical if failed
        } finally {
          registerResolvedWrite();
        }
      }
    },
    [user, getLocalKey]
  );

  // Update settings in Firestore
  const updateSettings = useCallback(
    async (partial: Partial<AppSettings>) => {
      setSettings((prev) => {
        const updated = { ...prev, ...partial };
        try {
          localStorage.setItem(getLocalKey('settings'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      if (user) {
        registerPendingWrite();
        const path = `users/${user.uid}/settings/user_settings`;
        try {
          await setDoc(
            doc(db, 'users', user.uid, 'settings', 'user_settings'),
            sanitizeForFirestore(partial),
            { merge: true }
          );
        } catch (err) {
          console.warn('Settings updated locally, will sync when online:', err);
        } finally {
          registerResolvedWrite();
        }
      }
    },
    [user, getLocalKey]
  );

  // Reset active goal progress in Firestore
  const resetActiveGoal = useCallback(async () => {
    if (!user || !activeGoal) return;

    const updatedGoal: ChallengeGoal = {
      ...activeGoal,
      completedSquares: [],
      history: [],
      updatedAt: new Date().toISOString(),
    };

    // Optimistic state update & immediate localStorage persistence
    setGoals((prev) => {
      const updated = prev.map((g) => (g.id === activeGoal.id ? updatedGoal : g));
      try {
        localStorage.setItem(getLocalKey('goals'), JSON.stringify(updated));
      } catch {}
      return updated;
    });

    registerPendingWrite();
    const path = `users/${user.uid}/goals/${activeGoal.id}`;
    try {
      await setDoc(doc(db, 'users', user.uid, 'goals', activeGoal.id), sanitizeForFirestore(updatedGoal));
    } catch (err) {
      console.warn('Goal reset saved locally, will sync when online:', err);
    } finally {
      registerResolvedWrite();
    }
  }, [user, activeGoal, getLocalKey]);

  // Reset all application goals for this user in Firestore
  const resetAllData = useCallback(async () => {
    if (!user) return;

    try {
      localStorage.removeItem(getLocalKey('goals'));
      localStorage.removeItem(getLocalKey('activeGoalId'));
    } catch {}

    setGoals([]);
    setActiveGoalId('');

    registerPendingWrite();
    try {
      const snapshot = await getDocs(collection(db, 'users', user.uid, 'goals'));
      const batchPromises: Promise<any>[] = [];
      snapshot.forEach((docSnap) => {
        batchPromises.push(deleteDoc(doc(db, 'users', user.uid, 'goals', docSnap.id)));
      });
      await Promise.all(batchPromises);
    } catch (err) {
      console.warn('Error wiping goals from Firestore:', err);
    } finally {
      registerResolvedWrite();
    }
  }, [user, getLocalKey]);

  // Export current user data as JSON file
  const exportData = useCallback(() => {
    const backup = {
      userId: user?.uid,
      exportedAt: new Date().toISOString(),
      goals,
      settings,
      unlockedAchievements,
    };
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(backup, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute(
      'download',
      `sisfinz-backup-${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }, [user?.uid, goals, settings, unlockedAchievements]);

  // Import data to current user account
  const importData = useCallback(
    async (jsonString: string): Promise<boolean> => {
      if (!user) return false;
      try {
        const parsed = JSON.parse(jsonString);
        const importedGoals: ChallengeGoal[] = parsed.goals || [];
        if (!Array.isArray(importedGoals) || importedGoals.length === 0) {
          throw new Error('Nenhum objetivo encontrado no arquivo.');
        }

        for (const g of importedGoals) {
          if (!g.id) continue;
          await setDoc(doc(db, 'users', user.uid, 'goals', g.id), {
            ...g,
            userId: user.uid,
            updatedAt: new Date().toISOString(),
          });
        }
        return true;
      } catch (err) {
        console.error('Import error:', err);
        return false;
      }
    },
    [user]
  );

  return {
    goals,
    activeGoal,
    activeCurrency,
    activeGoalSquares,
    savedAmount,
    targetAmount,
    remainingAmount,
    financialProgressPercent,
    completedSquaresCount,
    totalSquaresCount,
    squaresProgressPercent,
    isCompleted,
    loadingData,
    settings,
    unlockedAchievements,
    recentAchievement,
    clearRecentAchievement: () => setRecentAchievement(null),
    justFinishedAll,
    clearJustFinishedAll: () => setJustFinishedAll(false),
    completeSquare,
    uncompleteSquare,
    addAvulsoDeposit,
    undoAvulsoDeposit,
    createGoal,
    updateGoal,
    deleteGoal,
    switchGoal,
    updateSettings,
    resetActiveGoal,
    resetAllData,
    exportData,
    importData,
  };
}
