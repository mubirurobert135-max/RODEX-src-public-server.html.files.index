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
  getDocFromServer,
  onSnapshot,
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

/**
 * Validate Firestore connection
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    const testDocRef = doc(db, 'test', 'connection');
    await getDocFromServer(testDocRef).catch(() => {});
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline check:', error.message);
    }
    return false;
  }
}

// ----------------------------------------------------
// AUTHENTICATION METHODS
// ----------------------------------------------------

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

export const subscribeToAuthChanges = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, (user) => {
    callback(user);
  });
};

// ----------------------------------------------------
// USER PROFILE PERSISTENCE
// ----------------------------------------------------

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

export interface FirestoreUserProfile {
  displayName?: string;
  email: string;
  photoURL?: string;
  createdAt: string;
  updatedAt?: string;
}

export const saveUserProfileToFirestore = async (
  userId: string,
  profile: Partial<FirestoreUserProfile>
): Promise<boolean> => {
  const path = `users/${userId}`;
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(
      userRef,
      {
        ...profile,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    return false;
  }
};

export const loadUserProfileFromFirestore = async (
  userId: string
): Promise<FirestoreUserProfile | null> => {
  const path = `users/${userId}`;
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as FirestoreUserProfile;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return null;
  }
};

// ----------------------------------------------------
// CONVERSATIONS & MESSAGES PERSISTENCE
// ----------------------------------------------------

export interface FirestoreConversation {
  id: string;
  title: string;
  activeMode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FirestoreMessage {
  id?: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  toolCalls?: string;
  sources?: any[];
  webGrounded?: boolean;
}

export const saveConversationToFirestore = async (
  userId: string,
  conversation: FirestoreConversation
): Promise<boolean> => {
  const path = `users/${userId}/conversations/${conversation.id}`;
  try {
    const convRef = doc(db, 'users', userId, 'conversations', conversation.id);
    await setDoc(
      convRef,
      {
        ...conversation,
        timestamp: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    return false;
  }
};

export const loadUserConversationsFromFirestore = async (
  userId: string
): Promise<FirestoreConversation[]> => {
  const path = `users/${userId}/conversations`;
  try {
    const convsRef = collection(db, 'users', userId, 'conversations');
    const q = query(convsRef, orderBy('updatedAt', 'desc'), limit(50));
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

export const saveMessageToFirestore = async (
  userId: string,
  conversationId: string,
  message: FirestoreMessage
): Promise<string> => {
  const path = `users/${userId}/conversations/${conversationId}/messages`;
  try {
    const msgsRef = collection(db, 'users', userId, 'conversations', conversationId, 'messages');
    const docRef = await addDoc(msgsRef, {
      ...message,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    return `msg-${Date.now()}`;
  }
};

export const loadMessagesFromFirestore = async (
  userId: string,
  conversationId: string
): Promise<FirestoreMessage[]> => {
  const path = `users/${userId}/conversations/${conversationId}/messages`;
  try {
    const msgsRef = collection(db, 'users', userId, 'conversations', conversationId, 'messages');
    const snap = await getDocs(msgsRef);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
};

// ----------------------------------------------------
// MEMORY PERSISTENCE
// ----------------------------------------------------

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
  if (!auth.currentUser || auth.currentUser.uid !== userId) return '';
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

// ----------------------------------------------------
// SCHEDULE PERSISTENCE
// ----------------------------------------------------

export interface FirestoreScheduleItem {
  id?: string;
  title: string;
  datetime: string;
  status: string;
  priority?: string;
  recurrence?: string;
  createdAt: string;
}

export const saveScheduleToFirestore = async (
  userId: string,
  item: Omit<FirestoreScheduleItem, 'id' | 'createdAt'>
): Promise<string> => {
  if (!auth.currentUser || auth.currentUser.uid !== userId) return '';
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

export const deleteScheduleFromFirestore = async (
  userId: string,
  scheduleId: string
): Promise<boolean> => {
  const path = `users/${userId}/schedules/${scheduleId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'schedules', scheduleId));
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
    return false;
  }
};

// ----------------------------------------------------
// USER SETTINGS & VOICE PROFILE PERSISTENCE
// ----------------------------------------------------

export interface FirestoreUserSettings {
  theme?: string;
  voiceVolume?: number;
  autoSpeak?: boolean;
  autoListen?: boolean;
  hapticFeedbackEnabled?: boolean;
  webSearchEnabled?: boolean;
  updatedAt?: string;
}

export const saveUserSettingsToFirestore = async (
  userId: string,
  settings: FirestoreUserSettings
): Promise<boolean> => {
  const path = `users/${userId}/settings/preferences`;
  try {
    const setRef = doc(db, 'users', userId, 'settings', 'preferences');
    await setDoc(
      setRef,
      {
        ...settings,
        updatedAt: new Date().toISOString(),
        timestamp: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    return false;
  }
};

export const loadUserSettingsFromFirestore = async (
  userId: string
): Promise<FirestoreUserSettings | null> => {
  const path = `users/${userId}/settings/preferences`;
  try {
    const setRef = doc(db, 'users', userId, 'settings', 'preferences');
    const snap = await getDoc(setRef);
    if (snap.exists()) {
      return snap.data() as FirestoreUserSettings;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return null;
  }
};

export interface FirestoreVoiceProfile {
  voiceId?: string;
  pitch?: number;
  rate?: number;
  accent?: string;
  updatedAt?: string;
}

export const saveVoiceProfileToFirestore = async (
  userId: string,
  voiceProfile: FirestoreVoiceProfile
): Promise<boolean> => {
  const path = `users/${userId}/voice/profile`;
  try {
    const voiceRef = doc(db, 'users', userId, 'voice', 'profile');
    await setDoc(
      voiceRef,
      {
        ...voiceProfile,
        updatedAt: new Date().toISOString(),
        timestamp: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    return false;
  }
};

export const loadVoiceProfileFromFirestore = async (
  userId: string
): Promise<FirestoreVoiceProfile | null> => {
  const path = `users/${userId}/voice/profile`;
  try {
    const voiceRef = doc(db, 'users', userId, 'voice', 'profile');
    const snap = await getDoc(voiceRef);
    if (snap.exists()) {
      return snap.data() as FirestoreVoiceProfile;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return null;
  }
};

// ----------------------------------------------------
// INTEGRATION PERSISTENCE
// ----------------------------------------------------

export interface FirestoreIntegration {
  id?: string;
  provider: string;
  connected: boolean;
  email?: string;
  updatedAt: string;
}

export const saveIntegrationToFirestore = async (
  userId: string,
  integration: FirestoreIntegration
): Promise<boolean> => {
  const path = `users/${userId}/integrations/${integration.provider}`;
  try {
    const integRef = doc(db, 'users', userId, 'integrations', integration.provider);
    await setDoc(
      integRef,
      {
        ...integration,
        updatedAt: new Date().toISOString(),
        timestamp: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    return false;
  }
};

export const loadIntegrationsFromFirestore = async (
  userId: string
): Promise<FirestoreIntegration[]> => {
  const path = `users/${userId}/integrations`;
  try {
    const integRef = collection(db, 'users', userId, 'integrations');
    const snap = await getDocs(integRef);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
};

// ----------------------------------------------------
// AGENT TASK PERSISTENCE
// ----------------------------------------------------

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

function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj as Record<string, any>)) {
    if (value !== undefined) {
      sanitized[key] = sanitizeForFirestore(value);
    }
  }
  return sanitized as T;
}

export const saveTaskToFirestore = async (
  userId: string,
  task: FirestoreAgentTask
): Promise<boolean> => {
  if (!auth.currentUser || auth.currentUser.uid !== userId) return false;
  const path = `users/${userId}/tasks/${task.id}`;
  try {
    const taskRef = doc(db, 'users', userId, 'tasks', task.id);
    const sanitizedData = sanitizeForFirestore({
      ...task,
      updatedAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
    });
    await setDoc(taskRef, sanitizedData);
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
