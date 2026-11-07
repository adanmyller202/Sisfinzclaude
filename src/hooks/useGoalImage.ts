import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { fileToCompressedDataUrl } from '../utils/image';

export interface GoalImageData {
  dataUrl: string;
  width: number;
  height: number;
  updatedAt: string;
}

export function useGoalImage(goalId: string | undefined | null) {
  const { user } = useAuth();
  const [image, setImage] = useState<GoalImageData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!user || !goalId) {
      setImage(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const docRef = doc(db, 'users', user.uid, 'goal_images', goalId);

    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as GoalImageData;
          setImage({
            dataUrl: data.dataUrl || '',
            width: data.width || 600,
            height: data.height || 400,
            updatedAt: data.updatedAt || new Date().toISOString(),
          });
        } else {
          setImage(null);
        }
        setLoading(false);
      },
      (err) => {
        console.warn('Error fetching goal image from Firestore:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, goalId]);

  const saveImage = useCallback(
    async (file: File): Promise<GoalImageData> => {
      if (!user) {
        throw new Error('Você precisa estar autenticado para salvar uma imagem.');
      }
      if (!goalId) {
        throw new Error('Nenhum objetivo selecionado.');
      }

      const compressed = await fileToCompressedDataUrl(file);
      const payload: GoalImageData = {
        dataUrl: compressed.dataUrl,
        width: compressed.width,
        height: compressed.height,
        updatedAt: new Date().toISOString(),
      };

      const docRef = doc(db, 'users', user.uid, 'goal_images', goalId);
      await setDoc(docRef, payload);
      setImage(payload);
      return payload;
    },
    [user, goalId]
  );

  const removeImage = useCallback(async (): Promise<void> => {
    if (!user || !goalId) return;
    const docRef = doc(db, 'users', user.uid, 'goal_images', goalId);
    await deleteDoc(docRef);
    setImage(null);
  }, [user, goalId]);

  return {
    image,
    loading,
    saveImage,
    removeImage,
  };
}
