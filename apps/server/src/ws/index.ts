import type { Server } from 'node:http';
import { WebSocketServer } from 'ws';
import { joinRoom } from './roomManager';

export function attachWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server });
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url ?? '', 'http://localhost');
    const roomId = url.searchParams.get('roomId');
    if (!roomId) {
      ws.close(1008, 'roomId is required');
      return;
    }
    joinRoom(ws, roomId);
  });
  return wss;
}