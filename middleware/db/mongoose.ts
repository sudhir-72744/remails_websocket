import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

// Middleware function to connect to the database
const connectDb = (handler: (req: NextRequest) => Promise<NextResponse>) => async (req: NextRequest) => {
  if (mongoose.connections[0].readyState) {
    console.log("Already connection exists, using existing connection");
    return handler(req);
  }
  
  const dbUri = process.env.NEXT_PUBLIC_MONGO_URL;
  if (!dbUri) {
    throw new Error("MONGO_URI environment variable is not defined");
  }
  console.log("No connection exists, trying to connect");
  
  // Connect to MongoDB with the specified database name
  await mongoose.connect(dbUri, { dbName: 'remails' });
  console.log("Connected to DB");
  return handler(req);
};

// Function to initialize the database connection without a request
const initialConnectDb = async () => {
  if (mongoose.connections[0].readyState) {
    console.log("This is initial connect");
    return;
  }
  
  const dbUri = process.env.NEXT_PUBLIC_MONGO_URL;
  if (!dbUri) {
    throw new Error("MONGO_URI environment variable is not defined");
  }
  console.log("No connection exists, trying to connect");
  
  // Connect to MongoDB with the specified database name
  await mongoose.connect(dbUri, { dbName: 'remails' });
  console.log("Connected to DB");
};

export { initialConnectDb };
export default connectDb;
