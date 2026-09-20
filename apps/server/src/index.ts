import { createServer } from 'node:http';
import { app } from './app';
import { attachWebSocketServer } from './ws';

const server = createServer(app);
const PORT = Number(process.env.PORT ?? 3001);
attachWebSocketServer(server);

server.listen(PORT, () => console.log(`server listening on :${PORT}`));