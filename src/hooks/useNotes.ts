import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

export type NoteFolderIcon =
  | 'folder'
  | 'book'
  | 'briefcase'
  | 'lightbulb'
  | 'user'
  | 'rocket'
  | 'heart';

export type NoteFolderColor = 'emerald' | 'teal' | 'sky' | 'amber' | 'violet' | 'rose';

export interface NoteFolder {
  id: string;
  name: string;
  icon: NoteFolderIcon;
  color: NoteFolderColor;
  createdAt: string;
  updatedAt: string;
}

export interface NoteChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface NoteImageAttachment {
  id: string;
  url: string;
  name: string;
  storagePath?: string;
  createdAt: string;
}

export interface NoteTable {
  id: string;
  headers: string[];
  rows: string[][];
}

export interface NoteItem {
  id: string;
  title: string;
  bodyHtml: string;
  plainText: string;
  folderId: string | null;
  pinned: boolean;
  checklist: NoteChecklistItem[];
  images: NoteImageAttachment[];
  tables: NoteTable[];
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const NOTES_STORAGE_PREFIX = 'sisfinz_notes_v1_';
const FOLDERS_STORAGE_PREFIX = 'sisfinz_note_folders_v1_';

export function htmlToPlainText(html: string): string {
  if (!html) return '';
  if (typeof document !== 'undefined') {
    const div = document.createElement('div');
    div.innerHTML = html;
    return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
  }
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function countWords(text: string): number {
  const clean = text.trim();
  if (!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).length;
}

async function compressImageToDataUrl(file: File, maxDim = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler imagem'));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => resolve(String(reader.result || ''));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export function useNotes() {
  const { user } = useAuth();
  const uid = user?.uid || auth.currentUser?.uid || null;
  const notesStorageKey = `${NOTES_STORAGE_PREFIX}${uid || 'guest'}`;
  const foldersStorageKey = `${FOLDERS_STORAGE_PREFIX}${uid || 'guest'}`;

  const [notes, setNotes] = useState<NoteItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(notesStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [folders, setFolders] = useState<NoteFolder[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(foldersStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');

  const notesRef = useRef<NoteItem[]>(notes);
  notesRef.current = notes;
  const foldersRef = useRef<NoteFolder[]>(folders);
  foldersRef.current = folders;

  const debounceTimersRef = useRef<Record<string, number>>({});
  const pendingWritesRef = useRef<Record<string, NoteItem>>({});

  const saveNotesLocal = useCallback(
    (next: NoteItem[]) => {
      setNotes(next);
      notesRef.current = next;
      try {
        localStorage.setItem(notesStorageKey, JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
    },
    [notesStorageKey]
  );

  const saveFoldersLocal = useCallback(
    (next: NoteFolder[]) => {
      setFolders(next);
      foldersRef.current = next;
      try {
        localStorage.setItem(foldersStorageKey, JSON.stringify(next));
      } catch {
        // ignore
      }
    },
    [foldersStorageKey]
  );

  // Realtime Firestore sync for notes & folders
  useEffect(() => {
    if (!uid) return;

    const notesCol = collection(db, 'users', uid, 'notes');
    const unsubNotes = onSnapshot(
      notesCol,
      (snap) => {
        const list: NoteItem[] = [];
        snap.forEach((d) => {
          const data = d.data() as Partial<NoteItem>;
          list.push({
            id: d.id,
            title: data.title || '',
            bodyHtml: data.bodyHtml || '',
            plainText: data.plainText || htmlToPlainText(data.bodyHtml || ''),
            folderId: data.folderId ?? null,
            pinned: Boolean(data.pinned),
            checklist: Array.isArray(data.checklist) ? data.checklist : [],
            images: Array.isArray(data.images) ? data.images : [],
            tables: Array.isArray(data.tables) ? data.tables : [],
            deletedAt: data.deletedAt ?? null,
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
          });
        });
        list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        saveNotesLocal(list);
      },
      () => {}
    );

    const foldersCol = collection(db, 'users', uid, 'note_folders');
    const unsubFolders = onSnapshot(
      foldersCol,
      (snap) => {
        const list: NoteFolder[] = [];
        snap.forEach((d) => {
          const data = d.data() as Partial<NoteFolder>;
          list.push({
            id: d.id,
            name: data.name || 'Pasta',
            icon: data.icon || 'folder',
            color: data.color || 'emerald',
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
          });
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
        saveFoldersLocal(list);
      },
      () => {}
    );

    return () => {
      unsubNotes();
      unsubFolders();
    };
  }, [uid, saveNotesLocal, saveFoldersLocal]);

  const persistNoteRemote = useCallback(
    async (item: NoteItem) => {
      if (!uid) return;
      try {
        await setDoc(
          doc(db, 'users', uid, 'notes', item.id),
          JSON.parse(JSON.stringify(item)),
          { merge: true }
        );
      } catch {
        // offline fallback already persisted in localStorage
      }
    },
    [uid]
  );

  const flushPendingSaves = useCallback(async () => {
    const timers = debounceTimersRef.current;
    Object.keys(timers).forEach((k) => {
      window.clearTimeout(timers[k]);
      delete timers[k];
    });
    const pending = { ...pendingWritesRef.current };
    pendingWritesRef.current = {};
    const items = Object.values(pending);
    if (items.length === 0) return;
    setSaveState('saving');
    await Promise.all(items.map((it) => persistNoteRemote(it)));
    setSaveState('saved');
  }, [persistNoteRemote]);

  useEffect(() => {
    return () => {
      void flushPendingSaves();
    };
  }, [flushPendingSaves]);

  const createNote = useCallback(
    async (folderId: string | null = null): Promise<NoteItem> => {
      const nowIso = new Date().toISOString();
      const item: NoteItem = {
        id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: '',
        bodyHtml: '',
        plainText: '',
        folderId,
        pinned: false,
        checklist: [],
        images: [],
        tables: [],
        deletedAt: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      const next = [item, ...notesRef.current];
      saveNotesLocal(next);
      setSaveState('saving');
      await persistNoteRemote(item);
      setSaveState('saved');
      return item;
    },
    [saveNotesLocal, persistNoteRemote]
  );

  const updateNote = useCallback(
    (noteId: string, patch: Partial<NoteItem>, immediate = false) => {
      const current = notesRef.current.find((n) => n.id === noteId);
      if (!current) return;
      const nowIso = new Date().toISOString();
      const bodyHtml = patch.bodyHtml !== undefined ? patch.bodyHtml : current.bodyHtml;
      const plainText =
        patch.plainText !== undefined
          ? patch.plainText
          : patch.bodyHtml !== undefined
          ? htmlToPlainText(bodyHtml)
          : current.plainText;

      const updated: NoteItem = {
        ...current,
        ...patch,
        bodyHtml,
        plainText,
        updatedAt: nowIso,
      };

      const next = notesRef.current
        .map((n) => (n.id === noteId ? updated : n))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

      saveNotesLocal(next);
      setSaveState('saving');

      if (immediate) {
        if (debounceTimersRef.current[noteId]) {
          window.clearTimeout(debounceTimersRef.current[noteId]);
          delete debounceTimersRef.current[noteId];
        }
        delete pendingWritesRef.current[noteId];
        persistNoteRemote(updated).finally(() => setSaveState('saved'));
      } else {
        pendingWritesRef.current[noteId] = updated;
        if (debounceTimersRef.current[noteId]) {
          window.clearTimeout(debounceTimersRef.current[noteId]);
        }
        debounceTimersRef.current[noteId] = window.setTimeout(async () => {
          delete debounceTimersRef.current[noteId];
          const toWrite = pendingWritesRef.current[noteId];
          delete pendingWritesRef.current[noteId];
          if (toWrite) {
            await persistNoteRemote(toWrite);
          }
          if (Object.keys(pendingWritesRef.current).length === 0) {
            setSaveState('saved');
          }
        }, 650);
      }
    },
    [saveNotesLocal, persistNoteRemote]
  );

  const togglePinNote = useCallback(
    (noteId: string) => {
      const target = notesRef.current.find((n) => n.id === noteId);
      if (!target) return;
      updateNote(noteId, { pinned: !target.pinned }, true);
    },
    [updateNote]
  );

  const softDeleteNote = useCallback(
    (noteId: string) => {
      updateNote(noteId, { deletedAt: new Date().toISOString(), pinned: false }, true);
    },
    [updateNote]
  );

  const restoreNote = useCallback(
    (noteId: string) => {
      updateNote(noteId, { deletedAt: null }, true);
    },
    [updateNote]
  );

  const permanentlyDeleteNote = useCallback(
    async (noteId: string) => {
      const next = notesRef.current.filter((n) => n.id !== noteId);
      saveNotesLocal(next);
      if (uid) {
        await deleteDoc(doc(db, 'users', uid, 'notes', noteId)).catch(() => {});
      }
    },
    [uid, saveNotesLocal]
  );

  const emptyTrash = useCallback(async () => {
    const trashed = notesRef.current.filter((n) => Boolean(n.deletedAt));
    const remaining = notesRef.current.filter((n) => !n.deletedAt);
    saveNotesLocal(remaining);
    if (uid) {
      await Promise.all(
        trashed.map((n) => deleteDoc(doc(db, 'users', uid, 'notes', n.id)).catch(() => {}))
      );
    }
  }, [uid, saveNotesLocal]);

  const createFolder = useCallback(
    async (params: {
      name: string;
      icon: NoteFolderIcon;
      color: NoteFolderColor;
    }): Promise<NoteFolder> => {
      const nowIso = new Date().toISOString();
      const folder: NoteFolder = {
        id: `fld_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        name: params.name.trim(),
        icon: params.icon,
        color: params.color,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      const next = [...foldersRef.current, folder].sort((a, b) => a.name.localeCompare(b.name));
      saveFoldersLocal(next);
      if (uid) {
        await setDoc(
          doc(db, 'users', uid, 'note_folders', folder.id),
          JSON.parse(JSON.stringify(folder))
        ).catch(() => {});
      }
      return folder;
    },
    [uid, saveFoldersLocal]
  );

  const deleteFolder = useCallback(
    async (folderId: string) => {
      const nextFolders = foldersRef.current.filter((f) => f.id !== folderId);
      saveFoldersLocal(nextFolders);

      const affectedNotes = notesRef.current.filter((n) => n.folderId === folderId);
      if (affectedNotes.length > 0) {
        const nextNotes = notesRef.current.map((n) =>
          n.folderId === folderId ? { ...n, folderId: null } : n
        );
        saveNotesLocal(nextNotes);
        if (uid) {
          await Promise.all(
            affectedNotes.map((n) =>
              setDoc(
                doc(db, 'users', uid, 'notes', n.id),
                { folderId: null, updatedAt: new Date().toISOString() },
                { merge: true }
              ).catch(() => {})
            )
          );
        }
      }

      if (uid) {
        await deleteDoc(doc(db, 'users', uid, 'note_folders', folderId)).catch(() => {});
      }
    },
    [uid, saveFoldersLocal, saveNotesLocal]
  );

  const uploadNoteImage = useCallback(
    async (noteId: string, file: File): Promise<NoteImageAttachment> => {
      const nowIso = new Date().toISOString();
      const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;

      if (uid) {
        try {
          const storage = getStorage();
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const path = `users/${uid}/note_attachments/${noteId}/${id}_${safeName}`;
          const fileRef = storageRef(storage, path);
          await uploadBytes(fileRef, file);
          const url = await getDownloadURL(fileRef);
          return { id, url, name: file.name, storagePath: path, createdAt: nowIso };
        } catch {
          // Fallback to compressed data URL if Storage is unavailable/offline
        }
      }

      const dataUrl = await compressImageToDataUrl(file);
      return { id, url: dataUrl, name: file.name, createdAt: nowIso };
    },
    [uid]
  );

  return {
    notes,
    folders,
    saveState,
    createNote,
    updateNote,
    togglePinNote,
    softDeleteNote,
    restoreNote,
    permanentlyDeleteNote,
    emptyTrash,
    createFolder,
    deleteFolder,
    uploadNoteImage,
    flushPendingSaves,
  };
}
