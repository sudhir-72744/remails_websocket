import { NextRequest, NextResponse } from 'next/server';
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS(req: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders });
}


export const POST = async (req: NextRequest) => {

  const { decodedData,userId } = await req.json();
  const newHistoryId = decodedData.historyId;
  const email = decodedData.emailAddress;

  try {
   
    
    const io = (global as any).io;
    const users = (global as any).users;

    if (io) {
      const socketIds = users[userId];
      for (const socketId in socketIds) {
        if (socketId) {
          io.to(socketId).emit('newEmail', {userId,email,newHistoryId});
          console.log(`Notification emitted to user ${userId} with soket id ${socketId}`);
        } else {
          console.warn(`No client registered for user ${userId}`);
        }
      }
    } else {
      console.warn('Socket.IO server not initialized');
    }



    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('Error handling notification', error);
    return NextResponse.json({ success: false, error: 'Failed to handle notification' }, { status: 500 });
  }
};

export const GET = async (req: NextRequest) => {
  return NextResponse.json({ success: false, message: 'Req not allowed' }, { status: 200 });
};
