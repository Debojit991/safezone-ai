import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getAuth, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  databaseURL: import.meta.env.VITE_FB_DB_URL,
  appId: import.meta.env.VITE_FB_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const auth = getAuth(app);

// Authenticate anonymously on load
signInAnonymously(auth).then(async () => {
  const counterRef = doc(db, 'stats', 'counter');
  const snap = await getDoc(counterRef);
  if (!snap.exists()) {
    await setDoc(counterRef, { totalRuns: 0 });
  }
}).catch((error) => {
  console.error("Anonymous auth failed:", error);
});
