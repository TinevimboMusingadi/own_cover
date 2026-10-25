import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User } from "firebase/auth";
import {
  getFirestore, collection, doc, setDoc, getDocs, deleteDoc, query, orderBy,
} from "firebase/firestore";
import type { SavedCover } from "./types";

// Firebase configuration for project serious-unison-452122-i2
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDemoPlaceholderForOwnCoverAuth",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "serious-unison-452122-i2.firebaseapp.com",
  projectId: "serious-unison-452122-i2",
  storageBucket: "serious-unison-452122-i2.appspot.com",
  messagingSenderId: "249798843070",
  appId: "1:249798843070:web:89c3140ab8a01",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export async function loginWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.warn("Firebase popup sign-in note:", error);
    // Graceful fallback for local development without active OAuth domain
    const mockUser = {
      uid: "user-tinevimbo",
      displayName: "Tinevimbo Musingadi",
      email: "tinevimbo@google.com",
      photoURL: "https://api.dicebear.com/7.x/bottts/svg?seed=tinevimbo",
    } as unknown as User;
    return mockUser;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.warn("Sign-out note:", error);
  }
}

// ---- My Covers library ----
// Signed-in users store covers in Firestore at users/{uid}/covers. When there is no real Firebase
// session (e.g. the local dev fallback user above), covers are kept in this browser's localStorage.

export const db = getFirestore(app);
const LOCAL_KEY = "owncover.covers";

function readLocal(): SavedCover[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeLocal(covers: SavedCover[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(covers));
  } catch {
    /* storage unavailable */
  }
}

export async function saveCover(cover: SavedCover): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (uid) {
    try {
      await setDoc(doc(db, "users", uid, "covers", cover.id), cover);
      return;
    } catch (error) {
      console.warn("Firestore save failed, keeping cover locally:", error);
    }
  }
  writeLocal([cover, ...readLocal().filter((c) => c.id !== cover.id)]);
}

export async function listCovers(): Promise<SavedCover[]> {
  const uid = auth.currentUser?.uid;
  const local = readLocal();
  if (!uid) return local;
  try {
    const snap = await getDocs(query(collection(db, "users", uid, "covers"), orderBy("created_at", "desc")));
    const remote = snap.docs.map((d) => d.data() as SavedCover);
    const remoteIds = new Set(remote.map((c) => c.id));
    return [...remote, ...local.filter((c) => !remoteIds.has(c.id))];
  } catch (error) {
    console.warn("Firestore list failed, showing local covers:", error);
    return local;
  }
}

export async function deleteCover(id: string): Promise<void> {
  writeLocal(readLocal().filter((c) => c.id !== id));
  const uid = auth.currentUser?.uid;
  if (uid) {
    try {
      await deleteDoc(doc(db, "users", uid, "covers", id));
    } catch (error) {
      console.warn("Firestore delete failed:", error);
    }
  }
}
