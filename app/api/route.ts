import { NextRequest, NextResponse } from 'next/server';
import Cors from 'cors';

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  
  export async function OPTIONS(req: NextRequest) {
    return NextResponse.json({}, { headers: corsHeaders });
  }

// Handler for POST requests
export const POST = async (req: NextRequest) => {



    
    return NextResponse.json({ success: true, data:  "" , message: "test Sucessful" }, { status: 200 });
  
};
