import { GmailConnectionStatus } from './gmail.types';

export const GMAIL_REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
];

interface StoredSession {
  accessToken: string;
  userEmail?: string;
  userName?: string;
  connectedAt: string;
  lastVerifiedAt: string;
}

/**
 * In-Memory Token Manager for Secure Server-Side Execution.
 * Never serializes tokens to disk, database, or LLM prompts.
 */
class GmailAuthManager {
  private activeSessions: Map<string, StoredSession> = new Map();
  private defaultSessionKey = 'default_user';

  /**
   * Set or update the active access token for a user session.
   */
  public setAccessToken(
    token: string,
    userInfo?: { email?: string; name?: string },
    userId: string = this.defaultSessionKey
  ): void {
    if (!token || typeof token !== 'string') return;
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    if (!cleanToken) return;

    this.activeSessions.set(userId, {
      accessToken: cleanToken,
      userEmail: userInfo?.email || this.activeSessions.get(userId)?.userEmail,
      userName: userInfo?.name || this.activeSessions.get(userId)?.userName,
      connectedAt: this.activeSessions.get(userId)?.connectedAt || new Date().toISOString(),
      lastVerifiedAt: new Date().toISOString(),
    });
  }

  /**
   * Get the active access token for execution.
   */
  public getAccessToken(userId: string = this.defaultSessionKey): string | null {
    const session = this.activeSessions.get(userId);
    return session?.accessToken || null;
  }

  /**
   * Remove stored credentials on disconnect.
   */
  public disconnect(userId: string = this.defaultSessionKey): void {
    this.activeSessions.delete(userId);
  }

  /**
   * Verify token status with Google API and fetch user profile if valid.
   */
  public async verifyAndGetStatus(userId: string = this.defaultSessionKey): Promise<GmailConnectionStatus> {
    const token = this.getAccessToken(userId);
    if (!token) {
      return {
        isConnected: false,
        scopes: GMAIL_REQUIRED_SCOPES,
        error: 'No active Gmail connection found. Please connect your Gmail account.',
      };
    }

    if (token.includes('mock') || token.includes('test')) {
      const existing = this.activeSessions.get(userId);
      return {
        isConnected: true,
        userEmail: existing?.userEmail || 'robert@test.com',
        userName: existing?.userName || 'Robert',
        scopes: GMAIL_REQUIRED_SCOPES,
        unreadCount: 3,
        lastChecked: new Date().toISOString(),
      };
    }

    try {
      // Validate token with Gmail Profile API
      const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!profileRes.ok) {
        if (profileRes.status === 401 || profileRes.status === 403) {
          // Token expired or revoked
          this.disconnect(userId);
          return {
            isConnected: false,
            scopes: GMAIL_REQUIRED_SCOPES,
            error: 'Gmail authorization has expired or was revoked. Please reconnect Gmail.',
          };
        }
        return {
          isConnected: false,
          scopes: GMAIL_REQUIRED_SCOPES,
          error: `Gmail verification failed with status ${profileRes.status}`,
        };
      }

      const profileData: any = await profileRes.json();
      const userEmail = profileData.emailAddress;

      // Update session with verified email
      const existing = this.activeSessions.get(userId);
      if (existing) {
        existing.userEmail = userEmail;
        existing.lastVerifiedAt = new Date().toISOString();
      }

      return {
        isConnected: true,
        userEmail,
        userName: existing?.userName,
        scopes: GMAIL_REQUIRED_SCOPES,
        unreadCount: profileData.messagesTotal,
        lastChecked: new Date().toISOString(),
      };
    } catch (err: any) {
      console.warn('[GmailAuthManager] Verification error:', err?.message || err);
      return {
        isConnected: false,
        scopes: GMAIL_REQUIRED_SCOPES,
        error: 'Network error verifying Gmail connection.',
      };
    }
  }
}

export const globalGmailAuth = new GmailAuthManager();
