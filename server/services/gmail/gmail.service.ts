import { globalGmailAuth } from './gmail.auth';
import { GmailParser } from './gmail.parser';
import {
  GmailCheckNewResult,
  GmailConnectionStatus,
  GmailDraftReplyParams,
  GmailDraftResult,
  GmailMessageDetail,
  GmailMessageSummary,
  GmailSendEmailParams,
  GmailSendReplyParams,
  GmailSendResult,
} from './gmail.types';

export class GmailService {
  private static instance: GmailService;
  // Duplicate notification tracker: keeps track of message IDs already announced to user
  private notifiedMessageIds: Set<string> = new Set();
  // Conversation context memory: currently referenced email ID for conversational "Reply to that email"
  private activeReferencedEmail: GmailMessageDetail | null = null;

  public static getInstance(): GmailService {
    if (!GmailService.instance) {
      GmailService.instance = new GmailService();
    }
    return GmailService.instance;
  }

  /**
   * Helper to fetch authenticated Gmail API.
   */
  private async fetchGmailApi(endpoint: string, options: RequestInit = {}, userId: string = 'default_user'): Promise<any> {
    const token = globalGmailAuth.getAccessToken(userId);
    if (!token) {
      throw new Error('GMAIL_NOT_CONNECTED: No active Gmail access token found. Please connect your Gmail account.');
    }

    const url = endpoint.startsWith('https://')
      ? endpoint
      : `https://gmail.googleapis.com/gmail/v1/users/me${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers as any),
    };

    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new Error('GMAIL_AUTH_EXPIRED: Gmail authorization has expired or was revoked. Please reconnect Gmail.');
      }
      const errText = await res.text();
      let errorJson: any = {};
      try {
        errorJson = JSON.parse(errText);
      } catch {
        errorJson = { message: errText };
      }
      throw new Error(`Gmail API error (${res.status}): ${errorJson.error?.message || errText}`);
    }

    return res.json();
  }

  /**
   * Set active referenced email in context for follow-up drafting/replies.
   */
  public setActiveReferencedEmail(msg: GmailMessageDetail | null): void {
    this.activeReferencedEmail = msg;
  }

  public getActiveReferencedEmail(): GmailMessageDetail | null {
    return this.activeReferencedEmail;
  }

  /**
   * Get Gmail connection status.
   */
  public async getGmailConnectionStatus(userId: string = 'default_user'): Promise<GmailConnectionStatus> {
    return globalGmailAuth.verifyAndGetStatus(userId);
  }

  /**
   * Disconnect Gmail and clear session state.
   */
  public disconnectGmail(userId: string = 'default_user'): void {
    globalGmailAuth.disconnect(userId);
    this.activeReferencedEmail = null;
    this.notifiedMessageIds.clear();
  }

  /**
   * List recent email summaries.
   */
  public async listEmails(options: { maxResults?: number; query?: string; labelIds?: string[] } = {}, userId: string = 'default_user'): Promise<GmailMessageSummary[]> {
    const maxResults = Math.min(options.maxResults || 10, 25);
    const queryParams = new URLSearchParams();
    queryParams.set('maxResults', String(maxResults));
    if (options.query) queryParams.set('q', options.query);
    if (options.labelIds?.length) {
      options.labelIds.forEach((label) => queryParams.append('labelIds', label));
    }

    const listData = await this.fetchGmailApi(`/messages?${queryParams.toString()}`, {}, userId);
    if (!listData.messages || !Array.isArray(listData.messages)) {
      return [];
    }

    // Fetch message details in parallel with concurrency limit
    const detailPromises = listData.messages.map(async (msg: { id: string }) => {
      try {
        const rawMsg = await this.fetchGmailApi(`/messages/${msg.id}?format=full`, {}, userId);
        return GmailParser.parseSummary(rawMsg);
      } catch (err) {
        console.warn(`[GmailService] Failed fetching summary for ${msg.id}`, err);
        return null;
      }
    });

    const results = await Promise.all(detailPromises);
    return results.filter((item): item is GmailMessageSummary => item !== null);
  }

  /**
   * Check for new/unread emails and prevent duplicate notifications.
   */
  public async checkNewEmails(options: { maxResults?: number } = {}, userId: string = 'default_user'): Promise<GmailCheckNewResult> {
    const maxResults = options.maxResults || 5;
    // Query for unread emails in inbox
    const queryParams = new URLSearchParams({
      q: 'is:unread in:inbox',
      maxResults: String(maxResults),
    });

    const listData = await this.fetchGmailApi(`/messages?${queryParams.toString()}`, {}, userId);
    const messageRefs = listData.messages || [];
    const totalUnreadCount = listData.resultSizeEstimate || messageRefs.length;

    if (messageRefs.length === 0) {
      return {
        newCount: 0,
        unreadCount: 0,
        messages: [],
        spokenSummary: "You don't have any new emails in your inbox.",
      };
    }

    // Retrieve details for the top unread messages
    const summaries: GmailMessageSummary[] = [];
    for (const ref of messageRefs.slice(0, maxResults)) {
      try {
        const raw = await this.fetchGmailApi(`/messages/${ref.id}?format=full`, {}, userId);
        const parsed = GmailParser.parseSummary(raw);
        summaries.push(parsed);
      } catch (err) {
        console.warn(`[GmailService] Failed to load message ${ref.id}`, err);
      }
    }

    // Track truly new (unnotified) messages
    const genuinelyNew = summaries.filter((s) => !this.notifiedMessageIds.has(s.id));
    genuinelyNew.forEach((s) => this.notifiedMessageIds.add(s.id));

    // Remember the top message as referenced in conversation context
    if (summaries.length > 0) {
      try {
        const fullLatest = await this.getEmail(summaries[0].id, userId);
        this.setActiveReferencedEmail(fullLatest);
      } catch {
        // Fallback
      }
    }

    // Formulate clean natural speech response
    let spokenSummary = '';
    const count = summaries.length;
    if (count === 1) {
      const first = summaries[0];
      spokenSummary = `You have 1 new email from ${first.senderName} regarding "${first.subject}".`;
    } else {
      const topSender = summaries[0].senderName;
      const topSubject = summaries[0].subject;
      spokenSummary = `You have ${count} new emails. The latest is from ${topSender} about "${topSubject}".`;
    }

    return {
      newCount: genuinelyNew.length,
      unreadCount: totalUnreadCount,
      messages: summaries,
      spokenSummary,
    };
  }

  /**
   * Get single email message detail by ID.
   */
  public async getEmail(id: string, userId: string = 'default_user'): Promise<GmailMessageDetail> {
    const raw = await this.fetchGmailApi(`/messages/${id}?format=full`, {}, userId);
    const parsed = GmailParser.parseMessage(raw);
    this.setActiveReferencedEmail(parsed);
    return parsed;
  }

  /**
   * Search emails with natural language query mapping.
   */
  public async searchEmails(query: string, maxResults: number = 8, userId: string = 'default_user'): Promise<GmailMessageSummary[]> {
    // Clean and normalize query for Gmail syntax
    let gmailQuery = query.trim();

    // Map common phrases
    if (/from\s+([a-zA-Z0-9_\-\.]+)/i.test(query)) {
      const match = query.match(/from\s+([a-zA-Z0-9_\-\.]+)/i);
      if (match) gmailQuery = `from:${match[1]}`;
    } else if (/subject\s+["']?([^"']+)["']?/i.test(query)) {
      const match = query.match(/subject\s+["']?([^"']+)["']?/i);
      if (match) gmailQuery = `subject:(${match[1]})`;
    } else if (/unread/i.test(query)) {
      gmailQuery = `${gmailQuery} is:unread`;
    }

    return this.listEmails({ query: gmailQuery, maxResults }, userId);
  }

  /**
   * Read email aloud or in chat.
   */
  public async readEmail(emailId?: string, query?: string, userId: string = 'default_user'): Promise<{ message: GmailMessageDetail; spokenText: string }> {
    let targetId = emailId;

    if (!targetId && query) {
      // Find matching email
      const searchResults = await this.searchEmails(query, 1, userId);
      if (searchResults.length > 0) {
        targetId = searchResults[0].id;
      }
    }

    if (!targetId) {
      // Default to the latest email in inbox
      const recent = await this.listEmails({ maxResults: 1 }, userId);
      if (recent.length > 0) {
        targetId = recent[0].id;
      } else {
        throw new Error('No emails found in your inbox to read.');
      }
    }

    const detail = await this.getEmail(targetId);
    this.setActiveReferencedEmail(detail);

    // Build spoken text (concise, clear, no technical headers)
    const attachmentNote = detail.hasAttachments ? ` This email contains ${detail.attachmentCount} attachment${detail.attachmentCount > 1 ? 's' : ''}.` : '';
    const bodyPreview = detail.body.length > 350 ? `${detail.body.slice(0, 350)}...` : detail.body;
    const spokenText = `The email is from ${detail.senderName}. The subject is "${detail.subject}". The message says: "${bodyPreview}".${attachmentNote}`;

    return {
      message: detail,
      spokenText,
    };
  }

  /**
   * Draft a reply (prepares draft in memory and creates official Gmail draft).
   */
  public async draftReply(params: GmailDraftReplyParams): Promise<GmailDraftResult> {
    // Resolve email context
    let contextEmail = this.activeReferencedEmail;
    if (params.emailId) {
      contextEmail = await this.getEmail(params.emailId);
    }

    if (!contextEmail) {
      // Try retrieving latest email
      const recent = await this.listEmails({ maxResults: 1 });
      if (recent.length > 0) {
        contextEmail = await this.getEmail(recent[0].id);
      } else {
        throw new Error('No referenced email found to draft a reply to.');
      }
    }

    const recipient = params.recipient || contextEmail.senderEmail || contextEmail.sender;
    const subject = params.subject || (contextEmail.subject.toLowerCase().startsWith('re:') ? contextEmail.subject : `Re: ${contextEmail.subject}`);
    const threadId = contextEmail.threadId || contextEmail.id;

    // Build raw email message
    const raw = GmailParser.buildRawRfc2822({
      to: recipient,
      subject,
      body: params.replyContent,
      inReplyTo: contextEmail.rfcMessageId,
      references: contextEmail.rfcMessageId,
      threadId,
    });

    try {
      // Create draft in official Gmail API
      const draftRes = await this.fetchGmailApi('/drafts', {
        method: 'POST',
        body: JSON.stringify({
          message: {
            raw,
            threadId,
          },
        }),
      });

      return {
        draftId: draftRes.id || `draft-${Date.now()}`,
        messageId: draftRes.message?.id,
        threadId,
        to: recipient,
        subject,
        body: params.replyContent,
        status: 'draft_created',
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      console.warn('[GmailService] Could not persist draft to Gmail API; preparing locally:', err?.message || err);
      return {
        draftId: `local-draft-${Date.now()}`,
        threadId,
        to: recipient,
        subject,
        body: params.replyContent,
        status: 'draft_prepared',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Send a reply ONLY after explicit authorization.
   */
  public async sendReply(params: GmailSendReplyParams): Promise<GmailSendResult> {
    if (!params.explicitConfirmation) {
      throw new Error('EMAIL_SEND_CONFIRMATION_REQUIRED: Sending an email requires explicit user authorization.');
    }

    let contextEmail = this.activeReferencedEmail;
    if (params.emailId) {
      contextEmail = await this.getEmail(params.emailId);
    }

    if (!contextEmail) {
      throw new Error('No target email found to send reply to.');
    }

    const recipient = contextEmail.senderEmail || contextEmail.sender;
    const subject = contextEmail.subject.toLowerCase().startsWith('re:') ? contextEmail.subject : `Re: ${contextEmail.subject}`;
    const threadId = contextEmail.threadId || contextEmail.id;

    const raw = GmailParser.buildRawRfc2822({
      to: recipient,
      subject,
      body: params.replyContent,
      inReplyTo: contextEmail.rfcMessageId,
      references: contextEmail.rfcMessageId,
      threadId,
    });

    const sendRes = await this.fetchGmailApi('/messages/send', {
      method: 'POST',
      body: JSON.stringify({
        raw,
        threadId,
      }),
    });

    return {
      messageId: sendRes.id || `sent-${Date.now()}`,
      threadId: sendRes.threadId || threadId,
      to: recipient,
      subject,
      bodyPreview: params.replyContent.slice(0, 150),
      status: 'sent',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Send a new email ONLY after explicit authorization.
   */
  public async sendEmail(params: GmailSendEmailParams): Promise<GmailSendResult> {
    if (!params.explicitConfirmation) {
      throw new Error('EMAIL_SEND_CONFIRMATION_REQUIRED: Sending an email requires explicit user authorization.');
    }

    const raw = GmailParser.buildRawRfc2822({
      to: params.recipient,
      subject: params.subject,
      body: params.body,
    });

    const sendRes = await this.fetchGmailApi('/messages/send', {
      method: 'POST',
      body: JSON.stringify({ raw }),
    });

    return {
      messageId: sendRes.id || `sent-${Date.now()}`,
      threadId: sendRes.threadId,
      to: params.recipient,
      subject: params.subject,
      bodyPreview: params.body.slice(0, 150),
      status: 'sent',
      timestamp: new Date().toISOString(),
    };
  }
}

export const globalGmailService = GmailService.getInstance();
