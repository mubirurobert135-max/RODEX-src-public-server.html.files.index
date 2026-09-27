import { ToolDefinition } from '../../orchestrator/types';
import { globalGmailAuth } from './gmail.auth';
import { globalGmailService } from './gmail.service';

/**
 * Tool: Check New Emails
 */
export const gmailCheckNewTool: ToolDefinition = {
  name: 'gmail_check_new',
  description: 'Check for new and unread emails in the user\'s authorized Gmail inbox and provide a concise spoken summary.',
  permissionLevel: 'safe',
  parameters: {
    maxResults: {
      type: 'number',
      description: 'Maximum number of new messages to check (default 5)',
      required: false,
      default: 5,
    },
  },
  handler: async (params, context) => {
    // If access token was provided in context, ensure it is recorded in auth manager
    if (context?.gmailAccessToken) {
      globalGmailAuth.setAccessToken(context.gmailAccessToken, { name: context.userName });
    }

    const status = await globalGmailService.getGmailConnectionStatus();
    if (!status.isConnected) {
      return {
        success: false,
        output: { isConnected: false },
        error: 'Gmail is not connected. Please connect your Gmail account to check emails.',
        message: 'Your Gmail account is not connected. Please use "Connect Gmail" in the Gmail panel or sign in with Google.',
      };
    }

    try {
      const result = await globalGmailService.checkNewEmails({ maxResults: params?.maxResults || 5 });
      return {
        success: true,
        output: result,
        message: result.spokenSummary,
      };
    } catch (err: any) {
      console.warn('[gmail_check_new error]', err?.message || err);
      return {
        success: false,
        output: null,
        error: err?.message || 'Failed checking new emails from Gmail.',
        message: 'I was unable to check your Gmail right now. Please verify your connection.',
      };
    }
  },
  examples: [
    { query: 'Do I have any new emails?', params: {} },
    { query: 'Check my Gmail', params: {} },
    { query: 'Do I have new messages?', params: {} },
  ],
};

/**
 * Tool: List Emails
 */
export const gmailListTool: ToolDefinition = {
  name: 'gmail_list',
  description: 'List recent emails from Gmail inbox with sender, subject, and snippet.',
  permissionLevel: 'safe',
  parameters: {
    maxResults: {
      type: 'number',
      description: 'Number of emails to list (default 10)',
      required: false,
      default: 10,
    },
    query: {
      type: 'string',
      description: 'Optional filter query (e.g. "is:unread", "from:Google")',
      required: false,
    },
  },
  handler: async (params, context) => {
    if (context?.gmailAccessToken) {
      globalGmailAuth.setAccessToken(context.gmailAccessToken, { name: context.userName });
    }

    const status = await globalGmailService.getGmailConnectionStatus();
    if (!status.isConnected) {
      return {
        success: false,
        output: { isConnected: false },
        error: 'Gmail is not connected.',
        message: 'Please connect your Gmail account to view your messages.',
      };
    }

    try {
      const emails = await globalGmailService.listEmails({
        maxResults: params?.maxResults || 10,
        query: params?.query,
      });

      const count = emails.length;
      const message = count > 0 ? `Retrieved ${count} recent email${count > 1 ? 's' : ''} from your Gmail inbox.` : 'No emails found in your inbox.';
      return {
        success: true,
        output: { count, emails },
        message,
      };
    } catch (err: any) {
      return {
        success: false,
        output: null,
        error: err?.message || 'Failed listing emails.',
        message: 'Could not retrieve your Gmail messages at this time.',
      };
    }
  },
  examples: [
    { query: 'List my recent emails', params: { maxResults: 5 } },
    { query: 'Show unread emails', params: { query: 'is:unread' } },
  ],
};

/**
 * Tool: Read Email
 */
