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
  deleteDoc,
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
// Request official Gmail scopes
googleProvider.addScope('https://www.googleapis.com/auth/gmail.readonly');
googleProvider.addScope('https://www.googleapis.com/auth/gmail.send');
googleProvider.addScope('https://www.googleapis.com/auth/gmail.compose');

// In-memory token cache
let cachedGmailAccessToken: string | null = null;

export const getCachedGmailAccessToken = (): string | null => {
  return cachedGmailAccessToken;
};

export const setCachedGmailAccessToken = (token: string | null): void => {
  cachedGmailAccessToken = token;
};

// Connect to specific firestoreDatabaseId
const configuredDbId = (firebaseConfig as any).firestoreDatabaseId;
export const db =
  configuredDbId && configuredDbId !== '(default)'
    ? getFirestore(app, configuredDbId)
    : getFirestore(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('[Firestore Error Details]', JSON.stringify(errInfo));
  return errInfo;
}

export const signInWithGoogle = async (): Promise<User | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedGmailAccessToken = credential.accessToken;
      // Sync token to server in-memory store
      fetch('/api/gmail/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: credential.accessToken,
          userEmail: result.user.email,
          userName: result.user.displayName,
        }),
      }).catch((e) => console.warn('[Gmail token sync error]', e));
    }

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
  cachedGmailAccessToken = null;
  fetch('/api/gmail/disconnect', { method: 'POST' }).catch(() => {});
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
  const path = `users/${userId}/creations`;
  try {
    const creationsRef = collection(db, 'users', userId, 'creations');
    const docRef = await addDoc(creationsRef, {
      ...creation,
      createdAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
    });
    return docRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    return `local-${Date.now()}`;
  }
};

export const loadUserCreationsFromFirestore = async (
  userId: string
): Promise<AICreationRecord[]> => {
  const path = `users/${userId}/creations`;
  try {
    const creationsRef = collection(db, 'users', userId, 'creations');
    const q = query(creationsRef, orderBy('createdAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
};

// Memory Persistence in Firestore
export interface FirestoreMemoryItem {
  id?: string;
  category: string;
  key: string;
  value: string;
  confidence: number;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export const saveMemoryToFirestore = async (
  userId: string,
  item: Omit<FirestoreMemoryItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const path = `users/${userId}/memory`;
  try {
    const memRef = collection(db, 'users', userId, 'memory');
    const now = new Date().toISOString();
    const docRef = await addDoc(memRef, {
      ...item,
      createdAt: now,
      updatedAt: now,
      timestamp: serverTimestamp(),
    });
    return docRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    return `local-mem-${Date.now()}`;
  }
};

export const loadUserMemoriesFromFirestore = async (
  userId: string
): Promise<FirestoreMemoryItem[]> => {
  const path = `users/${userId}/memory`;
  try {
    const memRef = collection(db, 'users', userId, 'memory');
    const snap = await getDocs(memRef);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
};

export const deleteMemoryFromFirestore = async (
  userId: string,
  memoryId: string
): Promise<boolean> => {
  const path = `users/${userId}/memory/${memoryId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'memory', memoryId));
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
    return false;
  }
};

// Schedule Persistence in Firestore
export interface FirestoreScheduleItem {
  id?: string;
  title: string;
  datetime: string;
  status: string;
  priority?: string;
  recurrence?: string;
  createdAt: string;
}

// Agent Task Persistence in Firestore
export interface FirestoreAgentTask {
  id: string;
  title: string;
  category: string;
  goal: string;
  state: string;
  currentStepIndex: number;
  steps: any[];
  requiresConfirmation?: boolean;
  confirmationPrompt?: string;
  confirmationAction?: any;
  alternativeProposal?: string;
  resultSummary?: string;
  createdAt: string;
  updatedAt: string;
}

export const saveTaskToFirestore = async (
  userId: string,
  task: FirestoreAgentTask
): Promise<boolean> => {
  const path = `users/${userId}/tasks/${task.id}`;
  try {
    const taskRef = doc(db, 'users', userId, 'tasks', task.id);
    await setDoc(taskRef, {
      ...task,
      updatedAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
    });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    return false;
  }
};

export const loadUserTasksFromFirestore = async (
  userId: string
): Promise<FirestoreAgentTask[]> => {
  const path = `users/${userId}/tasks`;
  try {
    const tasksRef = collection(db, 'users', userId, 'tasks');
    const snap = await getDocs(tasksRef);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
};

export const saveScheduleToFirestore = async (
  userId: string,
  item: Omit<FirestoreScheduleItem, 'id' | 'createdAt'>
): Promise<string> => {
  const path = `users/${userId}/schedules`;
  try {
    const schedRef = collection(db, 'users', userId, 'schedules');
    const docRef = await addDoc(schedRef, {
      ...item,
      createdAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
    });
    return docRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    return `local-sched-${Date.now()}`;
  }
};

export const loadUserSchedulesFromFirestore = async (
  userId: string
): Promise<FirestoreScheduleItem[]> => {
  const path = `users/${userId}/schedules`;
  try {
    const schedRef = collection(db, 'users', userId, 'schedules');
    const snap = await getDocs(schedRef);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
};

export const subscribeToAuthChanges = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, (user) => {
    callback(user);
  });
};
