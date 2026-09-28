import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, setLogLevel } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";

setLogLevel("error");

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAIOWlMHhnzfcVUzCGULbdfS6IzqJItASY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "hackwell-fungames.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "hackwell-fungames",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "hackwell-fungames.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "206289606816",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:206289606816:web:5c71780d13f2ef274ed1c5",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-PDBGNEYX7S",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
export const auth = getAuth(app);

export let analytics = null;
if (typeof window !== "undefined") {
  isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch(() => {
      // Analytics is optional and might not be supported in all environments
    });
}

export default app;