import { app} from './app';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { joinRoom } from './ws/roomManager';

const server = createServer(app);
const wss =new WebSocketServer({ server});

wss.on('connection', (ws, req)=> {
    const url = new URL(req.url ?? '', 'http://localhost');
    const roomId = url.searchParams.get('roomId');
    if (!roomId) {
        ws.close(1008, 'roomId is required');
        return;
    }
    joinRoom(ws, roomId);
});

server.listen(3001, () => console.log('server listening on 3001'));