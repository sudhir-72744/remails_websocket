import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

interface Users {
  [userId: string]: string;
}

const users: Users = {}; // To store mapping of userId to socket id

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log('New client connected');

    // Register userId with socket id
    socket.on('registerUser', (userId: string) => {
      users[userId] = socket.id;
      console.log(`User ${userId} registered with socket id ${socket.id}`);
    });

    // Handle client disconnection
    socket.on('disconnect', () => {
      // Remove the mapping when the client disconnects
      for (const userId in users) {
        if (users[userId] === socket.id) {
          delete users[userId];
          console.log(`User ${userId} disconnected`);
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
