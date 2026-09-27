import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

export interface UserConnectedServices {
  gmail?: {
    connected: boolean;
    email?: string;
    accessToken?: string;
    connectedAt?: string;
  };
  spotify?: {
    connected: boolean;
    accountName?: string;
    connectedAt?: string;
  };
}

export interface UserAccount {
  id: string;
  username: string;
  email: string;
  displayName: string;
  passwordHash: string;
  salt: string;
  securityQuestion?: string;
  securityAnswerHash?: string;
  securityAnswerSalt?: string;
  role: 'user' | 'admin';
  profile: UserPersonalization;
  voiceProfile: UserVoiceProfile;
  connectedServices: UserConnectedServices;
  permissions: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
}

export interface SafeUser {
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

export interface UserSession {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  lastActive: string;
}

export class AuthService {
  private static instance: AuthService | null = null;
  private usersFilePath: string;
  private sessionsFilePath: string;
  private users: Map<string, UserAccount> = new Map();
  private sessions: Map<string, UserSession> = new Map();
  private readonly SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  private constructor() {
    const dataDir = path.resolve(__dirname, '../../../data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (err) {
        console.warn('[AuthService] Could not create data dir, using root directory:', err);
      }
    }

    this.usersFilePath = path.resolve(__dirname, '../../.rodex_users.json');
    this.sessionsFilePath = path.resolve(__dirname, '../../.rodex_sessions.json');

    this.loadFromDisk();
  }

  public static getInstance(): AuthService {
    if (!this.instance) {
      this.instance = new AuthService();
    }
    return this.instance;
  }

  private hashPassword(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha256').toString('hex');
  }

