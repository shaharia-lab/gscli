import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  subject: string;
  date: string;
  labels: string[];
}

/**
 * Parse email headers to extract relevant information
 */
function parseHeaders(headers: any[]): { from: string; subject: string; date: string } {
  const from = headers.find((h) => h.name.toLowerCase() === 'from')?.value || 'Unknown';
  const subject = headers.find((h) => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
  const date = headers.find((h) => h.name.toLowerCase() === 'date')?.value || '';
  return { from, subject, date };
}

/**
 * List messages from Gmail
 */
export async function listMessages(
  auth: OAuth2Client,
  options: {
    limit?: number;
    label?: string;
  } = {}
): Promise<GmailMessage[]> {
  const gmail = google.gmail({ version: 'v1', auth });
  const limit = options.limit || 10;
  const labelIds = options.label ? [options.label] : ['INBOX'];

  try {
    // Get message list
    const response = await gmail.users.messages.list({
      userId: 'me',
      labelIds,
      maxResults: limit,
    });

    const messages = response.data.messages || [];
    
    if (messages.length === 0) {
      return [];
    }

    // Fetch full message details for each message
    const fullMessages = await Promise.all(
      messages.map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });

        const { from, subject, date } = parseHeaders(detail.data.payload?.headers || []);

        return {
          id: detail.data.id!,
          threadId: detail.data.threadId!,
          snippet: detail.data.snippet || '',
          from,
          subject,
          date,
          labels: detail.data.labelIds || [],
        };
      })
    );

    return fullMessages;
  } catch (error: any) {
    throw new Error(`Failed to list messages: ${error.message}`);
  }
}

/**
 * Search messages in Gmail
 */
export async function searchMessages(
  auth: OAuth2Client,
  query: string,
  limit: number = 10
): Promise<GmailMessage[]> {
  const gmail = google.gmail({ version: 'v1', auth });

  try {
    // Search messages
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: limit,
    });

    const messages = response.data.messages || [];
    
    if (messages.length === 0) {
      return [];
    }

    // Fetch full message details
    const fullMessages = await Promise.all(
      messages.map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });

        const { from, subject, date } = parseHeaders(detail.data.payload?.headers || []);

        return {
          id: detail.data.id!,
          threadId: detail.data.threadId!,
          snippet: detail.data.snippet || '',
          from,
          subject,
          date,
          labels: detail.data.labelIds || [],
        };
      })
    );

    return fullMessages;
  } catch (error: any) {
    throw new Error(`Failed to search messages: ${error.message}`);
  }
}

/**
 * Get a single message by ID
 */
export async function getMessage(
  auth: OAuth2Client,
  messageId: string
): Promise<{
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  labels: string[];
}> {
  const gmail = google.gmail({ version: 'v1', auth });

  try {
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const message = response.data;
    const headers = message.payload?.headers || [];
    
    const from = headers.find((h) => h.name?.toLowerCase() === 'from')?.value || 'Unknown';
    const to = headers.find((h) => h.name?.toLowerCase() === 'to')?.value || 'Unknown';
    const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value || '(No Subject)';
    const date = headers.find((h) => h.name?.toLowerCase() === 'date')?.value || '';
    
    // Extract body (try HTML first, then plain text)
    let body = '';
    if (message.payload?.parts) {
      // Multipart message
      for (const part of message.payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString('utf-8');
          break;
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
    } else if (message.payload?.body?.data) {
      // Simple message
      body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    }
    
    // Fallback to snippet if no body found
    if (!body) {
      body = message.snippet || '';
    }

    return {
      id: message.id!,
      threadId: message.threadId!,
      from,
      to,
      subject,
      date,
      body,
      labels: message.labelIds || [],
    };
  } catch (error: any) {
    throw new Error(`Failed to get message: ${error.message}`);
  }
}

/**
 * Get available labels/folders
 */
export async function getLabels(auth: OAuth2Client): Promise<{ id: string; name: string }[]> {
  const gmail = google.gmail({ version: 'v1', auth });

  try {
    const response = await gmail.users.labels.list({
      userId: 'me',
    });

    return (response.data.labels || []).map((label) => ({
      id: label.id!,
      name: label.name!,
    }));
  } catch (error: any) {
    throw new Error(`Failed to get labels: ${error.message}`);
  }
}

