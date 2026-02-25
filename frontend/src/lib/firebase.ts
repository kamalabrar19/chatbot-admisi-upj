// src/lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCwdhWTls-tHG9sPJqB87b5o8PNEEPAGvM",
  authDomain: "admisi-upj-auth.firebaseapp.com",
  projectId: "admisi-upj-auth",
  storageBucket: "admisi-upj-auth.firebasestorage.app",
  messagingSenderId: "1037500522255",
  appId: "1:1037500522255:web:aaaf8eee3a9d0f4d3de87a",
  measurementId: "G-HN2TY1DDNG"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app); // <-- TAMBAHAN BARU

export { auth, googleProvider, db };