  private generateSalt(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private generateToken(): string {
    return `session_${crypto.randomBytes(32).toString('hex')}`;
  }

  private sanitizeUser(user: UserAccount): SafeUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      profile: user.profile,
      voiceProfile: user.voiceProfile,
      connectedServices: {
        gmail: user.connectedServices.gmail
          ? {
              connected: Boolean(user.connectedServices.gmail.connected),
              email: user.connectedServices.gmail.email,
              connectedAt: user.connectedServices.gmail.connectedAt,
            }
          : { connected: false },
        spotify: user.connectedServices.spotify
          ? {
              connected: Boolean(user.connectedServices.spotify.connected),
              accountName: user.connectedServices.spotify.accountName,
              connectedAt: user.connectedServices.spotify.connectedAt,
            }
          : { connected: false },
      },
      permissions: user.permissions,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.usersFilePath)) {
        const raw = fs.readFileSync(this.usersFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.users.clear();
          for (const u of parsed) {
            if (u && u.id) {
              this.users.set(u.id, u);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[AuthService] Error loading users from disk:', err);
    }

    try {
      if (fs.existsSync(this.sessionsFilePath)) {
        const raw = fs.readFileSync(this.sessionsFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.sessions.clear();
          const now = Date.now();
          for (const s of parsed) {
            if (s && s.token && new Date(s.expiresAt).getTime() > now) {
              this.sessions.set(s.token, s);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[AuthService] Error loading sessions from disk:', err);
    }

    // Seed default initial user for Robert if user database is empty
    if (this.users.size === 0) {
      this.seedInitialUser();
    }
  }

  private saveUsersToDisk(): void {
    try {
      const arr = Array.from(this.users.values());
      fs.writeFileSync(this.usersFilePath, JSON.stringify(arr, null, 2), 'utf-8');
    } catch (err) {
      console.error('[AuthService] Error saving users to disk:', err);
    }
  }

  private saveSessionsToDisk(): void {
    try {
      const arr = Array.from(this.sessions.values());
      fs.writeFileSync(this.sessionsFilePath, JSON.stringify(arr, null, 2), 'utf-8');
    } catch (err) {
      console.error('[AuthService] Error saving sessions to disk:', err);
    }
  }

  private seedInitialUser(): void {
    const salt = this.generateSalt();
    const passwordHash = this.hashPassword('robert123', salt);
    const answerSalt = this.generateSalt();
    const answerHash = this.hashPassword('rodex', answerSalt);
    const now = new Date().toISOString();

    const initialUser: UserAccount = {
      id: 'usr_robert_1001',
      username: 'robert',
      email: 'mubirurobert135@gmail.com',
      displayName: 'Robert',
      passwordHash,
      salt,
      securityQuestion: 'What is your primary AI project?',
      securityAnswerHash: answerHash,
      securityAnswerSalt: answerSalt,
      role: 'user',
      profile: {
        preferredName: 'Robert',
        honorific: 'Mr. Robert',
        responseStyle: 'balanced',
        tone: 'professional',
        timezone: 'Africa/Kampala',
        customDirectives: ['Prioritize verified, factual information and clear reasoning.'],
      },
      voiceProfile: {
        pitch: 1.0,
        rate: 1.0,
        autoSpeak: true,
      },
      connectedServices: {},
      permissions: {
        microphone: true,
        contacts: true,
        spotify: true,
        gmail: true,
        terminal: true,
      },
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(initialUser.id, initialUser);
    this.saveUsersToDisk();

    // Create a permanent default active session for seamless first-load access
    const defaultSession: UserSession = {
      token: 'session_robert_default_initial_key',
      userId: initialUser.id,
      createdAt: now,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      lastActive: now,
    };
    this.sessions.set(defaultSession.token, defaultSession);
    this.saveSessionsToDisk();
  }

  public registerUser(params: {
    username: string;
    email: string;
    displayName: string;
    password: string;
    securityQuestion?: string;
    securityAnswer?: string;
    preferredName?: string;
    timezone?: string;
  }): { user: SafeUser; sessionToken: string } {
    const username = (params.username || '').trim().toLowerCase();
    const email = (params.email || '').trim().toLowerCase();
    const displayName = (params.displayName || '').trim();
    const password = params.password || '';

    if (!username || username.length < 3) {
      throw new Error('Username must be at least 3 characters long.');
    }
    if (!/^[a-z0-9_-]+$/.test(username)) {
      throw new Error('Username can only contain lowercase letters, numbers, underscores, and dashes.');
    }
    if (!email || !email.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }
    if (!displayName) {
      throw new Error('Display name is required.');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    // Check uniqueness
    for (const existing of this.users.values()) {
      if (existing.username.toLowerCase() === username) {
        throw new Error(`An account with username '${username}' already exists.`);
      }
      if (existing.email.toLowerCase() === email) {
        throw new Error(`An account with email '${email}' already exists.`);
      }
    }

    const salt = this.generateSalt();
    const passwordHash = this.hashPassword(password, salt);
    let answerSalt: string | undefined;
    let answerHash: string | undefined;

    if (params.securityAnswer) {
      answerSalt = this.generateSalt();
      answerHash = this.hashPassword(params.securityAnswer.trim().toLowerCase(), answerSalt);
    }

    const now = new Date().toISOString();
    const userId = `usr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const newUser: UserAccount = {
      id: userId,
      username,
      email,
      displayName,
      passwordHash,
      salt,
      securityQuestion: params.securityQuestion,
      securityAnswerHash: answerHash,
      securityAnswerSalt: answerSalt,
      role: 'user',
      profile: {
        preferredName: params.preferredName || displayName,
        honorific: displayName,
        responseStyle: 'balanced',
        tone: 'professional',
        timezone: params.timezone || 'Africa/Kampala',
        customDirectives: [],
      },
      voiceProfile: {
        pitch: 1.0,
        rate: 1.0,
        autoSpeak: true,
      },
      connectedServices: {},
      permissions: {
        microphone: true,
        contacts: true,
        spotify: true,
        gmail: true,
        terminal: false,
      },
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(newUser.id, newUser);
    this.saveUsersToDisk();

    // Create active session
    const token = this.generateToken();
    const session: UserSession = {
      token,
      userId: newUser.id,
      createdAt: now,
      expiresAt: new Date(Date.now() + this.SESSION_TTL_MS).toISOString(),
      lastActive: now,
    };
    this.sessions.set(token, session);
    this.saveSessionsToDisk();

    return {
      user: this.sanitizeUser(newUser),
      sessionToken: token,
    };
  }

  public loginUser(identifier: string, password: string): { user: SafeUser; sessionToken: string } {
    const cleanId = (identifier || '').trim().toLowerCase();
    const cleanPass = password || '';

    if (!cleanId || !cleanPass) {
      throw new Error('Username/email and password are required.');
    }

    let foundUser: UserAccount | null = null;
    for (const u of this.users.values()) {
      if (u.username.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId) {
        foundUser = u;
        break;
      }
    }

    if (!foundUser) {
      throw new Error('Invalid credentials. Account not found.');
    }

    const calculatedHash = this.hashPassword(cleanPass, foundUser.salt);
    if (calculatedHash !== foundUser.passwordHash) {
      throw new Error('Invalid credentials. Password incorrect.');
    }

    // Create session
    const now = new Date().toISOString();
    const token = this.generateToken();
    const session: UserSession = {
      token,
      userId: foundUser.id,
      createdAt: now,
      expiresAt: new Date(Date.now() + this.SESSION_TTL_MS).toISOString(),
      lastActive: now,
    };
    this.sessions.set(token, session);
    this.saveSessionsToDisk();

    return {
      user: this.sanitizeUser(foundUser),
      sessionToken: token,
    };
  }

  public verifySession(token: string): SafeUser | null {
    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session) return null;

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      this.sessions.delete(token);
      this.saveSessionsToDisk();
      return null;
    }

    const user = this.users.get(session.userId);
    if (!user) {
      this.sessions.delete(token);
      this.saveSessionsToDisk();
      return null;
    }

    session.lastActive = new Date().toISOString();
    return this.sanitizeUser(user);
  }

  public logoutUser(token: string): boolean {
    if (!token) return false;
    const removed = this.sessions.delete(token);
    if (removed) {
      this.saveSessionsToDisk();
    }
    return removed;
  }

  public recoverPassword(params: {
    identifier: string;
    securityAnswer: string;
    newPassword: string;
  }): { success: boolean; message: string } {
    const cleanId = (params.identifier || '').trim().toLowerCase();
    const cleanAnswer = (params.securityAnswer || '').trim().toLowerCase();
    const newPass = params.newPassword || '';

    if (!cleanId || !cleanAnswer || !newPass) {
      throw new Error('Username/email, security answer, and new password are required.');
    }
    if (newPass.length < 6) {
      throw new Error('New password must be at least 6 characters long.');
    }

    let foundUser: UserAccount | null = null;
    for (const u of this.users.values()) {
      if (u.username.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId) {
        foundUser = u;
        break;
      }
    }

    if (!foundUser) {
      throw new Error('Account not found.');
    }

    if (!foundUser.securityAnswerHash || !foundUser.securityAnswerSalt) {
      throw new Error('No security question was configured for this account. Please contact system admin.');
    }

    const checkHash = this.hashPassword(cleanAnswer, foundUser.securityAnswerSalt);
    if (checkHash !== foundUser.securityAnswerHash) {
      throw new Error('Security answer does not match our records.');
    }

    const newSalt = this.generateSalt();
    foundUser.salt = newSalt;
    foundUser.passwordHash = this.hashPassword(newPass, newSalt);
    foundUser.updatedAt = new Date().toISOString();
    this.saveUsersToDisk();

    return {
      success: true,
      message: 'Password successfully reset. You may now sign in with your new password.',
    };
  }

  public getUserById(id: string): SafeUser | null {
    const user = this.users.get(id);
    return user ? this.sanitizeUser(user) : null;
  }

  public getRawUserById(id: string): UserAccount | null {
    return this.users.get(id) || null;
  }

  public updateUserProfile(
    userId: string,
    updates: Partial<UserPersonalization> & { displayName?: string }
  ): SafeUser {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found.');
    }

    if (updates.displayName) {
      user.displayName = updates.displayName.trim();
    }

    user.profile = {
      ...user.profile,
      ...updates,
    };
    user.updatedAt = new Date().toISOString();
    this.saveUsersToDisk();
    return this.sanitizeUser(user);
  }

  public updateVoiceProfile(userId: string, updates: Partial<UserVoiceProfile>): SafeUser {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found.');
    }

    user.voiceProfile = {
      ...user.voiceProfile,
      ...updates,
    };
    user.updatedAt = new Date().toISOString();
    this.saveUsersToDisk();
    return this.sanitizeUser(user);
  }

  public setConnectedService(
    userId: string,
    service: 'gmail' | 'spotify',
    data: any
  ): void {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found.');
    }

    if (!user.connectedServices) {
      user.connectedServices = {};
    }

    user.connectedServices[service] = data;
    user.updatedAt = new Date().toISOString();
    this.saveUsersToDisk();
  }

  public getConnectedService(userId: string, service: 'gmail' | 'spotify'): any {
    const user = this.users.get(userId);
    return user?.connectedServices?.[service] || null;
  }

  public getDefaultInitialUser(): SafeUser {
    const user = this.users.get('usr_robert_1001') || Array.from(this.users.values())[0];
    if (user) {
      return this.sanitizeUser(user);
    }
    this.seedInitialUser();
    return this.sanitizeUser(this.users.get('usr_robert_1001')!);
  }

  public getDefaultInitialToken(): string {
    return 'session_robert_default_initial_key';
  }
}

export const globalAuthService = AuthService.getInstance();
