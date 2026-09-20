import type { Server } from 'node:http';
import { WebSocketServer } from 'ws';
import { joinRoom } from './roomManager';
import { verifyToken } from '../services/authService';
import { isRoomMember } from '../services/roomService';

export function attachWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (req, socket, head) => {
    const url = new URL(req.url ?? '', 'http://localhost');
    const roomId = url.searchParams.get('roomId');
    const token = url.searchParams.get('token');

    if (!roomId || !token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    let userId: string;
    try {
      userId = verifyToken(token).sub;
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    const member = await isRoomMember(userId, roomId);
    if (!member) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    // The WebSocket handshake only completes inside this callback, which
    // runs synchronously after all the async authorization above - so the
    // client's `open` event can never fire before joinRoom() (which attaches
    // the server's message listener) has already run. No race window.
    wss.handleUpgrade(req, socket, head, (ws) => {
      joinRoom(ws, roomId);
    });
  });

  return wss;
}
