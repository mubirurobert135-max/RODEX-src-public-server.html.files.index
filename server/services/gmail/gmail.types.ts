// Types for RODEX Secure Gmail Service and API Integration

export interface GmailMessageSummary {
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

export interface GmailMessageDetail extends GmailMessageSummary {
  body: string;
  rawHtmlSnippet?: string;
  rfcMessageId?: string;
}

export interface GmailDraftResult {
  draftId: string;
  messageId?: string;
  threadId?: string;
  to: string;
  subject: string;
  body: string;
  status: 'draft_created' | 'draft_prepared';
  timestamp: string;
}

export interface GmailSendResult {
  messageId: string;
  threadId?: string;
  to: string;
  subject: string;
  bodyPreview: string;
  status: 'sent' | 'failed';
  timestamp: string;
}

export interface GmailConnectionStatus {
  isConnected: boolean;
  userEmail?: string;
  userName?: string;
  scopes: string[];
  lastChecked?: string;
  newEmailsCount?: number;
  unreadCount?: number;
  error?: string;
}

export interface GmailCheckNewResult {
  newCount: number;
  unreadCount: number;
  messages: GmailMessageSummary[];
  spokenSummary: string;
}

export interface GmailDraftReplyParams {
  emailId?: string;
  threadId?: string;
  recipient?: string;
  subject?: string;
  replyContent: string;
}

export interface GmailSendReplyParams {
  emailId: string;
  replyContent: string;
  explicitConfirmation?: boolean;
}

export interface GmailSendEmailParams {
  recipient: string;
  subject: string;
  body: string;
  explicitConfirmation?: boolean;
}