export const gmailReadTool: ToolDefinition = {
  name: 'gmail_read',
  description: 'Read an email message aloud or in chat, retrieving its sender, subject, date, and full message content.',
  permissionLevel: 'safe',
  parameters: {
    emailId: {
      type: 'string',
      description: 'The specific email ID to read (optional, defaults to latest or query match)',
      required: false,
    },
    query: {
      type: 'string',
      description: 'Search phrase to locate the email to read (e.g. "from John", "about meeting")',
      required: false,
    },
  },
  handler: async (params, context) => {
    if (context?.gmailAccessToken) {
      globalGmailAuth.setAccessToken(context.gmailAccessToken, { name: context.userName });
    }

    const status = await globalGmailService.getGmailConnectionStatus();
    if (!status.isConnected) {
      return {
        success: false,
        output: { isConnected: false },
        error: 'Gmail is not connected.',
        message: 'Please connect your Gmail account to read emails.',
      };
    }

    try {
      const { message, spokenText } = await globalGmailService.readEmail(params?.emailId, params?.query);
      return {
        success: true,
        output: message,
        message: spokenText,
      };
    } catch (err: any) {
      return {
        success: false,
        output: null,
        error: err?.message || 'Failed reading email.',
        message: err?.message || "I couldn't find an email matching that request.",
      };
    }
  },
  examples: [
    { query: 'Read my latest email', params: {} },
    { query: 'Read the email from Sarah', params: { query: 'from:Sarah' } },
    { query: 'Summarize my latest email', params: {} },
  ],
};

/**
 * Tool: Search Emails
 */
export const gmailSearchTool: ToolDefinition = {
  name: 'gmail_search',
  description: 'Search user\'s Gmail messages by sender, subject keyword, or content topic.',
  permissionLevel: 'safe',
  parameters: {
    query: {
      type: 'string',
      description: 'The search query or filter string (e.g. "from Robert", "assignment", "invoice")',
      required: true,
    },
    maxResults: {
      type: 'number',
      description: 'Maximum results to return',
      required: false,
      default: 5,
    },
  },
  handler: async (params, context) => {
    if (context?.gmailAccessToken) {
      globalGmailAuth.setAccessToken(context.gmailAccessToken, { name: context.userName });
    }

    const status = await globalGmailService.getGmailConnectionStatus();
    if (!status.isConnected) {
      return {
        success: false,
        output: { isConnected: false },
        error: 'Gmail is not connected.',
        message: 'Please connect your Gmail account to search emails.',
      };
    }

    try {
      const results = await globalGmailService.searchEmails(params.query, params.maxResults || 5);
      if (results.length === 0) {
        return {
          success: true,
          output: { count: 0, results: [] },
          message: `I couldn't find any emails matching "${params.query}".`,
        };
      }

      const top = results[0];
      const spoken = `Found ${results.length} email${results.length > 1 ? 's' : ''} matching "${params.query}". The top result is from ${top.senderName} regarding "${top.subject}".`;
      return {
        success: true,
        output: { count: results.length, results },
        message: spoken,
      };
    } catch (err: any) {
      return {
        success: false,
        output: null,
        error: err?.message || 'Email search failed.',
        message: `I encountered an error searching for emails matching "${params.query}".`,
      };
    }
  },
  examples: [
    { query: 'Find emails from Robert', params: { query: 'from Robert' } },
    { query: 'Find the email about my assignment', params: { query: 'assignment' } },
  ],
};

/**
 * Tool: Draft Reply
 */
export const gmailDraftReplyTool: ToolDefinition = {
  name: 'gmail_draft_reply',
  description: 'Draft a reply to an email without sending it. Prepares the recipient, subject, and body for user review.',
  permissionLevel: 'safe',
  parameters: {
    replyContent: {
      type: 'string',
      description: 'The text content of the reply message',
      required: true,
    },
    emailId: {
      type: 'string',
      description: 'The target email ID to reply to (optional, uses currently referenced email context)',
      required: false,
    },
    recipient: {
      type: 'string',
      description: 'The recipient email address (optional, inferred from email)',
      required: false,
    },
    subject: {
      type: 'string',
      description: 'The subject line (optional, defaults to Re: [Original Subject])',
      required: false,
    },
  },
  handler: async (params, context) => {
    if (context?.gmailAccessToken) {
      globalGmailAuth.setAccessToken(context.gmailAccessToken, { name: context.userName });
    }

    const status = await globalGmailService.getGmailConnectionStatus();
    if (!status.isConnected) {
      return {
        success: false,
        output: { isConnected: false },
        error: 'Gmail is not connected.',
        message: 'Please connect your Gmail account to draft a reply.',
      };
    }

    try {
      const draft = await globalGmailService.draftReply({
        emailId: params?.emailId,
        recipient: params?.recipient,
        subject: params?.subject,
        replyContent: params?.replyContent,
      });

      const spoken = `I've prepared a draft reply to ${draft.to} regarding "${draft.subject}": "${draft.body}". Would you like me to send it?`;
      return {
        success: true,
        output: draft,
        message: spoken,
      };
    } catch (err: any) {
      return {
        success: false,
        output: null,
        error: err?.message || 'Failed drafting reply.',
        message: `Could not draft reply: ${err?.message || 'Unknown error'}`,
      };
    }
  },
  examples: [
    { query: "Draft a reply saying I'll attend", params: { replyContent: "I'll attend tomorrow's meeting." } },
  ],
};

