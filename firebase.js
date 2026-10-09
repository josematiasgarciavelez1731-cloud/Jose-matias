import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Copy your Firebase web app configuration from Firebase Console.
// Never put a private API key for your AI provider in this file.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

export const firebaseReady = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
let app;
if (firebaseReady) app = initializeApp(firebaseConfig);

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export async function googleLogin() {
  if (!auth) throw new Error("Falta configurar Firebase. Revisa el archivo .env.");
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}
export async function googleLogout() {
  if (auth) await signOut(auth);
}
