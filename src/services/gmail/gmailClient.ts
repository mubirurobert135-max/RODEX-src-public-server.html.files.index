import { getCachedGmailAccessToken, signInWithGoogle, signOutUser } from '../firebase';

export interface ClientGmailStatus {
  isConnected: boolean;
  userEmail?: string;
  userName?: string;
  scopes: string[];
  unreadCount?: number;
  lastChecked?: string;
  error?: string;
}

export interface ClientEmailSummary {
  id: string;
  threadId: string;
  sender: string;
  senderName: string;
  senderEmail: string;
  recipient: string;
  subject: string;
  snippet: string;
  date: string;
  isRead: boolean;
  labels: string[];
  hasAttachments: boolean;
  attachmentCount: number;
}

export interface ClientEmailDetail extends ClientEmailSummary {
  body: string;
  rawHtmlSnippet?: string;
}

let backgroundCheckTimer: any = null;
let lastAnnouncedEmailId: string | null = null;

class GmailClientService {
  /**
   * Helper to perform authenticated requests to the backend proxy routes.
   */
  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = getCachedGmailAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as any),
    };

    const res = await fetch(endpoint, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errText = await res.text();
      let errJson: any = {};
      try {
        errJson = JSON.parse(errText);
      } catch {
        errJson = { message: errText };
      }
      throw new Error(errJson.error || errJson.message || `Request failed (${res.status})`);
    }

    return res.json();
  }

  /**
   * Get Gmail connection status.
   */
  public async getStatus(): Promise<ClientGmailStatus> {
    try {
      const status = await this.request('/api/gmail/status');
      return status;
    } catch {
      return {
        isConnected: false,
        scopes: [],
        error: 'Could not connect to Gmail service.',
      };
    }
  }

  /**
   * Initiate Google OAuth flow to connect Gmail.
   */
  public async connect(): Promise<ClientGmailStatus> {
    const user = await signInWithGoogle();
    if (!user) {
      throw new Error('Google sign-in was cancelled or aborted.');
    }
    // Return verified status
    return this.getStatus();
  }

  /**
   * Disconnect Gmail session.
   */
  public async disconnect(): Promise<void> {
    this.stopBackgroundChecking();
    await this.request('/api/gmail/disconnect', { method: 'POST' }).catch(() => {});
    await signOutUser().catch(() => {});
  }

  /**
   * Check for new and unread emails.
   */
  public async checkNew(maxResults = 5): Promise<{ newCount: number; unreadCount: number; messages: ClientEmailSummary[]; spokenSummary: string }> {
    const res = await this.request('/api/gmail/check', {
      method: 'POST',
      body: JSON.stringify({ maxResults }),
    });
    return res.result;
  }

  /**
   * List recent messages.
   */
  public async listMessages(options: { maxResults?: number; query?: string } = {}): Promise<ClientEmailSummary[]> {
    const params = new URLSearchParams();
    if (options.maxResults) params.set('maxResults', String(options.maxResults));
    if (options.query) params.set('q', options.query);

    const res = await this.request(`/api/gmail/messages?${params.toString()}`);
    return res.emails || [];
  }

  /**
   * Get full details for a single email.
   */
  public async getMessage(id: string): Promise<ClientEmailDetail> {
    const res = await this.request(`/api/gmail/messages/${encodeURIComponent(id)}`);
    return res.email;
  }

  /**
   * Draft a reply without sending.
   */
  public async draftReply(params: { emailId?: string; replyContent: string; recipient?: string; subject?: string }): Promise<any> {
    const res = await this.request('/api/gmail/draft-reply', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return res.draft;
  }

  /**
   * Send an email with explicit authorization.
   */
  public async sendEmail(params: { recipient: string; subject: string; body: string }): Promise<any> {
    const res = await this.request('/api/gmail/send', {
      method: 'POST',
      body: JSON.stringify({ ...params, explicitConfirmation: true }),
    });
    return res.result;
  }

  /**
   * Send a reply with explicit authorization.
   */
  public async sendReply(params: { emailId: string; replyContent: string }): Promise<any> {
    const res = await this.request('/api/gmail/send', {
      method: 'POST',
      body: JSON.stringify({ ...params, explicitConfirmation: true }),
    });
    return res.result;
  }

  /**
   * Optional background new-mail checker (polling without duplicate notifications).
   */
  public startBackgroundChecking(
    onNewMail: (notification: { count: number; latestSubject: string; sender: string; spokenText: string }) => void,
    intervalMs = 60000
  ): void {
    this.stopBackgroundChecking();
    backgroundCheckTimer = setInterval(async () => {
      try {
        const token = getCachedGmailAccessToken();
        if (!token) return;

        const checkRes = await this.checkNew(3);
        if (checkRes.messages && checkRes.messages.length > 0) {
          const latest = checkRes.messages[0];
          if (latest.id !== lastAnnouncedEmailId) {
            lastAnnouncedEmailId = latest.id;
            onNewMail({
              count: checkRes.newCount || checkRes.messages.length,
              latestSubject: latest.subject,
              sender: latest.senderName,
              spokenText: `RODEX Notice: You have a new email from ${latest.senderName} about "${latest.subject}".`,
            });
          }
        }
      } catch (err) {
        // Silently skip background check network blips
      }
    }, intervalMs);
  }

  public stopBackgroundChecking(): void {
    if (backgroundCheckTimer) {
      clearInterval(backgroundCheckTimer);
      backgroundCheckTimer = null;
    }
  }
}

export const globalGmailClient = new GmailClientService();