/**
 * Tool: Send Reply (High-Risk: requires explicit confirmation)
 */
export const gmailSendReplyTool: ToolDefinition = {
  name: 'gmail_send_reply',
  description: 'Send a reply to an email through Gmail. MUST only be called after explicit user authorization to send.',
  permissionLevel: 'elevated',
  parameters: {
    emailId: {
      type: 'string',
      description: 'Target email ID being replied to',
      required: false,
    },
    replyContent: {
      type: 'string',
      description: 'The finalized reply message body',
      required: true,
    },
    explicitConfirmation: {
      type: 'boolean',
      description: 'Explicit user authorization flag confirming sending the email',
      required: true,
    },
  },
  handler: async (params, context) => {
    if (context?.gmailAccessToken) {
      globalGmailAuth.setAccessToken(context.gmailAccessToken, { name: context.userName });
    }

    // Explicit confirmation guard check
    if (!params?.explicitConfirmation && !context?.hasElevatedPermission) {
      return {
        success: false,
        requiresConfirmation: true,
        confirmationPayload: {
          actionName: 'gmail_send_reply',
          description: `Send reply email: "${params?.replyContent?.slice(0, 100)}..."`,
          params: { ...params, explicitConfirmation: true },
        },
        output: null,
        message: 'Please confirm sending this reply email.',
      };
    }

    try {
      const result = await globalGmailService.sendReply({
        emailId: params?.emailId || '',
        replyContent: params?.replyContent,
        explicitConfirmation: true,
      });

      const spoken = `Your reply to ${result.to} regarding "${result.subject}" has been sent successfully.`;
      return {
        success: true,
        output: result,
        message: spoken,
      };
    } catch (err: any) {
      return {
        success: false,
        output: null,
        error: err?.message || 'Failed to send reply.',
        message: `Unable to send email: ${err?.message || 'Authorization or network error'}`,
      };
    }
  },
  examples: [
    { query: 'Send the reply', params: { replyContent: "I'll attend", explicitConfirmation: true } },
  ],
};

/**
 * Tool: Send New Email (High-Risk: requires explicit confirmation)
 */
export const gmailSendTool: ToolDefinition = {
  name: 'gmail_send',
  description: 'Compose and send a new email message via Gmail. MUST only be called after explicit user authorization.',
  permissionLevel: 'elevated',
  parameters: {
    recipient: {
      type: 'string',
      description: 'Recipient email address',
      required: true,
    },
    subject: {
      type: 'string',
      description: 'Email subject line',
      required: true,
    },
    body: {
      type: 'string',
      description: 'Email body text',
      required: true,
    },
    explicitConfirmation: {
      type: 'boolean',
      description: 'Explicit user authorization flag',
      required: true,
    },
  },
  handler: async (params, context) => {
    if (context?.gmailAccessToken) {
      globalGmailAuth.setAccessToken(context.gmailAccessToken, { name: context.userName });
    }

    if (!params?.explicitConfirmation && !context?.hasElevatedPermission) {
      return {
        success: false,
        requiresConfirmation: true,
        confirmationPayload: {
          actionName: 'gmail_send',
          description: `Send email to ${params?.recipient} with subject "${params?.subject}"`,
          params: { ...params, explicitConfirmation: true },
        },
        output: null,
        message: `Are you sure you want to send this email to ${params?.recipient}?`,
      };
    }

    try {
      const result = await globalGmailService.sendEmail({
        recipient: params.recipient,
        subject: params.subject,
        body: params.body,
        explicitConfirmation: true,
      });

      return {
        success: true,
        output: result,
        message: `Email to ${result.to} was sent successfully.`,
      };
    } catch (err: any) {
      return {
        success: false,
        output: null,
        error: err?.message || 'Failed sending email.',
        message: `Unable to send email: ${err?.message}`,
      };
    }
  },
  examples: [
    {
      query: 'Send an email to john@example.com about meeting',
      params: { recipient: 'john@example.com', subject: 'Meeting', body: 'See you tomorrow', explicitConfirmation: true },
    },
  ],
};
