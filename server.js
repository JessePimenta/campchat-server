import { WebSocketServer } from 'ws';
import { nanoid } from 'nanoid';

const PORT = process.env.PORT || 3000;

// Create WebSocket server with explicit options
const wss = new WebSocketServer({
  port: PORT,
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024
    },
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
    serverMaxWindowBits: 10,
    concurrencyLimit: 10,
    threshold: 1024
  },
  maxPayload: 65536
});

// Track connected clients
const clients = new Map();

// Log server events
wss.on('listening', () => {
  console.log(`WebSocket server listening on port ${PORT}`);
});

wss.on('error', (error) => {
  console.error('WebSocket server error:', error);
});

wss.on('connection', (ws) => {
  const clientId = nanoid();
  const username = `user_${clientId.slice(0, 6)}`;

  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  // Store client info
  clients.set(ws, {
    id: clientId,
    username
  });

  console.log(`Client connected: ${username}`);

  // Send welcome message
  const welcomeMsg = {
    id: nanoid(),
    username: 'system',
    text: `Welcome ${username}!`,
    timestamp: Date.now()
  };
  ws.send(JSON.stringify(welcomeMsg));

  // Broadcast join message
  const joinMsg = {
    id: nanoid(),
    username: 'system',
    text: `${username} joined the chat`,
    timestamp: Date.now()
  };
  broadcast(joinMsg);

  ws.on('message', (data) => {
    try {
      const { text } = JSON.parse(data.toString());
      const message = {
        id: nanoid(),
        username,
        text,
        timestamp: Date.now()
      };
      broadcast(message);
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    const client = clients.get(ws);
    if (client) {
      const leaveMsg = {
        id: nanoid(),
        username: 'system',
        text: `${client.username} left the chat`,
        timestamp: Date.now()
      };
      broadcast(leaveMsg);
      clients.delete(ws);
    }
  });
});

// Heartbeat to keep connections alive
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      clients.delete(ws);
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
});

function broadcast(message) {
  const messageStr = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocketServer.OPEN) {
      client.send(messageStr);
    }
  });
}
