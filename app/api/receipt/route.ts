import { NextRequest, NextResponse } from 'next/server';
import Receipt from '@/middleware/db/Model/receipt/Receipt'; // Adjust import path as needed
import connectDb from '@/middleware/db/mongoose';

// Transparent 1x1 GIF
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAACH5BAEAAAAAIf8LVwK8AI0dF4GiECg1ol0aKko2wq28sb33nBhnBeHDKlPf/3Kh5ovfwAs8xWDSqgyLCIIAdhCUdT8ovkA0Hp9foWbAM7cA03oFJj2F0tbU3H11wC/sLYDrpPbzKnI5oyroDAAAAC6wG7wEgqK8BmyBEyMuIHhF5dK3jNPSZCUt6MsH99rIk68OwLru+u2rtGm80E7wMLFszdDPTi2c8tCU5k1vJr7Ad2f8UR6hd3qaVuSJE2DOg1hrkBh+z4RTMWyKjilMYCeFGGJeFTKWiKoB4rIGC/yf6n2Oj+4lkb10GvZT4Qm7w/fZ5/yogNhT+G/lSkLQy5P3nT/8t+HAED3M1KqPgsO2eXi5hHc4Uu7HvX19n0Uj9jP1tZswaWWzo8G6fydD6Vj/ZKrIj0rABTMyEgHkEg9khhNsc7M2hoZpjcHiaGCDIwOBq0yStBlIggwQBEeibgPKHg8kKkCQgwkEADyzFj4GggQJABQ6tVZkrIxIzP+LfRJoHFLk+jpyS5M+chzIlwUGNiYkEJEAELBMiEq+ZrTAPLg2NYjAjFB5etE1tqEGtH5sBBIJgpqgNGXy5z4/gU9jAOABka5G7T++roBBmSJSZZWmg1MjZktAByBBaM2Tj5phuGsCzFZjMiXB3aXBqM5MmY1mGozadkQgqReAg2fFkaLP2dMBmAs6wAZSRg1HV6OaFkKBDXikSaj5F4rChOX5SnD4gMQAjgUNKhYp8+xegp0Xg/vB8cJRoJmjvSHFaFJioJTCGsoJiMDJHgAE2jSlRZsHbAwmAJDQO5WRnzYXgACl8Ag3KAkQzA9DDiDNCm8WIA2CmPQuRplg4MSXt6uIBFZYJcAiBwCUeRAk6KaOAVM2i1DJECO+UEyxGgfXhZhggxDo5pQkU8O0Cwhq+JgAnsbQiYxbkCjUBQEiHDmTFBpxIp8eAKFMwnq2bH9gAAe6bw5N1D04vFEOI5q6nEBjWE5BWgL8BOIH+2InRBwZSTYMrqDtQEB43HPAk2Ba8AAeFq0tV5hdK0QIc2cH7M7EDKw5ZkQix7wyF6HTr5xqntqIShOjPxkkjwiqTcfguJOPX0/HDytpAA3O/4nXy4sX8aXqEesqaH1VJp4GqcAk7khZ8NN2s/lc8dVh0H7MCEiqkH9tBdUcgQk1V/Ho3HDX5u9vY8Ih8J48tZnGEx0gyXEosrI4REpeccDURZbdHhF2jowqZYB5dE5PXYOHfWo1F1iEK80tA4hCqNYhzPCeQCq0sbAzzrTrLgD4OADuIfSthRDlChgQPMVdJJyA/YhBGkW9NKlD8J3PAEJib5DSu2CAz2xBNDiq/yztAAIA5aGYAQABkX4AAuI8GEnqNDFRMx/fzFfHlqshpyCJkhWmA+PZGi0jHFAuAeSY+FQiV/A5ehR0AB04G6SYIaCCOBg3eNG9F8rYhn00bmQA2cNsC+kFjEZz/mEQDAJ4BWmYTCZSTFfc7DsYosI2lB7h8QQJrGJSA8l2AxOxlgwCQf3r5O5LmaTSAQ3DoB4F7M07iI00GqI0Uge67Ml7hFjcHHfiyHMBM08jIYNJ7JznXAZe1bJahMkGr8xzNDKtqfoATYZRoAHPkQD/wM2kP7plmfQMD3HRJkBsgXkV5pJKg0kQjLTNOgks4BKL4W1tk06Kk9kC2ArDhYDP/89JrAkk6e',
  'base64'
);

export const GET = connectDb(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const GUID = url.searchParams.get('GUID');

    if (!GUID) {
      return NextResponse.json({ success: false, error: 'GUID parameter is missing' });
    }

    // Find the receipt by GUID and update its status
    const receipt = await Receipt.findOneAndUpdate(
      { GUID },
      { status: true },
      { new: true, upsert: true } // upsert creates a new document if no matching document is found
    );

    if (!receipt) {
      return NextResponse.json({ success: false, error: 'Receipt not found' });
    }

    // Send a transparent 1x1 GIF
    return new NextResponse(TRACKING_PIXEL, {
      headers: {
        'Content-Type': 'image/gif',
        'Content-Length': `${TRACKING_PIXEL.length}`,
      },
    });
  } catch (error) {
    console.error('Error handling tracking pixel request:', error);
    return NextResponse.json({ success: false, error: 'Failed to process tracking pixel request' });
  }
});
