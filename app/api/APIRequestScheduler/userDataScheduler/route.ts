import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import jwt from 'jsonwebtoken';
import { scheduler, ApiRequest } from '@/utils/APIRequestScheduler';

const oAuth2Client = new OAuth2Client(
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET!
);

interface DecodedToken {
  refreshToken: string;
}

async function fetchEmails(auth: OAuth2Client, lastFetchTime?: string) {
  const gmail = google.gmail({ version: 'v1', auth });
  const userId = 'me';
  const mailsToFetch = 500;
  const messageIds: string[] = [];
  let pageToken: string | undefined = undefined;

  try {
    let query = lastFetchTime ? `after:${lastFetchTime}` : '';

    while (true) {
      const response = await gmail.users.messages.list({
        userId,
        q: query,
        maxResults: mailsToFetch,
        pageToken: pageToken || undefined,
        fields: 'messages(id),nextPageToken',
      });

      const messages = response.data.messages || [];
      messageIds.push(...messages.map(msg => msg.id!));
      pageToken = response.data.nextPageToken;

      if (!pageToken) break; // No more pages, exit the loop
    }

    const currentFetchTime = Date.now();
    return { messageIds, currentFetchTime };
  } catch (err) {
    console.error('Error fetching emails:', err);
    throw err;
  }
}

export const POST = async (req: NextRequest) => {
  try {
    const { token, userId, lastFetchTime } = await req.json();

    if (!token || !userId) {
      return NextResponse.json({ success: false, error: 'Missing token or userId parameter' }, { status: 400 });
    }

    // Decode and set credentials
    const decoded = jwt.verify(token, process.env.NEXT_PUBLIC_JWT_SECRET!) as DecodedToken;
    oAuth2Client.setCredentials({ refresh_token: decoded.refreshToken });

    // Check if it's too early to make a request
    if (lastFetchTime) {
      const lastFetchTimeMs = new Date(lastFetchTime).getTime();
      const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
      const currentFetchTime = Date.now();

      if (currentFetchTime - lastFetchTimeMs < oneHour) {
        console.log('Too early to make another request')
        return NextResponse.json({ success: true, message: "Too early to make another request" }, { status: 200 });
      }
    }
    if (scheduler.isUserAlreadyScheduled(userId)) {
      console.log('Request already scheduled for this user')
      return NextResponse.json({ success: true, message: "Request already scheduled for this user" }, { status: 200 });
    }

    // Refresh access token
    const { credentials } = await oAuth2Client.refreshAccessToken();
    oAuth2Client.setCredentials(credentials);

    // Fetch emails
    const { messageIds, currentFetchTime } = await fetchEmails(oAuth2Client, lastFetchTime);

    // Define batch size
    const batchSize = 50;

    if (messageIds.length >= batchSize) {
      // Schedule API requests
      let cumulativeDelay = 0;
      const delayIncrement = 2000; // 2 seconds increment between batches

      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, i + batchSize);

        const requestTime = new Date(Date.now() + cumulativeDelay);

        const request: ApiRequest = {
          id: `fetch-${Date.now()}`, // Unique ID for each request
          method: 'POST', // HTTP method
          url: `${process.env.WEB_SOCKET_URI}/api/APIRequestScheduler/fetchUserMailBoxAddress`, // Endpoint URL
          payload: { messageIds: batch, token, userId }, // Payload containing message IDs
          scheduledTime: requestTime, // Schedule with calculated time
          retryCount: 0,
          maxTries: 10
        };

        scheduler.scheduleRequest(request);
        cumulativeDelay += delayIncrement; // Increment the delay for the next batch
      }

      return NextResponse.json({ success: true, data: { currentFetchTime }, message: "Scheduled fetch successfully" }, { status: 200 });
    } else {
      // Return a success response with a message if message IDs are less than batch size
      console.log('Not enough message IDs to schedule a request. Please try again after some time.')
      return NextResponse.json({
        success: true,
        message: "Not enough message IDs to schedule a request. Please try again after some time."
      }, { status: 200 });
    }
  } catch (error) {
    console.error('Error retrieving emails or refreshing access token:', error);
    return NextResponse.json({ success: false, error: 'Failed to retrieve emails or refresh access token' }, { status: 500 });
  }
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS(req: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders });
}