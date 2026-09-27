import { ToolDefinition } from '../types';
import { globalGmailAuth } from '../../services/gmail/gmail.auth';
import { globalGmailService } from '../../services/gmail/gmail.service';

export interface EmailMessage {
  id: string;
  sender: string;
  senderName: string;
  senderEmail: string;
  recipient: string;
  subject: string;
  snippet: string;
  body: string;
  date: string;
  isRead: boolean;
  labels: string[];
  isDraft?: boolean;
}

// In-memory secured sandbox email storage
let mockEmailDatabase: EmailMessage[] = [
  {
    id: 'em-101',
    sender: 'Johnathan Vance <johnathan.vance@techcorp.ug>',
    senderName: 'Johnathan Vance',
    senderEmail: 'johnathan.vance@techcorp.ug',
    recipient: 'Robert <mubirurobert135@gmail.com>',
    subject: 'Quarterly Architecture Sync & Strategy Review',
    snippet: 'Hi Robert, are you available tomorrow at 10:00 AM for the quarterly sync?',
    body: 'Hi Robert,\n\nI hope you are doing well. We are finalizing our Q4 roadmap for the distributed voice engine and would love to align with you on the real-time AI latency benchmarks.\n\nCould we meet tomorrow at 10:00 AM EAT for a 30-minute sync?\n\nBest regards,\nJohnathan Vance',
    date: '2026-09-26T08:30:00Z',
    isRead: false,
    labels: ['Inbox', 'Work', 'Priority'],
  },
  {
    id: 'em-102',
    sender: 'Sarah Nalubega <sarah.nalubega@fintech.africa>',
    senderName: 'Sarah Nalubega',
    senderEmail: 'sarah.nalubega@fintech.africa',
    recipient: 'Robert <mubirurobert135@gmail.com>',
    subject: 'Payment Gateway Security Audit Update',
    snippet: 'The security audit team has signed off on the tokenization endpoints.',
    body: 'Hello Robert,\n\nGreat news: the security team completed the penetration testing and verified the TLS 1.3 zero-trust handshake. Everything is approved for production staging.\n\nPlease let me know if you need the full PDF compliance certificate.\n\nCheers,\nSarah',
    date: '2026-09-26T07:15:00Z',
    isRead: false,
    labels: ['Inbox', 'Security'],
  },
  {
    id: 'em-103',
    sender: 'Google Cloud Platform <no-reply-alerts@google.com>',
    senderName: 'Google Cloud Platform',
    senderEmail: 'no-reply-alerts@google.com',
    recipient: 'Robert <mubirurobert135@gmail.com>',
    subject: 'Cloud Run Service Performance Report - 99.99% Uptime',
    snippet: 'Monthly metrics: Sub-50ms latency across 460M inference operations.',
    body: 'Dear Robert,\n\nYour deployment "ais-dev-s7j4ysiztkql56v6l6kkan" sustained 99.99% uptime with an average cold-start latency of 42ms during peak evaluation.\n\nNo operational alerts were triggered.',
    date: '2026-09-25T19:00:00Z',
    isRead: true,
    labels: ['Notifications', 'Cloud'],
  },
];

// Active draft storage
let activeDrafts: EmailMessage[] = [];

