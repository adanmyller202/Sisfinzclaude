import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { LinkPreviewMetadata } from '../utils/linkMetadata';

export type LinkCategoryColor =
  | 'emerald'
  | 'teal'
  | 'sky'
  | 'amber'
  | 'violet'
  | 'rose';

export interface LinkCategory {
  id: string;
  name: string;
  emoji: string;
  color: LinkCategoryColor;
  createdAt: string;
  updatedAt: string;
}

export interface SavedLinkItem {
  id: string;
  url: string;
  domain: string;
  siteName: string;
  title: string;
  description: string;
  notes: string;
  image: string | null;
  favicon: string | null;
  platform: LinkPreviewMetadata['platform'];
  categoryId: string | null;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

const LINKS_STORAGE_PREFIX = 'sisfinz_saved_links_v1_';
const CATS_STORAGE_PREFIX = 'sisfinz_link_categories_v1_';
const SEEDED_FLAG_PREFIX = 'sisfinz_link_cats_seeded_v1_';

function createDefaultLinkCategories(isEs: boolean): LinkCategory[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'lcat_receitas',
      name: isEs ? 'Recetas' : 'Receitas',
      emoji: '🍰',
      color: 'amber',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'lcat_roupas',
      name: isEs ? 'Ropa' : 'Roupas',
      emoji: '👕',
      color: 'rose',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'lcat_aluguel',
      name: isEs ? 'Alquiler' : 'Aluguel',
      emoji: '🏠',
      color: 'sky',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'lcat_ferramentas',
      name: isEs ? 'Herramientas' : 'Ferramentas',
      emoji: '🛠️',
      color: 'emerald',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'lcat_estudos',
      name: isEs ? 'Estudios' : 'Estudos',
      emoji: '📚',
      color: 'violet',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'lcat_inspiracoes',
      name: isEs ? 'Inspiraciones' : 'Inspirações',
      emoji: '✨',
      color: 'teal',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'lcat_viagens',
      name: isEs ? 'Viajes' : 'Viagens',
      emoji: '✈️',
      color: 'sky',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'lcat_compras',
      name: isEs ? 'Compras' : 'Compras',
      emoji: '🛍️',
      color: 'amber',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function useSavedLinks(isEs = false) {
  const { user } = useAuth();
  const uid = user?.uid || auth.currentUser?.uid || null;
  const linksStorageKey = `${LINKS_STORAGE_PREFIX}${uid || 'guest'}`;
  const catsStorageKey = `${CATS_STORAGE_PREFIX}${uid || 'guest'}`;
  const seededFlagKey = `${SEEDED_FLAG_PREFIX}${uid || 'guest'}`;

  const [links, setLinks] = useState<SavedLinkItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(linksStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [categories, setCategories] = useState<LinkCategory[]>(() => {
    if (typeof window === 'undefined') return createDefaultLinkCategories(isEs);
    try {
      const raw = localStorage.getItem(catsStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return createDefaultLinkCategories(isEs);
  });

  const linksRef = useRef<SavedLinkItem[]>(links);
  linksRef.current = links;
  const categoriesRef = useRef<LinkCategory[]>(categories);
  categoriesRef.current = categories;

  const saveLinksLocal = useCallback(
    (next: SavedLinkItem[]) => {
      setLinks(next);
      linksRef.current = next;
      try {
        localStorage.setItem(linksStorageKey, JSON.stringify(next));
      } catch {
        // ignore
      }
    },
    [linksStorageKey]
  );

  const saveCatsLocal = useCallback(
    (next: LinkCategory[]) => {
      setCategories(next);
      categoriesRef.current = next;
      try {
        localStorage.setItem(catsStorageKey, JSON.stringify(next));
      } catch {
        // ignore
      }
    },
    [catsStorageKey]
  );

  // Realtime Firestore sync for saved_links and link_categories
  useEffect(() => {
    if (!uid) return;

    const linksCol = collection(db, 'users', uid, 'saved_links');
    const unsubLinks = onSnapshot(
      linksCol,
      (snap) => {
        const list: SavedLinkItem[] = [];
        snap.forEach((d) => {
          const data = d.data() as Partial<SavedLinkItem>;
          list.push({
            id: d.id,
            url: data.url || '',
            domain: data.domain || '',
            siteName: data.siteName || data.domain || '',
            title: data.title || data.domain || 'Link',
            description: data.description || '',
            notes: data.notes || '',
            image: data.image ?? null,
            favicon: data.favicon ?? null,
            platform: data.platform || 'web',
            categoryId: data.categoryId ?? null,
            favorite: Boolean(data.favorite),
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
          });
        });
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        saveLinksLocal(list);
      },
      () => {}
    );

    const catsCol = collection(db, 'users', uid, 'link_categories');
    const unsubCats = onSnapshot(
      catsCol,
      (snap) => {
        if (snap.empty) {
          const alreadySeeded =
            typeof window !== 'undefined' && Boolean(localStorage.getItem(seededFlagKey));
          if (!alreadySeeded) {
            const defaults = createDefaultLinkCategories(isEs);
            saveCatsLocal(defaults);
            try {
              localStorage.setItem(seededFlagKey, '1');
            } catch {
              // ignore
            }
            defaults.forEach((cat) => {
              setDoc(
                doc(db, 'users', uid, 'link_categories', cat.id),
                JSON.parse(JSON.stringify(cat)),
                { merge: true }
              ).catch(() => {});
            });
          } else {
            saveCatsLocal([]);
          }
          return;
        }

        const list: LinkCategory[] = [];
        snap.forEach((d) => {
          const data = d.data() as Partial<LinkCategory>;
          list.push({
            id: d.id,
            name: data.name || 'Categoria',
            emoji: data.emoji || '🔗',
            color: data.color || 'emerald',
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
          });
        });
        list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        saveCatsLocal(list);
      },
      () => {}
    );

    return () => {
      unsubLinks();
      unsubCats();
    };
  }, [uid, isEs, seededFlagKey, saveLinksLocal, saveCatsLocal]);

  const addLink = useCallback(
    async (params: {
      metadata: LinkPreviewMetadata;
      title?: string;
      description?: string;
      notes?: string;
      categoryId: string | null;
      favorite?: boolean;
    }): Promise<SavedLinkItem> => {
      const nowIso = new Date().toISOString();
      const item: SavedLinkItem = {
        id: `lnk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        url: params.metadata.url,
        domain: params.metadata.domain,
        siteName: params.metadata.siteName,
        title: (params.title || params.metadata.title || params.metadata.domain).trim(),
        description: (params.description ?? params.metadata.description ?? '').trim(),
        notes: (params.notes || '').trim(),
        image: params.metadata.image,
        favicon: params.metadata.favicon,
        platform: params.metadata.platform,
        categoryId: params.categoryId,
        favorite: Boolean(params.favorite),
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const next = [item, ...linksRef.current];
      saveLinksLocal(next);

      if (uid) {
        await setDoc(
          doc(db, 'users', uid, 'saved_links', item.id),
          JSON.parse(JSON.stringify(item))
        ).catch(() => {});
      }
      return item;
    },
    [uid, saveLinksLocal]
  );

  const updateLink = useCallback(
    async (linkId: string, patch: Partial<SavedLinkItem>) => {
      const current = linksRef.current.find((l) => l.id === linkId);
      if (!current) return;
      const updated: SavedLinkItem = {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      const next = linksRef.current.map((l) => (l.id === linkId ? updated : l));
      saveLinksLocal(next);
      if (uid) {
        await setDoc(
          doc(db, 'users', uid, 'saved_links', linkId),
          JSON.parse(JSON.stringify(updated)),
          { merge: true }
        ).catch(() => {});
      }
    },
    [uid, saveLinksLocal]
  );

  const toggleFavoriteLink = useCallback(
    async (linkId: string) => {
      const target = linksRef.current.find((l) => l.id === linkId);
      if (!target) return;
      await updateLink(linkId, { favorite: !target.favorite });
    },
    [updateLink]
  );

  const deleteLink = useCallback(
    async (linkId: string): Promise<SavedLinkItem | null> => {
      const target = linksRef.current.find((l) => l.id === linkId) || null;
      const next = linksRef.current.filter((l) => l.id !== linkId);
      saveLinksLocal(next);
      if (uid) {
        await deleteDoc(doc(db, 'users', uid, 'saved_links', linkId)).catch(() => {});
      }
      return target;
    },
    [uid, saveLinksLocal]
  );

  const restoreDeletedLink = useCallback(
    async (item: SavedLinkItem) => {
      const exists = linksRef.current.some((l) => l.id === item.id);
      if (exists) return;
      const next = [item, ...linksRef.current].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );
      saveLinksLocal(next);
      if (uid) {
        await setDoc(
          doc(db, 'users', uid, 'saved_links', item.id),
          JSON.parse(JSON.stringify(item))
        ).catch(() => {});
      }
    },
    [uid, saveLinksLocal]
  );

  const createCategory = useCallback(
    async (params: {
      name: string;
      emoji: string;
      color: LinkCategoryColor;
    }): Promise<LinkCategory> => {
      const nowIso = new Date().toISOString();
      const cat: LinkCategory = {
        id: `lcat_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        name: params.name.trim(),
        emoji: params.emoji || '🔗',
        color: params.color || 'emerald',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      const next = [...categoriesRef.current, cat];
      saveCatsLocal(next);
      if (uid) {
        await setDoc(
          doc(db, 'users', uid, 'link_categories', cat.id),
          JSON.parse(JSON.stringify(cat))
        ).catch(() => {});
      }
      return cat;
    },
    [uid, saveCatsLocal]
  );

  const updateCategory = useCallback(
    async (catId: string, patch: Partial<Pick<LinkCategory, 'name' | 'emoji' | 'color'>>) => {
      const current = categoriesRef.current.find((c) => c.id === catId);
      if (!current) return;
      const updated: LinkCategory = {
        ...current,
        ...patch,
        name: (patch.name ?? current.name).trim(),
        updatedAt: new Date().toISOString(),
      };
      const next = categoriesRef.current.map((c) => (c.id === catId ? updated : c));
      saveCatsLocal(next);
      if (uid) {
        await setDoc(
          doc(db, 'users', uid, 'link_categories', catId),
          JSON.parse(JSON.stringify(updated)),
          { merge: true }
        ).catch(() => {});
      }
    },
    [uid, saveCatsLocal]
  );

  const deleteCategory = useCallback(
    async (catId: string) => {
      const nextCats = categoriesRef.current.filter((c) => c.id !== catId);
      saveCatsLocal(nextCats);

      const affected = linksRef.current.filter((l) => l.categoryId === catId);
      if (affected.length > 0) {
        const nextLinks = linksRef.current.map((l) =>
          l.categoryId === catId ? { ...l, categoryId: null } : l
        );
        saveLinksLocal(nextLinks);
        if (uid) {
          await Promise.all(
            affected.map((l) =>
              setDoc(
                doc(db, 'users', uid, 'saved_links', l.id),
                { categoryId: null, updatedAt: new Date().toISOString() },
                { merge: true }
              ).catch(() => {})
            )
          );
        }
      }

      if (uid) {
        await deleteDoc(doc(db, 'users', uid, 'link_categories', catId)).catch(() => {});
      }
    },
    [uid, saveCatsLocal, saveLinksLocal]
  );

  return {
    links,
    categories,
    addLink,
    updateLink,
    toggleFavoriteLink,
    deleteLink,
    restoreDeletedLink,
    createCategory,
    updateCategory,
    deleteCategory,
  };
}
