import { GmailMessageDetail, GmailMessageSummary } from './gmail.types';

export class GmailParser {
  /**
   * Parse email sender header into Name and Email components.
   */
  public static parseAddressHeader(headerValue: string): { name: string; email: string; full: string } {
    if (!headerValue) return { name: 'Unknown', email: 'unknown@email.com', full: 'Unknown' };

    const match = headerValue.match(/^(?:["']?([^"']+)["']?\s+)?<?([^>]+@[^>]+)>?$/);
    if (match) {
      const name = (match[1] || match[2].split('@')[0]).trim();
      const email = match[2].trim();
      return { name, email, full: headerValue.trim() };
    }

    return { name: headerValue.split('@')[0].trim(), email: headerValue.trim(), full: headerValue.trim() };
  }

  /**
   * Safely strip HTML tags to extract clean readable plain text.
   */
  public static stripHtml(html: string): string {
    if (!html) return '';
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Decode base64 / base64url encoded Gmail body data.
   */
  public static decodeBase64(data: string): string {
    if (!data) return '';
    try {
      return Buffer.from(data, 'base64url').toString('utf-8');
    } catch {
      try {
        const standardBase64 = data.replace(/-/g, '+').replace(/_/g, '/');
        return Buffer.from(standardBase64, 'base64').toString('utf-8');
      } catch (err) {
        console.warn('[GmailParser] Failed decoding base64 content', err);
        return '';
      }
    }
  }

  /**
   * Recursively extract plain text and HTML from Gmail message payload parts.
   */
  public static extractBodyFromParts(payload: any): { plainText: string; htmlText: string; attachmentCount: number } {
    let plainText = '';
    let htmlText = '';
    let attachmentCount = 0;

    const traverse = (part: any) => {
      if (!part) return;

      if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
        attachmentCount++;
      }

      if (part.mimeType === 'text/plain' && part.body?.data && !plainText) {
        plainText = this.decodeBase64(part.body.data);
      } else if (part.mimeType === 'text/html' && part.body?.data && !htmlText) {
        htmlText = this.decodeBase64(part.body.data);
      }

      if (part.parts && Array.isArray(part.parts)) {
        for (const subPart of part.parts) {
          traverse(subPart);
        }
      }
    };

    if (payload.body?.data) {
      if (payload.mimeType === 'text/plain') {
        plainText = this.decodeBase64(payload.body.data);
      } else if (payload.mimeType === 'text/html') {
        htmlText = this.decodeBase64(payload.body.data);
      }
    }

    if (payload.parts && Array.isArray(payload.parts)) {
      for (const part of payload.parts) {
        traverse(part);
      }
    }

    return { plainText, htmlText, attachmentCount };
  }

  /**
   * Parse a raw Gmail API message item into a sanitized, structured GmailMessageDetail.
   */
  public static parseMessage(rawMsg: any): GmailMessageDetail {
    const id = rawMsg.id || '';
    const threadId = rawMsg.threadId || id;
    const snippet = rawMsg.snippet || '';
    const labels = Array.isArray(rawMsg.labelIds) ? rawMsg.labelIds : [];
    const isRead = !labels.includes('UNREAD');

    const headers = rawMsg.payload?.headers || [];
    const getHeader = (name: string): string => {
      const h = headers.find((item: any) => item.name?.toLowerCase() === name.toLowerCase());
      return h ? h.value : '';
    };

    const fromHeader = getHeader('from');
    const toHeader = getHeader('to');
    const subjectHeader = getHeader('subject') || '(No Subject)';
    const dateHeader = getHeader('date') || new Date().toISOString();
    const rfcMessageId = getHeader('message-id');

    const { name: senderName, email: senderEmail, full: sender } = this.parseAddressHeader(fromHeader);
    const { plainText, htmlText, attachmentCount } = this.extractBodyFromParts(rawMsg.payload || {});

    let body = plainText;
    if (!body && htmlText) {
      body = this.stripHtml(htmlText);
    }
    if (!body) {
      body = snippet;
    }

    // Safety guard: Mark untrusted email content wrapper to ensure LLM safety
    const sanitizedBody = this.sanitizeEmailContent(body);

    return {
      id,
      threadId,
      sender,
      senderName,
      senderEmail,
      recipient: toHeader,
      subject: subjectHeader,
      snippet,
      body: sanitizedBody,
      rawHtmlSnippet: htmlText ? htmlText.slice(0, 500) : undefined,
      date: dateHeader,
      isRead,
      labels,
      hasAttachments: attachmentCount > 0,
      attachmentCount,
      rfcMessageId,
    };
  }

  /**
   * Parse raw message into lightweight GmailMessageSummary.
   */
  public static parseSummary(rawMsg: any): GmailMessageSummary {
    const detail = this.parseMessage(rawMsg);
    return {
      id: detail.id,
      threadId: detail.threadId,
      sender: detail.sender,
      senderName: detail.senderName,
      senderEmail: detail.senderEmail,
      recipient: detail.recipient,
      subject: detail.subject,
      snippet: detail.snippet,
      date: detail.date,
      isRead: detail.isRead,
      labels: detail.labels,
      hasAttachments: detail.hasAttachments,
      attachmentCount: detail.attachmentCount,
    };
  }

  /**
   * Neutralize prompt-injection strings inside external email text.
   */
  public static sanitizeEmailContent(text: string): string {
    if (!text) return '';
    // Strip control characters while preserving formatting
    return text.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, '').trim();
  }

  /**
   * Build RFC 2822 formatted raw email string encoded in base64url for Gmail API send/draft.
   */
  public static buildRawRfc2822(options: {
    to: string;
    subject: string;
    body: string;
    inReplyTo?: string;
    references?: string;
    threadId?: string;
  }): string {
    const lines = [
      `To: ${options.to}`,
      `Subject: ${options.subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: 7bit',
    ];

    if (options.inReplyTo) {
      lines.push(`In-Reply-To: ${options.inReplyTo}`);
    }
    if (options.references) {
      lines.push(`References: ${options.references}`);
    }

    lines.push('', options.body);
    const emailStr = lines.join('\r\n');
    return Buffer.from(emailStr, 'utf-8').toString('base64url');
  }
}