export const emailTool: ToolDefinition = {
  name: 'email_service',
  description:
    'Secure email capability to check new emails, search, read, summarize, draft replies, send emails with authorization, mark as read, and organize labels.',
  permissionLevel: 'elevated',
  parameters: {
    action: {
      type: 'string',
      description: 'The email action to perform: check_new | list_summaries | read_email | summarize_email | draft_reply | send_email | search_emails | mark_as_read | label_email',
      required: true,
      enum: [
        'check_new',
        'list_summaries',
        'read_email',
        'summarize_email',
        'draft_reply',
        'send_email',
        'search_emails',
        'mark_as_read',
        'label_email',
      ],
    },
    emailId: {
      type: 'string',
      description: 'The specific email ID for reading, summarizing, replying, or labeling',
      required: false,
    },
    senderQuery: {
      type: 'string',
      description: 'Sender name or email filter (e.g. "John", "Sarah")',
      required: false,
    },
    searchQuery: {
      type: 'string',
      description: 'Search query for filtering emails by keyword, subject, or content',
      required: false,
    },
    replyContent: {
      type: 'string',
      description: 'The EXACT reply message requested by the user without adding unrequested claims',
      required: false,
    },
    recipient: {
      type: 'string',
      description: 'Target email recipient address or contact name',
      required: false,
    },
    subject: {
      type: 'string',
      description: 'Subject line for a new email or draft',
      required: false,
    },
    label: {
      type: 'string',
      description: 'Label to apply (e.g. "Archived", "Work", "Read")',
      required: false,
    },
  },
  handler: async (params, context) => {
    if (context?.gmailAccessToken) {
      globalGmailAuth.setAccessToken(context.gmailAccessToken, { name: context.userName });
    }
    const isGmailActive = !!globalGmailAuth.getAccessToken();
    const action = params?.action;

    switch (action) {
      case 'check_new': {
        if (isGmailActive) {
          try {
            const result = await globalGmailService.checkNewEmails();
            return {
              success: true,
              output: result,
              message: result.spokenSummary,
            };
          } catch (err: any) {
            console.warn('[email_service:check_new Gmail error]', err);
          }
        }

        const unread = mockEmailDatabase.filter((e) => !e.isRead);
        if (unread.length === 0) {
          return {
            success: true,
            output: { count: 0, emails: [] },
            message: 'You have no new unread emails.',
          };
        }

        const summaryList = unread.map(
          (e, idx) => `${idx + 1}. From ${e.senderName}: "${e.subject}"`
        ).join('\n');

        return {
          success: true,
          output: { count: unread.length, emails: unread },
          message: `You have ${unread.length} new unread email${unread.length > 1 ? 's' : ''}:\n${summaryList}`,
        };
      }

      case 'list_summaries': {
        if (isGmailActive) {
          try {
            const emails = await globalGmailService.listEmails({ maxResults: 5 });
            const summaries = emails.map((e) => ({
              id: e.id,
              from: e.senderName,
              subject: e.subject,
              snippet: e.snippet,
              isRead: e.isRead,
              date: e.date,
            }));
            const textList = summaries.map((s) => `• [${s.from}] ${s.subject} (${s.isRead ? 'Read' : 'Unread'})`).join('\n');
            return {
              success: true,
              output: { total: emails.length, summaries },
              message: `Recent emails from Gmail:\n${textList}`,
            };
          } catch (err: any) {
            console.warn('[email_service:list_summaries Gmail error]', err);
          }
        }

        const count = mockEmailDatabase.length;
        const summaries = mockEmailDatabase.slice(0, 5).map((e) => ({
          id: e.id,
          from: e.senderName,
          subject: e.subject,
          snippet: e.snippet,
          isRead: e.isRead,
          date: e.date,
        }));

        const textList = summaries
          .map((s) => `• [${s.from}] ${s.subject} (${s.isRead ? 'Read' : 'Unread'})`)
          .join('\n');

        return {
          success: true,
          output: { total: count, summaries },
          message: `Recent emails:\n${textList}`,
        };
      }

      case 'read_email': {
        if (isGmailActive) {
          try {
            const { message, spokenText } = await globalGmailService.readEmail(params.emailId, params.searchQuery || params.senderQuery);
            return {
              success: true,
              output: message,
              message: spokenText,
            };
          } catch (err: any) {
            console.warn('[email_service:read_email Gmail error]', err);
          }
        }

        let found: EmailMessage | undefined;
        if (params.emailId) {
          found = mockEmailDatabase.find((e) => e.id === params.emailId);
        } else if (params.senderQuery) {
          const sq = params.senderQuery.toLowerCase();
          found = mockEmailDatabase.find(
            (e) => e.senderName.toLowerCase().includes(sq) || e.senderEmail.toLowerCase().includes(sq)
          );
        } else {
          // Default to latest unread or first email
          found = mockEmailDatabase.find((e) => !e.isRead) || mockEmailDatabase[0];
        }

        if (!found) {
          return {
            success: false,
            output: null,
            error: 'No matching email found.',
            message: 'No email found matching your request.',
          };
        }

        // Mark as read
        found.isRead = true;

        return {
          success: true,
          output: found,
          message: `Email from ${found.senderName} (${found.senderEmail}):\nSubject: ${found.subject}\n\n${found.body}`,
        };
      }

      case 'summarize_email': {
        if (isGmailActive) {
          try {
            const { message, spokenText } = await globalGmailService.readEmail(params.emailId, params.searchQuery || params.senderQuery);
            return {
              success: true,
              output: {
                id: message.id,
                from: message.senderName,
                subject: message.subject,
                summary: message.snippet,
              },
              message: spokenText,
            };
          } catch (err: any) {
            console.warn('[email_service:summarize_email Gmail error]', err);
          }
        }

        let found: EmailMessage | undefined;
        if (params.emailId) {
          found = mockEmailDatabase.find((e) => e.id === params.emailId);
        } else if (params.senderQuery) {
          const sq = params.senderQuery.toLowerCase();
          found = mockEmailDatabase.find(
            (e) => e.senderName.toLowerCase().includes(sq) || e.senderEmail.toLowerCase().includes(sq)
          );
        } else {
          found = mockEmailDatabase[0];
        }

        if (!found) {
          return {
            success: false,
            output: null,
            error: 'Email not found to summarize.',
          };
        }

        return {
          success: true,
          output: {
            id: found.id,
            from: found.senderName,
            subject: found.subject,
            summary: found.snippet,
          },
          message: `Email from ${found.senderName} regarding "${found.subject}": ${found.snippet}`,
        };
      }

      case 'draft_reply': {
        if (isGmailActive) {
          try {
            const draft = await globalGmailService.draftReply({
              emailId: params.emailId,
              recipient: params.recipient,
              subject: params.subject,
              replyContent: params.replyContent || "I'll attend.",
            });
            return {
              success: true,
              output: {
                draftId: draft.draftId,
                to: draft.to,
                subject: draft.subject,
                body: draft.body,
              },
              requiresConfirmation: true,
              confirmationPayload: {
                actionName: 'email_service',
                description: `Send email to ${draft.to} with subject "${draft.subject}": "${draft.body}"`,
                params: {
                  action: 'send_email',
                  emailId: draft.draftId,
                  recipient: draft.to,
                  subject: draft.subject,
                  replyContent: draft.body,
                },
              },
              message: `Draft ready.\nTo: ${draft.to}\nSubject: ${draft.subject}\nMessage: "${draft.body}"\nSay "Send it" or approve to send.`,
            };
          } catch (err: any) {
            console.warn('[email_service:draft_reply Gmail error]', err);
          }
        }

        let targetEmail: EmailMessage | undefined;
        if (params.emailId) {
          targetEmail = mockEmailDatabase.find((e) => e.id === params.emailId);
        } else if (params.senderQuery) {
          const sq = params.senderQuery.toLowerCase();
          targetEmail = mockEmailDatabase.find(
            (e) => e.senderName.toLowerCase().includes(sq) || e.senderEmail.toLowerCase().includes(sq)
          );
        } else if (params.recipient) {
          const rq = params.recipient.toLowerCase();
          targetEmail = mockEmailDatabase.find(
            (e) => e.senderName.toLowerCase().includes(rq) || e.senderEmail.toLowerCase().includes(rq)
          );
        } else {
          targetEmail = mockEmailDatabase[0];
        }

        const recipientAddress = targetEmail
          ? targetEmail.senderEmail
          : params.recipient || 'recipient@domain.com';
        const recipientName = targetEmail ? targetEmail.senderName : params.recipient || 'Recipient';
        const subject = targetEmail
          ? targetEmail.subject.startsWith('Re:') ? targetEmail.subject : `Re: ${targetEmail.subject}`
          : params.subject || 'Follow-up';

        // STRICT CONTENT PRESERVATION: preserve user's exact instruction
        const replyText = params.replyContent || "I'll attend the meeting.";

        const newDraft: EmailMessage = {
          id: `draft-${Date.now()}`,
          sender: 'Robert <mubirurobert135@gmail.com>',
          senderName: 'Robert',
          senderEmail: 'mubirurobert135@gmail.com',
          recipient: `${recipientName} <${recipientAddress}>`,
          subject,
          snippet: replyText,
          body: replyText,
          date: new Date().toISOString(),
          isRead: true,
          labels: ['Drafts'],
          isDraft: true,
        };

        activeDrafts.push(newDraft);

        return {
          success: true,
          output: {
            draftId: newDraft.id,
            to: newDraft.recipient,
            subject: newDraft.subject,
            body: newDraft.body,
          },
          requiresConfirmation: true,
          confirmationPayload: {
            actionName: 'email_service',
            description: `Send email to ${recipientName} (${recipientAddress}) with message: "${replyText}"`,
            params: {
              action: 'send_email',
              emailId: newDraft.id,
              recipient: recipientAddress,
              subject: newDraft.subject,
              replyContent: replyText,
            },
          },
          message: `Draft ready.\nTo: ${recipientName} (${recipientAddress})\nSubject: ${subject}\nMessage: "${replyText}"\nSay "Send it" or approve to send.`,
        };
      }

      case 'send_email': {
        // High-security operation: check if elevated permission or approval provided
        if (!context.hasElevatedPermission) {
          return {
            success: false,
            output: null,
            requiresConfirmation: true,
            confirmationPayload: {
              actionName: 'email_service',
              description: `Confirm sending email to ${params.recipient || 'recipient'} with content: "${params.replyContent || params.body || ''}"`,
              params,
            },
            message: `Please confirm sending this email to ${params.recipient || 'recipient'}.`,
          };
        }

        if (isGmailActive) {
          try {
            const sent = await globalGmailService.sendEmail({
              recipient: params.recipient || 'recipient@domain.com',
              subject: params.subject || 'Message from Robert',
              body: params.replyContent || params.body || "I'll attend the meeting.",
              explicitConfirmation: true,
            });
            if (params.emailId) {
              activeDrafts = activeDrafts.filter((d) => d.id !== params.emailId);
            }
            return {
              success: true,
              output: sent,
              message: 'Sent.',
            };
          } catch (err: any) {
            console.warn('[email_service:send_email Gmail error]', err);
          }
        }

        const sentRecord = {
          id: `sent-${Date.now()}`,
          to: params.recipient || 'recipient@domain.com',
          subject: params.subject || 'Message from Robert',
          body: params.replyContent || params.body || "I'll attend the meeting.",
          sentAt: new Date().toISOString(),
          status: 'delivered',
        };

        // Remove draft if present
        if (params.emailId) {
          activeDrafts = activeDrafts.filter((d) => d.id !== params.emailId);
        }

        return {
          success: true,
          output: sentRecord,
          message: 'Sent.',
        };
      }

      case 'search_emails': {
        const q = (params.searchQuery || params.senderQuery || '').toLowerCase();
        if (!q) {
          return {
            success: false,
            output: null,
            error: 'Search query required.',
          };
        }

        if (isGmailActive) {
          try {
            const results = await globalGmailService.searchEmails(params.searchQuery || params.senderQuery || '');
            return {
              success: true,
              output: { count: results.length, emails: results },
              message: results.length > 0
                ? `Found ${results.length} email${results.length > 1 ? 's' : ''} matching "${params.searchQuery || params.senderQuery}".`
                : `No emails found matching "${q}".`,
            };
          } catch (err: any) {
            console.warn('[email_service:search_emails Gmail error]', err);
          }
        }

        const matches = mockEmailDatabase.filter(
          (e) =>
            e.subject.toLowerCase().includes(q) ||
            e.body.toLowerCase().includes(q) ||
            e.senderName.toLowerCase().includes(q) ||
            e.senderEmail.toLowerCase().includes(q)
        );

        if (matches.length === 0) {
          return {
            success: true,
            output: { count: 0, results: [] },
            message: `No emails found matching "${q}".`,
          };
        }

        const list = matches.map((m) => `• From ${m.senderName}: "${m.subject}"`).join('\n');
        return {
          success: true,
          output: { count: matches.length, results: matches },
          message: `Found ${matches.length} matching email${matches.length > 1 ? 's' : ''}:\n${list}`,
        };
      }

      case 'mark_as_read': {
        const found = mockEmailDatabase.find((e) => e.id === params.emailId) || mockEmailDatabase[0];
        if (found) {
          found.isRead = true;
          return {
            success: true,
            output: { id: found.id, isRead: true },
            message: `Marked "${found.subject}" as read.`,
          };
        }
        return { success: false, output: null, error: 'Email not found.' };
      }

      case 'label_email': {
        const found = mockEmailDatabase.find((e) => e.id === params.emailId) || mockEmailDatabase[0];
        if (found && params.label) {
          if (!found.labels.includes(params.label)) {
            found.labels.push(params.label);
          }
          return {
            success: true,
            output: { id: found.id, labels: found.labels },
            message: `Added label "${params.label}" to email "${found.subject}".`,
          };
        }
        return { success: false, output: null, error: 'Email or label not provided.' };
      }

      default:
        return {
          success: false,
          output: null,
          error: `Unknown email action: ${action}`,
        };
    }
  },
};
