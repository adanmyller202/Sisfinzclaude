/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

export function useVoicePreferences() {
  const { user } = useAuth();
  const userId = user?.uid;
  const [userPreferences, setUserPreferences] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!userId) {
      setUserPreferences({});
      return;
    }

    const prefRef = doc(db, 'users', userId, 'settings', 'voice_category_map');
    const unsubscribe = onSnapshot(
      prefRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setUserPreferences(snapshot.data() as Record<string, string>);
        } else {
          setUserPreferences({});
        }
      },
      (err) => {
        console.warn('Error fetching voice category preferences:', err);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  const saveCategoryPreference = useCallback(
    async (description: string, category: string) => {
      if (!userId || !description || !category) return;
      const cleanKeyword = description.trim().toLowerCase();
      if (cleanKeyword.length < 2) return;

      const prefRef = doc(db, 'users', userId, 'settings', 'voice_category_map');
      const updateObj = { [cleanKeyword]: category };

      setUserPreferences((prev) => ({ ...prev, [cleanKeyword]: category }));

      try {
        await setDoc(prefRef, updateObj, { merge: true });
      } catch (err) {
        console.warn('Failed to save category preference to Firestore:', err);
      }
    },
    [userId]
  );

  return {
    userPreferences,
    saveCategoryPreference,
  };
}
