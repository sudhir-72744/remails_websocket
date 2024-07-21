import { NextResponse, NextRequest } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { google, gmail_v1 } from 'googleapis';
import jwt from 'jsonwebtoken';

import { Server as SocketIOServer } from 'socket.io';

const oAuth2Client = new OAuth2Client(
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET!
);

interface DecodedToken {
  refreshToken: string;
}

async function extractContent(email: gmail_v1.Schema$Message): Promise<{ textBody: string, htmlBody: string, attachments: gmail_v1.Schema$MessagePart[] }> {
  const parts = email.payload?.parts || [];
  let textBody = '';
  let htmlBody = '';
  const attachments: gmail_v1.Schema$MessagePart[] = [];

  const recursiveExtract = async (parts: gmail_v1.Schema$MessagePart[]): Promise<void> => {
    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        textBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        htmlBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.filename && part.body?.attachmentId) {
        attachments.push(part);
      } else if (part.parts) {
        await recursiveExtract(part.parts);
      }
    }
  };

  await recursiveExtract(parts);

  if (!textBody && email.payload?.mimeType === 'text/plain' && email.payload?.body?.data) {
    textBody = Buffer.from(email.payload.body.data, 'base64').toString('utf-8');
  }

  if (!htmlBody && email.payload?.mimeType === 'text/html' && email.payload?.body?.data) {
    htmlBody = Buffer.from(email.payload.body.data, 'base64').toString('utf-8');
  }

  if (attachments.length === 0) {
    const topLevelParts = email.payload?.parts || [];
    for (const part of topLevelParts) {
      if (part.filename && part.body?.attachmentId) {
        attachments.push(part);
      }
    }
  }

  return { textBody, htmlBody, attachments };
}

async function getAttachmentInfo(gmail: gmail_v1.Gmail, userId: string, messageId: string, attachmentId: string) {
  try {
    const response = await gmail.users.messages.attachments.get({
      userId,
      messageId,
      id: attachmentId,
    });

    return {
      data: response.data.data,
      size: response.data.size,
    };
  } catch (error) {
    console.error(`Error getting attachment info for ${attachmentId}:`, error);
    return null;
  }
}

async function formatEmailData(gmail: gmail_v1.Gmail, email: gmail_v1.Schema$Message, accessToken: string) {
  const headers = email.payload?.headers || [];
  const getHeader = (name: string) => headers.find(header => header.name?.toLowerCase() === name)?.value || '';
  const [senderName, senderEmail] = getHeader('from').split('<');
  
  const { textBody, htmlBody, attachments } = await extractContent(email);

  const attachmentPromises = attachments.map(async (attachment) => {
    const attachmentInfo = await getAttachmentInfo(gmail, 'me', email.id!, attachment.body!.attachmentId!);
    return {
      filename: attachment.filename!,
      mimeType: attachment.mimeType || 'application/octet-stream',
      data: attachmentInfo?.data,
      size: attachmentInfo?.size,
    };
  });

  const resolvedAttachments = await Promise.all(attachmentPromises);

  return {
    id: email.id,
    threadId: email.threadId,
    name: senderName?.trim() || '',
    email: senderEmail?.replace('>', '') || '',
    reply: getHeader('reply-to'),
    snippet: email.snippet,
    subject: getHeader('subject'),
    htmlBody,
    textBody,
    date: new Date(parseInt(email.internalDate || '0', 10)).toISOString(),
    read: !email.labelIds?.includes('UNREAD'),
    labels: email.labelIds,
    attachments: resolvedAttachments,
  };
}

