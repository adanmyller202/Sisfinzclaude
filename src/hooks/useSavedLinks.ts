import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { LanguageCode } from '../types';

export type LinkCategoryColor =
  | 'emerald'
  | 'teal'
  | 'sky'
  | 'amber'
  | 'violet'
  | 'rose'
  | 'orange'
  | 'slate';

export interface SavedLinkCategory {
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
  title: string;
  description: string;
  siteName: string;
  domain: string;
  image: string | null;
  favicon: string | null;
  isInstagram: boolean;
  notes: string;
  categoryId: string;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LinkPreviewResult {
  url: string;
  normalizedUrl: string;
  domain: string;
  siteName: string;
  title: string;
  description: string;
  image: string | null;
  favicon: string | null;
  isInstagram: boolean;
  previewStatus: 'ok' | 'partial' | 'fallback';
}

const LINKS_STORAGE_PREFIX = 'sisfinz_saved_links_v1_';
const CATS_STORAGE_PREFIX = 'sisfinz_link_categories_v1_';

function createDefaultCategories(language: LanguageCode): SavedLinkCategory[] {
  const now = new Date().toISOString();
  const isEs = language === 'es';
  return [
    { id: 'cat_receitas', name: isEs ? 'Recetas' : 'Receitas', emoji: '🍰', color: 'amber', createdAt: now, updatedAt: now },
    { id: 'cat_roupas', name: isEs ? 'Ropa' : 'Roupas', emoji: '👕', color: 'rose', createdAt: now, updatedAt: now },
    { id: 'cat_aluguel', name: isEs ? 'Alquiler' : 'Aluguel', emoji: '🏠', color: 'emerald', createdAt: now, updatedAt: now },
    { id: 'cat_ferramentas', name: isEs ? 'Herramientas' : 'Ferramentas', emoji: '🛠️', color: 'teal', createdAt: now, updatedAt: now },
    { id: 'cat_estudos', name: isEs ? 'Estudios' : 'Estudos', emoji: '📚', color: 'sky', createdAt: now, updatedAt: now },
    { id: 'cat_inspiracoes', name: isEs ? 'Inspiraciones' : 'Inspirações', emoji: '✨', color: 'violet', createdAt: now, updatedAt: now },
    { id: 'cat_viagens', name: isEs ? 'Viajes' : 'Viagens', emoji: '✈️', color: 'orange', createdAt: now, updatedAt: now },
    { id: 'cat_compras', name: isEs ? 'Compras' : 'Compras', emoji: '🛍️', color: 'slate', createdAt: now, updatedAt: now },
  ];
}

export function buildClientFallbackPreview(rawUrl: string): LinkPreviewResult {
  let normalized = rawUrl.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }
  try {
    const parsed = new URL(normalized);
    const domain = parsed.hostname.replace(/^www\./i, '');
    const isInstagram = domain === 'instagram.com' || domain.endsWith('.instagram.com');
    const segments = parsed.pathname.split('/').filter(Boolean);
    let title = domain;

    if (isInstagram) {
      if (segments[0] && !['p', 'reel', 'reels', 'stories', 'explore', 'tv'].includes(segments[0])) {
        title = `@${segments[0]} • Instagram`;
      } else {
        title = 'Publicação no Instagram';
      }
    } else if (segments.length > 0) {
      const last = decodeURIComponent(segments[segments.length - 1])
        .replace(/[-_]+/g, ' ')
        .replace(/\.\w+$/, '')
        .trim();
      if (last && last.length > 2) {
        title = last.charAt(0).toUpperCase() + last.slice(1);
      }
    }

    return {
      url: parsed.toString(),
      normalizedUrl: parsed.toString(),
      domain,
      siteName: isInstagram ? 'Instagram' : domain,
      title,
      description: '',
      image: null,
      favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
      isInstagram,
      previewStatus: 'fallback',
    };
  } catch {
    return {
      url: rawUrl.trim(),
      normalizedUrl: rawUrl.trim(),
      domain: rawUrl.trim(),
      siteName: 'Link',
      title: rawUrl.trim(),
      description: '',
      image: null,
      favicon: null,
      isInstagram: false,
      previewStatus: 'fallback',
    };
  }
}

