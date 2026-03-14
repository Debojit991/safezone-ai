import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const useCounter = () => {
  const [totalRuns, setTotalRuns] = useState<number>(0);

  useEffect(() => {
    const docRef = doc(db, 'stats', 'counter');
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setTotalRuns(docSnap.data().totalRuns || 0);
      }
    });

    return () => unsubscribe();
  }, []);

  const increment = async () => {
    const docRef = doc(db, 'stats', 'counter');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      await setDoc(docRef, { totalRuns: (docSnap.data().totalRuns || 0) + 1 }, { merge: true });
    } else {
      await setDoc(docRef, { totalRuns: 1 });
    }
  };

  return { totalRuns, increment };
};
