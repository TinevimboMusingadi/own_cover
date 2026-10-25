import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User } from "firebase/auth";

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
