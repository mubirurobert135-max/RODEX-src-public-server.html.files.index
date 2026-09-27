// Client-Side Authentication & Session Client

export interface UserVoiceProfile {
  voiceURI?: string;
  pitch: number;
  rate: number;
  autoSpeak: boolean;
  voiceName?: string;
}

export interface UserPersonalization {
  preferredName: string;
  honorific: string;
  responseStyle: 'concise' | 'balanced' | 'detailed';
  tone: 'professional' | 'conversational' | 'technical';
  timezone: string;
  customDirectives: string[];
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  profile: UserPersonalization;
  voiceProfile: UserVoiceProfile;
  connectedServices: {
    gmail?: { connected: boolean; email?: string; connectedAt?: string };
    spotify?: { connected: boolean; accountName?: string; connectedAt?: string };
  };
  permissions: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
}

const SESSION_TOKEN_KEY = 'rodex_session_token';
const CURRENT_USER_KEY = 'rodex_current_user';

class AuthClient {
  private static instance: AuthClient | null = null;
  private currentUser: AuthenticatedUser | null = null;
  private token: string | null = null;
  private listeners: Set<(user: AuthenticatedUser | null) => void> = new Set();

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): AuthClient {
    if (!this.instance) {
      this.instance = new AuthClient();
    }
    return this.instance;
  }

  private loadFromStorage(): void {
    try {
      this.token = localStorage.getItem(SESSION_TOKEN_KEY);
      const rawUser = localStorage.getItem(CURRENT_USER_KEY);
      if (rawUser) {
        this.currentUser = JSON.parse(rawUser);
      }
    } catch (err) {
      console.warn('[AuthClient] Error loading stored session:', err);
    }
  }

  private persistSession(user: AuthenticatedUser | null, token: string | null): void {
    this.currentUser = user;
    this.token = token;

    if (token && user) {
      localStorage.setItem(SESSION_TOKEN_KEY, token);
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_TOKEN_KEY);
      localStorage.removeItem(CURRENT_USER_KEY);
    }

    this.notifyListeners();
  }

  public subscribe(listener: (user: AuthenticatedUser | null) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentUser);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.currentUser);
    }
  }

  public setFirebaseUser(fbUser: {
    uid: string;
    email?: string | null;
    displayName?: string | null;
  }): AuthenticatedUser {
    const user: AuthenticatedUser = {
      id: fbUser.uid,
      username: fbUser.email ? fbUser.email.split('@')[0] : fbUser.uid,
      email: fbUser.email || `${fbUser.uid}@firebase.user`,
      displayName: fbUser.displayName || 'RODEX User',
      role: 'user',
      profile: {
        preferredName: fbUser.displayName?.split(' ')[0] || 'Operator',
        honorific: fbUser.displayName?.split(' ')[0] || 'Operator',
        responseStyle: 'balanced',
        tone: 'professional',
        timezone: 'Africa/Kampala',
        customDirectives: [],
      },
      voiceProfile: {
        pitch: 1.0,
        rate: 1.0,
        autoSpeak: true,
      },
      connectedServices: {
        gmail: { connected: true, email: fbUser.email || undefined },
      },
      permissions: {
        voice: true,
        browserControl: true,
        gmail: true,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.persistSession(user, `fb-token-${fbUser.uid}`);
    return user;
  }

  public getToken(): string | null {
    return this.token || localStorage.getItem(SESSION_TOKEN_KEY);
  }

  public getCurrentUser(): AuthenticatedUser | null {
    return this.currentUser;
  }

  public isAuthenticated(): boolean {
    return Boolean(this.currentUser && this.token);
  }

  public async getMe(): Promise<AuthenticatedUser | null> {
    const token = this.getToken();
    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          this.persistSession(null, null);
        }
        return null;
      }

      const data = await res.json();
      if (data.success && data.user) {
        this.persistSession(data.user, data.sessionToken || token);
        return data.user;
      }
      return null;
    } catch (err) {
      console.warn('[AuthClient] Error fetching current user:', err);
      return this.currentUser;
    }
  }

  public async register(params: {
    username: string;
    email: string;
    displayName: string;
    password: string;
    securityQuestion?: string;
    securityAnswer?: string;
    preferredName?: string;
  }): Promise<AuthenticatedUser> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to register account.');
    }

    this.persistSession(data.user, data.sessionToken);
    return data.user;
  }

  public async login(identifier: string, password: string): Promise<AuthenticatedUser> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Invalid username/email or password.');
    }

    this.persistSession(data.user, data.sessionToken);
    return data.user;
  }

  public async logout(): Promise<void> {
    const token = this.getToken();
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (err) {
      console.warn('[AuthClient] Logout request error:', err);
    } finally {
      this.persistSession(null, null);
    }
  }

  public async updateProfile(updates: Partial<UserPersonalization> & { displayName?: string }): Promise<AuthenticatedUser> {
    const token = this.getToken();
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(updates),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update profile.');
    }

    this.persistSession(data.user, token);
    return data.user;
  }

  public async updateVoiceProfile(updates: Partial<UserVoiceProfile>): Promise<AuthenticatedUser> {
    const token = this.getToken();
    const res = await fetch('/api/auth/voice-profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(updates),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update voice settings.');
    }

    this.persistSession(data.user, token);
    return data.user;
  }

  public async recoverPassword(params: {
    identifier: string;
    securityAnswer: string;
    newPassword: string;
  }): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/auth/recover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Password recovery failed.');
    }

    return data;
  }
}

export const globalAuthClient = AuthClient.getInstance();