async function fetchEmailThreads(auth: OAuth2Client, threadIds: Set<string>, accessToken: string) {
  const gmail = google.gmail({ version: 'v1', auth });
  const userId = 'me';

  const fetchThread = async (threadId: string) => {
    try {
      const { data } = await gmail.users.threads.get({
        userId,
        id: threadId,
        format: 'full',
        fields: 'messages(id,threadId,labelIds,snippet,payload,internalDate)',
      });

      const emails = await Promise.all(data.messages!.map(message => formatEmailData(gmail, message, accessToken)));
      return { threadId, emails };
    } catch (err) {
      console.error(`Error fetching emails for thread ${threadId}:`, err);
      return null;
    }
  };

  const threads = await Promise.all(Array.from(threadIds).map(fetchThread));
  return threads.filter(thread => thread !== null);
}

interface LabelCount {
  name: string;
  count: number;
}

async function fetchLabelCounts(auth: OAuth2Client): Promise<LabelCount[]> {
  const gmail = google.gmail({ version: 'v1', auth });
  const userId = 'me';

  try {
    const labelsResponse = await gmail.users.labels.list({ userId });
    const labels = labelsResponse.data.labels || [];

    const labelCountsPromises = labels.map(async (label) => {
      if (!label.id || !label.name) {
        console.warn('Label missing id or name:', label);
        return { name: 'unknown', count: 0 };
      }

      try {
        const labelData = await gmail.users.labels.get({ userId, id: label.id });
        const count = labelData.data.messagesTotal || 0;
        return { name: label.name, count };
      } catch (error) {
        console.error(`Error fetching details for label ${label.name}:`, error);
        return { name: label.name, count: 0 };
      }
    });

    return await Promise.all(labelCountsPromises);
  } catch (err) {
    console.error('Error fetching label counts:', err);
    throw err;
  }
}

async function fetchEmailsAfterHistoryId(auth: OAuth2Client, historyId: string, accessToken: string) {
  const gmail = google.gmail({ version: 'v1', auth });
  const userId = 'me';

  try {
    const response = await gmail.users.history.list({
      userId,
      startHistoryId: historyId,
      historyTypes: ['messageAdded'],
    });

    const messageIds = (response.data.history || []).flatMap(history =>
      history.messagesAdded?.map(message => message.message?.id) || []
    );

    const threadIds = new Set<string>();

    for (const messageId of messageIds) {
      const messageResponse = await gmail.users.messages.get({
        userId,
        id: messageId!,
      });
      threadIds.add(messageResponse.data.threadId!);
    }

    const threads = await fetchEmailThreads(auth, threadIds, accessToken);
    const labelCounts = await fetchLabelCounts(auth);

    return { threads, labelCounts };
  } catch (err) {
    console.error('Error fetching emails after history ID:', err);
    throw err;
  }
}

export const POST = async (req: NextRequest) => {
  const body = await req.json();
  const token = body.token;
  const historyId = body.historyId;

  if (!token || !historyId) {
    return NextResponse.json({ success: false, error: 'Missing token or historyId' }, { status: 400 });
  }
  console.log(token)
  console.log(historyId)

  try {
    const decoded = jwt.verify(token, process.env.NEXT_PUBLIC_JWT_SECRET!) as DecodedToken;
    oAuth2Client.setCredentials({ refresh_token: decoded.refreshToken });
    const { credentials } = await oAuth2Client.refreshAccessToken();
    oAuth2Client.setCredentials(credentials);
    console.log("req  recieved")
    const { threads, labelCounts } = await fetchEmailsAfterHistoryId(oAuth2Client, historyId, credentials.access_token!);

   console.log(threads)
    // Emit the notification to connected clients
    const io: SocketIOServer = (global as any).io;
    if (io) {
      io.emit('newEmail', threads);
      console.log('Notification emitted to clients');
    } else {
      console.warn('Socket.IO server not initialized');
    }
    return NextResponse.json({ success: true }, { status: 200 });
    // return NextResponse.json({ success: true, data: threads, labelCounts }, { status: 200 });

  } catch (error) {
    console.error('Error handling notification', error);
    return NextResponse.json({ success: false, error: 'Failed to handle notification' }, { status: 500 });
  }
};
export const GET = async (req: NextRequest) => {

    return NextResponse.json({ success: false, message:"Req not allowed"}, { status: 200 });
  } 