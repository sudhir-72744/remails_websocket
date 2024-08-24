import { NextResponse, NextRequest } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { google, gmail_v1 } from 'googleapis';
import jwt from 'jsonwebtoken';
import { initialConnectDb } from '@/middleware/db/mongoose';
import User from '@/middleware/db/Model/user/User';
import { isDuplicate } from '@/utils/cache';

const oAuth2Client = new OAuth2Client(
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET!
);

let isDbConnected = false;

async function connectDbIfNeeded() {
  if (!isDbConnected) {
    await initialConnectDb();
    isDbConnected = true;
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDbIfNeeded();
    const body = await req.json();

    // Decode the base64-encoded data
    const decodedData = JSON.parse(Buffer.from(body.message.data, 'base64').toString());
    const { emailAddress } = decodedData;

    if (isDuplicate(emailAddress)) {
      console.log('Duplicate notification received within 20ms, skipping processing');
      return NextResponse.json({ message: 'Duplicate notification skipped' }, { status: 200 });
    }

    console.log(decodedData);
    const user = await User.findOne({ email: emailAddress });

    const { userId, historyId, refreshToken } = user;

    const postData = {
      userId,
      historyId,
      decodedData
    };

    // Send the decoded data to another endpoint
    const res = await fetch(`${process.env.WEB_SOCKET_URI}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postData),
    });

    if (!res.ok) {
      throw new Error('Failed to forward the decoded data');
    } else {
      console.log("forwarded message");
    }

    return NextResponse.json({}, { status: 200 });

  } catch (error) {
    console.error('Error processing Pub/Sub message:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Keep the GET method if you need it for other purposes
export async function GET(req: NextRequest) {
  console.log('Received Pub/Sub message:', req);
  return NextResponse.json({}, { status: 200 });
}
