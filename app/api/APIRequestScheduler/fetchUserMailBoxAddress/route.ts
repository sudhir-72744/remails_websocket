import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import jwt from 'jsonwebtoken';
import connectDb from '@/middleware/db/mongoose';
import UserMailBoxAddress from '@/middleware/db/Model/userMailBoxAddress/UserMailBoxAddress';
import { unwantedKeywords,unwantedDomains } from '@/app/api/utils/fromEmailIrrelevantList';

const oAuth2Client = new OAuth2Client(
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET!
);

interface DecodedToken {
  refreshToken: string;
}
const spamPatterns = [
  /^[A-Z\s!]+$/,  // All caps with possible spaces and exclamation marks
  /\d{1,2}%\s?off/i,  // Percentage discounts
  /\$\d+(\.\d{2})?/,  // Dollar amounts
  /free\s+shipping/i,  // Free shipping offers
  /limited\s+time\s+offer/i,  // Limited time offers
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,  // Email addresses in subject
  /^Re:\s/i,  // Replies (often used in spam)
  /^Fwd:\s/i,  // Forwards (often used in spam)
  /unsubscribe/i,  // Unsubscribe mentions
];

function isUnwantedEmail(email: string, name: string): boolean {
  const normalizedEmail = email.toLowerCase();
  const normalizedName = name.toLowerCase();
  const domain = normalizedEmail.split('@')[1];

  // Check for unwanted keywords in email or name
  // if (Array.from(unwantedKeywords).some(keyword => 
  //     normalizedEmail.includes(keyword) || normalizedName.includes(keyword))) {
  //   return true;
  // }

  // Check for unwanted domains
  // if (unwantedDomains.has(domain)) {
  //   return true;
  // }

  // // Check for spam patterns in email or name
  // if (spamPatterns.some(pattern => pattern.test(email) || pattern.test(name))) {
  //   return true;
  // }

  return false;
}

// Use this function instead of containsUnwantedKeyword
function filterUnwantedEmails(emailAddresses: { email: string; name: string }[]): { email: string; name: string }[] {
  return emailAddresses.filter(({ email, name }) => !isUnwantedEmail(email, name));
}



function extractEmailAddresses(header: string): { email: string; name: string }[] {
  const addresses: { email: string; name: string }[] = [];

  header.split(',').forEach(part => {
    part = part.trim();
    let email = '';
    let name = '';

    if (part.includes('<') && part.includes('>')) {
      const match = part.match(/(.*)\s*<([^>]+)>/);
      if (match) {
        name = match[1].trim();
        email = match[2].trim();
      }
    } else {
      email = part;
      name = part.split('@')[0];
      // Remove non-alphabetic characters from name
      name = name.replace(/[^a-zA-Z]+/g, '');
    }

    if (email.includes('@')) {
      addresses.push({ email, name });
    }
  });

  return addresses;
}

async function fetchEmailAddresses(auth: OAuth2Client, messageIds: string[]) {
  const gmail = google.gmail({ version: 'v1', auth });
  const userId = 'me';
  const headersToFetch = ['From', 'To', 'Cc', 'Bcc'];

  const fetchEmailAddressesForMessage = async (messageId: string) => {
    try {
      const { data } = await gmail.users.messages.get({
        userId,
        id: messageId,
        format: 'metadata',
        metadataHeaders: headersToFetch,
      });

      const headers = data.payload?.headers || [];
      const getHeader = (name: string) => headers.find(header => header.name?.toLowerCase() === name.toLowerCase())?.value || '';

      return headersToFetch.reduce((result, header) => {
        const headerValue = getHeader(header);
        if (headerValue) {
          result[header.toLowerCase()] = extractEmailAddresses(headerValue);
     
        }
        return result;
      }, { id: messageId, from: [], to: [], cc: [], bcc: [] } as { id: string; from: { email: string; name: string }[]; to: { email: string; name: string }[]; cc: { email: string; name: string }[]; bcc: { email: string; name: string }[] });
    } catch (err) {
      console.error(`Error fetching email addresses for message ${messageId}:`, err);
      return null;
    }
  };

  return (await Promise.all(messageIds.map(fetchEmailAddressesForMessage))).filter(Boolean);
}

const handler = async (req: NextRequest) => {
  try {
    const { messageIds, token, userId } = await req.json();

    if (!token || !messageIds?.length || !userId) {
      return NextResponse.json({ success: false, error: 'Missing token, messageIds, or userId parameter' }, { status: 400 });
    }

    // Verify and set credentials
    const decoded = jwt.verify(token, process.env.NEXT_PUBLIC_JWT_SECRET!) as DecodedToken;
    oAuth2Client.setCredentials({ refresh_token: decoded.refreshToken });
    const { credentials } = await oAuth2Client.refreshAccessToken();
    oAuth2Client.setCredentials(credentials);

    // Fetch email addresses
    const emailAddresses = await fetchEmailAddresses(oAuth2Client, messageIds);

    // Fetch existing data from the database
    const userMailBoxAddress = await UserMailBoxAddress.findOne({ userId });

    // Prepare data for updating
    const existingData = userMailBoxAddress ? {
      fromAddresses: new Map(userMailBoxAddress.fromAddresses.map(addr => [addr.email, addr.name])),
      toAddresses: new Map(userMailBoxAddress.toAddresses.map(addr => [addr.email, addr.name])),
      metaAddresses: new Map(userMailBoxAddress.metaAddresses.map(addr => [addr.email, addr.name]))
    } : {
      fromAddresses: new Map<string, string>(),
      toAddresses: new Map<string, string>(),
      metaAddresses: new Map<string, string>()
    };

    // Update data with new email addresses
    emailAddresses.forEach(email => {
      if (email) {
        email.from = filterUnwantedEmails(email.from);
        email.to = filterUnwantedEmails(email.to);
        const metaAddresses = filterUnwantedEmails([...email.from, ...email.to, ...email.cc, ...email.bcc]);

        email.from.forEach(({ email: addr, name }) => {
          existingData.fromAddresses.set(addr, name);
        });

        email.to.forEach(({ email: addr, name }) => {
          existingData.toAddresses.set(addr, name);
        });

        metaAddresses.forEach(({ email: addr, name }) => {
          existingData.metaAddresses.set(addr, name);
        });
      }
    });

    // Prepare final update data
    const updateData = {
      fromAddresses: Array.from(existingData.fromAddresses.entries()).map(([email, name]) => ({ email, name })),
      toAddresses: Array.from(existingData.toAddresses.entries()).map(([email, name]) => ({ email, name })),
      metaAddresses: Array.from(existingData.metaAddresses.entries()).map(([email, name]) => ({ email, name })),
    };

    console.log('Update Data:', updateData); // Log update data to verify

    // Update database
    const result = await UserMailBoxAddress.findOneAndUpdate({ userId }, updateData, { upsert: true, new: true });

    if (!result) {
      console.error('Failed to update database');
    }

    return NextResponse.json({ success: true, data: updateData }, { status: 200 });
  } catch (error) {
    console.error('Error retrieving email addresses or updating database:', error);
    return NextResponse.json({ success: false, error: 'Failed to retrieve email addresses or update database' }, { status: 500 });
  }
};



export const POST = connectDb(handler);
