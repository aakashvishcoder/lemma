import express from 'express';
import cors from 'cors';
import { documentsRouter } from './routes/documents';
import { authRouter } from './routes/auth';
import { requireAuth } from './middleware/auth';
import { roomsRouter } from './routes/rooms';
import { runRouter } from './routes/run';

export const app = express();

// Behind a reverse proxy (Render), req.ip is the proxy unless Express is told
// how many hops to trust. Only turn this on when actually behind one, since
// otherwise clients could spoof X-Forwarded-For to dodge the rate limiter.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY));
}

// Unset (local dev) allows any origin; in production set it to the site's URL.
app.use(cors({ origin: process.env.CORS_ORIGIN ?? true }));
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/documents', requireAuth, documentsRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/run', requireAuth, runRouter);
app.get('/health', (req, res)=> res.json({status: 'ok'}));