export function useSavedLinks(language: LanguageCode = 'pt') {
  const { user } = useAuth();
  const uid = user?.uid || auth.currentUser?.uid || null;
  const linksStorageKey = `${LINKS_STORAGE_PREFIX}${uid || 'guest'}`;
  const catsStorageKey = `${CATS_STORAGE_PREFIX}${uid || 'guest'}`;

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

  const [categories, setCategories] = useState<SavedLinkCategory[]>(() => {
    if (typeof window === 'undefined') return createDefaultCategories(language);
    try {
      const raw = localStorage.getItem(catsStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return createDefaultCategories(language);
  });

  const [deletedUndoItem, setDeletedUndoItem] = useState<SavedLinkItem | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  const linksRef = useRef<SavedLinkItem[]>(links);
  linksRef.current = links;
  const categoriesRef = useRef<SavedLinkCategory[]>(categories);
  categoriesRef.current = categories;
  const seededDefaultsRef = useRef(false);

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

  const saveCategoriesLocal = useCallback(
    (next: SavedLinkCategory[]) => {
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

  // Realtime Firestore sync
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
            title: data.title || data.domain || data.url || 'Link',
            description: data.description || '',
            siteName: data.siteName || data.domain || 'Web',
            domain: data.domain || '',
            image: data.image ?? null,
            favicon: data.favicon ?? null,
            isInstagram: Boolean(data.isInstagram),
            notes: data.notes || '',
            categoryId: data.categoryId || 'cat_inspiracoes',
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
          if (!seededDefaultsRef.current) {
            seededDefaultsRef.current = true;
            const defaults = createDefaultCategories(language);
            saveCategoriesLocal(defaults);
            for (const cat of defaults) {
              setDoc(
                doc(db, 'users', uid, 'link_categories', cat.id),
                JSON.parse(JSON.stringify(cat))
              ).catch(() => {});
            }
          }
          return;
        }
        const list: SavedLinkCategory[] = [];
        snap.forEach((d) => {
          const data = d.data() as Partial<SavedLinkCategory>;
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
        saveCategoriesLocal(list);
      },
      () => {}
    );

    return () => {
      unsubLinks();
      unsubCats();
    };
  }, [uid, language, saveLinksLocal, saveCategoriesLocal]);

  const fetchLinkPreview = useCallback(async (rawUrl: string): Promise<LinkPreviewResult> => {
    const fallback = buildClientFallbackPreview(rawUrl);
    if (!rawUrl.trim()) return fallback;

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = await auth.currentUser?.getIdToken().catch(() => '');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const resp = await fetch('/api/links/preview', {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: rawUrl.trim() }),
      });
      if (!resp.ok) return fallback;
      const data = await resp.json();
      if (data && typeof data.url === 'string') {
        return {
          url: data.url,
          normalizedUrl: data.normalizedUrl || data.url,
          domain: data.domain || fallback.domain,
          siteName: data.siteName || fallback.siteName,
          title: data.title || fallback.title,
          description: data.description || '',
          image: data.image || null,
          favicon: data.favicon || fallback.favicon,
          isInstagram: Boolean(data.isInstagram),
          previewStatus: data.previewStatus || 'partial',
        };
      }
    } catch {
      // fallback gracefully when backend route is unreachable or offline
    }
    return fallback;
  }, []);

  const addLink = useCallback(
    async (params: {
      url: string;
      title?: string;
      description?: string;
      siteName?: string;
      domain?: string;
      image?: string | null;
      favicon?: string | null;
      isInstagram?: boolean;
      notes?: string;
      categoryId: string;
      favorite?: boolean;
    }): Promise<SavedLinkItem> => {
      const fallback = buildClientFallbackPreview(params.url);
      const nowIso = new Date().toISOString();
      const item: SavedLinkItem = {
        id: `lnk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        url: fallback.url,
        title: (params.title || fallback.title).trim(),
        description: (params.description || '').trim(),
        siteName: (params.siteName || fallback.siteName).trim(),
        domain: (params.domain || fallback.domain).trim(),
        image: params.image ?? null,
        favicon: params.favicon ?? fallback.favicon,
        isInstagram: params.isInstagram ?? fallback.isInstagram,
        notes: (params.notes || '').trim(),
        categoryId: params.categoryId || categoriesRef.current[0]?.id || 'cat_inspiracoes',
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
    async (id: string, patch: Partial<SavedLinkItem>) => {
      const current = linksRef.current.find((l) => l.id === id);
      if (!current) return;
      const updated: SavedLinkItem = {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      const next = linksRef.current.map((l) => (l.id === id ? updated : l));
      saveLinksLocal(next);
      if (uid) {
        await setDoc(
          doc(db, 'users', uid, 'saved_links', id),
          JSON.parse(JSON.stringify(updated)),
          { merge: true }
        ).catch(() => {});
      }
    },
    [uid, saveLinksLocal]
  );

  const toggleFavoriteLink = useCallback(
    async (id: string) => {
      const current = linksRef.current.find((l) => l.id === id);
      if (!current) return;
      await updateLink(id, { favorite: !current.favorite });
    },
    [updateLink]
  );

  const deleteLink = useCallback(
    async (id: string) => {
      const target = linksRef.current.find((l) => l.id === id) || null;
      const next = linksRef.current.filter((l) => l.id !== id);
      saveLinksLocal(next);

      if (target) {
        setDeletedUndoItem(target);
        if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
        undoTimerRef.current = window.setTimeout(() => {
          setDeletedUndoItem(null);
        }, 5500);
      }

      if (uid) {
        await deleteDoc(doc(db, 'users', uid, 'saved_links', id)).catch(() => {});
      }
    },
    [uid, saveLinksLocal]
  );

  const undoDeleteLink = useCallback(async () => {
    if (!deletedUndoItem) return;
    const restored = deletedUndoItem;
    setDeletedUndoItem(null);
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    const next = [restored, ...linksRef.current.filter((l) => l.id !== restored.id)].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
    saveLinksLocal(next);
    if (uid) {
      await setDoc(
        doc(db, 'users', uid, 'saved_links', restored.id),
        JSON.parse(JSON.stringify(restored))
      ).catch(() => {});
    }
  }, [deletedUndoItem, uid, saveLinksLocal]);

  const createCategory = useCallback(
    async (params: {
      name: string;
      emoji: string;
      color: LinkCategoryColor;
    }): Promise<SavedLinkCategory> => {
      const nowIso = new Date().toISOString();
      const cat: SavedLinkCategory = {
        id: `lcat_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        name: params.name.trim(),
        emoji: params.emoji || '🔗',
        color: params.color || 'emerald',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      const next = [...categoriesRef.current, cat];
      saveCategoriesLocal(next);
      if (uid) {
        await setDoc(
          doc(db, 'users', uid, 'link_categories', cat.id),
          JSON.parse(JSON.stringify(cat))
        ).catch(() => {});
      }
      return cat;
    },
    [uid, saveCategoriesLocal]
  );

  const updateCategory = useCallback(
    async (id: string, patch: Partial<SavedLinkCategory>) => {
      const current = categoriesRef.current.find((c) => c.id === id);
      if (!current) return;
      const updated: SavedLinkCategory = {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      const next = categoriesRef.current.map((c) => (c.id === id ? updated : c));
      saveCategoriesLocal(next);
      if (uid) {
        await setDoc(
          doc(db, 'users', uid, 'link_categories', id),
          JSON.parse(JSON.stringify(updated)),
          { merge: true }
        ).catch(() => {});
      }
    },
    [uid, saveCategoriesLocal]
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      const remainingCats = categoriesRef.current.filter((c) => c.id !== id);
      const fallbackCatId = remainingCats[0]?.id || 'cat_inspiracoes';
      saveCategoriesLocal(remainingCats);

      const affected = linksRef.current.filter((l) => l.categoryId === id);
      if (affected.length > 0) {
        const nextLinks = linksRef.current.map((l) =>
          l.categoryId === id ? { ...l, categoryId: fallbackCatId } : l
        );
        saveLinksLocal(nextLinks);
        if (uid) {
          await Promise.all(
            affected.map((l) =>
              setDoc(
                doc(db, 'users', uid, 'saved_links', l.id),
                { categoryId: fallbackCatId, updatedAt: new Date().toISOString() },
                { merge: true }
              ).catch(() => {})
            )
          );
        }
      }

      if (uid) {
        await deleteDoc(doc(db, 'users', uid, 'link_categories', id)).catch(() => {});
      }
    },
    [uid, saveCategoriesLocal, saveLinksLocal]
  );

  return {
    links,
    categories,
    deletedUndoItem,
    fetchLinkPreview,
    addLink,
    updateLink,
    toggleFavoriteLink,
    deleteLink,
    undoDeleteLink,
    createCategory,
    updateCategory,
    deleteCategory,
  };
}
