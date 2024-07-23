import { NextRequest, NextResponse } from 'next/server';


export const POST = async (req: NextRequest) => {

  const { decodedData,userId } = await req.json();
  const newHistoryId = decodedData.historyId;
  const email = decodedData.emailAddress;

  try {
   
    
    const io = (global as any).io;
    const users = (global as any).users;

    if (io) {
      const socketId = users[userId];
      if (socketId) {
        io.to(socketId).emit('newEmail', {userId,email,newHistoryId});
        console.log(`Notification emitted to user ${userId}`);
      } else {
        console.warn(`No client registered for user ${userId}`);
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
