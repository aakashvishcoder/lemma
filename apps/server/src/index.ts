import { createServer } from 'node:http';
import { app } from './app';
import { attachWebSocketServer } from './ws';

const server = createServer(app);
attachWebSocketServer(server);

server.listen(3001, () => console.log('server listening on :3001'));