import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { initialConnectDb } from './middleware/db/mongoose';
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();


interface Users {
  [userId: string]: string[];
}

const users: Users = {}; // To store mapping of userId to an array of socket ids

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('New client connected');

    // Register userId with socket id
    socket.on('registerUser', (userId: string) => {
      if (!users[userId]) {
        users[userId] = [];
      }
      users[userId].push(socket.id);
      console.log(`User ${userId} registered with socket id ${socket.id}`);
    });

    // Handle client disconnection
    socket.on('disconnect', () => {
      for (const userId in users) {
        const index = users[userId].indexOf(socket.id);
        if (index !== -1) {
          users[userId].splice(index, 1);
          console.log(`User ${userId} with socket id ${socket.id} disconnected`);
          // If no sockets left for the user, remove the user entry
          if (users[userId].length === 0) {
            delete users[userId];
          }
          break;
        }
      }
    });
  });


  // Store the io instance so it can be used in API routes
  (global as any).io = io;
  (global as any).users = users;

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`> WebSocket server ready on http://localhost:${PORT}`);
  });
});
