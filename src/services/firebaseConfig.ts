/**
 * Firebase Integration Readiness Adapter
 * Prepares RODEX for future Firebase Authentication and Cloud Firestore
 * persistent storage without breaking current local operations or exposing secrets.
 */

export interface FirebaseSyncStatus {
  isConfigured: boolean;
  authProvider: 'local' | 'firebase';
  cloudSyncEnabled: boolean;
  lastSyncedAt?: string;
  projectId?: string;
}

export interface FirestoreUserSchema {
  uid: string;
  displayName: string;
  email?: string;
  photoURL?: string;
  createdAt: string;
  lastLoginAt: string;
  preferences: {
    themeAccent: string;
    responseStyle: 'concise' | 'balanced' | 'detailed';
    autoSpeak: boolean;
    audioSensitivity: number;
    wakeWordEnabled: boolean;
  };
}

export interface FirestoreMemorySchema {
  id: string;
  userId: string;
  category: string;
  key: string;
  value: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export class FirebaseReadinessAdapter {
  private static instance: FirebaseReadinessAdapter | null = null;
  private status: FirebaseSyncStatus = {
    isConfigured: false,
    authProvider: 'local',
    cloudSyncEnabled: false,
  };

  private constructor() {
    this.inspectConfig();
  }

  public static getInstance(): FirebaseReadinessAdapter {
    if (!this.instance) {
      this.instance = new FirebaseReadinessAdapter();
    }
    return this.instance;
  }

  private inspectConfig(): void {
    // Check if Firebase environment variables or config flags are initialized
    const hasConfig = typeof window !== 'undefined' && Boolean((window as any).__FIREBASE_CONFIG__);
    this.status = {
      isConfigured: hasConfig,
      authProvider: hasConfig ? 'firebase' : 'local',
      cloudSyncEnabled: hasConfig,
    };
  }

  public getStatus(): FirebaseSyncStatus {
    return { ...this.status };
  }

  public getTargetCollections(): string[] {
    return [
      'users/{userId}',
      'users/{userId}/memories',
      'users/{userId}/chat_sessions',
      'users/{userId}/settings',
    ];
  }
}

export const globalFirebaseAdapter = FirebaseReadinessAdapter.getInstance();
