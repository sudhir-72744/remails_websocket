import { NextResponse, NextRequest } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { google, gmail_v1 } from 'googleapis';
import jwt from 'jsonwebtoken';
import connectDb from '@/middleware/db/mongoose'; // Import the middleware
import User from '@/middleware/db/Model/user/User';
import { isDuplicate } from '@/utils/cache';

const oAuth2Client = new OAuth2Client(
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET!
);

interface PostData {
  userId: string;
  newHistoryId: string;
  decodedData: any; // Define a more specific type if possible
}

// Define the type for WebSocket global variables
interface GlobalSocket {
  io?: any; // Use more specific type if known, e.g., SocketIOServer
  users?: { [userId: string]: string[] }; // Map userId to an array of socket IDs
}

declare global {
  var io: any;
  var users: { [userId: string]: string[] };
}

const postHandler = async (req: NextRequest) => {
  try {
    const body = await req.json();

    // Decode the base64-encoded data
    const decodedData = JSON.parse(Buffer.from(body.message.data, 'base64').toString());
    const { emailAddress } = decodedData;

    if (isDuplicate(emailAddress)) {
      console.log('Duplicate notification received within 1000ms, skipping processing');
      return NextResponse.json({ message: 'Duplicate notification skipped' }, { status: 200 });
    }

    const user = await User.findOne({ email: emailAddress });
    

    if (!user) {
      console.error('User not found for email:', emailAddress);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { userId } = user;


    const postData: PostData = {
      userId,
      newHistoryId:decodedData.historyId,
      decodedData
    };

    // Emit the decoded data to the user via WebSocket
    const io = (global as GlobalSocket).io;
    if (io) {
      const socketIds = (global as GlobalSocket).users?.[userId] || [];
      socketIds.forEach((socketId: string) => {
        io.to(socketId).emit('newEmail', postData);
      });
      console.log("Emitted newEmail event to user:", userId);
    } else {
      console.error('WebSocket instance not available');
    }

    return NextResponse.json({}, { status: 200 });

  } catch (error) {
    console.error('Error processing Pub/Sub message:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
};

// Wrap the handler with connectDb middleware
export const POST = connectDb(postHandler);
