import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Connect to the specific firestoreDatabaseId if specified
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const signInWithGoogle = async (): Promise<User | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user) {
      // Save / update user profile in Firestore
      const userRef = doc(db, 'users', result.user.uid);
      await setDoc(
        userRef,
        {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
          lastActive: new Date().toISOString(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
    return result.user;
  } catch (error: any) {
    console.error('[Firebase Auth Error]', error);
    throw error;
  }
};

export const signOutUser = async (): Promise<void> => {
  await firebaseSignOut(auth);
};

export interface AICreationRecord {
  id?: string;
  type: 'video' | 'image' | 'edited_image';
  prompt: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  aspectRatio: '16:9' | '9:16' | '1:1';
  model: string;
  createdAt: string;
  sourceImageUrl?: string;
}

export const saveCreationToFirestore = async (
  userId: string,
  creation: Omit<AICreationRecord, 'id' | 'createdAt'>
): Promise<string> => {
  try {
    const creationsRef = collection(db, 'users', userId, 'creations');
    const docRef = await addDoc(creationsRef, {
      ...creation,
      createdAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
    });
    return docRef.id;
  } catch (err) {
    console.warn('[Firestore Save Creation Error]', err);
    return `local-${Date.now()}`;
  }
};

export const loadUserCreationsFromFirestore = async (
  userId: string
): Promise<AICreationRecord[]> => {
  try {
    const creationsRef = collection(db, 'users', userId, 'creations');
    const q = query(creationsRef, orderBy('createdAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));
  } catch (err) {
    console.warn('[Firestore Load Creations Error]', err);
    return [];
  }
};

export const subscribeToAuthChanges = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, (user) => {
    callback(user);
  });
};
