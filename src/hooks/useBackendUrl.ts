import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const useBackendUrl = () => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchUrl = async () => {
      try {
        const docRef = doc(db, 'config', 'backend');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setUrl(docSnap.data().url);
        }
      } catch (error) {
        console.error('Error fetching backend URL:', error);
      }
    };

    fetchUrl();
  }, []);

  return url;
};
