/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db, sanitizeForFirestore } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { CustomCategory, CategoryScope } from '../types';
import { BILL_CATEGORIES, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../utils/finance';
import { registerPendingWrite, registerResolvedWrite } from './useSyncStatus';

export interface DisplayCategory {
  id: string;
  name: string;
  originalName?: string;
  scope: CategoryScope;
  color?: string;
  isPredefined: boolean;
}

interface PredefinedOverrides {
  deleted: string[];
  renamed: Record<string, { name: string; scope?: CategoryScope; color?: string }>;
}

export function useCategories() {
  const { user } = useAuth();
  const userId = user?.uid;

  const getLocalKey = useCallback(
    (sub: string) => (userId ? `mc_cat_${userId}_${sub}` : `mc_cat_anon_${sub}`),
    [userId]
  );

  // Initial state hydrated instantly from localStorage for offline startup
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>(() => {
    if (!userId || typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(`mc_cat_${userId}_custom`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [predefinedOverrides, setPredefinedOverrides] = useState<PredefinedOverrides>(() => {
    if (!userId || typeof window === 'undefined') return { deleted: [], renamed: {} };
    try {
      const stored = localStorage.getItem(`mc_cat_${userId}_overrides`);
      return stored ? JSON.parse(stored) : { deleted: [], renamed: {} };
    } catch {
      return { deleted: [], renamed: {} };
    }
  });

  const [loading, setLoading] = useState(true);

  // 1. Real-time listener for user custom categories
  useEffect(() => {
    if (!userId) {
      setCustomCategories([]);
      setPredefinedOverrides({ deleted: [], renamed: {} });
      setLoading(false);
      return;
    }

    // Hydrate for current user immediately
    try {
      const storedCustom = localStorage.getItem(getLocalKey('custom'));
      if (storedCustom) setCustomCategories(JSON.parse(storedCustom));
      const storedOverrides = localStorage.getItem(getLocalKey('overrides'));
      if (storedOverrides) setPredefinedOverrides(JSON.parse(storedOverrides));
    } catch {}

    const catCol = collection(db, 'users', userId, 'categories');
    const unsubscribeCustom = onSnapshot(
      catCol,
      (snapshot) => {
        const loaded: CustomCategory[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          loaded.push({
            id: d.id,
            userId,
            name: data.name || '',
            scope: data.scope || 'all',
            color: data.color || '#6366f1',
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
          });
        });
        loaded.sort((a, b) => a.name.localeCompare(b.name));
        setCustomCategories(loaded);
        try {
          localStorage.setItem(getLocalKey('custom'), JSON.stringify(loaded));
        } catch {}
        setLoading(false);
      },
      (error) => {
        console.warn('Custom categories offline / cached load:', error);
        setLoading(false);
      }
    );

    // 2. Real-time listener for predefined overrides (deleted / renamed)
    const overridesDoc = doc(db, 'users', userId, 'settings', 'category_overrides');
    const unsubscribeOverrides = onSnapshot(
      overridesDoc,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const nextOverrides: PredefinedOverrides = {
            deleted: Array.isArray(data.deleted) ? data.deleted : [],
            renamed: data.renamed && typeof data.renamed === 'object' ? data.renamed : {},
          };
          setPredefinedOverrides(nextOverrides);
          try {
            localStorage.setItem(getLocalKey('overrides'), JSON.stringify(nextOverrides));
          } catch {}
        } else {
          setPredefinedOverrides({ deleted: [], renamed: {} });
        }
      },
      (error) => {
        console.warn('Category overrides offline / cached load:', error);
      }
    );

    return () => {
      unsubscribeCustom();
      unsubscribeOverrides();
    };
  }, [userId, getLocalKey]);

  // Add new custom category
  const addCategory = useCallback(
    async (name: string, scope: CategoryScope = 'all', color: string = '#6366f1') => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Nome da categoria não pode ser vazio.');
      if (!userId) throw new Error('Usuário não autenticado.');

      const id = 'cat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const now = new Date().toISOString();
      const newCategory: CustomCategory = {
        id,
        userId,
        name: trimmed,
        scope,
        color,
        createdAt: now,
        updatedAt: now,
      };

      setCustomCategories((prev) => {
        const updated = [...prev, newCategory];
        try {
          localStorage.setItem(getLocalKey('custom'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      try {
        const docRef = doc(db, 'users', userId, 'categories', id);
        await setDoc(docRef, sanitizeForFirestore(newCategory));
        return newCategory;
      } catch (err) {
        console.warn('Category saved locally, will sync when online:', err);
        return newCategory;
      } finally {
        registerResolvedWrite();
      }
    },
    [userId, getLocalKey]
  );

  // Update ANY category (custom or predefined)
  const updateCategory = useCallback(
    async (id: string, partial: { name?: string; scope?: CategoryScope; color?: string }) => {
      if (!userId) return;
      const now = new Date().toISOString();

      // Check if it's a predefined category
      if (id.startsWith('predefined_')) {
        const originalName = id.replace('predefined_', '');
        const newRenamed = {
          ...predefinedOverrides.renamed,
          [originalName]: {
            name: partial.name?.trim() || originalName,
            scope: partial.scope,
            color: partial.color,
          },
        };

        const updatedOverrides: PredefinedOverrides = {
          ...predefinedOverrides,
          renamed: newRenamed,
        };

        setPredefinedOverrides(updatedOverrides);
        try {
          localStorage.setItem(getLocalKey('overrides'), JSON.stringify(updatedOverrides));
        } catch {}

        registerPendingWrite();
        try {
          const docRef = doc(db, 'users', userId, 'settings', 'category_overrides');
          await setDoc(docRef, sanitizeForFirestore(updatedOverrides), { merge: true });
        } catch (err) {
          console.warn('Predefined category updated locally, will sync when online:', err);
        } finally {
          registerResolvedWrite();
        }
        return;
      }

      // It's a custom category
      setCustomCategories((prev) => {
        const updated = prev.map((c) => (c.id === id ? { ...c, ...partial, updatedAt: now } : c));
        try {
          localStorage.setItem(getLocalKey('custom'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      try {
        const docRef = doc(db, 'users', userId, 'categories', id);
        await setDoc(docRef, sanitizeForFirestore({ ...partial, updatedAt: now }), { merge: true });
      } catch (err) {
        console.warn('Custom category updated locally, will sync when online:', err);
      } finally {
        registerResolvedWrite();
      }
    },
    [userId, predefinedOverrides, getLocalKey]
  );

  // Delete ANY category (custom or predefined)
  const deleteCategory = useCallback(
    async (id: string) => {
      if (!userId) return;

      // Check if it's a predefined category
      if (id.startsWith('predefined_')) {
        const originalName = id.replace('predefined_', '');
        const newDeleted = Array.from(new Set([...predefinedOverrides.deleted, originalName]));

        const updatedOverrides: PredefinedOverrides = {
          ...predefinedOverrides,
          deleted: newDeleted,
        };

        setPredefinedOverrides(updatedOverrides);
        try {
          localStorage.setItem(getLocalKey('overrides'), JSON.stringify(updatedOverrides));
        } catch {}

        registerPendingWrite();
        try {
          const docRef = doc(db, 'users', userId, 'settings', 'category_overrides');
          await setDoc(docRef, sanitizeForFirestore(updatedOverrides), { merge: true });
        } catch (err) {
          console.warn('Predefined category deleted locally, will sync when online:', err);
        } finally {
          registerResolvedWrite();
        }
        return;
      }

      // It's a custom category
      setCustomCategories((prev) => {
        const updated = prev.filter((c) => c.id !== id);
        try {
          localStorage.setItem(getLocalKey('custom'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      try {
        const docRef = doc(db, 'users', userId, 'categories', id);
        await deleteDoc(docRef);
      } catch (err) {
        console.warn('Custom category deleted locally, will sync when online:', err);
      } finally {
        registerResolvedWrite();
      }
    },
    [userId, predefinedOverrides, getLocalKey]
  );

  // Restore predefined categories defaults
  const resetPredefinedCategories = useCallback(async () => {
    if (!userId) return;
    const emptyOverrides: PredefinedOverrides = { deleted: [], renamed: {} };
    setPredefinedOverrides(emptyOverrides);
    try {
      localStorage.setItem(getLocalKey('overrides'), JSON.stringify(emptyOverrides));
    } catch {}

    registerPendingWrite();
    try {
      const docRef = doc(db, 'users', userId, 'settings', 'category_overrides');
      await setDoc(docRef, emptyOverrides);
    } catch (err) {
      console.warn('Category overrides reset locally, will sync when online:', err);
    } finally {
      registerResolvedWrite();
    }
  }, [userId, getLocalKey]);

  // Helper to get active merged categories for dropdowns
  const getCategoriesFor = useCallback(
    (scope: 'bill' | 'income' | 'expense' | 'all'): string[] => {
      let baseList: readonly string[] = [];
      if (scope === 'bill') {
        baseList = BILL_CATEGORIES;
      } else if (scope === 'income') {
        baseList = INCOME_CATEGORIES;
      } else if (scope === 'expense') {
        baseList = EXPENSE_CATEGORIES;
      } else {
        baseList = Array.from(new Set([...BILL_CATEGORIES, ...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES]));
      }

      // Map predefined through renames and filter out deleted ones
      const processedPredefined = baseList
        .filter((cat) => !predefinedOverrides.deleted.includes(cat))
        .map((cat) => {
          const override = predefinedOverrides.renamed[cat];
          // If scope was changed and doesn't match, exclude it
          if (override?.scope && override.scope !== 'all' && scope !== 'all' && override.scope !== scope) {
            return null;
          }
          return override?.name?.trim() || cat;
        })
        .filter((cat): cat is string => Boolean(cat));

      // Filter custom categories matching the scope
      const customNames = customCategories
        .filter((c) => scope === 'all' || c.scope === 'all' || c.scope === scope)
        .map((c) => c.name.trim());

      // Merge and remove duplicates
      const merged = Array.from(new Set([...processedPredefined, ...customNames]));
      return merged;
    },
    [customCategories, predefinedOverrides]
  );

  // All display categories (both predefined & custom) for CategoryManager
  const allDisplayCategories = useMemo<DisplayCategory[]>(() => {
    const list: DisplayCategory[] = [];

    // 1. Predefined categories with scopes
    const predefinedDefinitions: { name: string; defaultScope: CategoryScope }[] = [
      ...BILL_CATEGORIES.map((c) => ({ name: c, defaultScope: 'bill' as CategoryScope })),
      ...INCOME_CATEGORIES.map((c) => ({ name: c, defaultScope: 'income' as CategoryScope })),
      ...EXPENSE_CATEGORIES.map((c) => ({ name: c, defaultScope: 'expense' as CategoryScope })),
    ];

    const seenPredefined = new Set<string>();

    for (const def of predefinedDefinitions) {
      if (seenPredefined.has(def.name)) continue;
      seenPredefined.add(def.name);

      // Check if user deleted this predefined category
      if (predefinedOverrides.deleted.includes(def.name)) continue;

      const override = predefinedOverrides.renamed[def.name];
      list.push({
        id: `predefined_${def.name}`,
        name: override?.name || def.name,
        originalName: def.name,
        scope: override?.scope || def.defaultScope,
        color: override?.color || '#64748b',
        isPredefined: true,
      });
    }

    // 2. Custom categories
    for (const cat of customCategories) {
      list.push({
        id: cat.id,
        name: cat.name,
        scope: cat.scope,
        color: cat.color || '#6366f1',
        isPredefined: false,
      });
    }

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [customCategories, predefinedOverrides]);

  return {
    customCategories,
    allDisplayCategories,
    loading,
    addCategory,
    updateCategory,
    deleteCategory,
    resetPredefinedCategories,
    getCategoriesFor,
  };
}
